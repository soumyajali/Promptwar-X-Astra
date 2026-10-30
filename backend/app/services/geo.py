"""Geographic helpers."""
from __future__ import annotations

import math

EARTH_RADIUS_M = 6_371_000


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def has_coords(r) -> bool:
    return r.get("lat") is not None and r.get("lng") is not None


def distance_between(a: dict, b: dict) -> float | None:
    if has_coords(a) and has_coords(b):
        return haversine_m(a["lat"], a["lng"], b["lat"], b["lng"])
    return None
