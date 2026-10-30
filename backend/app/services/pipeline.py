"""The intelligence pipeline: CAPTURE → UNDERSTAND. Runs on every new report.

1. classify text           (classifier)
2. resolve category        (citizen choice vs prediction — mismatches flagged, never silently overwritten)
3. extract signals         (signals)
4. summarise               (summarizer)
5. find duplicates         (duplicates) → stored as links, reports are never deleted
6. score priority          (priority) using recurrence + geographic concentration
7. recommend action        (recommender)
8. re-score nearby open reports whose recurrence/concentration just changed
"""
from __future__ import annotations

from .. import repository as repo
from ..config import CATEGORIES, CLOSED_STATUSES
from .classifier import classify
from .duplicates import find_duplicates
from .priority import neighbourhood, score_priority
from .recommender import recommend
from .signals import extract
from .summarizer import summarize
from .geo import distance_between


def resolve_category(selected: str | None, cls) -> tuple[str, dict]:
    """Citizen selection wins (they were there), but disagreements are surfaced for review."""
    note = {"source": "", "mismatch": False, "message": ""}
    if selected and selected != "other":
        note["source"] = "citizen"
        if cls.category != selected and cls.category != "other" and cls.confidence >= 0.6:
            note["mismatch"] = True
            note["message"] = (f"Citizen chose {CATEGORIES[selected]}, but the text reads as "
                               f"{cls.label} ({cls.confidence:.0%}). Flagged for officer review.")
        else:
            note["message"] = f"Citizen selected {CATEGORIES[selected]}; text analysis agrees." if cls.category == selected \
                else f"Citizen selected {CATEGORIES[selected]}."
        return selected, note
    if cls.category != "other" and not cls.needs_review:
        note["source"] = "ai"
        note["message"] = f"Category set automatically to {cls.label} ({cls.confidence:.0%} confidence)."
        return cls.category, note
    note["source"] = "ai-low-confidence"
    note["mismatch"] = cls.category != "other"
    note["message"] = ("Low confidence prediction" + (f" ({cls.label}, {cls.confidence:.0%})" if cls.category != "other" else "")
                       + "; filed as Other until an officer confirms.")
    return "other", note


def analyse(report: dict, existing: list[dict]) -> dict:
    """Pure analysis (no writes). `report` needs description, location_text, lat, lng, created_at."""
    cls = classify(report["description"])
    category, cat_note = resolve_category(report.get("category_selected"), cls)
    sig = extract(report["description"])
    probe = {**report, "category": category}
    summary = summarize(report["description"], category, report.get("location_text", ""), sig,
                        report.get("affected_people"))
    pool = [e for e in existing if e["id"] != report.get("id")]
    dups = find_duplicates(probe, pool)
    hood = neighbourhood(probe, pool, report["created_at"])
    pr = score_priority(category, sig, linked_count=len(dups["matches"]),
                        same_category_nearby=len(hood["same_category_nearby"]),
                        open_nearby=len(hood["open_nearby"]),
                        affected_people=report.get("affected_people"))
    rec = recommend(category, pr["level"], sig, linked_count=len(dups["matches"]),
                    open_nearby=len(hood["open_nearby"]))
    return {
        "category": category,
        "classification": cls.to_dict() | {"resolution": cat_note},
        "summary": summary,
        "duplicates": dups,
        "neighbourhood": {k: len(v) for k, v in hood.items()},
        "priority": pr,
        "recommendation": rec,
        "signals": {
            "hazards": [label for _, _, label in sig.hazards],
            "severity": [p for p, _ in sig.severity],
            "urgency": [p for p, _ in sig.urgency],
            "affected": [label for _, _, label in sig.affected],
            "duration": sig.duration_text,
        },
        "pipeline_version": "1.0",
    }


def rescore(report: dict, all_reports: list[dict]) -> dict | None:
    """Recompute priority for an existing report (e.g. a new nearby report raised its recurrence)."""
    if report["priority_overridden"] or report["status"] in CLOSED_STATUSES:
        return None
    sig = extract(report["description"])
    linked = len(repo.links_for(report["id"]))
    others = [r for r in all_reports if r["id"] != report["id"]]
    # Use "now" = latest report time so newer neighbours count toward concentration.
    latest = max([r["created_at"] for r in all_reports] + [report["created_at"]])
    hood = neighbourhood(report, others, latest)
    pr = score_priority(report["category"], sig, linked_count=linked,
                        same_category_nearby=len(hood["same_category_nearby"]),
                        open_nearby=len(hood["open_nearby"]), affected_people=report.get("affected_people"))
    if pr["score"] == report["priority_score"]:
        return None
    analysis = dict(report["analysis"])
    analysis["priority"] = pr
    analysis["neighbourhood"] = {k: len(v) for k, v in hood.items()}
    analysis["recommendation"] = recommend(report["category"], pr["level"], sig, linked_count=linked,
                                           open_nearby=len(hood["open_nearby"]))
    return {"priority_score": pr["score"], "priority_level": pr["level"], "analysis": analysis}


def rescore_neighbours(report: dict, all_reports: list[dict], radius_m: float = 400) -> list[str]:
    changed = []
    for o in all_reports:
        if o["id"] == report["id"]:
            continue
        d = distance_between(report, o)
        if d is None or d > radius_m:
            continue
        upd = rescore(o, all_reports)
        if upd:
            old = o["priority_level"]
            repo.update_report(o["id"], **upd)
            if upd["priority_level"] != old:
                repo.add_timeline(o["id"], "priority",
                                  f"Priority recalculated to {upd['priority_level'].title()} ({upd['priority_score']}) after a new nearby report.",
                                  visibility="internal", actor="CivicPulse engine")
            changed.append(o["id"])
    return changed
