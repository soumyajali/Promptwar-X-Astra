"""Centralised configuration. Every value can be overridden with an environment variable."""
from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.getenv("CIVICPULSE_DATA_DIR", BASE_DIR / "data"))
DB_PATH = Path(os.getenv("CIVICPULSE_DB_PATH", DATA_DIR / "civicpulse.db"))
UPLOAD_DIR = Path(os.getenv("CIVICPULSE_UPLOAD_DIR", DATA_DIR / "uploads"))
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"

# Demo-only authority access code. Not real authentication — see README "Honesty statement".
AUTHORITY_CODE = os.getenv("CIVICPULSE_AUTHORITY_CODE", "civic-demo")

MAX_IMAGE_BYTES = int(os.getenv("CIVICPULSE_MAX_IMAGE_MB", "5")) * 1024 * 1024
ALLOWED_ORIGINS = [o.strip() for o in os.getenv(
    "CIVICPULSE_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
AUTO_SEED = os.getenv("CIVICPULSE_AUTO_SEED", "1") == "1"
# Local time offset used for "today" / "this week" in assistant answers (Demo City is in India: UTC+05:30).
TZ_OFFSET_MIN = int(os.getenv("CIVICPULSE_TZ_OFFSET_MIN", "330"))

# Demonstration area: synthetic reports placed on real-world coordinates (Mangaluru, Karnataka)
# but with fictional ward and street names. Nothing here is real municipal data.
DEMO_AREA = {
    "name": "Demo City",
    "description": "Fictional wards placed on Mangaluru coordinates for demonstration only",
    "center": [12.8705, 74.8430],
    "zoom": 14,
    "bounds": {"lat_min": 12.835, "lat_max": 12.905, "lng_min": 74.815, "lng_max": 74.875},
}

CATEGORIES = {
    "roads": "Roads and potholes",
    "waterlogging": "Waterlogging and flooding",
    "garbage": "Garbage and sanitation",
    "streetlights": "Streetlights",
    "drainage": "Drainage",
    "public_safety": "Public safety",
    "water_supply": "Water supply",
    "other": "Other",
}

DEPARTMENTS = {
    "roads": "Roads and Infrastructure",
    "sanitation": "Sanitation",
    "water": "Water and Drainage",
    "electricity": "Electricity",
    "safety": "Public Safety",
    "admin": "General Administration",
}

CATEGORY_DEPARTMENT = {
    "roads": "roads",
    "waterlogging": "water",
    "garbage": "sanitation",
    "streetlights": "electricity",
    "drainage": "water",
    "public_safety": "safety",
    "water_supply": "water",
    "other": "admin",
}

# Synthetic officer roster (fictional names) per department.
OFFICERS = {
    "roads": ["Er. Anil Rao", "Er. Meera Shetty"],
    "sanitation": ["Insp. Farah Khan", "Insp. Rohit Pai"],
    "water": ["Er. Kavya Bhat", "Er. Suresh Naik"],
    "electricity": ["Er. Joseph D'Souza", "Er. Lata Kamath"],
    "safety": ["Officer Divya Hegde", "Officer Imran Sheikh"],
    "admin": ["Ms. Priya Acharya"],
}

STATUSES = ["submitted", "under_review", "assigned", "in_progress", "resolved", "rejected"]
OPEN_STATUSES = ["submitted", "under_review", "assigned", "in_progress"]
CLOSED_STATUSES = ["resolved", "rejected"]
PRIORITY_LEVELS = ["critical", "high", "medium", "low"]
