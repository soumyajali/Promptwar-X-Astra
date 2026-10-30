# CivicPulse AI — Five-Minute Demo Guide

## Before you start (2 minutes, off-stage)

1. Start the backend: `cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8000`
2. Start the frontend: `cd frontend && npm run dev` → http://localhost:5173
   *(or single-process: `npm run build` once, then open http://localhost:8000)*
3. Open **two browser windows side by side**:
   - **Window A (citizen):** http://localhost:5173/report
   - **Window B (authority):** http://localhost:5173/command → sign in as `officer@civicpulse.demo` / `Officer@2026`
   - Optional citizen account (Window A): http://localhost:5173/account → `citizen@civicpulse.demo` / `Citizen@2026`
     (or create one). Reports filed while signed in appear under **My reports** with live status.
4. In Window B, click **Reset demo data** in the sidebar so you start from the clean 46-report dataset.
5. Have `docs/demo/sample-waterlogging.jpg` ready (an illustration, labelled as such) or use any real photo.

Demo data: 46 synthetic reports in "Demo City" (fictional wards on Mangaluru coordinates). Hotspot **H1 — Central Bus
Stand, Platform Road** already exists with drainage and waterlogging reports. Your new report will join it.

---

## Minute 1 — CAPTURE: citizen reports waterlogging (Window A)

1. *"A commuter is standing in knee-deep water at the bus stand. No app account, no form to decode."*
2. Click **Fill with demo example** (or type it). It fills:
   - Category: **Waterlogging**
   - Description: *Knee deep waterlogging near the Central Bus Stand entrance after heavy rain since this morning.
     Commuters and school children cannot reach the buses and the drain is completely blocked.*
   - Location: **Central Bus Stand, Platform Road**, pin at `12.87010, 74.84255`
3. Point at the green hint under the description: *"Reads as Waterlogging and flooding (90%)"* — the classifier is
   working while they type.
4. Click **Next: Location & map** — the pin is already on the bus stand. Click **Next: Add evidence** and choose
   `sample-waterlogging.jpg`. Show the preview.
5. Click **Next: Review & submit**, glance at the summary of all four steps, then click **Submit report**.

## Minute 2 — UNDERSTAND: the analysis (Window A, result page)

Walk down the panels:
- **Tracking ID** (e.g. `CP-4Z7ZCT`) — copy it.
- **Category** — "Citizen selected Waterlogging; text analysis agrees", with the matched phrases.
- **Summary** — built only from the citizen's words: location, school children and bus commuters, urgency cues.
- **Similar reports nearby** — *Likely the same problem* as 3 earlier reports, with % match, distance (12–70 m) and
  reasons. *"We don't delete duplicates — we link them, and that raises the priority."*
- **Priority** — about **75 / 100, Critical**. Point at the six bars: severity (knee deep, completely blocked),
  public impact (school children, commuters), recurring reports, geographic concentration.
- **Recommended action** — send a drainage crew with a pump; Water and Drainage; respond within 4 hours.

## Minute 3 — REVEAL: authority dashboard (Window B)

1. Window B already shows a toast **"New citizen report CP-… received and analysed"** and the totals went up by one —
   *no refresh*, pushed over Server-Sent Events.
2. Click **Live city map** → the new report is a large vermilion marker inside the dashed **H1** ring. Click it to
   show the card. *(If map tiles are blocked on venue Wi-Fi, a notice appears and markers still show at exact
   coordinates.)*
3. Click **Hotspots** → **H1 Central Bus Stand** now lists the new report; read the *Why flagged* line and the
   suggested intervention.

## Minute 4 — ACT: assign and update (Window B)

1. Click the new report (from the hotspot list or **All reports**, sorted by priority).
2. Show the AI analysis panel briefly (classification bars, priority breakdown, linked duplicates on a mini-map).
3. **Assign:** Department is pre-selected as *Water and Drainage (suggested)*. Choose officer **Er. Kavya Bhat** →
   **Save assignment**. Status becomes *Assigned*.
4. **Update status:** choose **In progress**, message: *Pump crew dispatched to Central Bus Stand; drain inlet being
   cleared.* → **Update status**.
5. Click **Action briefs** → step 1 is **Hotspot H1 · Central Bus Stand** with the intervention, department and
   response target. Point out the split between **Suggested** (vermilion border) and **Calculated** tables.
6. Optional: **Ask** → *"Which area needs attention first?"* → answer cites H1 with counts, from the database.

## Minute 5 — Citizen tracks progress (Window A)

1. Click **Track this report** (or go to `/track/<your ID>`).
2. Progress stepper shows **Submitted → Under review → Assigned → In progress**; the timeline shows the officer's
   message and *Assigned to Water and Drainage*.
3. Leave the page open and, in Window B, add a **Citizen-visible** update or resolve with a note — Window A updates
   on its own.
4. Close: *"From a phone in the rain to a crew on site — prioritised, explained and visible to everyone."*

---

## Backup lines for questions

- **"Is this a real AI model?"** — No trained model and no LLM. Documented NLP (weighted lexicon classifier, TF-IDF
  cosine similarity), weighted scoring and DBSCAN clustering. Every number is explainable; open **AI intelligence**.
- **"What if the classifier is wrong?"** — Low confidence goes to review; officers can **Correct category**, and the
  correction is logged. Priority can be overridden with a mandatory reason.
- **"Is the data real?"** — No. Synthetic reports, fictional wards and people, on real coordinates for a realistic map.
- **"How is it real-time?"** — Server-Sent Events from FastAPI; if the stream fails the app polls every 15 seconds.
- **"Privacy?"** — Names, contacts and photos never appear on public pages; internal notes never reach the citizen.

## Reset between runs

Command Center sidebar → **Reset demo data** (or `POST /api/authority/demo/reset` with header
`X-Authority-Code: civic-demo`). Seed IDs are stable across resets (e.g. `CP-S794U7` is the top critical report).

## Login flow demo (citizen → authority → citizen)

1. `/account` → **Create account** (or sign in as `citizen@civicpulse.demo` / `Citizen@2026`).
2. **Report an issue** → choose **Roads and potholes**, describe the pothole → **Next** → type the location and tap the
   map → **Next** → **Next** → **Submit report**. Note the tracking ID; it is listed under **My reports**.
3. **Sign out**. Click **Command Center** in the header → sign in as `officer@civicpulse.demo` / `Officer@2026`
   (the header shows *Priya Shetty · Ward Officer*).
4. **All reports** → search the ID → open it: category, summary, duplicate check and the priority breakdown.
5. **Assign**: department **Road Maintenance**, officer *Er. Anil Rao* → **Save assignment**.
6. **Update status** → **In progress**, add a message → **Update status**. Post a citizen-visible progress note.
7. **Sign out** → `/account` → sign in as the citizen → open the report: status *In progress*, Road Maintenance,
   the officer and both notes in the timeline, same tracking ID.
