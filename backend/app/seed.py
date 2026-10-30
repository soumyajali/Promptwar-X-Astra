"""Synthetic demo data. All names, wards and complaints are fictional.

Coordinates sit on Mangaluru, Karnataka so the OpenStreetMap basemap looks real, but every ward
name, street name, person and incident here is invented for demonstration.

Each report goes through the real intelligence pipeline in chronological order, so duplicates,
priorities and hotspots in the demo are computed — not hard-coded.
"""
from __future__ import annotations

import random
from datetime import datetime, timedelta, timezone

from . import db, repository as repo
from .config import OFFICERS
from .events import broker
from .services import workflow as wf

# (days_ago, hour, ward, location, lat, lng, selected_category|None, description, reporter, outcome)
# outcome: submitted | review | assigned | progress | resolved:<hours> | rejected
R = [
    # ---- Cluster A: Central Bus Stand, Station Ward — waterlogging + drainage (demo hotspot)
    (12, 9, "Station Ward", "Central Bus Stand, Platform Road", 12.87018, 74.84262, "waterlogging",
     "Heavy rain water accumulated near the Central Bus Stand entrance. Ankle deep water, commuters are wading through to reach buses.", "Rakesh M.", "resolved:30"),
    (6, 8, "Station Ward", "Central Bus Stand, Platform Road", 12.87031, 74.84240, "drainage",
     "Drain beside the bus stand is completely blocked with silt and plastic. Water does not flow even hours after rain.", "Shabana R.", "assigned"),
    (4, 18, "Station Ward", "Bus stand junction near ticket counter", 12.87002, 74.84291, None,
     "Knee deep waterlogging at the bus stand junction again. Two wheelers stalled and an elderly man fell while crossing. Getting worse every monsoon.", "Anitha P.", "review"),
    (3, 7, "Station Ward", "Platform Road, opposite bus stand", 12.87060, 74.84218, "waterlogging",
     "Water logging on Platform Road opposite the bus stand since 3 days. School children and commuters cannot use the footpath.", "Joel F.", "submitted"),
    (2, 20, "Station Ward", "Central Bus Stand, Platform Road", 12.86995, 74.84250, "drainage",
     "Open manhole near the bus stand is hidden under flood water. Very dangerous at night for pedestrians.", "Deepa K.", "submitted"),
    (1, 10, "Station Ward", "Station Approach Road", 12.87110, 74.84330, "drainage",
     "Sewage overflowing from the drain on Station Approach Road, foul smell near the shops.", "Ganesh S.", "submitted"),

    # ---- Cluster B: Market Road, Market Ward — garbage
    (9, 7, "Market Ward", "Fish Market, Market Road", 12.86681, 74.83820, "garbage",
     "Garbage bins at the fish market are overflowing and waste is spreading onto Market Road. Stray dogs and flies everywhere.", "Ibrahim A.", "progress"),
    (7, 8, "Market Ward", "Fish Market, Market Road", 12.86702, 74.83801, "garbage",
     "Garbage not collected for days near the fish market, foul smell for the whole market area. Shops and shoppers affected.", "Lavina D.", "assigned"),
    (5, 17, "Market Ward", "Market Road bus shelter", 12.86650, 74.83855, None,
     "People are dumping and burning garbage behind the bus shelter on Market Road. Smoke is affecting traders.", "Harish N.", "submitted"),
    (3, 9, "Market Ward", "Vegetable market back lane", 12.86720, 74.83770, "garbage",
     "Rotting vegetable waste piled in the back lane, mosquito breeding and stink. Dustbin is broken.", "Sneha B.", "submitted"),
    (1, 8, "Market Ward", "Fish Market, Market Road", 12.86690, 74.83832, "garbage",
     "Overflowing bins at fish market again today, waste spilling on the road.", "Ravi T.", "submitted"),

    # ---- Cluster C: Lakeview Main Road — potholes
    (14, 10, "Lakeview Ward", "Lakeview Main Road, near Lake Circle", 12.88352, 74.84851, "roads",
     "Large potholes on Lakeview Main Road near Lake Circle. Vehicles swerving dangerously.", "Mohan R.", "resolved:70"),
    (8, 9, "Lakeview Ward", "Lakeview Main Road, near Lake Circle", 12.88370, 74.84880, "roads",
     "Deep pothole on Lakeview Main Road has reopened after rain. Two wheeler skidded and the rider was injured.", "Ayesha F.", "progress"),
    (6, 19, "Lakeview Ward", "Lake Circle junction", 12.88330, 74.84822, None,
     "Road damage at Lake Circle junction, big crater in the middle of the road. Traffic jam every evening.", "Nikhil P.", "assigned"),
    (4, 8, "Lakeview Ward", "Lakeview Main Road, school gate", 12.88401, 74.84905, "roads",
     "Broken road and potholes in front of the school gate. Students walking on the main road to avoid them.", "Rekha S.", "submitted"),
    (2, 11, "Lakeview Ward", "Lakeview Main Road", 12.88385, 74.84860, "roads",
     "Potholes on Lakeview main road getting worse, multiple complaints but no action.", "Clinton M.", "submitted"),

    # ---- Cluster D: Hillcrest Colony — streetlights + public safety
    (10, 21, "Hillcrest Ward", "Hillcrest Colony 2nd Cross", 12.85802, 74.85201, "streetlights",
     "Streetlights on Hillcrest Colony 2nd Cross not working for a week. The road is pitch dark at night.", "Vani H.", "resolved:50"),
    (5, 22, "Hillcrest Ward", "Hillcrest Colony 3rd Cross", 12.85830, 74.85240, "streetlights",
     "All lights on 3rd Cross are off. Women returning from work feel unsafe walking in the darkness.", "Pooja L.", "assigned"),
    (3, 23, "Hillcrest Ward", "Hillcrest Colony park", 12.85775, 74.85180, "public_safety",
     "Chain snatching incident near the colony park last night, the area is dark and unsafe. Residents want patrols.", "Sunitha G.", "progress"),
    (2, 21, "Hillcrest Ward", "Hillcrest Colony 2nd Cross", 12.85810, 74.85215, None,
     "Electric pole near 2nd Cross has a live wire hanging low and sparking. Children play here. Emergency.", "Arjun V.", "submitted"),
    (1, 20, "Hillcrest Ward", "Hillcrest Colony main gate", 12.85850, 74.85160, "streetlights",
     "Street lamp at the colony main gate flickering and then off. Dark stretch near the bus stop.", "Fathima Z.", "submitted"),

    # ---- Cluster E: Riverside — water supply
    (6, 6, "Riverside Ward", "Riverside Lane 4", 12.87602, 74.83201, "water_supply",
     "No water supply in Riverside Lane 4 for 3 days. Around 120 families depend on the tap connection.", "Kiran J.", "progress"),
    (4, 7, "Riverside Ward", "Riverside Lane 5", 12.87630, 74.83170, None,
     "Pipe burst on Riverside Lane 5, drinking water is being wasted on the road and supply to houses is low pressure.", "Maria D.", "assigned"),
    (2, 6, "Riverside Ward", "Riverside Lane 4", 12.87585, 74.83225, "water_supply",
     "Muddy and dirty water coming from taps in Riverside Lane 4 after the pipeline repair. Possible contamination, children falling sick.", "Shreya N.", "submitted"),

    # ---- Scattered reports across the demo city
    (20, 10, "Harbour Ward", "Harbour Road warehouse stretch", 12.86120, 74.83560, "roads",
     "Speed breaker broken on Harbour Road, cracked surface near the warehouses.", "Rahul D.", "resolved:96"),
    (19, 9, "Harbour Ward", "Old Port Road", 12.86010, 74.83310, "garbage",
     "Garbage dump near Old Port Road gate not cleared.", "Nazia K.", "resolved:20"),
    (18, 15, "Riverside Ward", "Riverside Park entrance", 12.87905, 74.83410, "streetlights",
     "Two streetlights at Riverside Park entrance not working.", "Vikram S.", "resolved:40"),
    (17, 11, "Market Ward", "Car Street", 12.86480, 74.83950, "drainage",
     "Drain cover broken on Car Street, gutter water on the footpath.", "Leena P.", "resolved:55"),
    (16, 8, "Lakeview Ward", "Lake Circle bus stop", 12.88250, 74.84700, "public_safety",
     "Fallen tree branch blocking half the road near Lake Circle bus stop after the storm.", "Ajay K.", "resolved:8"),
    (15, 13, "Station Ward", "Railway Colony Road", 12.87420, 74.84720, "water_supply",
     "Low pressure water supply in Railway Colony for a week.", "Ramesh B.", "resolved:60"),
    (13, 16, "Harbour Ward", "Fishermen Colony", 12.85880, 74.83420, None,
     "Stagnant water and mosquito breeding near Fishermen Colony after rain, dengue cases reported.", "Sabina H.", "resolved:48"),
    (12, 12, "Hillcrest Ward", "Hilltop Road", 12.85320, 74.85610, "roads",
     "Footpath tiles uneven on Hilltop Road, elderly residents tripping.", "Gopal M.", "resolved:120"),
    (11, 10, "Market Ward", "Central Market parking", 12.86590, 74.84060, "other",
     "Abandoned vehicle lying in the market parking for months.", "Suraj A.", "rejected"),
    (11, 18, "Riverside Ward", "Riverside Lane 1", 12.87710, 74.83010, "garbage",
     "Garbage collection van has not come to Riverside Lane 1 this week.", "Rina C.", "resolved:26"),
    (10, 9, "Lakeview Ward", "Lakeview Apartments", 12.88720, 74.85120, "water_supply",
     "Water meter leaking outside Lakeview Apartments.", "Deepak R.", "resolved:72"),
    (9, 14, "Harbour Ward", "Harbour Road", 12.86200, 74.83700, "drainage",
     "Culvert on Harbour Road choked with silt, water backing up during high tide.", "Manjunath S.", "assigned"),
    (8, 20, "Station Ward", "Railway Colony 1st Cross", 12.87510, 74.84880, "streetlights",
     "Streetlight bulb fused on Railway Colony 1st Cross.", "Prakash V.", "progress"),
    (7, 15, "Hillcrest Ward", "Hilltop Road water tank", 12.85410, 74.85700, "water_supply",
     "Water tank overflowing at Hilltop Road every morning, water wasted.", "Lalitha N.", "review"),
    (6, 12, "Market Ward", "Car Street", 12.86460, 74.83980, "roads",
     "Potholes on Car Street near the temple, vehicles and worshippers affected.", "Anand K.", "review"),
    (5, 10, "Harbour Ward", "Old Port Road", 12.85990, 74.83290, "public_safety",
     "Compound wall collapsed partly on Old Port Road, debris on the footpath. Unsafe for pedestrians.", "Yusuf M.", "assigned"),
    (4, 13, "Riverside Ward", "Riverside School Road", 12.87980, 74.83120, "roads",
     "Road resurfacing left gravel spread on Riverside School Road, children slipping on bicycles.", "Teena J.", "submitted"),
    (3, 16, "Lakeview Ward", "Lakeview Apartments", 12.88705, 74.85150, "garbage",
     "Plastic waste thrown into the lake edge behind Lakeview Apartments.", "Sanjay H.", "submitted"),
    (2, 9, "Station Ward", "Railway Colony Road", 12.87440, 74.84700, None,
     "Stray dog bite incident near Railway Colony Road, packs of dogs chasing two wheelers.", "Neha G.", "review"),
    (1, 14, "Harbour Ward", "Harbour Road warehouse stretch", 12.86140, 74.83590, "other",
     "Illegal hoarding board leaning over the footpath on Harbour Road.", "Faisal B.", "submitted"),
    (1, 7, "Riverside Ward", "Riverside Lane 1", 12.87725, 74.83030, "drainage",
     "Drain choked in Riverside Lane 1, water entering the ground floor houses during rain.", "Jyothi R.", "submitted"),
    (0, 7, "Lakeview Ward", "Lake Circle bus stop", 12.88262, 74.84720, "streetlights",
     "Light pole at Lake Circle bus stop damaged after a vehicle hit it, wires exposed.", "Arun P.", "submitted"),
]

