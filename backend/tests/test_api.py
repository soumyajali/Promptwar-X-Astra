"""API and workflow tests against a fresh seeded SQLite database."""
from conftest import AUTH

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64

DEMO = {
    "description": ("Knee deep waterlogging near the Central Bus Stand entrance after heavy rain since this morning. "
                    "Commuters and school children cannot reach the buses and the drain is completely blocked."),
    "location_text": "Central Bus Stand, Platform Road",
    "category": "waterlogging",
    "lat": "12.87010", "lng": "74.84255",
}


def submit(client, **over):
    data = {**DEMO, **over}
    return client.post("/api/reports", data=data, files={"image": ("flood.png", PNG, "image/png")})


def test_complaint_creation_runs_pipeline(client):
    before = client.get("/api/public/stats").json()["metrics"]["total"]
    res = submit(client)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["id"].startswith("CP-")
    assert body["category"] == "waterlogging"
    assert body["image_url"].startswith("/uploads/")
    a = body["analysis"]
    assert a["priority"]["level"] in ("critical", "high")
    assert a["duplicates"]["likelihood"] == "likely"
    assert a["duplicates"]["matches"][0]["distance_m"] < 200
    assert "Central Bus Stand" in a["summary"]["text"]
    assert a["recommendation"]["department_label"] == "Water and Drainage"
    assert body["ward"] == "Station Ward"  # inferred from nearby reports
    assert "reporter_name" not in body
    after = client.get("/api/public/stats").json()["metrics"]["total"]
    assert after == before + 1
    # hotspots recalculated: new report belongs to the bus-stand hotspot
    hs = client.get("/api/authority/hotspots", headers=AUTH).json()
    assert any(body["id"] in h["report_ids"] for h in hs)


def test_validation_errors(client):
    res = client.post("/api/reports", data={"description": "short", "location_text": "x"})
    assert res.status_code == 422
    fields = res.json()["detail"]["fields"]
    assert "description" in fields and "location_text" in fields


def test_rejects_non_image_upload(client):
    res = client.post("/api/reports", data=DEMO, files={"image": ("x.png", b"not an image at all", "image/png")})
    assert res.status_code == 422
    assert "image" in res.json()["detail"]["fields"]


def test_authority_requires_code(client):
    assert client.get("/api/authority/reports").status_code == 401
    assert client.post("/api/authority/login", json={"code": "wrong"}).status_code == 401
    assert client.post("/api/authority/login", json={"code": "civic-demo"}).status_code == 200


def test_assignment_status_and_timeline_visible_to_citizen(client):
    rid = submit(client).json()["id"]
    r = client.post(f"/api/authority/reports/{rid}/assign", headers=AUTH,
                    json={"department": "water", "officer": "Er. Kavya Bhat"})
    assert r.status_code == 200 and r.json()["status"] == "assigned"
    r = client.post(f"/api/authority/reports/{rid}/status", headers=AUTH,
                    json={"status": "in_progress", "public_message": "Pump crew dispatched to the bus stand."})
    assert r.status_code == 200
    client.post(f"/api/authority/reports/{rid}/updates", headers=AUTH,
                json={"message": "Internal: check inlet grill size", "visibility": "internal"})

    t = client.get(f"/api/track/{rid}").json()
    assert t["status"] == "in_progress"
    assert t["department_label"] == "Water and Drainage"
    msgs = [e["message"] for e in t["timeline"]]
    assert "Pump crew dispatched to the bus stand." in msgs
    assert not any("Internal" in m for m in msgs)  # internal notes stay internal

    # resolution needs a note
    bad = client.post(f"/api/authority/reports/{rid}/status", headers=AUTH, json={"status": "resolved"})
    assert bad.status_code == 409
    ok = client.post(f"/api/authority/reports/{rid}/status", headers=AUTH,
                     json={"status": "resolved", "resolution_note": "Inlets cleared, water pumped out."})
    assert ok.status_code == 200
    t = client.get(f"/api/track/{rid}").json()
    assert t["status"] == "resolved" and t["resolution_note"] == "Inlets cleared, water pumped out."


def test_invalid_transition_rejected(client):
    rid = submit(client).json()["id"]
    r = client.post(f"/api/authority/reports/{rid}/status", headers=AUTH, json={"status": "submitted"})
    assert r.status_code == 409


def test_category_correction_and_priority_override(client):
    rid = submit(client).json()["id"]
    r = client.post(f"/api/authority/reports/{rid}/category", headers=AUTH, json={"category": "drainage", "reason": "Blocked inlet is root cause"})
    assert r.status_code == 200 and r.json()["category"] == "drainage" and r.json()["category_corrected"]
    no_reason = client.post(f"/api/authority/reports/{rid}/priority", headers=AUTH, json={"level": "low", "reason": ""})
    assert no_reason.status_code == 422
    r = client.post(f"/api/authority/reports/{rid}/priority", headers=AUTH, json={"level": "medium", "reason": "Water has receded"})
    assert r.status_code == 200
    d = r.json()
    assert d["priority_level"] == "medium" and d["priority_overridden"]
    assert any("Water has receded" in e["message"] for e in d["timeline"])


def test_dashboard_calculations_match_data(client):
    dash = client.get("/api/authority/dashboard", headers=AUTH).json()
    reports = client.get("/api/authority/reports", headers=AUTH).json()
    m = dash["metrics"]
    open_r = [r for r in reports if r["status"] not in ("resolved", "rejected")]
    assert m["total"] == len(reports)
    assert m["open"] == len(open_r)
    assert m["critical_open"] == sum(1 for r in open_r if r["priority_level"] == "critical")
    assert m["resolved"] == sum(1 for r in reports if r["status"] == "resolved")
    assert sum(c["total"] for c in dash["distributions"]["category"]) == len(reports)
    assert sum(d["received"] for d in dash["trend"]) <= len(reports)
    assert m["avg_resolution_hours"] is not None  # seed has 13 resolved reports
    assert dash["hotspots"] and dash["hotspots"][0]["id"] == "H1"


def test_public_feed_hides_personal_data(client):
    feed = client.get("/api/public/reports?limit=50").json()
    assert feed
    for item in feed:
        assert "reporter_name" not in item and "reporter_contact" not in item and "description" not in item


def test_action_brief_and_assistant(client):
    b = client.get("/api/authority/brief", headers=AUTH).json()
    assert b["calculated"]["hotspots"] and b["suggested"]["intervention_order"]
    assert b["suggested"]["intervention_order"][0]["step"] == 1
    a = client.post("/api/authority/assistant", headers=AUTH, json={"question": "How many critical complaints are pending?"}).json()
    dash = client.get("/api/authority/dashboard", headers=AUTH).json()
    assert a["intent"] == "critical"
    assert f"{dash['metrics']['critical_open']} critical" in a["answer"]
    a = client.post("/api/authority/assistant", headers=AUTH, json={"question": "Which area needs attention first?"}).json()
    assert a["intent"] == "attention" and dash["hotspots"][0]["location"] in a["answer"]
    a = client.post("/api/authority/assistant", headers=AUTH, json={"question": "what is the meaning of life"}).json()
    assert a["intent"] == "unknown"


def test_reset_demo(client):
    submit(client)
    r = client.post("/api/authority/demo/reset", headers=AUTH)
    assert r.json()["reports"] == 46
    assert client.get("/api/health").json()["reports"] == 46
