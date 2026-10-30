"""Geographic hotspot detection with DBSCAN over haversine distance (pure Python, O(n²)).

eps = 350 m, min_samples = 3, run on open reports with coordinates. Each cluster becomes a
hotspot; its score blends size, mean priority and critical count. The same function feeds the map,
dashboard, landing page, action brief and assistant, so every view shows identical hotspots.
"""
from __future__ import annotations

from collections import Counter

from ..config import CATEGORIES, CATEGORY_DEPARTMENT, DEPARTMENTS
from .geo import haversine_m

EPS_M = 350
MIN_SAMPLES = 3

INTERVENTIONS = {
    "waterlogging": "Clear and upsize storm-water inlets; pre-position pumps before the next heavy rain",
    "drainage": "Desilt the drain network along this stretch and repair broken covers",
    "roads": "Schedule a full resurfacing of this stretch rather than spot patching",
    "garbage": "Add bin capacity and an extra daily collection round",
    "streetlights": "Audit the lighting circuit for this block and replace failing fixtures together",
    "public_safety": "Increase patrols and fix lighting; review with the public safety cell",
    "water_supply": "Inspect the distribution main serving this area for leaks and pressure loss",
    "other": "Ward officer site visit to triage the mixed issues",
}


def dbscan(points: list[tuple[float, float]], eps_m: float = EPS_M, min_samples: int = MIN_SAMPLES) -> list[int]:
    """Return a cluster label per point (-1 = noise)."""
    n = len(points)
    labels = [None] * n
    neighbours = [[j for j in range(n) if haversine_m(*points[i], *points[j]) <= eps_m] for i in range(n)]
    cluster = -1
    for i in range(n):
        if labels[i] is not None:
            continue
        if len(neighbours[i]) < min_samples:
            labels[i] = -1
            continue
        cluster += 1
        labels[i] = cluster
        seeds = [j for j in neighbours[i] if j != i]
        k = 0
        while k < len(seeds):
            j = seeds[k]
            if labels[j] == -1:
                labels[j] = cluster  # border point
            if labels[j] is None:
                labels[j] = cluster
                if len(neighbours[j]) >= min_samples:
                    seeds.extend(x for x in neighbours[j] if x not in seeds)
            k += 1
    return [l if l is not None else -1 for l in labels]


def detect_hotspots(reports: list[dict]) -> list[dict]:
    pts = [r for r in reports if r.get("lat") is not None and r.get("status") not in ("resolved", "rejected")]
    if not pts:
        return []
    labels = dbscan([(r["lat"], r["lng"]) for r in pts])
    groups: dict[int, list[dict]] = {}
    for r, l in zip(pts, labels):
        if l >= 0:
            groups.setdefault(l, []).append(r)

    hotspots = []
    for members in groups.values():
        n = len(members)
        lat = sum(m["lat"] for m in members) / n
        lng = sum(m["lng"] for m in members) / n
        radius = max(haversine_m(lat, lng, m["lat"], m["lng"]) for m in members)
        cats = Counter(m["category"] for m in members)
        dominant, dom_n = cats.most_common(1)[0]
        critical = sum(1 for m in members if m["priority_level"] == "critical")
        high = sum(1 for m in members if m["priority_level"] == "high")
        avg = sum(m["priority_score"] for m in members) / n
        place = Counter(m["location_text"] for m in members).most_common(1)[0][0]
        ward = Counter(m.get("ward") or "—" for m in members).most_common(1)[0][0]
        hscore = round(min(100, 0.5 * avg + 8 * critical + 4 * high + 3 * n))

        reasons = [f"{n} open reports within {EPS_M} m of each other"]
        if dom_n >= 2:
            reasons.append(f"{dom_n} are {CATEGORIES[dominant].lower()}")
        if critical:
            reasons.append(f"{critical} rated Critical")
        if len(cats) >= 3:
            reasons.append(f"{len(cats)} different infrastructure issues in one place")
        kind = "recurring" if dom_n / n >= 0.6 else "multi-issue"

        hotspots.append({
            "lat": round(lat, 6), "lng": round(lng, 6), "radius_m": round(max(radius, 60)),
            "location": place, "ward": ward, "count": n,
            "dominant_category": dominant, "dominant_label": CATEGORIES[dominant],
            "categories": dict(cats), "critical_count": critical, "high_count": high,
            "avg_priority": round(avg, 1), "score": hscore, "kind": kind,
            "department": DEPARTMENTS[CATEGORY_DEPARTMENT[dominant]],
            "intervention": INTERVENTIONS.get(dominant, INTERVENTIONS["other"]),
            "reason": "; ".join(reasons) + ".",
            "report_ids": [m["id"] for m in sorted(members, key=lambda m: -m["priority_score"])],
        })
    hotspots.sort(key=lambda h: h["score"], reverse=True)
    for i, h in enumerate(hotspots, 1):
        h["id"] = f"H{i}"
        h["rank"] = i
    return hotspots
