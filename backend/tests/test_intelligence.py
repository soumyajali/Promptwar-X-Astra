"""Unit tests for the intelligence services (no database needed)."""
from datetime import datetime, timedelta

from app.services.classifier import classify
from app.services.duplicates import find_duplicates
from app.services.hotspots import dbscan, detect_hotspots
from app.services.priority import level_for, score_priority
from app.services.recommender import recommend
from app.services.signals import extract
from app.services.summarizer import summarize


# ---------- classification
def test_classifies_clear_categories():
    cases = {
        "Knee deep waterlogging near the bus stand after heavy rain": "waterlogging",
        "Huge pothole on the main road, two wheelers skidding": "roads",
        "Garbage bins overflowing at the market, foul smell": "garbage",
        "Streetlight not working, the lane is pitch dark": "streetlights",
        "Drain completely blocked and sewage overflowing": "drainage",
        "No water supply for three days, pipeline burst": "water_supply",
        "Chain snatching and harassment near the park at night": "public_safety",
    }
    for text, expected in cases.items():
        c = classify(text)
        assert c.category == expected, (text, c.category, c.scores)
        assert c.confidence >= 0.45
        assert c.evidence and c.explanation


def test_unknown_text_goes_to_other_with_review_flag():
    c = classify("The neighbour plays loud music sometimes")
    assert c.category == "other"
    assert c.needs_review
    assert c.confidence == 0.0


def test_ambiguous_text_offers_alternative():
    c = classify("Water from the broken drain is flooding the road")
    assert c.alternative is not None
    assert c.alternative != c.category


# ---------- summarisation
def test_summary_preserves_facts_and_does_not_invent():
    text = ("Knee deep water near the bus stand since 2 days. School children and commuters are stuck. "
            "An open manhole is hidden under the water.")
    s = summarize(text, "waterlogging", "Central Bus Stand")
    assert "Central Bus Stand" in s["text"]
    assert "open manhole" in s["safety_concerns"]
    assert "school children" in s["affected"]
    assert any("2 day" in u for u in s["urgency_cues"])
    # nothing that is not in the input
    s2 = summarize("Garbage not collected near the temple", "garbage", "Car Street")
    assert s2["safety_concerns"] == []
    assert s2["people"] is None


# ---------- duplicates
def _r(i, text, cat, lat, lng, days_ago=0):
    t = (datetime(2026, 10, 30, 12) - timedelta(days=days_ago)).isoformat()
    return {"id": f"R{i}", "description": text, "category": cat, "lat": lat, "lng": lng,
            "created_at": t, "location_text": "Bus stand", "status": "submitted"}


def test_duplicate_detected_for_nearby_similar_report():
    existing = [
        _r(1, "Waterlogging at bus stand, knee deep water", "waterlogging", 12.8702, 74.8426, 1),
        _r(2, "Garbage overflowing at market", "garbage", 12.8668, 74.8382, 1),
        _r(3, "Waterlogging at bus stand knee deep", "waterlogging", 12.9500, 74.9000, 30),
    ]
    new = _r(9, "Knee deep waterlogging near the bus stand", "waterlogging", 12.8703, 74.8427)
    res = find_duplicates(new, existing)
    assert res["likelihood"] == "likely"
    top = res["matches"][0]
    assert top["id"] == "R1"
    assert top["distance_m"] < 50
    assert any("Same category" in r for r in top["reasons"])
    assert all(m["id"] != "R2" for m in res["matches"])  # unrelated report is not matched


def test_far_away_old_report_is_not_likely_duplicate():
    existing = [_r(3, "Waterlogging at bus stand knee deep", "waterlogging", 12.9500, 74.9000, 30)]
    new = _r(9, "Knee deep waterlogging near the bus stand", "waterlogging", 12.8703, 74.8427)
    res = find_duplicates(new, existing)
    assert res["likelihood"] != "likely"


# ---------- priority
def test_priority_explainable_and_bounded():
    s = extract("Live wire sparking near school, emergency, children play here")
    p = score_priority("streetlights", s, linked_count=2, same_category_nearby=1, open_nearby=4)
    assert 0 <= p["score"] <= 100
    assert p["level"] == "critical"
    assert sum(f["weight"] for f in p["factors"]) == 100
    assert abs(sum(f["points"] for f in p["factors"]) - p["score"]) <= 1
    assert "Safety" in p["reasoning"] or "safety" in p["reasoning"]


def test_minor_issue_scores_low():
    p = score_priority("garbage", extract("Small plastic litter near the lake"))
    assert p["level"] in ("low", "medium")
    assert p["score"] < 40


def test_levels():
    assert level_for(90) == "critical" and level_for(60) == "high" and level_for(35) == "medium" and level_for(5) == "low"


# ---------- recommendations
def test_recommendation_escalates_electrical_hazard():
    rec = recommend("streetlights", "critical", extract("live wire hanging and sparking"))
    assert "electrical" in rec["primary"]["action"].lower()
    assert rec["department"] == "electricity"
    assert rec["response_target"] == "within 4 hours"


# ---------- hotspots
def test_dbscan_finds_cluster_and_noise():
    pts = [(12.8700, 74.8426), (12.8701, 74.8427), (12.8702, 74.8425), (12.8703, 74.8428), (12.9000, 74.9000)]
    labels = dbscan(pts, eps_m=100, min_samples=3)
    assert len(set(labels[:4])) == 1 and labels[0] >= 0
    assert labels[4] == -1


def test_hotspot_summary_fields():
    reports = [
        {"id": f"R{i}", "lat": 12.8700 + i * 0.0002, "lng": 74.8426, "status": "submitted", "category": "drainage",
         "priority_level": "critical" if i == 0 else "high", "priority_score": 80 - i, "location_text": "Bus stand", "ward": "Station Ward"}
        for i in range(4)
    ] + [{"id": "Z", "lat": 12.9, "lng": 74.9, "status": "resolved", "category": "roads", "priority_level": "low",
          "priority_score": 10, "location_text": "Far", "ward": "X"}]
    hs = detect_hotspots(reports)
    assert len(hs) == 1
    h = hs[0]
    assert h["count"] == 4 and h["dominant_category"] == "drainage" and h["critical_count"] == 1
    assert h["reason"] and h["intervention"] and h["id"] == "H1"


# ---------- regressions found during the end-to-end demo run
def test_relative_time_phrases_count_as_urgency():
    s = extract("Water at the bus stand since this morning, commuters cannot reach the buses")
    assert {"since this morning", "cannot reach"} <= {p for p, _ in s.urgency}


def test_summary_does_not_repeat_overlapping_groups():
    s = summarize("Flooding near the school, school children and children stuck", "waterlogging", "Main road")
    assert s["affected"].count("children") == 0 and "school children" in s["affected"]


def test_duplicate_reasons_use_readable_words():
    from app.services.text import shared_terms
    assert "waterlogging" in shared_terms("waterlogging at the platform", "waterlogged platform")
