"""CivicPulse assistant: intent recognition + structured queries over stored data.

It never generates free text from a language model. Each intent maps to a query function that
returns an answer built only from database values, plus the evidence (report IDs / numbers) used.
Unrecognised questions get an honest "I can't answer that from the data" response.
"""
from __future__ import annotations

import re
from collections import Counter

from ..config import CATEGORIES, DEPARTMENTS, OPEN_STATUSES
from .. import repository as rp
from .analytics import metrics, workload
from .hotspots import detect_hotspots
from .text import normalize

CATEGORY_WORDS = {
    "roads": ["road", "roads", "pothole", "potholes"],
    "waterlogging": ["waterlogging", "flood", "flooding", "waterlogged"],
    "garbage": ["garbage", "waste", "trash", "sanitation"],
    "streetlights": ["streetlight", "streetlights", "light", "lights", "lighting"],
    "drainage": ["drain", "drains", "drainage", "sewage", "sewer"],
    "public_safety": ["safety", "crime", "unsafe"],
    "water_supply": ["water supply", "supply", "pipeline", "tap", "drinking"],
}

INTENTS = {
    "lookup": [r"\bcp-[a-z0-9]{6}\b"],
    "duplicates": ["duplicate", "duplicates", "same complaint", "repeated report", "linked"],
    "attention": ["attention first", "which area", "where should", "worst area", "need attention", "needs attention", "hotspot", "hotspots"],
    "today": ["prioritize", "prioritise", "today", "first", "focus", "plan"],
    "critical": ["critical", "urgent", "emergency"],
    "department": ["department", "workload", "team", "assigned work", "busiest"],
    "common": ["most common", "common issue", "most frequent", "top issue", "top category", "most reported"],
    "recurring": ["recurring", "repeat", "again and again", "show"],
    "resolution": ["resolution rate", "resolved", "how fast", "average time", "resolution time"],
    "ward": ["ward"],
    "count": ["how many", "number of", "total", "count"],
}


def _detect_category(q: str) -> str | None:
    for cat, words in CATEGORY_WORDS.items():
        for w in words:
            if re.search(rf"\b{re.escape(w)}\b", q):
                return cat
    return None


def detect_intent(question: str) -> tuple[str, float, dict]:
    q = normalize(question)
    slots = {"category": _detect_category(q)}
    m = re.search(r"\bcp-[a-z0-9]{6}\b", q)
    if m:
        slots["report_id"] = m.group(0).upper()
        return "lookup", 1.0, slots
    wm = re.search(r"\b(\w+) ward\b", q)
    if wm and wm.group(1) not in ("which", "each", "every", "the", "a", "per"):
        slots["ward"] = wm.group(1).title() + " Ward"
    scores = {}
    for intent, keys in INTENTS.items():
        if intent == "lookup":
            continue
        scores[intent] = sum(1.0 + 0.2 * len(k.split()) for k in keys if k in q)
    if slots.get("ward"):
        scores["ward"] = scores.get("ward", 0) + 2
    if slots["category"] and scores.get("recurring", 0) == 0 and not any(scores.values()):
        scores["recurring"] = 1.0
    if scores.get("critical") and scores.get("count"):
        scores["critical"] += 1
    best = max(scores, key=scores.get)
    if scores[best] == 0:
        return "unknown", 0.0, slots
    total = sum(scores.values())
    return best, round(scores[best] / total, 2), slots


def _ref(r: dict) -> dict:
    return {"id": r["id"], "label": CATEGORIES[r["category"]], "location": r["location_text"],
            "level": r["priority_level"], "score": r["priority_score"], "status": r["status"]}


