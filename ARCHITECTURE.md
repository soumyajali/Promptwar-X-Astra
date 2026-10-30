# CivicPulse AI — Architecture

## Overview

Two processes in development (Vite dev server + FastAPI), one in demo/production mode (FastAPI serves `frontend/dist`).
SQLite is the single source of truth. Every page reads from the API; nothing is cached as "truth" in the browser.

```
Browser ──HTTP JSON / multipart──▶ FastAPI routers ──▶ services (pure Python) ──▶ repository ──▶ SQLite
   ▲                                     │
   └──────── Server-Sent Events ◀────────┘ events.broker.publish() after every write
```

## Backend (`backend/app`)

| Module | Responsibility |
|---|---|
| `config.py` | All configuration, categories, departments, officer roster, demo area, statuses (env-overridable) |
| `db.py` | SQLite connection, schema, serialised transactions (`RLock` + WAL) |
| `repository.py` | All SQL. Report/timeline/link CRUD; ID generation (`CP-` + 6 unambiguous chars) |
| `schemas.py` | Pydantic request models, submission validation, and the **privacy boundary**: `public_feed_item`, `tracking_view`, `authority_view` |
| `events.py` | In-process SSE broker; thread-safe publish onto the event loop |
| `routers/public.py` | `/api/meta`, `/api/analyze/preview`, `POST /api/reports`, `/api/track/{id}`, `/api/public/*` |
| `routers/authority.py` | `/api/authority/*` guarded by `X-Authority-Code` (constant-time compare) |
| `services/text.py` | Normalisation, synonyms, stop words, stemming, TF-IDF, cosine |
| `services/signals.py` | Hazard / severity / urgency / affected-group lexicons + duration and people extraction (shared by summary and priority so they never disagree) |
| `services/classifier.py` | Category prediction with confidence, evidence, alternative |
| `services/summarizer.py` | Extractive summary |
| `services/duplicates.py` | Similarity scoring and likelihood |
| `services/priority.py` | Six-factor score, neighbourhood counts |
| `services/recommender.py` | Rule-based actions, department, response target |
| `services/hotspots.py` | DBSCAN (haversine) and hotspot summaries |
| `services/pipeline.py` | Orchestrates the UNDERSTAND stage; re-scores neighbours |
| `services/workflow.py` | ACT stage: create, assign, status transitions, category correction, priority override, updates — each persists, writes a timeline entry and publishes an event |
| `services/analytics.py` | Dashboard metrics, trend, distributions, workload, insights |
| `services/brief.py` | Action brief (calculated vs suggested) |
| `services/assistant.py` | Intent recognition + structured queries |
| `seed.py` | 46 synthetic reports pushed through the real pipeline, then real workflow calls |

### Data model

```
reports
  id TEXT PK                 CP-XXXXXX
  description, location_text, ward, lat, lng, image_path, affected_people, channel
  category_selected          citizen's choice (nullable)
  category                   effective category
  category_predicted, category_confidence, category_corrected
  reporter_name, reporter_contact      ← never leave authority endpoints
  status                     submitted | under_review | assigned | in_progress | resolved | rejected
  priority_score, priority_level, priority_overridden, priority_override_reason
  department, officer
  summary, analysis_json     full engine output (classification, summary, duplicates, priority, recommendation, signals)
  primary_report_id          earliest report in a likely-duplicate group
  resolution_note, created_at, updated_at, resolved_at

timeline   (id, report_id → reports, kind, status, message, visibility public|internal, actor, created_at)
report_links (report_id, related_id, score, distance_m, likelihood, reasons JSON, created_at)  PK(report_id, related_id)
```

### Status transitions

```
submitted ─▶ under_review ─▶ assigned ─▶ in_progress ─▶ resolved
     └──────────┴──────────────┴─────────────┴─────────▶ rejected
resolved / rejected ─▶ under_review   (re-open)
```
Assigning a department moves `submitted`/`under_review` to `assigned`. Resolving requires a note; rejecting requires a
reason to the citizen. Invalid transitions return `409` with a readable message.

### Request flow — new report

1. `POST /api/reports` (multipart). Validate fields; read at most 5 MB + 1 byte; sniff magic bytes (JPEG/PNG/WebP);
   save under a random name.
2. `workflow.create_report` → `pipeline.analyse` (classify → resolve category → signals → summary → duplicates →
   neighbourhood → priority → recommendation).
