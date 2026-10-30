"""Duplicate / related-report detection.

score = 0.40·text + 0.20·category + 0.30·geo + 0.10·time

  text      TF-IDF cosine similarity of unigrams+bigrams (normalised, stop-words removed, light stemming)
  category  1 if same category, 0.5 if related (waterlogging<->drainage, streetlights<->public safety), else 0
  geo       1 - distance/500 m (0 beyond 500 m; 0.3 neutral when either report lacks coordinates)
  time      1 - days_apart/14 (0 beyond 14 days)

likely duplicate   score ≥ 0.70, or score ≥ 0.60 with same category, geo ≥ 0.70 (≤150 m) and text ≥ 0.15
possibly related   ≥ 0.50

Reports are never deleted or merged: matches are stored as links and each citizen keeps their own ID.
"""
from __future__ import annotations

from datetime import datetime

from .geo import distance_between
from .text import TfIdf, cosine, shared_terms

WEIGHTS = {"text": 0.40, "category": 0.20, "geo": 0.30, "time": 0.10}
GEO_RADIUS_M = 500
TIME_WINDOW_DAYS = 14
LIKELY = 0.70
LIKELY_NEARBY = 0.60
POSSIBLE = 0.50

RELATED_CATEGORIES = {
    frozenset({"waterlogging", "drainage"}),
    frozenset({"streetlights", "public_safety"}),
    frozenset({"roads", "waterlogging"}),
    frozenset({"drainage", "garbage"}),
}


def _category_score(a: str, b: str) -> float:
    if a == b:
        return 1.0
    if frozenset({a, b}) in RELATED_CATEGORIES:
        return 0.5
    return 0.0


def _days_apart(a: str, b: str) -> float:
    return abs((datetime.fromisoformat(a) - datetime.fromisoformat(b)).total_seconds()) / 86400


def find_duplicates(new: dict, existing: list[dict], limit: int = 5) -> dict:
    """`new` and `existing` items need: id, description, category, lat, lng, created_at, location_text."""
    candidates = [e for e in existing if e["id"] != new.get("id")]
    if not candidates:
        return {"likelihood": "none", "top_score": 0.0, "matches": [], "weights": WEIGHTS}

    docs = [f"{c['description']} {c.get('location_text') or ''}" for c in candidates]
    new_doc = f"{new['description']} {new.get('location_text') or ''}"
    tfidf = TfIdf(docs + [new_doc])
    vecs = tfidf.vectors()
    new_vec = vecs[-1]

    matches = []
    for c, vec in zip(candidates, vecs[:-1]):
        text = cosine(new_vec, vec)
        cat = _category_score(new["category"], c["category"])
        dist = distance_between(new, c)
        geo = 0.3 if dist is None else max(0.0, 1 - dist / GEO_RADIUS_M)
        days = _days_apart(new["created_at"], c["created_at"])
        time = max(0.0, 1 - days / TIME_WINDOW_DAYS)
        score = (WEIGHTS["text"] * text + WEIGHTS["category"] * cat
                 + WEIGHTS["geo"] * geo + WEIGHTS["time"] * time)
        if score < POSSIBLE:
            continue
        likely = score >= LIKELY or (score >= LIKELY_NEARBY and cat == 1.0 and geo >= 0.7 and text >= 0.15)
        reasons = []
        if text >= 0.25:
            common = shared_terms(new_doc, docs[candidates.index(c)])
            reasons.append(f"Similar wording ({text:.0%})" + (f": {', '.join(common)}" if common else ""))
        if cat == 1.0:
            reasons.append("Same category")
        elif cat == 0.5:
            reasons.append("Related category")
        if dist is not None and dist <= GEO_RADIUS_M:
            reasons.append(f"{dist:.0f} m apart")
        if days <= TIME_WINDOW_DAYS:
            reasons.append(f"Reported {days:.1f} days apart" if days >= 1 else "Reported within 24 hours")
        matches.append({
            "id": c["id"],
            "score": round(score, 3),
            "likelihood": "likely" if likely else "possible",
            "components": {"text": round(text, 3), "category": cat, "geo": round(geo, 3), "time": round(time, 3)},
            "distance_m": None if dist is None else round(dist),
            "days_apart": round(days, 1),
            "reasons": reasons,
            "category": c["category"],
            "status": c.get("status"),
            "location_text": c.get("location_text"),
        })

    matches.sort(key=lambda m: m["score"], reverse=True)
    matches = matches[:limit]
    top = matches[0]["score"] if matches else 0.0
    likelihood = "none"
    if matches:
        likelihood = "likely" if any(m["likelihood"] == "likely" for m in matches) else "possible"
    return {"likelihood": likelihood, "top_score": round(top, 3), "matches": matches, "weights": WEIGHTS}
