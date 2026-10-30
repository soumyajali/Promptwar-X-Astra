"""CivicPulse assistant: intent recognition + structured queries over stored data.

Every answer is computed from the database at request time. Each intent maps to a query
function that returns the answer text, the report/hotspot items it used and evidence lines.
Unrecognised questions get an honest "I can't answer that from the data" reply.

An optional language-model layer (services/llm.py) may rephrase the answer when an API key is
configured; it only ever sees these computed facts and falls back to the local text on any error.
"""
from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, timedelta, timezone

from .. import config, repository as rp
from ..config import CATEGORIES, DEPARTMENTS, OPEN_STATUSES
from .analytics import metrics, workload
from .geo import haversine_m
from .hotspots import detect_hotspots
from .text import normalize

CATEGORY_WORDS = {
    "roads": ["road", "roads", "pothole", "potholes"],
    "waterlogging": ["waterlogging", "flood", "flooding", "flooded", "waterlogged"],
    "garbage": ["garbage", "waste", "trash", "sanitation", "dustbin"],
    "streetlights": ["streetlight", "streetlights", "street light", "lights", "lighting", "lamp"],
    "drainage": ["drain", "drains", "drainage", "sewage", "sewer", "manhole"],
    "public_safety": ["safety", "crime", "unsafe", "theft"],
    "water_supply": ["water supply", "supply", "pipeline", "tap", "drinking water"],
}
STATUS_WORDS = {
    "in_progress": ["in progress", "ongoing", "being fixed", "work started"],
    "under_review": ["under review", "being reviewed"],
    "resolved": ["resolved", "fixed", "closed", "completed", "done"],
    "rejected": ["rejected", "declined"],
    "submitted": ["new reports", "just submitted", "not yet reviewed"],
}
GREETING = re.compile(r"^(hi|hello|hey|hai|namaste|namaskara|good (morning|afternoon|evening)|yo)\b")
THANKS = re.compile(r"\b(thanks|thank you|thx|ty|great|cool|ok|okay)\b")
HELP = ["what can you do", "help", "how do you work", "what can i ask", "who are you", "what are you"]
FOLLOW_UP = re.compile(r"^(and|what about|how about|also|same for|and in|and for)\b")
REPORT_ID = re.compile(r"\bcp-[a-z0-9]{6}\b")
PLACE = re.compile(r"\b(?:near|around|at|close to|by)\s+(?:the\s+)?([a-z0-9][a-z0-9 ,'-]{2,60})")
WARD = re.compile(r"\b([a-z]+) ward\b")

SUGGESTIONS = [
    "Which area needs attention first?",
    "How many critical complaints are pending?",
    "Show all hotspots",
    "List unassigned reports",
    "How many reports came in today?",
    "Show recurring drainage complaints",
    "Which complaints are likely duplicates?",
    "Which department has the most assigned work?",
]


def _local_now() -> datetime:
    return datetime.now(timezone.utc) + timedelta(minutes=config.TZ_OFFSET_MIN)


def _created_local(r: dict) -> datetime:
    return datetime.fromisoformat(r["created_at"]).replace(tzinfo=timezone.utc) + timedelta(minutes=config.TZ_OFFSET_MIN)


def time_scope(q: str) -> tuple[datetime | None, datetime | None, str | None]:
    """Return (start, end, label) in local time for phrases like today / yesterday / this week / last 3 days."""
    now = _local_now()
    midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if re.search(r"\btoday\b|\bthis morning\b", q):
        return midnight, None, "today"
    if re.search(r"\byesterday\b", q):
        return midnight - timedelta(days=1), midnight, "yesterday"
    if re.search(r"\bthis week\b", q):
        return midnight - timedelta(days=now.weekday()), None, "this week"
    m = re.search(r"\b(?:last|past)\s+(\d{1,2})\s+days?\b", q)
    if m:
        n = int(m.group(1))
        return now - timedelta(days=n), None, f"in the last {n} days"
    if re.search(r"\b(?:last|past) week\b", q):
        return now - timedelta(days=7), None, "in the last 7 days"
    return None, None, None


def _in_scope(r: dict, start, end) -> bool:
    if start is None:
        return True
    t = _created_local(r)
    return t >= start and (end is None or t < end)


