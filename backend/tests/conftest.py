import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ["CIVICPULSE_AUTO_SEED"] = "0"


@pytest.fixture()
def fresh_db(tmp_path, monkeypatch):
    from app import config, db

    monkeypatch.setattr(config, "UPLOAD_DIR", tmp_path / "uploads")
    db.reset_connection(tmp_path / "test.db")
    yield
    db.reset_connection(tmp_path / "test2.db")


@pytest.fixture()
def seeded(fresh_db):
    from app.seed import seed

    seed(force=True)


@pytest.fixture()
def client(seeded):
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as c:
        yield c


AUTH = {"X-Authority-Code": "civic-demo"}
