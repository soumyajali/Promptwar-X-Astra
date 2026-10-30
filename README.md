# CivicPulse AI

**From citizen complaints to intelligent civic action.**
PromptWars × ASTRA 2026 · Problem statement: *From Complaints to Action*

CivicPulse turns scattered citizen reports into prioritised, explainable and trackable action. A citizen reports a
problem in two minutes without an account. The engine classifies it, summarises it, links it to duplicates nearby,
scores its priority from 0–100 with every reason shown, and clusters it into geographic hotspots. The ward office
assigns, updates and resolves it in a Command Center — and the citizen watches each step live on a tracking page.

---

## The problem

Ward offices receive complaints by phone, message, social media and in person. The same pothole is reported
many times, a dangerous live wire waits behind a garbage complaint, recurring problems look "new" every year,
and citizens never hear back.

## The solution — four stages

| Stage | What happens | How |
|---|---|---|
| **Capture** | Citizen report: category (optional), description, map pin / GPS, photo, optional contact | Validated form, image type/size checks, tracking ID `CP-XXXXXX` |
| **Understand** | Category, summary, duplicates, priority score, recommended action | Weighted lexicon classifier · extractive summariser · TF-IDF + geo + time similarity · 6-factor weighted score · rules |
| **Reveal** | Live map, hotspots, dashboard, analytics | DBSCAN over haversine distance; all metrics computed from SQLite on request |
| **Act** | Assign department + officer, update status, public/internal notes, resolve with a note, action brief, data-backed assistant | Audited workflow with timeline; live sync over Server-Sent Events |

## Features

**Citizen**
- Landing page with a photographic city hero, live statistics bar, a data-driven city map (every dot is a real stored report), hotspots and a public ledger
- Report form: 8 categories, live classifier hint while typing, map pin picker + "use my location", photo upload with preview (JPEG/PNG/WebP ≤ 5 MB, magic-byte checked), validation with field-level errors
- Instant analysis shown after submit: category, summary, similar reports with reasons and distance, priority breakdown, recommended action
- Tracking page: progress stepper, live timeline, department, target response, resolution note, photo, map

**Authority Command Center** (demo code `civic-demo`)
- Overview — 8 live metrics, received-vs-resolved trend, priority mix, critical list, hotspot map, category and department charts, derived insights
- All reports — search, 5 filters, 4 sort orders, flags for duplicates / category review / overrides
- Report detail — full AI analysis; correct category; override priority with a logged reason; assign department + officer; change status; citizen-visible or internal notes; timeline
- Live city map — priority markers, hotspot rings, category/priority/status filters, map↔list switch on mobile
- Hotspots — each with coordinates, count, dominant category, critical count, average priority, reason and suggested intervention
- AI intelligence — live classifier playground, classifier/citizen agreement rate, review queue, documented weights, honest limits
- Assignments — unassigned queue with one-click suggested department; per-department boards with officer load
- Analytics — trend, backlog, status, ward, priority, department performance
- Action briefs — per ward or city-wide, **Calculated** facts separated from **Suggested** actions, printable
- Ask CivicPulse — intent-recognition assistant that answers only from stored data, with evidence

## Architecture

