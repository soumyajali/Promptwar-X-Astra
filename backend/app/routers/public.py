"""Citizen-facing endpoints: submit, preview analysis, track, public feed, public stats."""
from __future__ import annotations

import secrets

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from .. import config, repository as repo
from ..schemas import Preview, public_feed_item, tracking_view, validate_submission
from ..services import workflow as wf
from ..services.analytics import metrics, distributions
from ..services.classifier import classify
from ..services.hotspots import detect_hotspots
from ..services.priority import WEIGHTS as PRIORITY_WEIGHTS
from ..services.signals import extract

router = APIRouter(prefix="/api")

MAGIC = {b"\xff\xd8\xff": "jpg", b"\x89PNG\r\n\x1a\n": "png", b"RIFF": "webp"}


def _sniff(head: bytes) -> str | None:
    for sig, ext in MAGIC.items():
        if head.startswith(sig):
            if ext == "webp" and head[8:12] != b"WEBP":
                return None
            return ext
    return None


@router.get("/meta")
def meta():
    return {
        "categories": config.CATEGORIES, "departments": config.DEPARTMENTS, "officers": config.OFFICERS,
        "statuses": config.STATUSES, "category_department": config.CATEGORY_DEPARTMENT,
        "demo_area": config.DEMO_AREA, "max_image_mb": config.MAX_IMAGE_BYTES // (1024 * 1024),
        "priority_weights": PRIORITY_WEIGHTS,
    }


@router.post("/analyze/preview")
def preview(body: Preview):
    """Live hint while the citizen types: predicted category + detected signals. Nothing is stored."""
    text = body.description.strip()
    if len(text) < 10:
        return {"ready": False}
    c = classify(text)
    s = extract(text)
    return {"ready": True, "category": c.category, "label": c.label, "confidence": c.confidence,
            "evidence": c.evidence[:4], "needs_review": c.needs_review,
            "hazards": [l for _, _, l in s.hazards][:3], "affected": [l for _, _, l in s.affected][:3]}


@router.post("/reports", status_code=201)
async def submit_report(
    description: str = Form(...),
    location_text: str = Form(...),
    category: str | None = Form(None),
    lat: float | None = Form(None),
    lng: float | None = Form(None),
    ward: str | None = Form(None),
    reporter_name: str | None = Form(None),
    reporter_contact: str | None = Form(None),
    affected_people: int | None = Form(None),
    location_source: str | None = Form(None),
    location_accuracy_m: float | None = Form(None),
    image: UploadFile | None = File(None),
):
    category = category or None
    location_source = location_source or None
    errors = validate_submission(description, location_text, category, lat, lng, reporter_name, reporter_contact,
                                 affected_people, location_source, location_accuracy_m)
    image_name = None
    if image is not None and image.filename:
        data = await image.read(config.MAX_IMAGE_BYTES + 1)
        if len(data) > config.MAX_IMAGE_BYTES:
            errors["image"] = f"Image is larger than {config.MAX_IMAGE_BYTES // (1024 * 1024)} MB."
        elif not data:
            errors["image"] = "The image file is empty."
        else:
            ext = _sniff(data[:16])
            if not ext:
                errors["image"] = "Only JPEG, PNG or WebP photos are accepted."
            elif not errors:
                config.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
                image_name = f"{secrets.token_hex(12)}.{ext}"  # random name: never trust the client filename
                (config.UPLOAD_DIR / image_name).write_bytes(data)
    if errors:
        raise HTTPException(422, detail={"message": "Please fix the highlighted fields.", "fields": errors})

    if not ward and lat is not None:
        ward = _nearest_ward(lat, lng)
    report = wf.create_report({
        "description": description.strip(), "location_text": location_text.strip(), "category_selected": category,
        "lat": lat, "lng": lng, "ward": ward, "reporter_name": (reporter_name or "").strip() or None,
        "reporter_contact": (reporter_contact or "").strip() or None, "affected_people": affected_people,
        "image_path": image_name, "channel": "web",
        # Where the pin came from: the citizen's device (with its stated accuracy), a map tap, or the demo button.
        "location_source": location_source if lat is not None else None,
        "location_accuracy_m": round(location_accuracy_m, 1) if (location_accuracy_m and location_source == "device") else None,
    })
    view = tracking_view(report)
    # The citizen gets to see the full matching evidence for their own report.
    view["analysis"]["duplicates"] = {k: report["analysis"]["duplicates"][k] for k in ("likelihood", "top_score")} | {
        "matches": [{k: m[k] for k in ("id", "score", "likelihood", "distance_m", "days_apart", "reasons", "category", "status")}
                    for m in report["analysis"]["duplicates"]["matches"]]}
    view["analysis"]["summary"] = report["analysis"]["summary"]
    view["analysis"]["recommendation"] = report["analysis"]["recommendation"]
    view["analysis"]["signals"] = report["analysis"]["signals"]
    return view


def _nearest_ward(lat: float, lng: float) -> str | None:
    """Assign the ward of the nearest existing report within 1.5 km (demo wards have no polygons)."""
    from ..services.geo import haversine_m
    best, best_d = None, 1500.0
    for r in repo.list_reports():
        if r.get("lat") is None or not r.get("ward"):
            continue
        d = haversine_m(lat, lng, r["lat"], r["lng"])
        if d < best_d:
            best, best_d = r["ward"], d
    return best


@router.get("/track/{report_id}")
def track(report_id: str):
    r = repo.get_report(report_id)
    if not r:
        raise HTTPException(404, detail={"message": f"No complaint found with ID {report_id.upper()}. Check the ID and try again."})
    return tracking_view(r)


@router.get("/public/reports")
def public_reports(limit: int = 12):
    limit = max(1, min(limit, 100))
    return [public_feed_item(r) for r in repo.list_reports()[:limit]]


@router.get("/public/map")
def public_map():
    return [public_feed_item(r) for r in repo.list_reports() if r.get("lat") is not None]


@router.get("/public/stats")
def public_stats():
    reports = repo.list_reports()
    m = metrics(reports)
    hs = detect_hotspots(reports)
    open_crit = sorted([r for r in reports if r["status"] not in ("resolved", "rejected")], key=lambda r: -r["priority_score"])
    example = None
    if open_crit:
        r = open_crit[0]
        example = {"id": r["id"], "category_label": config.CATEGORIES[r["category"]], "location_text": r["location_text"],
                   "headline": r["analysis"]["summary"]["what"], "priority": r["analysis"]["priority"] | {"score": r["priority_score"], "level": r["priority_level"]},
                   "duplicates": len(r["analysis"]["duplicates"]["matches"])}
    return {
        "metrics": m,
        "categories": distributions(reports)["category"],
        "hotspots": [{k: h[k] for k in ("id", "lat", "lng", "radius_m", "location", "ward", "count", "dominant_label",
                                         "critical_count", "avg_priority", "score", "reason", "kind")} for h in hs],
        "wards": sorted({r["ward"] for r in reports if r.get("ward")}),
        "engine_example": example,
        "demo_area": config.DEMO_AREA,
    }
