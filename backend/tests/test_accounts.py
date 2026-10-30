"""Citizen and authority sign-in, route protection and the citizen → authority → citizen demo flow."""
from test_api import PNG

POTHOLE = {"description": "Deep pothole on Lakeview Main Road near the bus stop, two wheelers are skidding into it at night.",
           "location_text": "Lakeview Main Road, near bus stop", "category": "roads", "lat": "12.8601", "lng": "74.8402"}


def bearer(t):
    return {"Authorization": f"Bearer {t}"}


def test_register_hashes_password_and_rejects_duplicates(client):
    r = client.post("/api/auth/register", json={"name": "Asha N", "email": "Asha@Example.com", "password": "pothole123"})
    assert r.status_code == 200, r.text
    assert r.json()["user"] == {**r.json()["user"], "role": "citizen", "email": "asha@example.com"}
    from app import db
    row = db.query("SELECT password_hash FROM users WHERE email = 'asha@example.com'")[0]
    assert "pothole123" not in row["password_hash"] and row["password_hash"].startswith("pbkdf2_sha256$")
    dup = client.post("/api/auth/register", json={"name": "Asha", "email": "asha@example.com", "password": "another123"})
    assert dup.status_code == 409
    short = client.post("/api/auth/register", json={"name": "A", "email": "nope", "password": "x"})
    assert short.status_code == 422 and set(short.json()["detail"]["fields"]) == {"name", "email", "password"}


def test_authority_register_and_login(client):
    # Missing authority code or title fails
    bad = client.post("/api/auth/register", json={
        "name": "Officer Ramesh", "email": "ramesh@civicpulse.demo", "password": "RameshPass123", "role": "authority"
    })
    assert bad.status_code == 422
    assert "authority_code" in bad.json()["detail"]["fields"]
    assert "title" in bad.json()["detail"]["fields"]

    # Wrong authority code fails
    wrong_code = client.post("/api/auth/register", json={
        "name": "Officer Ramesh", "email": "ramesh@civicpulse.demo", "password": "RameshPass123",
        "role": "authority", "title": "Assistant Engineer", "authority_code": "wrong"
    })
    assert wrong_code.status_code == 422

    # Correct registration succeeds
    ok = client.post("/api/auth/register", json={
        "name": "Officer Ramesh", "email": "ramesh@civicpulse.demo", "password": "RameshPass123",
        "role": "authority", "title": "Assistant Engineer", "authority_code": "civic-demo"
    })
    assert ok.status_code == 200
    data = ok.json()
    assert data["user"]["role"] == "authority"
    assert data["user"]["title"] == "Assistant Engineer"
    t = data["token"]

    # Authority token can access command center
    dash = client.get("/api/authority/dashboard", headers=bearer(t))
    assert dash.status_code == 200


def test_wrong_password_and_wrong_portal(client):
    assert client.post("/api/auth/login", json={"email": "citizen@civicpulse.demo", "password": "bad", "role": "citizen"}).status_code == 401
    # Citizen account cannot sign in through the authority portal, and vice versa.
    assert client.post("/api/auth/login", json={"email": "citizen@civicpulse.demo", "password": "Citizen@2026", "role": "authority"}).status_code == 403
    assert client.post("/api/auth/login", json={"email": "officer@civicpulse.demo", "password": "Officer@2026", "role": "citizen"}).status_code == 403


def test_citizen_token_cannot_use_command_center(client):
    t = client.post("/api/auth/login", json={"email": "citizen@civicpulse.demo", "password": "Citizen@2026"}).json()["token"]
    assert client.get("/api/authority/dashboard", headers=bearer(t)).status_code == 403
    assert client.get("/api/authority/dashboard").status_code == 401


def test_full_demo_flow(client):
    # 1–3 citizen signs in, submits a pothole complaint, gets a tracking ID
    c = client.post("/api/auth/login", json={"email": "citizen@civicpulse.demo", "password": "Citizen@2026"}).json()
    sub = client.post("/api/reports", data=POTHOLE, files={"image": ("p.png", PNG, "image/png")}, headers=bearer(c["token"]))
    assert sub.status_code == 201, sub.text
    rid = sub.json()["id"]
    mine = client.get("/api/citizen/reports", headers=bearer(c["token"])).json()
    assert rid in [m["id"] for m in mine]
    # 4 logout ends the session
    client.post("/api/auth/logout", headers=bearer(c["token"]))
    assert client.get("/api/auth/me", headers=bearer(c["token"])).status_code == 401
    # 5–7 authority signs in and sees analysis + priority
    a = client.post("/api/auth/login", json={"email": "officer@civicpulse.demo", "password": "Officer@2026", "role": "authority"}).json()
    assert a["user"]["name"] == "Priya Shetty" and a["user"]["title"] == "Ward Officer"
    h = bearer(a["token"])
    d = client.get(f"/api/authority/reports/{rid}", headers=h).json()
    assert d["category"] == "roads" and d["analysis"]["priority"]["factors"]
    # 8–10 assign to Road Maintenance with an officer, set In progress, add a progress note
    assert client.post(f"/api/authority/reports/{rid}/assign", json={"department": "roads", "officer": "Er. Anil Rao"}, headers=h).status_code == 200
    assert client.post(f"/api/authority/reports/{rid}/status", json={"status": "in_progress", "public_message": "Crew on site."}, headers=h).status_code == 200
    assert client.post(f"/api/authority/reports/{rid}/updates", json={"message": "Patch work scheduled for tonight."}, headers=h).status_code == 200
    # 12–13 citizen tracking shows the update, in order, with the same ID
    t = client.get(f"/api/track/{rid}").json()
    assert t["id"] == rid and t["status"] == "in_progress"
    assert t["department_label"] == "Road Maintenance" and t["officer"] == "Er. Anil Rao"
    msgs = [e["message"] for e in t["timeline"]]
    assert any("Road Maintenance" in m for m in msgs) and "Patch work scheduled for tonight." in msgs
    times = [e["created_at"] for e in t["timeline"]]
    assert times == sorted(times)
    actors = {e["actor"] for e in client.get(f"/api/authority/reports/{rid}", headers=h).json()["timeline"]}
    assert "Priya Shetty (Ward Officer)" in actors