def answer(question: str) -> dict:
    question = (question or "").strip()
    if not question:
        return {"intent": "empty", "confidence": 0, "answer": "Ask a question about the reports, e.g. “How many critical complaints are pending?”", "evidence": [], "items": []}
    reports = rp.list_reports()
    intent, conf, slots = detect_intent(question)
    open_r = [r for r in reports if r["status"] in OPEN_STATUSES]
    cat = slots.get("category")
    items: list[dict] = []
    evidence: list[str] = []

    if intent == "lookup":
        r = next((x for x in reports if x["id"] == slots["report_id"]), None)
        if not r:
            text = f"No report with ID {slots['report_id']} exists in the database."
        else:
            text = (f"{r['id']} is a {CATEGORIES[r['category']].lower()} report at {r['location_text']}, "
                    f"status {r['status'].replace('_', ' ')}, priority {r['priority_level']} ({r['priority_score']}/100)"
                    + (f", assigned to {DEPARTMENTS[r['department']]}." if r.get("department") else ", not yet assigned."))
            items = [_ref(r)]
    elif intent == "critical":
        crit = sorted([r for r in open_r if r["priority_level"] == "critical" and (not cat or r["category"] == cat)], key=lambda r: -r["priority_score"])
        unassigned = [r for r in crit if not r.get("department")]
        scope = f" {CATEGORIES[cat].lower()}" if cat else ""
        text = f"{len(crit)} critical{scope} complaints are pending (open)."
        if crit:
            text += f" {len(unassigned)} have no department assigned. Highest: {crit[0]['id']} at {crit[0]['location_text']} ({crit[0]['priority_score']}/100)."
        items = [_ref(r) for r in crit[:8]]
        evidence = [f"Counted reports with priority=critical and status in {', '.join(OPEN_STATUSES)}"]
    elif intent == "common":
        pool = open_r if "open" in question.lower() or "pending" in question.lower() else reports
        c = Counter(r["category"] for r in pool)
        if not c:
            text = "There are no reports yet."
        else:
            (top, n), *rest = c.most_common()
            text = f"The most common issue is {CATEGORIES[top]} with {n} of {len(pool)} {'open ' if pool is open_r else ''}reports."
            if rest:
                text += " Next: " + ", ".join(f"{CATEGORIES[k]} ({v})" for k, v in rest[:3]) + "."
            evidence = [f"{CATEGORIES[k]}: {v}" for k, v in c.most_common()]
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
    elif intent in ("attention", "today"):
        hs = detect_hotspots(reports)
        crit_unassigned = sorted([r for r in open_r if r["priority_level"] == "critical" and not r.get("department")], key=lambda r: -r["priority_score"])
        parts = []
        if hs:
            h = hs[0]
            parts.append(f"{h['location']} ({h['ward']}) needs attention first: hotspot {h['id']} with {h['count']} open reports, {h['critical_count']} critical, mostly {h['dominant_label'].lower()}.")
            items = [{"id": h["id"], "label": "Hotspot", "location": h["location"], "level": "critical" if h["critical_count"] else "high", "score": h["score"], "status": f"{h['count']} reports"}]
            evidence.append(h["reason"])
        if intent == "today":
            top = sorted([r for r in open_r if r["priority_level"] in ("critical", "high")], key=lambda r: -r["priority_score"])[:5]
            if top:
                parts.append("Today's suggested order by priority score: " + ", ".join(f"{r['id']} ({r['priority_score']})" for r in top) + ".")
                items += [_ref(r) for r in top]
        if crit_unassigned:
            parts.append(f"Also assign {len(crit_unassigned)} critical report(s) with no department: {', '.join(r['id'] for r in crit_unassigned[:4])}.")
        text = " ".join(parts) if parts else "No open hotspots or high-priority reports right now."
    elif intent == "duplicates":
        linked = [r for r in reports if r.get("primary_report_id") and (not cat or r["category"] == cat)]
        groups: dict[str, list[str]] = {}
        for r in linked:
            groups.setdefault(r["primary_report_id"], []).append(r["id"])
        if not groups:
            text = "No reports are currently linked as likely duplicates."
        else:
            big = sorted(groups.items(), key=lambda kv: -len(kv[1]))
            text = f"{len(linked)} reports are linked as likely duplicates across {len(groups)} groups. Largest: {big[0][0]} with {len(big[0][1])} linked report(s): {', '.join(big[0][1][:5])}."
            byid = {r["id"]: r for r in reports}
            items = [_ref(byid[p]) for p, _ in big[:6] if p in byid]
            evidence = ["Links use TF-IDF text similarity, category, distance (≤500 m) and time (≤14 days)."]
    elif intent == "resolution":
        m = metrics(reports)
        text = f"{m['resolved']} reports resolved; resolution rate {m['resolution_rate']}% (resolved ÷ resolved+open, rejected excluded)."
        text += f" Average resolution time {m['avg_resolution_hours']} hours." if m["avg_resolution_hours"] is not None else f" Average time not shown: {m['avg_resolution_note'].lower()}."
    elif intent == "ward" and slots.get("ward"):
        w = slots["ward"]
        mine = [r for r in open_r if (r.get("ward") or "").lower() == w.lower()]
        if not [r for r in reports if (r.get("ward") or "").lower() == w.lower()]:
            text = f"There is no data for “{w}”. Known wards: " + ", ".join(sorted({r['ward'] for r in reports if r.get('ward')})) + "."
        else:
            c = Counter(r["category"] for r in mine)
            text = f"{w} has {len(mine)} open reports" + (f", mostly {CATEGORIES[c.most_common(1)[0][0]].lower()}" if c else "") + f"; {sum(1 for r in mine if r['priority_level']=='critical')} critical."
            items = [_ref(r) for r in sorted(mine, key=lambda r: -r["priority_score"])[:6]]
    elif intent in ("recurring", "count", "ward") and cat:
        mine = [r for r in reports if r["category"] == cat]
        open_m = [r for r in mine if r["status"] in OPEN_STATUSES]
        places = Counter(r["location_text"] for r in open_m)
        repeat = [(p, n) for p, n in places.most_common() if n >= 2]
        text = f"{len(mine)} {CATEGORIES[cat].lower()} reports in total, {len(open_m)} open."
        if repeat:
            text += " Recurring at: " + ", ".join(f"{p} ({n})" for p, n in repeat[:3]) + "."
        else:
            text += " No location has two or more open reports of this kind."
        items = [_ref(r) for r in sorted(open_m, key=lambda r: -r["priority_score"])[:8]]
    elif intent == "count":
        m = metrics(reports)
        text = f"{m['total']} reports in total: {m['open']} open, {m['resolved']} resolved, {m['rejected']} rejected. {m['critical_open']} open reports are critical."
    else:
        text = ("I can only answer questions about the stored reports, and I didn't recognise this one. "
                "Try: “Which area needs attention first?”, “How many critical complaints are pending?”, "
                "“Show recurring drainage complaints”, or a report ID like CP-XXXXXX.")
        intent = "unknown"

    return {"intent": intent, "confidence": conf, "slots": {k: v for k, v in slots.items() if v},
            "answer": text, "evidence": evidence, "items": items,
            "source": f"Computed from {len(reports)} stored reports"}
