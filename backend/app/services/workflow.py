"""Business operations: create a report, and every authority action (ACT stage).

Each operation persists to SQLite, writes a timeline entry, and publishes an SSE event.
"""
from __future__ import annotations

from .. import repository as repo
from ..config import CATEGORIES, CATEGORY_DEPARTMENT, DEPARTMENTS, OFFICERS, STATUSES
from ..events import broker
from .pipeline import analyse, rescore_neighbours
from .priority import level_for

STATUS_LABEL = {
    "submitted": "Submitted", "under_review": "Under Review", "assigned": "Assigned",
    "in_progress": "In Progress", "resolved": "Resolved", "rejected": "Rejected",
}

# Allowed status moves. Re-opening a resolved/rejected report goes back to under_review.
TRANSITIONS = {
    "submitted": {"under_review", "assigned", "in_progress", "resolved", "rejected"},
    "under_review": {"assigned", "in_progress", "resolved", "rejected"},
    "assigned": {"in_progress", "resolved", "rejected", "under_review"},
    "in_progress": {"resolved", "assigned", "rejected"},
    "resolved": {"under_review"},
    "rejected": {"under_review"},
}


class WorkflowError(ValueError):
    pass


def create_report(data: dict, *, publish: bool = True, rescore: bool = True) -> dict:
    created = data.get("created_at") or repo.now_iso()
    rid = data.get("id") or repo.new_report_id()
    report = {**data, "id": rid, "created_at": created}
    existing = repo.list_reports()
    analysis = analyse(report, existing)
    pr = analysis["priority"]
    dups = analysis["duplicates"]
    primary = None
    likely = [m for m in dups["matches"] if m["likelihood"] == "likely"]
    if likely:
        top = next(e for e in existing if e["id"] == likely[0]["id"])
        primary = top.get("primary_report_id") or top["id"]

    row = {
        **report,
        "category": analysis["category"],
        "category_predicted": analysis["classification"]["category"],
        "category_confidence": analysis["classification"]["confidence"],
        "status": "submitted",
        "priority_score": pr["score"],
        "priority_level": pr["level"],
        "summary": analysis["summary"]["text"],
        "analysis": analysis,
        "primary_report_id": primary,
        "updated_at": created,
        "channel": data.get("channel", "web"),
    }
    repo.insert_report(row)
    for m in dups["matches"]:
        repo.add_link(rid, m["id"], m["score"], m["distance_m"], m["likelihood"], m["reasons"], created)

    repo.add_timeline(rid, "status", "Report received and logged.", status="submitted", at=created,
                      actor="Citizen")
    msg = f"Automatically analysed: {CATEGORIES[analysis['category']]}, priority {pr['level'].title()}."
    if likely:
        msg += f" Linked to {len(likely)} similar report{'s' if len(likely) > 1 else ''} in the area."
    repo.add_timeline(rid, "analysis", msg, at=created, actor="CivicPulse engine")

    changed = []
    if rescore:
        changed = rescore_neighbours(repo.get_report(rid), repo.list_reports())
    if publish:
        broker.publish("report.created", {"id": rid, "rescored": changed})
    return repo.get_report(rid)


def _require(rid: str) -> dict:
    r = repo.get_report(rid)
    if not r:
        raise LookupError(rid)
    return r


def change_status(rid: str, status: str, *, actor: str, public_message: str | None = None,
                  resolution_note: str | None = None, at: str | None = None, publish: bool = True) -> dict:
    r = _require(rid)
    if status not in STATUSES:
        raise WorkflowError(f"Unknown status '{status}'.")
    if status == r["status"]:
        raise WorkflowError(f"Report is already {STATUS_LABEL[status]}.")
    if status not in TRANSITIONS[r["status"]]:
        raise WorkflowError(f"Cannot move from {STATUS_LABEL[r['status']]} to {STATUS_LABEL[status]}.")
    if status == "resolved" and not (resolution_note or "").strip():
        raise WorkflowError("A resolution note is required to resolve a report.")
    if status == "rejected" and not (public_message or resolution_note or "").strip():
        raise WorkflowError("Give the citizen a reason when rejecting a report.")
    when = at or repo.now_iso()
    fields = {"status": status, "updated_at": when}
    if status == "resolved":
        fields["resolved_at"] = when
        fields["resolution_note"] = resolution_note.strip()
    elif status == "rejected":
        fields["resolution_note"] = (resolution_note or public_message).strip()
    elif r["status"] in ("resolved", "rejected"):
        fields["resolved_at"] = None
    repo.update_report(rid, **fields)
    text = public_message.strip() if public_message and public_message.strip() else f"Status changed to {STATUS_LABEL[status]}."
    if status == "resolved":
        text = f"Resolved: {resolution_note.strip()}"
    repo.add_timeline(rid, "status", text, status=status, actor=actor, at=when)
    if publish:
        broker.publish("report.updated", {"id": rid, "change": "status"})
    return repo.get_report(rid)