def _detect_category(q: str) -> str | None:
    for cat, words in CATEGORY_WORDS.items():
        for w in words:
            if re.search(rf"\b{re.escape(w)}\b", q):
                return cat
    return None


def _detect_status(q: str) -> str | None:
    for st, words in STATUS_WORDS.items():
        if any(w in q for w in words):
            return st
    return None


def _detect_place(q: str, reports: list[dict]) -> str | None:
    m = PLACE.search(q)
    if not m:
        return None
    place = re.sub(r"\b(please|now|today|right now)\b", "", m.group(1)).strip(" ,.?")
    return place or None


INTENTS: dict[str, list[str]] = {
    "duplicates": ["duplicate", "duplicates", "same complaint", "same problem", "linked", "repeated report"],
    "attention": ["attention first", "which area", "worst area", "need attention", "needs attention", "most urgent area"],
    "hotspots": ["hotspot", "hotspots", "cluster", "clusters", "nearby", "near ", "around ", "problem areas"],
    "today": ["prioritize", "prioritise", "priority list", "focus on", "plan for", "do first", "should authorities", "should we"],
    "critical": ["critical", "urgent", "emergency", "dangerous"],
    "unassigned": ["unassigned", "not assigned", "no department", "without a department", "without department", "nobody assigned"],
    "department": ["department", "workload", "assigned work", "busiest", "team load"],
    "common": ["most common", "common issue", "most frequent", "top issue", "top category", "most reported"],
    "recurring": ["recurring", "repeat", "again and again", "keeps happening"],
    "resolution": ["resolution rate", "how fast", "average time", "resolution time", "how long to fix"],
    "count": ["how many", "number of", "total", "count", "came in", "received"],
    "status_list": ["in progress", "under review", "resolved", "rejected", "being fixed"],
    "list": ["show", "list", "which", "what are"],
}


def detect_intent(question: str, context: dict | None = None) -> tuple[str, float, dict]:
    q = normalize(question)
    reports_cache: list[dict] = []
    slots: dict = {"category": _detect_category(q), "status": _detect_status(q)}
    start, end, label = time_scope(q)
    if label:
        slots["scope"] = label
    m = REPORT_ID.search(q)
    if m:
        slots["report_id"] = m.group(0).upper()
        return "lookup", 1.0, slots
    wm = WARD.search(q)
    if wm and wm.group(1) not in ("which", "each", "every", "the", "a", "per", "my", "this", "that"):
        slots["ward"] = wm.group(1).title() + " Ward"
    place = _detect_place(q, reports_cache)
    if place and not slots.get("ward"):
        slots["place"] = place

    # Follow-ups reuse the previous question's filters and intent ("and in Market Ward?").
    if context and FOLLOW_UP.search(q):
        for k in ("category", "ward", "scope", "status"):
            if not slots.get(k) and context.get(k):
                slots[k] = context[k]
        if context.get("intent") and not any(k in q for keys in INTENTS.values() for k in keys if k not in ("show", "list", "which", "what are")):
            return context["intent"], 0.6, slots

    if GREETING.search(q) and len(q.split()) <= 4:
        return "greeting", 1.0, slots
    if any(h in q for h in HELP):
        return "help", 1.0, slots
    if THANKS.search(q) and len(q.split()) <= 4:
        return "thanks", 1.0, slots

    scores = {intent: sum(1.0 + 0.25 * len(k.split()) for k in keys if k in f" {q} ") for intent, keys in INTENTS.items()}
    if slots.get("place"):
        scores["hotspots"] += 1.5
    if slots.get("ward"):
        scores["ward"] = scores.get("ward", 0) + 2
    if slots.get("scope") and scores["count"] == 0 and scores["list"] == 0:
        scores["count"] += 1
    if scores["critical"] and scores["count"]:
        scores["critical"] += 1
    if scores["unassigned"]:
        scores["unassigned"] += 1
    if scores["status_list"] and not scores["count"]:
        scores["status_list"] += 0.5
    if slots.get("category") and not any(v for k, v in scores.items() if k not in ("list", "count")):
        scores["category"] = 1.5
    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return "unknown", 0.0, slots
    if best == "list":
        best = "category" if slots.get("category") else "status_list" if slots.get("status") else "critical" if "report" in q else "unknown"
    total = sum(v for v in scores.values() if v > 0)
    return best, round(scores.get(best, 1) / total, 2) if total else 0.5, slots