3. Insert report, links and two timeline entries.
4. Re-score open reports within 400 m (recurrence/concentration changed); log internal timeline entries for level changes.
5. `broker.publish("report.created")` → every open browser refetches dashboards, map, hotspots, lists.
6. Response: the citizen's tracking view plus full analysis.

## Frontend (`frontend/src`)

| Path | Responsibility |
|---|---|
| `store/live.tsx` | One `EventSource('/api/events')` for the whole app. Each event bumps a version counter; `useLiveQuery` refetches when it changes, keeping old data visible while loading. On error: polling every 15 s and reconnect with back-off |
| `lib/api.ts` | Typed API client, `ApiError` with field errors, demo auth header in `sessionStorage` |
| `lib/types.ts` | Shared TypeScript types mirroring backend payloads |
| `components/CityMap.tsx` | Leaflet map: priority markers, hotspot circles, picker mode, fly-to, tile-failure notice |
| `components/CityPlate.tsx` | Hero SVG: abstract drawn city with real report coordinates and hotspots plotted on it |
| `components/Assistant.tsx` | Drawer chat for the data assistant |
| `components/ui.tsx` | Logo, badges, score breakdown, timeline, states, error boundary, toast |
| `layouts/` | Public masthead/footer; Command Center sidebar with auth gate, reset, assistant |
| `pages/` | Landing, Report, Track, NotFound; `command/*` lazy-loaded (keeps charts out of the citizen bundle) |
| `styles/` | `system.css` tokens + components, `site.css` public pages, `command.css` Command Center |

## Design decisions

- **Deterministic AI over an LLM.** Judges and officers can see exactly why a score is 88; it runs offline, costs
  nothing, is testable, and cannot hallucinate statistics.
- **Shared signal extraction.** The summary and the priority score read the same hazard/affected lexicons, so the
  explanation always matches the number.
- **Link, never merge.** Duplicates raise priority and group work while each citizen keeps their own ID and timeline.
- **One hotspot function.** Map, dashboard, landing, brief and assistant all call `detect_hotspots`, so they agree.
- **SSE over WebSockets.** Updates only flow server→client; SSE is simpler, proxies cleanly through Vite, and
  auto-reconnects.
- **Privacy at the serialiser.** Public endpoints build their payloads from allow-lists, so new columns can't leak by
  accident. Names, contacts and photos never appear in public feeds.

## Visual design

Direction: **"The Observatory"** (Concept 5), selected by the team from a six-screen reference. A dark
forest-green operations look with warm amber/orange signal colours, laid out on a wide 1500 px container.

Screens: the landing page (headline, four live statistics, common-issue grid with open counts, live city pulse), a
four-step report wizard (details → location & map → evidence → review), the citizen tracking page (report card,
status steps with real timestamps, officer, evidence, map, priority breakdown), the Command Center operations
overview (five live stat tiles with week-over-week change, trend and distribution charts, recent reports, critical
issues, department workload, hotspots, insights), the City Intelligence Map (filters, legend counts that double as
filters, glowing hotspot beacons, report/hotspot detail panel) and the AI Intelligence workspace (classification,
summaries, duplicates, priority factors, recommendations, area briefs — each labelled "Local deterministic engine";
the assistant labels when an optional LLM only rephrased a locally computed answer).

Tokens (`frontend/src/styles/system.css`): grounds #071A15 / #06130F, surfaces #10241D / #172D24, rules #294238,
text #F0EBDD / #A5B5A9 / #71857A, amber #E9A33A, orange #E45B32, critical #D94B3D, success #80B69A. Priority colours:
critical #D94B3D, high #E45B32, medium #E9A33A, low #80B69A. Typography: Fraunces for headings and large figures,
Manrope for interface text, IBM Plex Mono for IDs, timestamps and metrics. Single dark theme with
`color-scheme: dark`; OpenStreetMap tiles are darkened with a CSS filter. Motion is limited to the live indicator,
hotspot beacons and the newest-report pulse, disabled under `prefers-reduced-motion`. Checked at 1920×1080,
1600×900, 1440×900, 1024×768 and 390×844 with no horizontal overflow.

The hero image (`frontend/scripts/make_hero.py`) and the street image used on the report and tracking pages
(`frontend/scripts/make_street.py`) are procedurally generated illustrations, labelled as such in the footer, and can be replaced by a real photo at the same path.
