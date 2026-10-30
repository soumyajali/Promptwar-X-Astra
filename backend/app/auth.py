"""Demo accounts for citizens and ward-office staff.

Passwords are stored as salted PBKDF2-SHA256 hashes; sessions are random bearer tokens stored only as SHA-256
hashes. This is a hackathon demo login, not government identity verification.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Header, HTTPException

from . import config, db

ITERATIONS = 200_000
SESSION_HOURS = int(os.getenv("CIVICPULSE_SESSION_HOURS", "12"))


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, it, salt, digest = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(it))
        return hmac.compare_digest(dk.hex(), digest)
    except (ValueError, AttributeError):
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def public_user(u: dict) -> dict:
    return {"id": u["id"], "name": u["name"], "email": u["email"], "role": u["role"], "title": u.get("title")}


def get_user_by_email(email: str) -> dict | None:
    rows = db.query("SELECT * FROM users WHERE email = ?", (email.strip().lower(),))
    return dict(rows[0]) if rows else None


def create_user(name: str, email: str, password: str, role: str = "citizen", title: str | None = None) -> dict:
    now = _now().isoformat()
    with db.tx() as conn:
        cur = conn.execute(
            "INSERT INTO users (name, email, password_hash, role, title, created_at) VALUES (?,?,?,?,?,?)",
            (name.strip(), email.strip().lower(), hash_password(password), role, title, now))
        uid = cur.lastrowid
    return dict(db.query("SELECT * FROM users WHERE id = ?", (uid,))[0])


def create_session(user: dict) -> str:
    token = secrets.token_urlsafe(32)
    now = _now()
    with db.tx() as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (now.isoformat(),))
        conn.execute("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)",
                     (_token_hash(token), user["id"], now.isoformat(), (now + timedelta(hours=SESSION_HOURS)).isoformat()))
    return token


def end_session(token: str) -> None:
    with db.tx() as conn:
        conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))


def user_for_token(token: str | None) -> dict | None:
    if not token:
        return None
    rows = db.query(
        "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?",
        (_token_hash(token), _now().isoformat()))
    return dict(rows[0]) if rows else None


def bearer(authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip() or None
    return None


# ---- FastAPI dependencies -------------------------------------------------------------------------------------

def optional_user(authorization: str | None = Header(None)) -> dict | None:
    return user_for_token(bearer(authorization))


def require_user(authorization: str | None = Header(None)) -> dict:
    u = user_for_token(bearer(authorization))
    if not u:
        raise HTTPException(401, detail={"message": "Please sign in again."})
    return u


def require_citizen(authorization: str | None = Header(None)) -> dict:
    u = require_user(authorization)
    if u["role"] != "citizen":
        raise HTTPException(403, detail={"message": "This page is for citizen accounts."})
    return u


def authority_actor(authorization: str | None, x_authority_code: str | None) -> str:
    """Authority staff sign in with a named account. The legacy shared access code (used by the API tests and
    scripts) still works and acts as a generic ward officer."""
    u = user_for_token(bearer(authorization))
    if u:
        if u["role"] != "authority":
            raise HTTPException(403, detail={"message": "Citizen accounts cannot open the Command Center."})
        return f"{u['name']} ({u['title'] or 'Ward office'})"
    if x_authority_code and hmac.compare_digest(x_authority_code, config.AUTHORITY_CODE):
        return "Ward Officer (demo)"
    raise HTTPException(401, detail={"message": "Authority sign-in required."})


# ---- Demo accounts ---------------------------------------------------------------------------------------------
# Synthetic people. Credentials are documented in the README; only their hashes are stored.
DEMO_ACCOUNTS = [
    {"name": "Priya Shetty", "email": "officer@civicpulse.demo", "password": "Officer@2026", "role": "authority",
     "title": "Ward Officer"},
    {"name": "Er. Anil Rao", "email": "engineer@civicpulse.demo", "password": "Engineer@2026", "role": "authority",
     "title": "Assistant Engineer, Road Maintenance"},
    {"name": "Ravi Kumar", "email": "citizen@civicpulse.demo", "password": "Citizen@2026", "role": "citizen",
     "title": None},
]


def seed_accounts() -> int:
    n = 0
    for a in DEMO_ACCOUNTS:
        if not get_user_by_email(a["email"]):
            create_user(a["name"], a["email"], a["password"], a["role"], a["title"])
            n += 1
    return n
