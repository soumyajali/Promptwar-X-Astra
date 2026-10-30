"""Text normalisation shared by every NLP service: lowercasing, tokenising, stop words, light stemming."""
from __future__ import annotations

import math
import re
from collections import Counter

STOPWORDS = set("""
a an the and or but if of to in on at by for with from into onto over under near
is are was were be been being am i we you he she it they them this that these those
my our your their its me us him her there here very so too also just only not no
has have had do does did can could would should will shall may might must
since about as than then such which who whom what when where why how all any some
please kindly sir madam team dear hello hi regards thanks thank
""".split())

# Hand-written normalisations so that "potholes", "pothole", "pot hole" compare equal.
SYNONYMS = {
    "pot hole": "pothole", "pot-hole": "pothole", "water logging": "waterlogging",
    "water-logging": "waterlogging", "water logged": "waterlogged", "street light": "streetlight",
    "street-light": "streetlight", "street lamp": "streetlight", "bus stop": "bus stand",
    "busstand": "bus stand", "man hole": "manhole", "dust bin": "dustbin",
}

_word = re.compile(r"[a-z0-9]+")


def normalize(text: str) -> str:
    t = (text or "").lower()
    for k, v in SYNONYMS.items():
        t = t.replace(k, v)
    return re.sub(r"\s+", " ", t).strip()


def stem(token: str) -> str:
    """Very small suffix stripper — enough to merge plurals and -ing/-ed forms."""
    for suffix in ("ings", "ing", "edly", "ed", "ies", "es", "s"):
        if len(token) > len(suffix) + 3 and token.endswith(suffix):
            base = token[: -len(suffix)]
            return base + "y" if suffix == "ies" else base
    return token


def tokens(text: str) -> list[str]:
    return [stem(w) for w in _word.findall(normalize(text)) if w not in STOPWORDS and len(w) > 1]


def terms(text: str) -> list[str]:
    """Unigrams plus bigrams, used for TF-IDF vectors."""
    toks = tokens(text)
    return toks + [f"{a}_{b}" for a, b in zip(toks, toks[1:])]


def contains_any(text: str, phrases) -> list[str]:
    """Return which phrases appear in the normalised text (word-boundary aware)."""
    t = " " + re.sub(r"[^a-z0-9 ]", " ", normalize(text)) + " "
    t = re.sub(r"\s+", " ", t)
    hits = []
    for p in phrases:
        if f" {p} " in t or (p.endswith("*") and f" {p[:-1]}" in t):
            hits.append(p.rstrip("*"))
    return hits


class TfIdf:
    """Minimal TF-IDF with smoothed IDF and L2 normalised sparse vectors."""

    def __init__(self, documents: list[str]):
        self.doc_terms = [Counter(terms(d)) for d in documents]
        n = len(documents)
        df: Counter = Counter()
        for c in self.doc_terms:
            df.update(c.keys())
        self.n = n
        self.idf = {t: math.log((1 + n) / (1 + f)) + 1 for t, f in df.items()}

    def vector(self, counts: Counter) -> dict[str, float]:
        default_idf = math.log((1 + self.n) / 1) + 1
        vec = {t: (1 + math.log(c)) * self.idf.get(t, default_idf) for t, c in counts.items()}
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        return {t: v / norm for t, v in vec.items()}

    def vectors(self) -> list[dict[str, float]]:
        return [self.vector(c) for c in self.doc_terms]


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if len(a) > len(b):
        a, b = b, a
    return sum(v * b.get(t, 0.0) for t, v in a.items())


def shared_terms(a: str, b: str, limit: int = 5) -> list[str]:
    """Words the two texts share, matched on stems but shown as readable words from text `a`."""
    words_a = {w: stem(w) for w in _word.findall(normalize(a)) if w not in STOPWORDS and len(w) > 2}
    stems_b = {stem(w) for w in _word.findall(normalize(b))}
    out = sorted({w for w, s in words_a.items() if s in stems_b}, key=len, reverse=True)
    return out[:limit]
