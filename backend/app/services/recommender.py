"""Rule-based action recommendations. Each rule states why it fired."""
from __future__ import annotations

from ..config import CATEGORY_DEPARTMENT, DEPARTMENTS
from .signals import Signals

BASE_ACTIONS = {
    "roads": "Dispatch a road inspection team to assess and patch the damaged surface",
    "waterlogging": "Send a drainage crew with a pump to clear standing water and inspect inlets",
    "garbage": "Arrange a waste collection run and inspect bin capacity at this point",
    "streetlights": "Send an electrical maintenance crew to repair the streetlight",
    "drainage": "Inspect and desilt the blocked drain section",
    "public_safety": "Escalate to the public safety cell for a site check",
    "water_supply": "Send water-supply maintenance staff to inspect the pipeline",
    "other": "Route to general administration for triage",
}

RESPONSE_TARGET = {"critical": "within 4 hours", "high": "within 24 hours", "medium": "within 3 days", "low": "within 7 days"}

ELECTRICAL = {"exposed live electrical wire", "electric shock risk", "electrocution risk", "sparking electrical equipment", "short circuit"}


def recommend(category: str, level: str, signals: Signals, *, linked_count: int = 0,
              open_nearby: int = 0) -> dict:
    hazards = {label for _, _, label in signals.hazards}
    department = CATEGORY_DEPARTMENT.get(category, "admin")
    actions = [{"action": BASE_ACTIONS.get(category, BASE_ACTIONS["other"]),
                "why": f"Standard first response for {category.replace('_', ' ')} reports."}]

    if hazards & ELECTRICAL:
        actions.insert(0, {"action": "Isolate power and inspect dangerous electrical infrastructure",
                           "why": "The description mentions " + ", ".join(sorted(hazards & ELECTRICAL)) + "."})
        if category not in ("streetlights",):
            actions.append({"action": "Notify the Electricity department for a joint inspection",
                            "why": "Electrical hazard reported inside a non-electrical complaint."})
    if {"open manhole", "uncovered manhole"} & hazards:
        actions.insert(0, {"action": "Barricade and cover the open manhole immediately",
                           "why": "An open manhole is a fall hazard, especially when water hides it."})
    if {"assault", "harassment", "chain snatching", "robbery"} & hazards:
        department = "safety"
        actions.insert(0, {"action": "Escalate to Public Safety and request increased patrols",
                           "why": "Personal-safety incident reported."})
    if {"contaminated water", "sewage mixing with water"} & hazards:
        actions.insert(0, {"action": "Issue a do-not-drink advisory and test water samples",
                           "why": "Possible contamination of drinking water."})
    if level == "critical" and not any(a["action"].startswith("Escalate") for a in actions):
        actions.append({"action": "Escalate to the ward duty officer for same-day response",
                        "why": "Priority score is in the Critical band."})
    if linked_count >= 2:
        actions.append({"action": "Treat as a recurring fault and schedule a root-cause inspection",
                        "why": f"{linked_count} similar reports are linked to this one."})
    if open_nearby >= 3:
        actions.append({"action": "Coordinate one combined site visit for nearby open reports",
                        "why": f"{open_nearby} other open reports lie within 400 m."})

    return {
        "department": department,
        "department_label": DEPARTMENTS[department],
        "primary": actions[0],
        "actions": actions,
        "response_target": RESPONSE_TARGET[level],
        "note": "Suggested by rules; an officer decides the final action.",
    }