def assign(rid: str, department: str, officer: str | None, *, actor: str, at: str | None = None,
           publish: bool = True) -> dict:
    r = _require(rid)
    if department not in DEPARTMENTS:
        raise WorkflowError(f"Unknown department '{department}'.")
    if officer and officer not in OFFICERS.get(department, []):
        raise WorkflowError(f"{officer} is not on the {DEPARTMENTS[department]} roster.")
    when = at or repo.now_iso()
    fields = {"department": department, "officer": officer, "updated_at": when}
    moved = False
    if r["status"] in ("submitted", "under_review"):
        fields["status"] = "assigned"
        moved = True
    repo.update_report(rid, **fields)
    who = f" ({officer})" if officer else ""
    repo.add_timeline(rid, "assignment", f"Assigned to {DEPARTMENTS[department]}{who}.",
                      status="assigned" if moved else None, actor=actor, at=when)
    if publish:
        broker.publish("report.updated", {"id": rid, "change": "assignment"})
    return repo.get_report(rid)


def correct_category(rid: str, category: str, *, actor: str, reason: str | None = None, publish: bool = True) -> dict:
    r = _require(rid)
    if category not in CATEGORIES:
        raise WorkflowError(f"Unknown category '{category}'.")
    if category == r["category"]:
        raise WorkflowError("That is already the category.")
    analysis = dict(r["analysis"])
    analysis.setdefault("corrections", []).append({"from": r["category"], "to": category, "by": actor, "reason": reason})
    repo.update_report(rid, category=category, category_corrected=1, analysis=analysis)
    repo.add_timeline(rid, "category", f"Category corrected from {CATEGORIES[r['category']]} to {CATEGORIES[category]}."
                      + (f" Reason: {reason}" if reason else ""), visibility="internal", actor=actor)
    repo.add_timeline(rid, "category", f"Category confirmed as {CATEGORIES[category]}.", actor=actor)
    if publish:
        broker.publish("report.updated", {"id": rid, "change": "category"})
    return repo.get_report(rid)


def override_priority(rid: str, level: str, reason: str, *, actor: str, publish: bool = True) -> dict:
    r = _require(rid)
    bands = {"critical": 80, "high": 60, "medium": 40, "low": 20}
    if level not in bands:
        raise WorkflowError(f"Unknown priority '{level}'.")
    if not (reason or "").strip():
        raise WorkflowError("A reason is required to adjust priority.")
    score = bands[level] if level_for(r["priority_score"]) != level else r["priority_score"]
    repo.update_report(rid, priority_level=level, priority_score=score, priority_overridden=1,
                       priority_override_reason=reason.strip())
    repo.add_timeline(rid, "priority", f"Priority set to {level.title()} by officer. Reason: {reason.strip()}",
                      visibility="internal", actor=actor)
    if publish:
        broker.publish("report.updated", {"id": rid, "change": "priority"})
    return repo.get_report(rid)


def add_update(rid: str, message: str, visibility: str, *, actor: str, at: str | None = None, publish: bool = True) -> dict:
    _require(rid)
    if visibility not in ("public", "internal"):
        raise WorkflowError("Visibility must be public or internal.")
    if not (message or "").strip():
        raise WorkflowError("Message cannot be empty.")
    if len(message) > 1000:
        raise WorkflowError("Message is too long (max 1000 characters).")
    when = at or repo.now_iso()
    repo.add_timeline(rid, "update" if visibility == "public" else "note", message.strip(),
                      visibility=visibility, actor=actor, at=when)
    repo.update_report(rid, updated_at=when)
    if publish:
        broker.publish("report.updated", {"id": rid, "change": "update"})
    return repo.get_report(rid)


def suggested_department(category: str) -> str:
    return CATEGORY_DEPARTMENT.get(category, "admin")
