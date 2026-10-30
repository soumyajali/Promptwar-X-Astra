"""Area-level action brief. Splits CALCULATED facts (from stored data) from SUGGESTED actions (rules)."""
from __future__ import annotations

from collections import Counter

from ..config import CATEGORIES, CATEGORY_DEPARTMENT, DEPARTMENTS, OPEN_STATUSES
from .analytics import metrics, workload
from .hotspots import detect_hotspots
from .recommender import RESPONSE_TARGET


def action_brief(reports: list[dict], ward: str | None = None) -> dict:
    scope = [r for r in reports if not ward or (r.get("ward") or "").lower() == ward.lower()]
    open_r = [r for r in scope if r["status"] in OPEN_STATUSES]
    hotspots = detect_hotspots(reports)
    if ward:
        hotspots = [h for h in hotspots if h["ward"].lower() == ward.lower()]
    m = metrics(scope)

    cat_open = Counter(r["category"] for r in open_r)
    recurring = []
    for cat, n in cat_open.most_common():
        linked = sum(1 for r in open_r if r["category"] == cat and r.get("primary_report_id"))
        places = Counter(r["location_text"] for r in open_r if r["category"] == cat).most_common(2)
        recurring.append({"category": cat, "label": CATEGORIES[cat], "open": n, "linked_duplicates": linked,
                          "top_locations": [p for p, _ in places]})

    ward_counts = Counter(r.get("ward") or "Unknown" for r in open_r)
    ward_crit = Counter(r.get("ward") or "Unknown" for r in open_r if r["priority_level"] == "critical")
    areas = [{"ward": w, "open": n, "critical": ward_crit.get(w, 0)} for w, n in ward_counts.most_common(5)]

    high = sorted([r for r in open_r if r["priority_level"] in ("critical", "high")], key=lambda r: -r["priority_score"])
    high_items = [{"id": r["id"], "category": r["category"], "label": CATEGORIES[r["category"]],
                   "location": r["location_text"], "score": r["priority_score"], "level": r["priority_level"],
                   "status": r["status"], "department": r.get("department")} for r in high[:10]]

    load = [d for d in workload(scope) if d["open"]]

    # ---- Suggested intervention order: hotspots first (by hotspot score), then lone critical/high reports
    order = []
    covered = set()
    for h in hotspots:
        order.append({
            "type": "hotspot", "target": f"{h['id']} · {h['location']}",
            "action": h["intervention"], "department": h["department"],
            "why": h["reason"], "report_ids": h["report_ids"],
            "respond": RESPONSE_TARGET["critical" if h["critical_count"] else "high"],
            "score": h["score"],
        })
        covered.update(h["report_ids"])
    for r in high:
        if r["id"] in covered:
            continue
        rec = r["analysis"].get("recommendation", {})
        order.append({
            "type": "report", "target": f"{r['id']} · {r['location_text']}",
            "action": (rec.get("primary") or {}).get("action", "Inspect site"),
            "department": DEPARTMENTS[r.get("department") or CATEGORY_DEPARTMENT[r["category"]]],
            "why": r["analysis"].get("priority", {}).get("reasoning", ""),
            "report_ids": [r["id"]], "respond": RESPONSE_TARGET[r["priority_level"]], "score": r["priority_score"],
        })
    order = order[:8]
    for i, o in enumerate(order, 1):
        o["step"] = i

    unassigned_crit = [r["id"] for r in open_r if r["priority_level"] == "critical" and not r.get("department")]
    suggestions = []
    if unassigned_crit:
        suggestions.append(f"Assign the {len(unassigned_crit)} unassigned critical report(s) before anything else: {', '.join(unassigned_crit[:5])}.")
    if load:
        top = load[0]
        if top["open"] >= 2 * max(1, (load[1]["open"] if len(load) > 1 else 1)):
            suggestions.append(f"{top['label']} holds {top['open']} open reports — consider borrowing crew capacity.")
    for rc in recurring[:2]:
        if rc["linked_duplicates"] >= 2:
            suggestions.append(f"{rc['label']} complaints repeat at {', '.join(rc['top_locations'])} — plan a root-cause fix, not repeat patching.")

    return {
        "scope": ward or "All wards",
        "generated_from": f"{len(scope)} stored reports ({len(open_r)} open)",
        "calculated": {
            "metrics": m,
            "recurring_problems": recurring,
            "most_affected_areas": areas,
            "high_priority_reports": high_items,
            "department_workload": load,
            "hotspots": hotspots,
        },
        "suggested": {
            "intervention_order": order,
            "notes": suggestions,
            "disclaimer": "Suggestions come from documented rules applied to the calculated data. Officers make final decisions.",
        },
    }
