"""SQLite persistence layer. A single file database is the single source of truth."""
from __future__ import annotations

import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS reports (
    id                   TEXT PRIMARY KEY,
    description          TEXT NOT NULL,
    category_selected    TEXT,
    category             TEXT NOT NULL,
    category_predicted   TEXT,
    category_confidence  REAL,
    category_corrected   INTEGER NOT NULL DEFAULT 0,
    location_text        TEXT NOT NULL,
    ward                 TEXT,
    lat                  REAL,
    lng                  REAL,
    location_source      TEXT,
    location_accuracy_m  REAL,
    image_path           TEXT,
    reporter_name        TEXT,
    reporter_contact     TEXT,
    affected_people      INTEGER,
    channel              TEXT NOT NULL DEFAULT 'web',
    status               TEXT NOT NULL DEFAULT 'submitted',
    priority_score       INTEGER NOT NULL DEFAULT 0,
    priority_level       TEXT NOT NULL DEFAULT 'low',
    priority_overridden  INTEGER NOT NULL DEFAULT 0,
    priority_override_reason TEXT,
    department           TEXT,
    officer              TEXT,
    summary              TEXT,
    analysis_json        TEXT,
    primary_report_id    TEXT,
    resolution_note      TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    resolved_at          TEXT
);
CREATE INDEX IF NOT EXISTS idx_reports_status   ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created  ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_category ON reports(category);

CREATE TABLE IF NOT EXISTS timeline (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id   TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    kind        TEXT NOT NULL,
    status      TEXT,
    message     TEXT NOT NULL,
    visibility  TEXT NOT NULL DEFAULT 'public',
    actor       TEXT NOT NULL DEFAULT 'system',
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_timeline_report ON timeline(report_id);

CREATE TABLE IF NOT EXISTS report_links (
    report_id   TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    related_id  TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    score       REAL NOT NULL,
    distance_m  REAL,
    likelihood  TEXT NOT NULL,
    reasons     TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    PRIMARY KEY (report_id, related_id)
);
"""

_lock = threading.RLock()


def _connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


_conn: sqlite3.Connection | None = None


# Columns added after the first release. Existing databases are upgraded in place on start.
MIGRATIONS = {
    "reports": {"location_source": "TEXT", "location_accuracy_m": "REAL"},
}


def _migrate(conn: sqlite3.Connection) -> None:
    for table, cols in MIGRATIONS.items():
        have = {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}
        for name, kind in cols.items():
            if name not in have:
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {name} {kind}")
    conn.commit()


def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = _connect(config.DB_PATH)
        _conn.executescript(SCHEMA)
        _migrate(_conn)
    return _conn


def reset_connection(path: Path | None = None) -> None:
    """Used by tests to point the app at a fresh database file."""
    global _conn
    with _lock:
        if _conn is not None:
            _conn.close()
        _conn = None
        if path is not None:
            config.DB_PATH = path
        get_conn()


@contextmanager
def tx():
    """Serialised transaction. SQLite + a process-wide lock keeps writes consistent."""
    with _lock:
        conn = get_conn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def query(sql: str, params: tuple | list = ()) -> list[sqlite3.Row]:
    with _lock:
        return get_conn().execute(sql, params).fetchall()


def wipe() -> None:
    with tx() as conn:
        conn.execute("DELETE FROM report_links")
        conn.execute("DELETE FROM timeline")
        conn.execute("DELETE FROM reports")
