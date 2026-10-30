"""REVEAL stage: dashboard metrics computed from the database on every request. No stored or fake figures."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta

from ..config import CATEGORIES, DEPARTMENTS, OPEN_STATUSES, PRIORITY_LEVELS, STATUSES
from .hotspots import detect_hotspots

MIN_RESOLVED_FOR_AVG = 3


def _hours(a: str, b: str) -> float:
    return (datetime.fromisoformat(b) - datetime.fromisoformat(a)).total_seconds() / 3600


def metrics(reports: list[dict]) -> dict:
    total = len(reports)
    open_r = [r for r in reports if r["status"] in OPEN_STATUSES]
    resolved = [r for r in reports if r["status"] == "resolved"]
    rejected = [r for r in reports if r["status"] == "rejected"]
    closed_valid = len(resolved) + len(open_r)
    avg_res = None
    if len(resolved) >= MIN_RESOLVED_FOR_AVG:
        hrs = [_hours(r["created_at"], r["resolved_at"]) for r in resolved if r.get("resolved_at")]
        avg_res = round(sum(hrs) / len(hrs), 1) if hrs else None
    return {
        "total": total,
        "open": len(open_r),
        "critical_open": sum(1 for r in open_r if r["priority_level"] == "critical"),
        "high_open": sum(1 for r in open_r if r["priority_level"] == "high"),
        "resolved": len(resolved),
        "rejected": len(rejected),
        "unassigned_open": sum(1 for r in open_r if not r.get("department")),
        "resolution_rate": round(100 * len(resolved) / closed_valid, 1) if closed_valid else 0.0,
        "avg_resolution_hours": avg_res,
        "avg_resolution_note": None if avg_res is not None else f"Needs at least {MIN_RESOLVED_FOR_AVG} resolved reports",
        "linked_duplicates": sum(1 for r in reports if r.get("primary_report_id")),
    }


def trend(reports: list[dict], days: int = 21) -> list[dict]:
    if not reports:
        return []
    end = max(datetime.fromisoformat(r["created_at"]) for r in reports).date()
    start = end - timedelta(days=days - 1)
    rec = Counter(datetime.fromisoformat(r["created_at"]).date() for r in reports)
    res = Counter(datetime.fromisoformat(r["resolved_at"]).date() for r in reports if r.get("resolved_at"))
    out = []
    for i in range(days):
        d = start + timedelta(days=i)
        out.append({"date": d.isoformat(), "label": d.strftime("%d %b"), "received": rec.get(d, 0), "resolved": res.get(d, 0)})
    return out


def distributions(reports: list[dict]) -> dict:
    cat = Counter(r["category"] for r in reports)
    cat_open = Counter(r["category"] for r in reports if r["status"] in OPEN_STATUSES)
    pri = Counter(r["priority_level"] for r in reports if r["status"] in OPEN_STATUSES)
    st = Counter(r["status"] for r in reports)
    ward = Counter(r.get("ward") or "Unknown" for r in reports if r["status"] in OPEN_STATUSES)
    return {
        "category": [{"key": k, "label": CATEGORIES[k], "total": cat.get(k, 0), "open": cat_open.get(k, 0)}
                     for k in CATEGORIES if cat.get(k, 0)],
        "priority": [{"key": k, "label": k.title(), "count": pri.get(k, 0)} for k in PRIORITY_LEVELS],
        "status": [{"key": k, "count": st.get(k, 0)} for k in STATUSES],
        "ward": [{"ward": w, "open": n} for w, n in ward.most_common()],
    }


def workload(reports: list[dict]) -> list[dict]:
    out = []
    for key, label in DEPARTMENTS.items():
        mine = [r for r in reports if r.get("department") == key]
        open_m = [r for r in mine if r["status"] in OPEN_STATUSES]
        out.append({
            "key": key, "label": label,
            "open": len(open_m),
            "in_progress": sum(1 for r in open_m if r["status"] == "in_progress"),
            "critical": sum(1 for r in open_m if r["priority_level"] == "critical"),
            "resolved": sum(1 for r in mine if r["status"] == "resolved"),
            "officers": sorted({r["officer"] for r in open_m if r.get("officer")}),
        })
    return sorted(out, key=lambda d: (-d["open"], d["label"]))


def insights(reports: list[dict], hotspots: list[dict], m: dict, dist: dict, load: list[dict]) -> list[dict]:
    """Plain-language observations. Each one carries the numbers it is derived from."""
    out = []
    if hotspots:
        h = hotspots[0]
        out.append({"kind": "hotspot", "title": f"{h['location']} is the top hotspot",
                    "detail": f"{h['count']} open reports, {h['critical_count']} critical, mostly {h['dominant_label'].lower()}.",
                    "evidence": h["report_ids"][:5]})
    if m["critical_open"]:
        unassigned_crit = [r["id"] for r in reports if r["status"] in OPEN_STATUSES and r["priority_level"] == "critical" and not r.get("department")]
        out.append({"kind": "critical", "title": f"{m['critical_open']} critical reports are open",
                    "detail": (f"{len(unassigned_crit)} of them have no department yet." if unassigned_crit else "All are assigned to a department."),
                    "evidence": unassigned_crit[:5]})
    cats = sorted(dist["category"], key=lambda c: -c["open"])
    if cats and cats[0]["open"]:
        c = cats[0]
        share = round(100 * c["open"] / max(1, m["open"]))
        out.append({"kind": "category", "title": f"{c['label']} leads open complaints",
                    "detail": f"{c['open']} of {m['open']} open reports ({share}%).", "evidence": []})
    busiest = load[0] if load and load[0]["open"] else None
    if busiest:
        out.append({"kind": "workload", "title": f"{busiest['label']} carries the most open work",
                    "detail": f"{busiest['open']} open, {busiest['critical']} critical.", "evidence": []})
    if m["linked_duplicates"]:
        out.append({"kind": "duplicates", "title": f"{m['linked_duplicates']} reports linked as likely duplicates",
                    "detail": "Kept as separate citizen submissions, grouped for one response.", "evidence": []})
    return out


def week_change(reports: list[dict]) -> dict:
    """Reports received and resolved in the last 7 days vs the 7 days before (anchored to the newest report)."""
    if not reports:
        return {"received": [0, 0], "resolved": [0, 0], "critical": [0, 0]}
    end = max(datetime.fromisoformat(r["created_at"]) for r in reports)
    w1, w0 = end - timedelta(days=7), end - timedelta(days=14)

    def window(ts: str | None, lo, hi) -> bool:
        return bool(ts) and lo < datetime.fromisoformat(ts) <= hi

    rec = [sum(window(r["created_at"], w1, end) for r in reports), sum(window(r["created_at"], w0, w1) for r in reports)]
    res = [sum(window(r.get("resolved_at"), w1, end) for r in reports), sum(window(r.get("resolved_at"), w0, w1) for r in reports)]
    crit = [sum(window(r["created_at"], w1, end) and r["priority_level"] == "critical" for r in reports),
            sum(window(r["created_at"], w0, w1) and r["priority_level"] == "critical" for r in reports)]
    return {"received": rec, "resolved": res, "critical": crit}


def dashboard(reports: list[dict]) -> dict:
    hs = detect_hotspots(reports)
    m = metrics(reports)
    dist = distributions(reports)
    load = workload(reports)
    open_r = [r for r in reports if r["status"] in OPEN_STATUSES]
    critical = sorted([r for r in open_r if r["priority_level"] in ("critical",)], key=lambda r: -r["priority_score"])
    return {
        "metrics": m,
        "trend": trend(reports),
        "distributions": dist,
        "workload": load,
        "hotspots": hs,
        "insights": insights(reports, hs, m, dist, load),
        "critical_ids": [r["id"] for r in critical],
        "recent_ids": [r["id"] for r in reports[:8]],
        "week": week_change(reports),
    }
