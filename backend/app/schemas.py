"""Request validation models and public/authority serialisers (privacy boundary lives here)."""
from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from . import repository as repo
from .config import CATEGORIES, DEPARTMENTS

Status = Literal["submitted", "under_review", "assigned", "in_progress", "resolved", "rejected"]


class StatusChange(BaseModel):
    status: Status
    public_message: str | None = Field(None, max_length=1000)
    resolution_note: str | None = Field(None, max_length=1000)


class Assignment(BaseModel):
    department: str
    officer: str | None = None

    @field_validator("department")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in DEPARTMENTS:
            raise ValueError("Unknown department")
        return v


class CategoryCorrection(BaseModel):
    category: str
    reason: str | None = Field(None, max_length=500)

    @field_validator("category")
    @classmethod
    def known(cls, v: str) -> str:
        if v not in CATEGORIES:
            raise ValueError("Unknown category")
        return v


class PriorityOverride(BaseModel):
    level: Literal["critical", "high", "medium", "low"]
    reason: str = Field(..., min_length=3, max_length=500)


class Update(BaseModel):
    message: str = Field(..., min_length=2, max_length=1000)
    visibility: Literal["public", "internal"] = "public"


class Question(BaseModel):
    question: str = Field(..., max_length=500)
    # Slots from the previous answer (category, ward, scope) so follow-ups like "and in Market Ward?" work.
    context: dict | None = None


class Login(BaseModel):
    code: str = Field(..., max_length=100)


class Preview(BaseModel):
    description: str = Field(..., max_length=2000)


_contact = re.compile(r"^[0-9+\-\s()]{7,20}$|^[^@\s]+@[^@\s]+\.[^@\s]+$")


LOCATION_SOURCES = {"device", "map", "demo"}


def validate_submission(description: str, location_text: str, category: str | None, lat, lng,
                        name: str | None, contact: str | None, affected: int | None,
                        location_source: str | None = None, location_accuracy: float | None = None) -> dict[str, str]:
    errors: dict[str, str] = {}
    d = (description or "").strip()
    if len(d) < 15:
        errors["description"] = "Describe the problem in at least 15 characters so it can be understood."
    elif len(d) > 2000:
        errors["description"] = "Keep the description under 2000 characters."
    loc = (location_text or "").strip()
    if len(loc) < 3:
        errors["location_text"] = "Add a landmark, street or area name."
    elif len(loc) > 200:
        errors["location_text"] = "Location is too long (max 200 characters)."
    if category and category not in CATEGORIES:
        errors["category"] = "Choose a category from the list."
    if (lat is None) != (lng is None):
        errors["location"] = "Both latitude and longitude are needed."
    if lat is not None and not (-90 <= lat <= 90 and -180 <= lng <= 180):
        errors["location"] = "Coordinates are out of range."
    elif lat is not None and lat == 0 and lng == 0:
        errors["location"] = "0, 0 is not a real location. Place the pin again."
    if location_source is not None:
        if location_source not in LOCATION_SOURCES:
            errors["location"] = "Unknown location source."
        elif lat is None:
            errors["location"] = "A location source was given without coordinates."
    if location_accuracy is not None and not (0 < location_accuracy <= 100_000):
        errors["location"] = "Location accuracy must be between 0 and 100 km."
    if name and len(name) > 80:
        errors["reporter_name"] = "Name is too long."
    if contact and not _contact.match(contact.strip()):
        errors["reporter_contact"] = "Enter a valid phone number or email, or leave it blank."
    if affected is not None and not (1 <= affected <= 1_000_000):
        errors["affected_people"] = "Enter a number between 1 and 1,000,000."
    return errors


def _image_url(r: dict) -> str | None:
    return f"/uploads/{r['image_path']}" if r.get("image_path") else None


def public_feed_item(r: dict) -> dict:
    """Public feed: no names, contacts, photos or free text. Only the generated summary and status."""
    return {
        "id": r["id"], "category": r["category"], "category_label": CATEGORIES[r["category"]],
        "location_text": r["location_text"], "ward": r.get("ward"), "lat": r["lat"], "lng": r["lng"],
        "status": r["status"], "priority_level": r["priority_level"], "priority_score": r["priority_score"],
        "headline": r["analysis"].get("summary", {}).get("what", ""),
        "created_at": r["created_at"], "updated_at": r["updated_at"],
    }


def tracking_view(r: dict) -> dict:
    """What the citizen sees with their complaint ID: their report, never the reporter's identity."""
    a = r["analysis"]
    from .config import DEPARTMENTS as D
    return {
        **public_feed_item(r),
        "description": r["description"],
        "summary": r["summary"],
        "image_url": _image_url(r),
        "department": r.get("department"),
        "department_label": D.get(r["department"]) if r.get("department") else None,
        "officer_assigned": bool(r.get("officer")),
        "resolution_note": r.get("resolution_note"),
        "resolved_at": r.get("resolved_at"),
        "analysis": {
            "classification": {k: a["classification"].get(k) for k in ("category", "label", "confidence", "explanation", "resolution")},
            "priority": {k: a["priority"].get(k) for k in ("score", "level", "factors", "reasoning")} | {"score": r["priority_score"], "level": r["priority_level"]},
            "duplicates": {"likelihood": a["duplicates"]["likelihood"], "count": len(a["duplicates"]["matches"])},
            "recommendation": {"department_label": a["recommendation"]["department_label"],
                               "response_target": a["recommendation"]["response_target"]},
        },
        "timeline": repo.timeline(r["id"], public_only=True),
    }


def authority_view(r: dict, detail: bool = False) -> dict:
    out = {k: v for k, v in r.items() if k != "analysis"}
    out["category_label"] = CATEGORIES[r["category"]]
    out["image_url"] = _image_url(r)
    out["department_label"] = DEPARTMENTS.get(r["department"]) if r.get("department") else None
    out["headline"] = r["analysis"].get("summary", {}).get("what", "")
    out["duplicate_likelihood"] = r["analysis"].get("duplicates", {}).get("likelihood", "none")
    out["needs_review"] = bool(r["analysis"].get("classification", {}).get("resolution", {}).get("mismatch")) and not r["category_corrected"]
    if detail:
        out["analysis"] = r["analysis"]
        out["timeline"] = repo.timeline(r["id"])
        links = repo.links_for(r["id"])
        for l in links:
            o = repo.get_report(l["id"])
            if o:
                l.update({"category": o["category"], "category_label": CATEGORIES[o["category"]], "status": o["status"],
                          "location_text": o["location_text"], "priority_level": o["priority_level"],
                          "priority_score": o["priority_score"], "created_at": o["created_at"], "lat": o["lat"], "lng": o["lng"]})
        out["links"] = links
    return out
