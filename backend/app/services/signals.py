"""Shared signal lexicons: safety hazards, severity, urgency and affected groups.

Used by both the summariser (to describe a complaint) and the priority engine (to score it),
so the explanation a citizen sees and the score an officer sees always agree.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field

from .text import contains_any, normalize

# phrase -> (risk weight 0..1, plain-English description)
HAZARDS: dict[str, tuple[float, str]] = {
    "live wire": (1.0, "exposed live electrical wire"),
    "electric shock": (1.0, "electric shock risk"),
    "electrocut*": (1.0, "electrocution risk"),
    "sparking": (0.9, "sparking electrical equipment"),
    "short circuit": (0.85, "short circuit"),
    "open manhole": (0.95, "open manhole"),
    "manhole open": (0.95, "open manhole"),
    "uncovered manhole": (0.95, "uncovered manhole"),
    "gas leak": (1.0, "gas leak"),
    "fire": (0.9, "fire"),
    "collapse*": (0.85, "structural collapse"),
    "fallen tree": (0.75, "fallen tree"),
    "tree fell": (0.75, "fallen tree"),
    "accident": (0.8, "accidents reported"),
    "accidents": (0.8, "accidents reported"),
    "injur*": (0.85, "injuries reported"),
    "fell": (0.6, "people have fallen"),
    "skid*": (0.6, "vehicles skidding"),
    "drown*": (1.0, "drowning risk"),
    "assault": (0.9, "assault"),
    "harass*": (0.85, "harassment"),
    "chain snatch*": (0.8, "chain snatching"),
    "robbery": (0.85, "robbery"),
    "theft": (0.6, "theft"),
    "dog bite": (0.75, "dog bites"),
    "snake": (0.6, "snakes sighted"),
    "contaminat*": (0.75, "contaminated water"),
    "sewage mixed": (0.8, "sewage mixing with water"),
    "disease": (0.6, "disease risk"),
    "dengue": (0.7, "dengue risk"),
    "mosquito": (0.35, "mosquito breeding"),
    "unsafe": (0.55, "unsafe conditions"),
    "dangerous": (0.55, "dangerous conditions"),
    "pitch dark": (0.5, "complete darkness at night"),
    "deep pothole": (0.55, "deep pothole"),
    "stranded": (0.6, "people stranded"),
}

SEVERITY: dict[str, float] = {
    "knee deep": 0.9, "waist deep": 1.0, "ankle deep": 0.5, "submerged": 0.9, "completely blocked": 0.8,
    "overflowing": 0.6, "burst": 0.8, "huge": 0.6, "massive": 0.7, "deep": 0.5, "large": 0.4, "big": 0.35,
    "severe": 0.7, "major": 0.6, "entire street": 0.7, "whole area": 0.7, "entire road": 0.7,
    "entered houses": 0.85, "water entered": 0.8, "no water": 0.7, "broken": 0.4, "damaged": 0.4,
    "completely": 0.5, "all lights": 0.6, "several": 0.4, "multiple": 0.4, "spreading": 0.5, "stinking": 0.4,
}

URGENCY: dict[str, float] = {
    "urgent": 0.8, "urgently": 0.8, "emergency": 1.0, "immediately": 0.8, "right now": 0.7,
    "getting worse": 0.7, "worsening": 0.7, "rising": 0.6, "still": 0.3, "again": 0.4, "every year": 0.5,
    "every monsoon": 0.6, "at night": 0.4, "tonight": 0.6, "today": 0.3, "since morning": 0.4, "since this morning": 0.45,
    "since yesterday": 0.5, "since last night": 0.5, "cannot reach": 0.4, "can not reach": 0.4, "stuck": 0.4,
    "for days": 0.5, "for weeks": 0.6, "for a week": 0.55, "no action": 0.5, "repeatedly": 0.5,
    "complained before": 0.5, "multiple complaints": 0.5,
}

# phrase -> (impact weight, group label)
AFFECTED: dict[str, tuple[float, str]] = {
    "school": (0.9, "school children"), "students": (0.8, "students"), "children": (0.8, "children"),
    "kids": (0.7, "children"), "hospital": (1.0, "hospital access"), "ambulance": (1.0, "ambulance access"),
    "elderly": (0.7, "elderly residents"), "senior citizens": (0.7, "elderly residents"),
    "bus stand": (0.85, "bus commuters"), "commuters": (0.75, "commuters"), "pedestrians": (0.65, "pedestrians"),
    "market": (0.75, "market traders and shoppers"), "shops": (0.5, "shopkeepers"), "traffic": (0.6, "traffic"),
    "main road": (0.7, "main-road traffic"), "highway": (0.8, "highway traffic"), "junction": (0.6, "junction traffic"),
    "residents": (0.5, "residents"), "families": (0.5, "families"), "houses": (0.5, "households"),
    "two wheeler": (0.5, "two-wheeler riders"), "vehicles": (0.5, "vehicles"), "women": (0.6, "women"),
    "temple": (0.5, "worshippers"), "church": (0.5, "worshippers"), "mosque": (0.5, "worshippers"),
    "apartment": (0.5, "apartment residents"), "colony": (0.45, "colony residents"),
}

_duration = re.compile(r"(?:for|since|past|last)\s+(\d+|a|one|two|three|four|five|six|seven|several|many)\s+(hour|day|week|month)s?")
_numbers = {"a": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "several": 3, "many": 4}
_people = re.compile(r"(\d{2,6})\s*(?:\+\s*)?(?:people|residents|families|households|students|houses|commuters)")


def _match(text: str, table: dict) -> list[str]:
    return contains_any(text, table.keys())


def _lookup(table: dict, hit: str):
    return table.get(hit, table.get(hit + "*"))


@dataclass
class Signals:
    hazards: list[tuple[str, float, str]] = field(default_factory=list)  # (phrase, weight, label)
    severity: list[tuple[str, float]] = field(default_factory=list)
    urgency: list[tuple[str, float]] = field(default_factory=list)
    affected: list[tuple[str, float, str]] = field(default_factory=list)
    duration_days: float | None = None
    duration_text: str | None = None
    people_mentioned: int | None = None

    @property
    def safety_level(self) -> float:
        return max((w for _, w, _ in self.hazards), default=0.0)


def extract(text: str) -> Signals:
    s = Signals()
    for h in _match(text, HAZARDS):
        w, label = _lookup(HAZARDS, h)
        s.hazards.append((h, w, label))
    for h in _match(text, SEVERITY):
        s.severity.append((h, SEVERITY[h]))
    for h in _match(text, URGENCY):
        s.urgency.append((h, URGENCY[h]))
    # Strongest groups first; drop a label already covered by a more specific one
    # (e.g. "children" when "school children" is present).
    for h in sorted(_match(text, AFFECTED), key=lambda x: -AFFECTED[x][0]):
        w, label = AFFECTED[h]
        if any(label == l or label in l or l in label for _, _, l in s.affected):
            continue
        s.affected.append((h, w, label))

    t = normalize(text)
    m = _duration.search(t)
    if m:
        qty = m.group(1)
        n = int(qty) if qty.isdigit() else _numbers.get(qty, 1)
        unit = m.group(2)
        days = {"hour": n / 24, "day": n, "week": n * 7, "month": n * 30}[unit]
        s.duration_days = days
        s.duration_text = m.group(0)
    p = _people.search(t)
    if p:
        s.people_mentioned = int(p.group(1))
    # de-duplicate hazard labels
    uniq, seen = [], set()
    for h in sorted(s.hazards, key=lambda x: -x[1]):
        if h[2] not in seen:
            uniq.append(h)
            seen.add(h[2])
    s.hazards = uniq
    return s
