"""Extractive + structured summariser.

Builds a short summary only from facts present in the complaint text and form fields:
what happened (category + key phrase), where (location field), who is affected, urgency and
safety concerns. It never adds facts that are not in the input.
"""
from __future__ import annotations

import re

from ..config import CATEGORIES
from .classifier import LEXICON
from .signals import Signals, extract
from .text import contains_any

_sentence_split = re.compile(r"(?<=[.!?])\s+|\n+")


def _key_sentence(text: str, category: str) -> str:
    sentences = [s.strip() for s in _sentence_split.split(text) if len(s.strip()) > 3]
    if not sentences:
        return text.strip()
    lex = LEXICON.get(category, {})

    def score(s: str) -> float:
        hits = contains_any(s, lex.keys())
        return sum(lex.get(h, lex.get(h + "*", 1)) for h in hits) + 0.01 * min(len(s), 120) / 120

    best = max(sentences, key=score)
    best = best.rstrip(".!? ")
    if len(best) > 140:
        cut = best[:140].rsplit(" ", 1)[0]
        best = cut + "…"
    return best[0].upper() + best[1:] if best else best


def summarize(description: str, category: str, location_text: str, signals: Signals | None = None,
              affected_people: int | None = None) -> dict:
    sig = signals or extract(description)
    what = _key_sentence(description, category)
    where = (location_text or "").strip() or "location not specified"

    affected = [label for _, _, label in sig.affected]
    people = affected_people or sig.people_mentioned
    safety = [label for _, _, label in sig.hazards]
    urgency_bits = [u for u, _ in sig.urgency]
    if sig.duration_text:
        urgency_bits.insert(0, sig.duration_text)

    parts = [f"{CATEGORIES.get(category, 'Issue')} at {where}: {what}."]
    if affected or people:
        who = ", ".join(affected[:3]) if affected else "people"
        parts.append(f"Affects {who}" + (f" (about {people} people reported)" if people else "") + ".")
    if safety:
        parts.append("Safety concern: " + ", ".join(safety[:3]) + ".")
    if urgency_bits:
        parts.append("Urgency cues: " + ", ".join(dict.fromkeys(urgency_bits[:3])) + ".")

    return {
        "text": " ".join(parts),
        "what": what,
        "where": where,
        "affected": affected,
        "people": people,
        "safety_concerns": safety,
        "urgency_cues": list(dict.fromkeys(urgency_bits)),
        "method": "extractive",
    }