def _ref(r: dict) -> dict:
    return {"id": r["id"], "label": CATEGORIES[r["category"]], "location": r["location_text"],
            "level": r["priority_level"], "score": r["priority_score"], "status": r["status"]}


def _hs_ref(h: dict) -> dict:
    return {"id": h["id"], "label": f"Hotspot · {h['dominant_label']}", "location": h["location"],
            "level": "critical" if h["critical_count"] else "high", "score": h["score"], "status": f"{h['count']} open reports"}


def _filter(reports: list[dict], slots: dict, *, open_only: bool) -> list[dict]:
    start, end, _ = time_scope(slots.get("scope") or "") if slots.get("scope") else (None, None, None)
    out = []
    for r in reports:
        if open_only and r["status"] not in OPEN_STATUSES:
            continue
        if slots.get("category") and r["category"] != slots["category"]:
            continue
        if slots.get("ward") and (r.get("ward") or "").lower() != slots["ward"].lower():
            continue
        if slots.get("status") and r["status"] != slots["status"]:
            continue
        if not _in_scope(r, start, end):
            continue
        out.append(r)
    return out


def _scope_words(slots: dict) -> str:
    bits = []
    if slots.get("category"):
        bits.append(CATEGORIES[slots["category"]].lower())
    words = " ".join(bits)
    tail = []
    if slots.get("ward"):
        tail.append(f"in {slots['ward']}")
    if slots.get("scope"):
        tail.append(slots["scope"] if slots["scope"].startswith("in ") else f"({slots['scope']})" if slots["scope"] in ("today", "yesterday", "this week") else slots["scope"])
    return (words + " " if words else "") + "|" + " ".join(tail)


def _match_place(place: str, reports: list[dict], hotspots: list[dict]):
    """Find the stored location the user means, by word overlap with report locations and ward names."""
    words = [w for w in re.findall(r"[a-z0-9]+", place) if len(w) > 2 and w not in ("the", "and", "road", "near")]
    if not words:
        return None
    best, best_n = None, 0
    for r in reports:
        if r.get("lat") is None:
            continue
        hay = f"{r['location_text']} {r.get('ward') or ''}".lower()
        n = sum(1 for w in words if w in hay)
        if n > best_n:
            best, best_n = r, n
    if not best:
        return None
    matched = [r for r in reports if r.get("lat") is not None and sum(1 for w in words if w in f"{r['location_text']} {r.get('ward') or ''}".lower()) == best_n]
    lat = sum(r["lat"] for r in matched) / len(matched)
    lng = sum(r["lng"] for r in matched) / len(matched)
    return {"name": best["location_text"], "lat": lat, "lng": lng}


