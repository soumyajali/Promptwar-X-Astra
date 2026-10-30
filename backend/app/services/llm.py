"""Optional language-model phrasing for the assistant (Anthropic Messages API).

Off unless ANTHROPIC_API_KEY is set. The model never queries the database itself: it receives the
question plus the facts the local engine already computed, and is told to answer only from them.
Its reply is rejected (and the local answer used) when:
  - the API call fails, times out or returns no text, or
  - the reply contains a number that does not appear in the supplied facts.
Every response states which engine produced it.
"""
from __future__ import annotations

import json
import logging
import os
import re

import httpx

log = logging.getLogger("civicpulse.llm")

API_URL = os.getenv("CIVICPULSE_LLM_URL", "https://api.anthropic.com/v1/messages")
MODEL = os.getenv("CIVICPULSE_LLM_MODEL", "claude-haiku-5-5")
API_VERSION = os.getenv("CIVICPULSE_LLM_API_VERSION", "2023-06-01")
TIMEOUT_S = float(os.getenv("CIVICPULSE_LLM_TIMEOUT", "12"))

SYSTEM = (
    "You are the CivicPulse assistant for a municipal ward office. Answer the officer's question using ONLY the "
    "JSON facts provided. Never invent reports, places, numbers or statistics. If the facts do not answer the "
    "question, say plainly that the stored data does not answer it. Keep report IDs (like CP-ABC123) and hotspot IDs "
    "(like H1) exactly as given. Reply in plain sentences, at most 90 words, no markdown headings or lists."
)


def api_key() -> str | None:
    return os.getenv("ANTHROPIC_API_KEY") or None


def enabled() -> bool:
    return api_key() is not None


def status() -> dict:
    return {"enabled": enabled(), "model": MODEL if enabled() else None}


_num = re.compile(r"(?<![A-Za-z-])\d+(?:\.\d+)?")


def numbers_supported(reply: str, facts_blob: str) -> bool:
    """Every number in the reply must already appear in the facts (IDs like CP-1A2B3C are ignored)."""
    allowed = set(_num.findall(facts_blob))
    for n in _num.findall(re.sub(r"\b(?:CP-[A-Z0-9]{6}|H\d+)\b", "", reply)):
        if n not in allowed and n.rstrip("0").rstrip(".") not in allowed:
            return False
    return True


def phrase(question: str, local: dict, *, client: httpx.Client | None = None) -> tuple[str | None, str | None]:
    """Return (text, None) on success or (None, reason) when the local answer must be used."""
    key = api_key()
    if not key:
        return None, "no API key configured"
    facts = {
        "question": question,
        "computed_answer": local["answer"],
        "items": local.get("items", []),
        "evidence": local.get("evidence", []),
    }
    blob = json.dumps(facts, ensure_ascii=False)
    body = {
        "model": MODEL,
        "max_tokens": 300,
        "system": SYSTEM,
        "messages": [{"role": "user", "content": f"Facts (JSON):\n{blob}\n\nQuestion: {question}"}],
    }
    headers = {"x-api-key": key, "anthropic-version": API_VERSION, "content-type": "application/json"}
    try:
        c = client or httpx.Client(timeout=TIMEOUT_S)
        try:
            res = c.post(API_URL, headers=headers, json=body)
        finally:
            if client is None:
                c.close()
        if res.status_code != 200:
            return None, f"language model returned HTTP {res.status_code}"
        data = res.json()
        text = "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text").strip()
    except (httpx.HTTPError, ValueError) as e:
        log.warning("LLM call failed: %s", e)
        return None, f"language model unavailable ({e.__class__.__name__})"
    if not text:
        return None, "language model returned no text"
    if not numbers_supported(text, blob):
        return None, "language model reply contained figures not in the data; local answer shown instead"
    return text, None
