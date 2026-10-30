"""Explainable priority scoring (0–100). Deterministic, documented weights — not a trained model.

Factor              Max pts  Source
Safety risk           25     hazard lexicon (e.g. live wire, open manhole) and category baseline
Severity              20     severity phrases (knee deep, burst, completely blocked …); hazards imply severity (0.6 × safety)
Urgency               15     urgency phrases + stated duration (for 3 days …)
Public impact         15     affected groups (school, hospital, bus stand …) + affected people count
Recurring reports     15     linked duplicate/related reports + same-category history within 300 m / 60 days
Geographic cluster    10     any open reports within 400 m in the last 14 days

Levels: Critical ≥ 70 · High ≥ 50 · Medium ≥ 30 · Low < 30
"""
from __future__ import annotations

from datetime import datetime

from .geo import distance_between
from .signals import Signals

WEIGHTS = {
    "safety": 25,
    "severity": 20,
    "urgency": 15,
    "impact": 15,
    "recurrence": 15,
    "concentration": 10,
}
LABELS = {
    "safety": "Safety risk",
    "severity": "Severity",
    "urgency": "Urgency",
    "impact": "Public impact",
    "recurrence": "Recurring reports",
    "concentration": "Geographic concentration",
}
THRESHOLDS = [("critical", 70), ("high", 50), ("medium", 30), ("low", 0)]

# Baseline inherent risk of a category before reading the text.
CATEGORY_SAFETY_BASELINE = {
    "public_safety": 0.5, "streetlights": 0.3, "drainage": 0.25, "waterlogging": 0.3,
    "roads": 0.25, "water_supply": 0.15, "garbage": 0.1, "other": 0.05,
}
CATEGORY_SEVERITY_BASELINE = {
    "waterlogging": 0.3, "public_safety": 0.3, "drainage": 0.25, "water_supply": 0.3,
    "roads": 0.2, "streetlights": 0.2, "garbage": 0.2, "other": 0.1,
}


def level_for(score: int) -> str:
    for name, t in THRESHOLDS:
        if score >= t:
            return name
    return "low"


def _cap(x: float) -> float:
    return max(0.0, min(1.0, x))


def neighbourhood(report: dict, others: list[dict], now: str) -> dict:
    """Count recurring and concentrated reports around a report (excluding itself)."""
    same_cat_nearby, any_nearby = [], []
    t_now = datetime.fromisoformat(now)
    for o in others:
        if o["id"] == report.get("id"):
            continue
        d = distance_between(report, o)
        if d is None:
            continue
        age_days = (t_now - datetime.fromisoformat(o["created_at"])).total_seconds() / 86400
        if age_days < -0.01:
            continue  # only look backwards in time
        if d <= 300 and age_days <= 60 and o["category"] == report["category"]:
            same_cat_nearby.append(o["id"])
        if d <= 400 and age_days <= 14 and o.get("status") not in ("resolved", "rejected"):
            any_nearby.append(o["id"])
    return {"same_category_nearby": same_cat_nearby, "open_nearby": any_nearby}


def score_priority(category: str, signals: Signals, *, linked_count: int = 0,
                   same_category_nearby: int = 0, open_nearby: int = 0,
                   affected_people: int | None = None) -> dict:
    factors = []

    # Safety
    base = CATEGORY_SAFETY_BASELINE.get(category, 0.05)
    hazard = signals.safety_level
    safety_raw = _cap(max(base, hazard) + (0.1 if len(signals.hazards) > 1 else 0))
    ev = [label for _, _, label in signals.hazards[:3]] or [f"category baseline ({base:.0%})"]
    factors.append(("safety", safety_raw, ev))

    # Severity
    sev = sorted((w for _, w in signals.severity), reverse=True)
    sev_raw = _cap(max([CATEGORY_SEVERITY_BASELINE.get(category, 0.1), 0.6 * hazard] + sev[:1]) + 0.15 * len(sev[1:3]))
    factors.append(("severity", sev_raw, [p for p, _ in signals.severity[:3]] or ["no severity cues; category baseline"]))

    # Urgency
    urg = max((w for _, w in signals.urgency), default=0.0)
    dur = 0.0
    if signals.duration_days is not None:
        dur = _cap(signals.duration_days / 7)  # a week or longer unresolved = full duration weight
    urg_raw = _cap(max(urg, dur) + 0.1 * max(0, len(signals.urgency) - 1))
    urg_ev = ([signals.duration_text] if signals.duration_text else []) + [p for p, _ in signals.urgency[:2]]
    factors.append(("urgency", urg_raw, urg_ev or ["no urgency cues stated"]))

    # Public impact
    impact = max((w for _, w, _ in signals.affected), default=0.15)
    people = affected_people or signals.people_mentioned
    people_raw = 0.0
    if people:
        people_raw = _cap(people / 500)  # 500+ people = maximum
    impact_raw = _cap(max(impact, people_raw) + 0.08 * max(0, len(signals.affected) - 1))
    imp_ev = [label for _, _, label in signals.affected[:3]]
    if people:
        imp_ev.append(f"~{people} people affected (stated)")
    factors.append(("impact", impact_raw, imp_ev or ["no affected group stated"]))

    # Recurrence
    rec_raw = _cap(0.25 * linked_count + 0.15 * same_category_nearby)
    rec_ev = []
    if linked_count:
        rec_ev.append(f"{linked_count} linked similar report{'s' if linked_count != 1 else ''}")
    if same_category_nearby:
        rec_ev.append(f"{same_category_nearby} same-category report{'s' if same_category_nearby != 1 else ''} within 300 m (60 days)")
    factors.append(("recurrence", rec_raw, rec_ev or ["first report of this kind here"]))

    # Concentration
    con_raw = _cap(open_nearby / 5)
    factors.append(("concentration", con_raw,
                    [f"{open_nearby} open report{'s' if open_nearby != 1 else ''} within 400 m (14 days)"] if open_nearby
                    else ["no other open reports nearby"]))

    out = []
    total = 0.0
    for key, raw, evidence in factors:
        pts = raw * WEIGHTS[key]
        total += pts
        out.append({"key": key, "label": LABELS[key], "weight": WEIGHTS[key], "raw": round(raw, 3),
                    "points": round(pts, 1), "evidence": evidence})
    score = int(round(total))
    level = level_for(score)
    top = sorted(out, key=lambda f: f["points"] / f["weight"] if f["weight"] else 0, reverse=True)
    drivers = [f["label"].lower() for f in top if f["raw"] >= 0.5][:3]
    reasoning = (
        f"Scored {score}/100 ({level.title()})."
        + (f" Main drivers: {', '.join(drivers)}." if drivers else " No strong risk drivers detected.")
        + f" Strongest evidence: {top[0]['evidence'][0]}."
    )
    return {"score": score, "level": level, "factors": out, "reasoning": reasoning,
            "weights": WEIGHTS, "method": "deterministic-weighted"}