def answer(question: str, context: dict | None = None) -> dict:
    question = (question or "").strip()
    if not question:
        return {"intent": "empty", "confidence": 0, "answer": "Type a question about the reports, for example “How many critical complaints are pending?”",
                "evidence": [], "items": [], "slots": {}, "suggestions": SUGGESTIONS[:4]}
    reports = rp.list_reports()
    intent, conf, slots = detect_intent(question, context)
    q = normalize(question)
    open_r = [r for r in reports if r["status"] in OPEN_STATUSES]
    items: list[dict] = []
    evidence: list[str] = []
    suggestions: list[str] = []
    text = ""

    if intent == "greeting":
        m = metrics(reports)
        text = (f"Hello. I answer questions about the {m['total']} reports stored in CivicPulse: right now {m['open']} are open "
                f"and {m['critical_open']} of those are critical. Ask about priorities, hotspots, departments, duplicates or a report ID.")
        suggestions = SUGGESTIONS[:4]
    elif intent == "help":
        text = ("I look up and count the reports stored in CivicPulse. I can tell you what is critical, which areas are hotspots, "
                "what to prioritise today, department workload, unassigned or duplicate reports, counts for today or this week, "
                "and the status of any report ID like CP-S794U7. I don't make up figures: every number comes from the database.")
        suggestions = SUGGESTIONS[:6]
    elif intent == "thanks":
        text = "You're welcome. Ask another question whenever you need."
        suggestions = SUGGESTIONS[:3]
    elif intent == "lookup":
        r = next((x for x in reports if x["id"] == slots["report_id"]), None)
        if not r:
            text = f"No report with ID {slots['report_id']} exists in the database."
        else:
            text = (f"{r['id']} is a {CATEGORIES[r['category']].lower()} report at {r['location_text']}, "
                    f"status {r['status'].replace('_', ' ')}, priority {r['priority_level']} ({r['priority_score']}/100)"
                    + (f", assigned to {DEPARTMENTS[r['department']]}" + (f" ({r['officer']})" if r.get("officer") else "") + "." if r.get("department") else ", not yet assigned."))
            items = [_ref(r)]
    elif intent == "critical":
        crit = sorted([r for r in _filter(reports, slots, open_only=True) if r["priority_level"] == "critical"], key=lambda r: -r["priority_score"])
        scope, tail = _scope_words(slots).split("|")
        unassigned = [r for r in crit if not r.get("department")]
        text = f"{len(crit)} critical {scope}complaints are pending{(' ' + tail) if tail else ''}."
        if crit:
            text += f" {len(unassigned)} have no department yet. Highest: {crit[0]['id']} at {crit[0]['location_text']} ({crit[0]['priority_score']}/100)."
        items = [_ref(r) for r in crit[:8]]
        evidence = [f"Open = {', '.join(s.replace('_', ' ') for s in OPEN_STATUSES)}; critical = priority score ≥ 70"]
        suggestions = ["List unassigned reports", "Which area needs attention first?"]
    elif intent == "unassigned":
        rows = sorted([r for r in _filter(reports, slots, open_only=True) if not r.get("department")], key=lambda r: -r["priority_score"])
        scope, tail = _scope_words(slots).split("|")
        text = f"{len(rows)} open {scope}reports have no department assigned{(' ' + tail) if tail else ''}."
        if rows:
            crit = sum(1 for r in rows if r["priority_level"] == "critical")
            text += f" {crit} of them are critical. Highest first: " + ", ".join(f"{r['id']} ({r['priority_score']})" for r in rows[:4]) + "."
        items = [_ref(r) for r in rows[:10]]
        suggestions = ["Which department has the most assigned work?"]
    elif intent in ("hotspots", "attention"):
        hs = detect_hotspots(reports)
        place = slots.get("place")
        target = _match_place(place, reports, hs) if place else None
        if place and not target:
            text = f"I couldn't find a stored location matching “{place}”. "
            if hs:
                text += f"The current hotspots are: " + "; ".join(f"{h['id']} {h['location']} ({h['count']} reports)" for h in hs) + "."
            items = [_hs_ref(h) for h in hs]
        elif target:
            ranked = sorted(hs, key=lambda h: haversine_m(target["lat"], target["lng"], h["lat"], h["lng"]))
            near = [h for h in ranked if haversine_m(target["lat"], target["lng"], h["lat"], h["lng"]) <= 1500]
            nearby_reports = sorted([r for r in open_r if r.get("lat") is not None and haversine_m(target["lat"], target["lng"], r["lat"], r["lng"]) <= 400],
                                    key=lambda r: -r["priority_score"])
            if near:
                h = near[0]
                d = haversine_m(target["lat"], target["lng"], h["lat"], h["lng"])
                text = (f"Nearest hotspot to {target['name']} is {h['id']} {h['location']}, about {d:.0f} m away: {h['count']} open reports, "
                        f"{h['critical_count']} critical, mostly {h['dominant_label'].lower()}.")
                if len(near) > 1:
                    text += " Also within 1.5 km: " + ", ".join(f"{x['id']} {x['location']}" for x in near[1:3]) + "."
                items = [_hs_ref(x) for x in near[:3]]
                evidence.append(h["reason"])
            else:
                text = f"There is no hotspot within 1.5 km of {target['name']}."
            text += f" {len(nearby_reports)} open reports lie within 400 m of it."
            items += [_ref(r) for r in nearby_reports[:5]]
        elif not hs:
            text = "There are no hotspots right now: no group of 3 or more open reports lies within 350 m."
        elif intent == "attention":
            h = hs[0]
            text = (f"{h['location']} ({h['ward']}) needs attention first: hotspot {h['id']} with {h['count']} open reports, "
                    f"{h['critical_count']} critical, mostly {h['dominant_label'].lower()}. Suggested: {h['intervention'].lower()}.")
            items = [_hs_ref(h)]
            evidence.append(h["reason"])
            suggestions = ["Show all hotspots", "What should authorities prioritize today?"]
        else:
            text = f"{len(hs)} hotspots, highest risk first: " + "; ".join(
                f"{h['id']} {h['location']} — {h['count']} reports, {h['critical_count']} critical" for h in hs) + "."
            items = [_hs_ref(h) for h in hs]
            evidence.append("DBSCAN clustering of open reports: 350 m radius, at least 3 reports.")
            suggestions = ["Which hotspots are near the bus stand?", "Which area needs attention first?"]
    elif intent == "today":
        hs = detect_hotspots(reports)
        top = sorted([r for r in open_r if r["priority_level"] in ("critical", "high")], key=lambda r: -r["priority_score"])[:5]
        crit_unassigned = sorted([r for r in open_r if r["priority_level"] == "critical" and not r.get("department")], key=lambda r: -r["priority_score"])
        parts = []
        if crit_unassigned:
            parts.append(f"First assign the {len(crit_unassigned)} critical report(s) with no department: {', '.join(r['id'] for r in crit_unassigned[:4])}.")
        if hs:
            parts.append(f"Then the top hotspot {hs[0]['id']} {hs[0]['location']} ({hs[0]['count']} open reports).")
        if top:
            parts.append("Highest priority scores: " + ", ".join(f"{r['id']} ({r['priority_score']})" for r in top) + ".")
        text = " ".join(parts) if parts else "There are no open critical or high-priority reports."
        items = [_ref(r) for r in (crit_unassigned[:3] + [r for r in top if r not in crit_unassigned])[:6]]
        evidence.append("Order: unassigned critical reports, then the top hotspot, then highest priority scores.")
    elif intent == "department":
        load = [d for d in workload(reports) if d["open"]]
        if not load:
            text = "No department has open assigned work right now."
        else:
            d = load[0]
            text = f"{d['label']} has the most assigned open work: {d['open']} reports ({d['critical']} critical, {d['in_progress']} in progress)."
            evidence = [f"{x['label']}: {x['open']} open" for x in load]
        unassigned = sum(1 for r in open_r if not r.get("department"))
        if unassigned:
            text += f" {unassigned} open reports are still unassigned."
            suggestions = ["List unassigned reports"]
    elif intent == "common":
        pool = _filter(reports, {**slots, "category": None}, open_only="open" in q or "pending" in q)
        c = Counter(r["category"] for r in pool)
        scope, tail = _scope_words({**slots, "category": None}).split("|")
        if not c:
            text = f"There are no reports{(' ' + tail) if tail else ''}."
        else:
            (top, n), *rest = c.most_common()
            text = f"The most common issue{(' ' + tail) if tail else ''} is {CATEGORIES[top]}: {n} of {len(pool)} reports."
            if rest:
                text += " Next: " + ", ".join(f"{CATEGORIES[k]} ({v})" for k, v in rest[:3]) + "."
            evidence = [f"{CATEGORIES[k]}: {v}" for k, v in c.most_common()]
    elif intent == "duplicates":
        linked = [r for r in reports if r.get("primary_report_id") and (not slots.get("category") or r["category"] == slots["category"])]
        groups: dict[str, list[str]] = {}
        for r in linked:
            groups.setdefault(r["primary_report_id"], []).append(r["id"])
        if not groups:
            text = "No reports are currently linked as likely duplicates."
        else:
            big = sorted(groups.items(), key=lambda kv: -len(kv[1]))
            text = (f"{len(linked)} reports are linked as likely duplicates across {len(groups)} groups. "
                    f"Largest: {big[0][0]} with {len(big[0][1])} linked report(s): {', '.join(big[0][1][:5])}.")
            byid = {r["id"]: r for r in reports}
            items = [_ref(byid[p]) for p, _ in big[:6] if p in byid]
            evidence = ["Links use TF-IDF text similarity, category, distance (≤500 m) and time (≤14 days). Reports are never deleted."]
    elif intent == "resolution":
        m = metrics(reports)
        text = f"{m['resolved']} reports resolved; resolution rate {m['resolution_rate']}% (resolved ÷ resolved + open, rejected excluded)."
        text += (f" Average resolution time {m['avg_resolution_hours']} hours." if m["avg_resolution_hours"] is not None
                 else f" Average time not shown: {m['avg_resolution_note'].lower()}.")
    elif intent == "status_list" and slots.get("status"):
        rows = sorted(_filter(reports, slots, open_only=False), key=lambda r: -r["priority_score"])
        scope, tail = _scope_words(slots).split("|")
        label = slots["status"].replace("_", " ")
        text = f"{len(rows)} {scope}reports are {label}{(' ' + tail) if tail else ''}."
        if rows:
            text += " " + ", ".join(f"{r['id']} ({r['location_text']})" for r in rows[:4]) + ("…" if len(rows) > 4 else ".")
        items = [_ref(r) for r in rows[:10]]
    elif intent == "ward" and slots.get("ward"):
        w = slots["ward"]
        if not any((r.get("ward") or "").lower() == w.lower() for r in reports):
            text = f"There is no data for “{w}”. Known wards: " + ", ".join(sorted({r['ward'] for r in reports if r.get('ward')})) + "."
        else:
            mine = _filter(reports, slots, open_only=True)
            scope, tail = _scope_words(slots).split("|")
            c = Counter(r["category"] for r in mine)
            text = (f"{w} has {len(mine)} open {scope}reports" + (f", mostly {CATEGORIES[c.most_common(1)[0][0]].lower()}" if c and not slots.get("category") else "")
                    + f"; {sum(1 for r in mine if r['priority_level'] == 'critical')} critical.")
            items = [_ref(r) for r in sorted(mine, key=lambda r: -r["priority_score"])[:6]]
    elif intent in ("recurring", "category") and slots.get("category"):
        cat = slots["category"]
        mine = _filter(reports, slots, open_only=False)
        open_m = [r for r in mine if r["status"] in OPEN_STATUSES]
        places = Counter(r["location_text"] for r in open_m)
        repeat = [(p, n) for p, n in places.most_common() if n >= 2]
        scope, tail = _scope_words(slots).split("|")
        text = f"{len(mine)} {CATEGORIES[cat].lower()} reports{(' ' + tail) if tail else ''}, {len(open_m)} open."
        text += (" Recurring at: " + ", ".join(f"{p} ({n})" for p, n in repeat[:3]) + ".") if repeat else " No location has two or more open reports of this kind."
        items = [_ref(r) for r in sorted(open_m, key=lambda r: -r["priority_score"])[:8]]
    elif intent == "count":
        rows = _filter(reports, slots, open_only=False)
        scope, tail = _scope_words(slots).split("|")
        o = sum(1 for r in rows if r["status"] in OPEN_STATUSES)
        res = sum(1 for r in rows if r["status"] == "resolved")
        crit = sum(1 for r in rows if r["status"] in OPEN_STATUSES and r["priority_level"] == "critical")
        if slots.get("scope"):
            text = f"{len(rows)} {scope}reports were received {slots['scope']}: {o} still open, {res} resolved, {crit} critical and open."
        else:
            text = f"{len(rows)} {scope}reports in total{(' ' + tail) if tail.strip() else ''}: {o} open, {res} resolved, {crit} open and critical."
        items = [_ref(r) for r in sorted(rows, key=lambda r: r["created_at"], reverse=True)[:6]]
        if slots.get("scope"):
            evidence.append(f"Counted by submission time in local time (UTC{config.TZ_OFFSET_MIN // 60:+d}:{config.TZ_OFFSET_MIN % 60:02d}).")
    else:
        intent = "unknown"
        text = ("I can only answer questions about the stored reports, and I didn't recognise this one. "
                "Try one of the suggestions below, or ask about a report ID like CP-S794U7.")
        suggestions = SUGGESTIONS[:5]

    public_slots = {k: v for k, v in slots.items() if v}
    public_slots["intent"] = intent
    return {"intent": intent, "confidence": conf, "slots": public_slots, "answer": text, "evidence": evidence,
            "items": items, "suggestions": suggestions, "source": f"Computed from {len(reports)} stored reports"}
