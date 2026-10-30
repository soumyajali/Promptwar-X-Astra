"""Sign-in for citizens and ward-office staff (demo accounts, hashed passwords, bearer sessions)."""
from __future__ import annotations

import re
import sqlite3

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from .. import auth, repository as repo
from ..schemas import tracking_view

router = APIRouter(prefix="/api")
EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class Register(BaseModel):
    name: str = Field(..., max_length=80)
    email: str = Field(..., max_length=120)
    password: str = Field(..., max_length=128)


class SignIn(BaseModel):
    email: str = Field(..., max_length=120)
    password: str = Field(..., max_length=128)
    role: str = Field("citizen", pattern="^(citizen|authority)$")


@router.post("/auth/register")
def register(body: Register):
    errors = {}
    if len(body.name.strip()) < 2:
        errors["name"] = "Enter your name."
    if not EMAIL.match(body.email.strip()):
        errors["email"] = "Enter a valid email address."
    if len(body.password) < 8:
        errors["password"] = "Use at least 8 characters."
    if errors:
        raise HTTPException(422, detail={"message": "Please fix the highlighted fields.", "fields": errors})
    if auth.get_user_by_email(body.email):
        raise HTTPException(409, detail={"message": "An account with this email already exists. Sign in instead.",
                                         "fields": {"email": "Already registered."}})
    try:
        u = auth.create_user(body.name, body.email, body.password, "citizen")
    except sqlite3.IntegrityError:
        raise HTTPException(409, detail={"message": "An account with this email already exists."})
    return {"token": auth.create_session(u), "user": auth.public_user(u)}


@router.post("/auth/login")
def login(body: SignIn):
    u = auth.get_user_by_email(body.email)
    if not u or not auth.verify_password(body.password, u["password_hash"]):
        raise HTTPException(401, detail={"message": "Email or password is not correct."})
    if u["role"] != body.role:
        msg = ("This is a ward-office account. Use the Authority sign-in." if u["role"] == "authority"
               else "Citizen accounts cannot open the Command Center.")
        raise HTTPException(403, detail={"message": msg})
    return {"token": auth.create_session(u), "user": auth.public_user(u)}


@router.post("/auth/logout")
def logout(authorization: str | None = Header(None)):
    token = auth.bearer(authorization)
    if token:
        auth.end_session(token)
    return {"ok": True}


@router.get("/auth/me")
def me(user: dict = Depends(auth.require_user)):
    return auth.public_user(user)


@router.get("/citizen/reports")
def my_reports(user: dict = Depends(auth.require_citizen)):
    rows = [r for r in repo.list_reports() if r.get("citizen_id") == user["id"]]
    return [{k: v for k, v in tracking_view(r).items() if k != "analysis"} | {
        "priority_level": r["priority_level"], "priority_score": r["priority_score"]} for r in rows]