```
frontend/ (React 19 + Vite + TypeScript)          backend/ (FastAPI + SQLite, pure-Python AI)
  pages/  Landing · Report · Track                  routers/   public.py · authority.py
          command/* (lazy-loaded)                   services/  classifier · signals · summarizer
  components/ CityMap (Leaflet) · CityPlate (SVG)              duplicates · priority · recommender
              Assistant · ui                                   hotspots · analytics · brief
  store/live.tsx  ← EventSource /api/events                    assistant · pipeline · workflow
  lib/api.ts  ─────────── /api/* (JSON, multipart) ──→ repository.py → db.py (SQLite, single source of truth)
                                                     events.py (SSE broker) · seed.py · schemas.py
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the data model, request flows and design decisions.

## Technology stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19, Vite, TypeScript, plain CSS design tokens | Fast to build; tokens give a distinctive look without a utility-class template feel |
| Icons / charts / maps | lucide-react, Recharts, Leaflet + OpenStreetMap | As requested; free, no keys |
| Visual theme | "Dusk": dark forest-charcoal UI over a photographic city hero; Fraunces, Manrope, IBM Plex Mono (bundled via @fontsource) | Chosen by the team from a reference; fonts work offline |
| Hero image | `frontend/public/img/hero-city.jpg`, generated by `frontend/scripts/make_hero.py` | No stock-photo licensing; replace the file with a real photo any time |
| Backend | Python 3.11+, FastAPI, Uvicorn | Typed validation, async SSE, easy testing |
| Database | SQLite (stdlib) | Zero setup, persistent, one file |
| AI | Pure-Python NLP + geometry (no ML libraries) | Explainable, deterministic, no paid API, tiny repo |

## AI methodology

All intelligence is **deterministic and documented**. There is no trained model and no external LLM. Each output
carries the evidence that produced it, and officers can correct it.

**Classification** (`services/classifier.py`) — every category has a lexicon of weighted phrases (multi-word phrases
weigh more). Scores are softmax-normalised (temperature 2) together with an "other" pseudo-class so weak evidence
never yields high confidence. Returns category, confidence, matched phrases, explanation and an alternative. Below 45%
confidence → flagged for review. A citizen's own category choice is kept; a confident disagreement (≥60%) is flagged,
never silently overwritten.

**Summarisation** (`services/summarizer.py`) — extractive: picks the sentence with the strongest category evidence,
then appends only detected facts — affected groups, people count, safety hazards, urgency cues — prefixed with the
category and the citizen's location. It never adds information.

**Duplicate detection** (`services/duplicates.py`)
`score = 0.40·text + 0.20·category + 0.30·geo + 0.10·time`
- text: TF-IDF (unigrams + bigrams, stop words removed, light stemming, synonym normalisation) cosine similarity
- category: 1 same, 0.5 related (e.g. waterlogging↔drainage), 0 otherwise
- geo: `1 − distance/500 m`; time: `1 − days/14`
- **Likely** duplicate: score ≥ 0.70, or ≥ 0.60 with same category, ≤150 m and some text overlap. **Possibly related**: ≥ 0.50
- Matches are stored as links with reasons. Reports are never deleted or merged.

**Priority scoring** (`services/priority.py`) — six factors, weights sum to 100:

| Factor | Max | Measured from |
|---|---|---|
| Safety risk | 25 | Hazard lexicon (live wire 1.0, open manhole 0.95 …) or category baseline |
| Severity | 20 | Severity phrases (knee deep, burst …); a hazard implies ≥ 0.6 × its risk |
| Urgency | 15 | Urgency phrases + stated duration (≥ 7 days = full) |
| Public impact | 15 | Affected groups (hospital, school, bus stand …) + stated people count (500+ = full) |
| Recurring reports | 15 | 0.25 per linked report + 0.15 per same-category report ≤300 m / 60 days |
| Geographic concentration | 10 | Open reports ≤400 m in 14 days (5+ = full) |

Levels: **Critical ≥ 70 · High ≥ 50 · Medium ≥ 30 · Low < 30.** When a new report arrives, nearby open reports are
re-scored because their recurrence changed. Officers can override with a mandatory, logged reason.

**Recommendations** (`services/recommender.py`) — category base action plus rules for electrical hazards, open
manholes, personal-safety incidents, contamination, critical band, recurrence (≥2 links) and clustering (≥3 nearby),
each with its reason, a suggested department and a suggested response target.

**Hotspot detection** (`services/hotspots.py`) — DBSCAN with haversine distance, `eps = 350 m`, `min_samples = 3`, over
open reports. Each cluster reports centroid, radius, count, category mix, dominant category, critical/high counts,
average priority, a reason, a suggested intervention and a hotspot score
(`0.5·avg priority + 8·critical + 4·high + 3·count`, max 100). One function feeds the map, dashboard, landing page,
brief and assistant.

**Assistant** (`services/assistant.py`) — keyword/regex intent recognition (critical, common issue, attention,
today's plan, department, duplicates, recurring by category, resolution, ward, report lookup, counts) with slot
extraction (category, ward, report ID). Each intent runs a structured query and returns the answer, evidence and
report links. Unrecognised questions get an honest "I can't answer that from the data".

## Database design

`reports` (one row per citizen submission: text, category fields, location, photo path, reporter (private),
status, priority, department, officer, summary, full analysis JSON, primary duplicate link, timestamps) ·
`timeline` (every event with `public` / `internal` visibility and actor) · `report_links` (duplicate/related pairs with
score, distance, likelihood and reasons). Details in ARCHITECTURE.md.

## Setup

Requirements: **Python 3.11+**, **Node.js 20+**.

```bash
git clone <your-repo-url> civicpulse-ai && cd civicpulse-ai

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000     # seeds 46 demo reports on first start

