"""Complaint classifier: weighted keyword lexicon + phrase evidence, softmax-normalised confidence.

This is a deterministic, explainable NLP classifier — not a trained ML model. Every prediction
returns the exact phrases that produced it.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, asdict

from ..config import CATEGORIES
from .text import contains_any

# phrase -> weight. Multi-word phrases are stronger evidence than single words.
LEXICON: dict[str, dict[str, float]] = {
    "roads": {
        "pothole": 3, "potholes": 3, "road damage": 3, "damaged road": 3, "broken road": 3, "crater": 2.5,
        "road": 1, "tar": 1.5, "asphalt": 2, "speed breaker": 2, "divider": 1.5, "footpath": 1.5,
        "pavement": 1.5, "cracked": 1.2, "uneven": 1.2, "bridge": 1.2, "resurfac*": 2, "skid": 1.5,
        "two wheeler": 0.8, "gravel": 1.5, "road cave": 3, "caved": 2,
    },
    "waterlogging": {
        "waterlogging": 3.5, "waterlogged": 3.5, "flooded": 3, "flood": 3, "flooding": 3,
        "knee deep": 3, "ankle deep": 2.5, "water stagnant": 2.5, "stagnant water": 2.5,
        "rain water": 2, "rainwater": 2, "submerged": 3, "inundated": 3, "water entered": 2.5,
        "heavy rain": 1.5, "rain": 1, "stagnant": 2, "after rain": 1, "water accumulated": 2.5, "standing water": 2.5, "pool of water": 2,
    },
    "garbage": {
        "garbage": 3, "trash": 2.5, "waste": 2, "dustbin": 2.5, "bin overflowing": 3, "overflowing bin": 3,
        "litter": 2, "dump": 2, "dumping": 2.5, "stink": 1.5, "smell": 1, "foul smell": 1.5,
        "rotting": 1.5, "plastic": 1, "sanitation": 2, "not collected": 2, "garbage collection": 3,
        "stray dogs": 0.8, "flies": 1, "mosquito": 0.8, "burning garbage": 2.5,
    },
    "streetlights": {
        "streetlight": 3.5, "streetlights": 3.5, "street lamp": 3, "lamp post": 3, "light pole": 3,
        "not working light": 2, "lights off": 2, "dark": 1.2, "darkness": 1.5, "pitch dark": 2,
        "bulb": 1.5, "flicker*": 2, "pole": 1, "electric pole": 2.5, "transformer": 1.5, "live wire": 2,
        "sparking": 2, "wires exposed": 2, "exposed wire*": 2, "light": 0.8, "lights": 0.8, "lamp": 1.5,
    },
    "drainage": {
        "drain": 2.5, "drainage": 3, "gutter": 2.5, "sewage": 3, "sewer": 3, "clogged": 2,
        "blocked drain": 3.5, "drain blocked": 3.5, "choked": 2.5, "overflowing drain": 3.5,
        "manhole": 2.5, "open drain": 3, "sewage overflow": 3.5, "nala": 2.5, "culvert": 2.5, "silt": 1.5,
    },
    "public_safety": {
        "unsafe": 2.5, "danger": 1.5, "dangerous": 1.5, "accident": 2, "theft": 3, "robbery": 3,
        "harass*": 3, "assault": 3, "chain snatch*": 3, "fight": 2, "fire": 2.5, "smoke": 1.5,
        "fallen tree": 2.5, "tree fell": 2.5, "collapsed": 2, "wall collapse": 3, "stray dog": 1.5,
        "dog bite": 2.5, "snake": 2, "gas leak": 3, "live wire": 2.2, "suspicious": 2, "crime": 3,
        "women safety": 3, "no police": 2, "drunk": 1.5, "eve teasing": 3, "vandal*": 2,
    },
    "water_supply": {
        "no water": 3, "water supply": 3.5, "tap": 1.5, "pipeline": 2.5, "pipe burst": 3, "burst pipe": 3,
        "pipe leak": 3, "leaking pipe": 3, "drinking water": 3, "contaminated water": 3, "muddy water": 2.5,
        "low pressure": 2.5, "water tanker": 2.5, "water shortage": 3, "borewell": 2, "water meter": 2,
        "dirty water": 2.5, "no supply": 2.5,
    },
}

CONFIDENCE_FLOOR = 0.45  # below this the prediction is flagged for human review


@dataclass
class Classification:
    category: str
    label: str
    confidence: float
    evidence: list[str]
    explanation: str
    alternative: str | None
    alternative_label: str | None
    alternative_confidence: float | None
    scores: dict[str, float]
    needs_review: bool

    def to_dict(self) -> dict:
        return asdict(self)


def classify(text: str) -> Classification:
    raw: dict[str, float] = {}
    evidence: dict[str, list[str]] = {}
    for cat, lex in LEXICON.items():
        hits = contains_any(text, lex.keys())
        score = 0.0
        for h in hits:
            key = h if h in lex else h + "*"
            score += lex.get(key, 1.0)
        raw[cat] = score
        evidence[cat] = hits

    total = sum(raw.values())
    if total == 0:
        return Classification(
            category="other", label=CATEGORIES["other"], confidence=0.0, evidence=[],
            explanation="No civic-issue vocabulary was recognised in the description, so it is filed as Other for manual review.",
            alternative=None, alternative_label=None, alternative_confidence=None,
            scores={c: 0.0 for c in LEXICON}, needs_review=True,
        )

    # Softmax with temperature over evidence strength gives a calibrated-looking 0..1 confidence
    # that still rewards a clear winner. Temperature chosen so a 3-point margin ≈ 0.8 confidence.
    temp = 2.0
    exps = {c: math.exp(s / temp) for c, s in raw.items()}
    # Add an "other" pseudo-class so weak evidence never produces high confidence.
    exps_other = math.exp(1.5 / temp)
    z = sum(exps.values()) + exps_other
    probs = {c: e / z for c, e in exps.items()}
    ranked = sorted(probs.items(), key=lambda kv: kv[1], reverse=True)
    (best, p1), (second, p2) = ranked[0], ranked[1]

    confidence = round(p1, 3)
    needs_review = confidence < CONFIDENCE_FLOOR
    alt = second if (raw[second] > 0 and (needs_review or p2 > 0.2)) else None
    ev = evidence[best]
    explanation = (
        f"Matched {len(ev)} {CATEGORIES[best].lower()} signal{'s' if len(ev) != 1 else ''}: "
        + ", ".join(f"“{e}”" for e in ev[:5])
        + f". Evidence strength {raw[best]:.1f} vs {raw[second]:.1f} for the next category."
    )
    if needs_review:
        explanation += " Confidence is below the review threshold, so an officer should confirm the category."

    return Classification(
        category=best, label=CATEGORIES[best], confidence=confidence, evidence=ev,
        explanation=explanation,
        alternative=alt, alternative_label=CATEGORIES[alt] if alt else None,
        alternative_confidence=round(p2, 3) if alt else None,
        scores={c: round(p, 3) for c, p in probs.items()}, needs_review=needs_review,
    )