PUBLIC_UPDATES = {
    "review": "An officer is reviewing the report and the location details.",
    "progress": "Field team is on site and work has started.",
}
RESOLUTIONS = {
    "roads": "Pothole patched with hot-mix asphalt and the surface levelled.",
    "garbage": "Area cleared; collection schedule increased for this point.",
    "streetlights": "Faulty fittings replaced and the lights tested at night.",
    "drainage": "Drain desilted and cover replaced.",
    "water_supply": "Leak repaired and supply pressure restored.",
    "public_safety": "Hazard removed and the site made safe.",
    "waterlogging": "Inlets cleared and water pumped out; site inspected after rain.",
    "other": "Issue addressed by the ward office.",
}


def _when(now: datetime, days_ago: int, hour: int) -> datetime:
    base = (now - timedelta(days=days_ago)).replace(hour=hour, minute=(days_ago * 7 + hour * 3) % 60, second=0)
    if base > now:
        base = now - timedelta(minutes=30 + days_ago)
    return base


def seed(force: bool = False) -> int:
    if not force and db.query("SELECT 1 FROM reports LIMIT 1"):
        return 0
    db.wipe()
    now = datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)
    actor = "Ward Office (demo)"
    plan = sorted(R, key=lambda r: (-r[0], r[1]))
    created_ids = []
    rng = random.Random(2026)  # stable demo IDs across resets
    for (days, hour, ward, loc, lat, lng, cat, desc, name, outcome) in plan:
        t = _when(now, days, hour)
        rid = "CP-" + "".join(rng.choice(repo.ID_ALPHABET) for _ in range(6))
        rep = wf.create_report({
            "id": rid, "description": desc, "category_selected": cat, "location_text": loc, "ward": ward,
            "lat": lat, "lng": lng, "reporter_name": name, "reporter_contact": None,
            "created_at": t.isoformat(), "channel": "seed",
        }, publish=False, rescore=False)
        created_ids.append((rep, t, outcome))

    # Recompute priorities once all reports exist so recurrence/concentration reflect the full picture.
    from .services.pipeline import rescore
    all_r = repo.list_reports()
    for r in all_r:
        upd = rescore(r, all_r)
        if upd:
            repo.update_report(r["id"], **upd)

    for rep, t, outcome in created_ids:
        rid = rep["id"]
        r = repo.get_report(rid)
        dept = r["analysis"]["recommendation"]["department"]
        officer = OFFICERS[dept][sum(map(ord, rid)) % len(OFFICERS[dept])] if OFFICERS.get(dept) else None
        step = lambda h: min(now - timedelta(minutes=5), t + timedelta(hours=h)).isoformat()
        kind, _, hrs = outcome.partition(":")
        if kind == "submitted":
            continue
        if kind == "review":
            wf.change_status(rid, "under_review", actor=actor, public_message=PUBLIC_UPDATES["review"], at=step(2), publish=False)
            continue
        if kind == "rejected":
            wf.change_status(rid, "under_review", actor=actor, at=step(3), publish=False)
            wf.change_status(rid, "rejected", actor=actor,
                             public_message="Outside municipal civic-services scope; forwarded to the traffic police.",
                             at=step(20), publish=False)
            continue
        total = float(hrs) if hrs else 24
        wf.change_status(rid, "under_review", actor=actor, at=step(min(2, total * 0.1)), publish=False)
        wf.assign(rid, dept, officer, actor=actor, at=step(min(4, total * 0.2)), publish=False)
        if kind == "assigned":
            continue
        wf.change_status(rid, "in_progress", actor=actor, public_message=PUBLIC_UPDATES["progress"],
                         at=step(total * 0.5), publish=False)
        if kind == "progress":
            wf.add_update(rid, "Crew requested additional material; work continues tomorrow morning.", "internal",
                          actor=officer or actor, at=step(total * 0.6), publish=False)
            continue
        wf.change_status(rid, "resolved", actor=officer or actor,
                         resolution_note=RESOLUTIONS.get(r["category"], RESOLUTIONS["other"]),
                         at=step(total), publish=False)
    broker.publish("data.reset", {"count": len(created_ids)})
    return len(created_ids)