# Frontend (second terminal)
cd frontend
npm install
npm run dev                          # http://localhost:5173  (proxies /api to :8000)
```

**Single-process mode** (for a demo machine): `cd frontend && npm run build`, then start only the backend and open
http://localhost:8000 — FastAPI serves the built app.

Optional configuration: copy `backend/.env.example` and export the variables (no secrets are required).

**Tests:** `cd backend && pytest` (26 tests: classifier, summariser, duplicates, priority, recommendations, DBSCAN,
creation pipeline, validation, image checks, auth gate, assignment, status transitions, timeline visibility,
category correction, priority override, dashboard arithmetic, privacy of the public feed, brief, assistant, reset).

## Demo

See [DEMO_GUIDE.md](DEMO_GUIDE.md) for the exact five-minute script. Short version: **Report an issue → Fill with demo
example → add `docs/demo/sample-waterlogging.jpg` → Submit** → open **Command Center** (code `civic-demo`) → the new
report appears live → assign to Water and Drainage, set In progress → open the citizen tracking page → it updates
without reloading.

## Design exploration

`/design-lab` keeps the five alternative UI concepts that were explored (Atlas, Wayfinder, Signal, Quiet, Cyanotype).
The shipped app uses the "Dusk" theme the team selected afterwards. The lab does not affect the live app.

## Limitations

- The classifier is a hand-written lexicon: explainable and fast but it will miss phrasing it hasn't seen (low
  confidence goes to review). English only.
- The summariser is extractive and may keep awkward citizen wording.
- Thresholds and weights were tuned on the synthetic demo data, not real outcomes.
- Photos are validated and stored but not analysed.
- Wards are assigned from the nearest existing report (no ward polygons).
- Authority access is a shared demo code, not real authentication or role management.
- SSE broker is in-process: one backend instance. Clients fall back to 15-second polling if the stream drops.
- Map tiles come from the public OpenStreetMap servers; offline, markers still render on a plain background.

## Honesty statement

- **Real and working:** report capture, image upload, persistence, every algorithm described above, the workflow,
  live sync, map, hotspots, dashboard, briefs, assistant, tests.
- **Deterministic AI:** all "AI" is documented rule-based NLP, TF-IDF similarity, weighted scoring and DBSCAN clustering.
  No trained model, no LLM, no external AI API.
- **Simulated:** "Demo City" — fictional wards, streets, people and complaints placed on Mangaluru coordinates; officer
  names are invented; the authority login is a demo gate; the city hero image is a generated illustration.
- **Not claimed:** government integration, emergency dispatch, verified citizen identities, real municipal data or
  production-grade security.

## Future scope

Multilingual intake (Kannada, Hindi) and voice notes · WhatsApp/SMS/call-centre ingestion into the same pipeline ·
optional LLM summaries behind the existing extractive fallback · image classification of photos · ward boundary
polygons · real SSO and role-based permissions · SLA tracking and escalation · calibration of weights with ward
outcome data · Postgres/PostGIS and a shared message bus for multiple instances.
