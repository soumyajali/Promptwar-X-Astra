"""Data access: every SQL statement in the app lives here."""
from __future__ import annotations

import json
import secrets
from datetime import datetime, timezone

from . import db

ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no 0/O/1/I to avoid misreading


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None).isoformat()


def new_report_id() -> str:
    while True:
        rid = "CP-" + "".join(secrets.choice(ID_ALPHABET) for _ in range(6))
        if not db.query("SELECT 1 FROM reports WHERE id = ?", (rid,)):
            return rid


def _row(r) -> dict:
    d = dict(r)
    d["analysis"] = json.loads(d.pop("analysis_json") or "{}")
    d["category_corrected"] = bool(d["category_corrected"])
    d["priority_overridden"] = bool(d["priority_overridden"])
    return d


def list_reports() -> list[dict]:
    return [_row(r) for r in db.query("SELECT * FROM reports ORDER BY created_at DESC")]


def get_report(rid: str) -> dict | None:
    rows = db.query("SELECT * FROM reports WHERE id = ?", (rid.upper().strip(),))
    return _row(rows[0]) if rows else None


def insert_report(r: dict) -> None:
    cols = ["id", "description", "category_selected", "category", "category_predicted", "category_confidence",
            "location_text", "ward", "lat", "lng", "image_path", "reporter_name", "reporter_contact",
            "affected_people", "channel", "status", "priority_score", "priority_level", "department", "officer",
            "summary", "analysis_json", "primary_report_id", "created_at", "updated_at", "resolved_at",
            "resolution_note"]
    vals = [r.get(c) if c != "analysis_json" else json.dumps(r.get("analysis", {})) for c in cols]
    with db.tx() as conn:
        conn.execute(f"INSERT INTO reports ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", vals)


ALLOWED_UPDATE = {"category", "category_corrected", "status", "priority_score", "priority_level",
                  "priority_overridden", "priority_override_reason", "department", "officer", "summary",
                  "analysis", "primary_report_id", "resolution_note", "resolved_at", "updated_at"}


def update_report(rid: str, **fields) -> None:
    bad = set(fields) - ALLOWED_UPDATE
    if bad:
        raise ValueError(f"Unknown fields {bad}")
    if "analysis" in fields:
        fields["analysis_json"] = json.dumps(fields.pop("analysis"))
    fields.setdefault("updated_at", now_iso())
    sets = ", ".join(f"{k} = ?" for k in fields)
    with db.tx() as conn:
        conn.execute(f"UPDATE reports SET {sets} WHERE id = ?", [*fields.values(), rid])


def add_timeline(rid: str, kind: str, message: str, *, status: str | None = None,
                 visibility: str = "public", actor: str = "system", at: str | None = None) -> None:
    with db.tx() as conn:
        conn.execute(
            "INSERT INTO timeline (report_id, kind, status, message, visibility, actor, created_at) VALUES (?,?,?,?,?,?,?)",
            (rid, kind, status, message, visibility, actor, at or now_iso()))


def timeline(rid: str, public_only: bool = False) -> list[dict]:
    sql = "SELECT * FROM timeline WHERE report_id = ?"
    if public_only:
        sql += " AND visibility = 'public'"
    return [dict(r) for r in db.query(sql + " ORDER BY created_at, id", (rid,))]


def add_link(rid: str, related: str, score: float, distance_m, likelihood: str, reasons: list[str], at: str) -> None:
    with db.tx() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO report_links (report_id, related_id, score, distance_m, likelihood, reasons, created_at) "
            "VALUES (?,?,?,?,?,?,?)", (rid, related, score, distance_m, likelihood, json.dumps(reasons), at))


def links_for(rid: str) -> list[dict]:
    rows = db.query(
        "SELECT report_id, related_id, score, distance_m, likelihood, reasons FROM report_links "
        "WHERE report_id = ? OR related_id = ? ORDER BY score DESC", (rid, rid))
    out = []
    for r in rows:
        other = r["related_id"] if r["report_id"] == rid else r["report_id"]
        out.append({"id": other, "score": r["score"], "distance_m": r["distance_m"],
                    "likelihood": r["likelihood"], "reasons": json.loads(r["reasons"])})
    return out


def all_links() -> list[dict]:
    return [dict(r) | {"reasons": json.loads(r["reasons"])} for r in db.query("SELECT * FROM report_links ORDER BY score DESC")]
