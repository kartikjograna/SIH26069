# National Weather Big Data Analytics Platform - Prototype

A working prototype of the SIH 2026 weather data analytics platform.
End-to-end: real-time ingestion → ML verification → storage → REST + WebSocket API → dashboard.

## Architecture

```
prototype/
├── backend/
│   ├── main.py            # FastAPI app + lifespan (DB init, ingestion startup)
│   ├── config.py          # Settings (DB URL, thresholds)
│   ├── database.py        # Async SQLAlchemy setup
│   ├── models.py          # ORM: WeatherEvent, VerificationResult, SourceCredibility
│   ├── schemas.py         # Pydantic request/response
│   ├── ml/
│   │   └── pipeline.py    # 5-model verification pipeline
│   ├── ingestion/
│   │   ├── mock_sources.py  # India-focused mock data generator
│   │   └── pipeline.py    # Orchestrates ingest -> verify -> persist -> broadcast
│   └── api/
│       ├── events.py      # /api/events list/get/citizen-report/stats
│       ├── admin.py       # /api/admin review-queue/sources
│       └── ws.py          # /ws/stream WebSocket broadcaster
├── scripts/seed.py        # Populate DB with N events
├── frontend/              # Vite + React + TypeScript dashboard
│   ├── src/
│   │   ├── App.tsx        # Shell: nav, theme toggle, shared WebSocket
│   │   ├── api.ts         # Typed backend client
│   │   ├── types.ts       # Mirrors backend/schemas.py
│   │   ├── theme.ts       # Status + sequential palettes, label maps
│   │   ├── hooks/useLiveEvents.ts   # WebSocket with backoff reconnect
│   │   ├── components/    # Map, charts, event list, model breakdown
│   │   └── pages/         # Dashboard.tsx, Admin.tsx
│   └── vite.config.ts     # Proxies /api + /ws to :8000
├── data/                  # SQLite DB lives here
├── models/                # Trained model artifacts (future)
├── requirements.txt
└── .env.example
```

## ML Verification Models (5)

| # | Model | Production | Prototype |
|---|-------|-----------|-----------|
| 1 | Fake News Detector | DistilBERT fine-tuned | Lexicon + style heuristics |
| 2 | Event Classifier | CNN + Bi-LSTM (multi-label) | Keyword multi-label scoring |
| 3 | Image Forensics | ELA + CNN | URL-pattern heuristic + stable hash |
| 4 | Duplicate Detection | MinHash + LSH | Content shingle SimHash |
| 5 | Source Credibility | XGBoost ensemble | Lookup table + dynamic update |

Each event is scored 0-1; final confidence = source_cred - fake_penalty - image_penalty + classification_bonus.
- `>= 0.85` -> **verified** (auto-publish)
- `0.60 - 0.85` -> **manual_review** (admin queue)
- `< 0.60` -> **rejected**

## Running

You need **two terminals**: one for the API, one for the dashboard.
(Or skip both with Docker — see [One-command stack](#one-command-stack).)

### Terminal 1 — backend

```bash
cd prototype
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
python -m backend.main
```

API at `http://localhost:8000` | Docs at `http://localhost:8000/docs`

Background ingestion starts automatically: **60 events/min** continuously.

> **Python 3.13 note.** Use the CPython release build (`python.org` installer).
> Some `uv`-managed 3.13 builds ship without the `_sqlite3` extension, which
> breaks the SQLite backend. Verify with:
> `python -c "import sqlite3; print('ok')"`

> **Two logging flags, both off by default.** `SQL_ECHO=true` echoes every SQL
> statement (~6k lines/min under continuous ingestion — useful only to debug a
> query). `RELOAD=true` enables auto-restart, which is deliberately *not* tied to
> `DEBUG`: this service holds a background ingestion task and live WebSocket
> clients, so a reload restarts ingestion and drops every connected dashboard.

### Terminal 2 — frontend

```bash
cd prototype/frontend
npm install
npm run dev
```

Dashboard at **http://localhost:5173** — admin panel at `/admin`.

Vite proxies `/api` and `/ws` to `:8000`, so both run on one origin in the
browser: no CORS preflight, and the WebSocket needs no extra config. To point
at a non-default backend, set `BACKEND_URL` before `npm run dev`.

### Optional — seed a batch first
So the dashboard opens with history instead of an empty map:

```bash
python scripts/seed.py --count 200 --fast
```

### Try the API directly
- API docs: http://localhost:8000/docs
- List events: http://localhost:8000/api/events?limit=20
- Stats: http://localhost:8000/api/events/stats/overview
- Review queue: http://localhost:8000/api/admin/review-queue
- WebSocket: ws://localhost:8000/ws/stream

## Dashboard
**Dashboard (`/`)**
- KPI row: totals, verified / manual-review / rejected split, fake news caught,
  duplicates removed, events last hour, mean confidence
- Live map of India — marker color = verification status, size = confidence
- Filters: status, category, source, state, city, minimum confidence
- Live feed over WebSocket; new arrivals flash once
- Click any event for the **5-model breakdown** and the reasons behind its decision
- Citizen report form — submits through the real pipeline and shows the verdict

**Admin (`/admin`)**
- Manual review queue (60–85% confidence) with approve / reject
- Source credibility table with live report counters
- Recent activity across all statuses

Both themes ship: the toggle is in the top bar, and the palette is defined for
light and dark separately rather than inverted.

## One-command stack

If Docker is available, skip the two-terminal setup entirely:

> **Untested path.** This was written but never built — no Docker on the dev
> machine. The two-terminal setup above is the verified one; don't make this the
> primary demo path until you've run it once.

```bash
cd prototype
docker compose up --build
```

- Dashboard → **http://localhost:8080**
- API docs → http://localhost:8000/docs

nginx serves the built frontend and proxies `/api` and `/ws` to the backend
container, so the WebSocket works the same as in dev. Ingested events persist in
a named volume across restarts.

To seed history inside the running container:

```bash
docker compose exec backend python scripts/seed.py --count 250 --fast
```

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/events` | List events with date/category/location/status filters |
| GET | `/api/events/{id}` | Get one event with full verification result |
| POST | `/api/events/citizen-report` | Submit a citizen report (goes through full ML) |
| GET | `/api/events/stats/overview` | Aggregate stats for dashboard |
| GET | `/api/admin/review-queue` | Events needing human review |
| POST | `/api/admin/review-action` | Approve/reject a manual-review item |
| GET | `/api/admin/sources` | Source credibility table |
| GET | `/api/admin/events/recent` | Most recent across all statuses |
| WS | `/ws/stream` | Real-time event stream (JSON per event) |

## What's Mocked vs Real

**Real:**
- Async FastAPI server
- Async SQLAlchemy with SQLite (swap URL for PostgreSQL)
- WebSocket broadcast on every event
- Full ML pipeline structure matching production architecture
- All API endpoints match the system design
- React dashboard, live map, admin review workflow

**Mocked (for prototype speed):**
- ML models are heuristic-based, not trained transformers/CNNs
- Data sources are templated generators, not real Twitter/IMD APIs
- SQLite instead of PostgreSQL+TimescaleDB+Elasticsearch+MinIO
- No auth, no rate limiting

Swap any of these in by replacing one file - the interfaces are stable.

Be upfront about the mocked column when demoing. The claim that holds is
*"the architecture is real and every seam is in place"* — not that the models are
trained. See `DEMO.md` for a walkthrough that makes that distinction cleanly.
