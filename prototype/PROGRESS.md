# SIH 2026 Prototype - Build Progress

**Last session**: 2026-09-02
**Status**: all 8 tasks complete, full stack verified running end-to-end

## What was built

A working prototype of the **National Weather Big Data Analytics Platform**
(SIH 2026, MoES/IMD). Real-time ingestion → 5-model ML verification → SQLite →
REST + WebSocket → React dashboard + admin panel.

### Project structure

```
prototype/
├── backend/
│   ├── main.py              # FastAPI app + lifespan (auto-starts 60 events/min ingestion)
│   ├── config.py            # Settings from .env
│   ├── database.py          # Async SQLAlchemy + source-credibility seeding
│   ├── models.py            # ORM: WeatherEvent, VerificationResult, SourceCredibility
│   ├── schemas.py           # Pydantic v2 request/response
│   ├── ml/pipeline.py       # 5-model verification (BERT/CNN/ELA/MinHash/XGBoost stand-ins)
│   ├── ingestion/
│   │   ├── mock_sources.py  # 42 Indian cities, 7 source types
│   │   └── pipeline.py      # ingest -> verify -> persist -> WS broadcast
│   └── api/
│       ├── events.py        # /api/events, /{id}, /citizen-report, /stats/overview
│       ├── admin.py         # /review-queue, /review-action, /sources, /events/recent
│       └── ws.py            # /ws/stream broadcaster + ConnectionManager
├── frontend/                # Vite + React 18 + TypeScript (see README for the tree)
├── scripts/seed.py          # Bulk-load N events
├── Dockerfile.backend
├── Dockerfile.frontend      # multi-stage build + nginx (proxies /api and /ws)
├── docker-compose.yml       # one-command stack
├── DEMO.md                  # 6-minute judge run sheet
└── README.md
```

### 5 ML models (heuristic stand-ins matching production interfaces)

| # | Model | Production | Prototype |
|---|-------|-----------|-----------|
| 1 | Fake news | DistilBERT | Lexicon + caps/exclam detection |
| 2 | Event classifier | CNN + Bi-LSTM | Multi-label word-anchored keyword scoring |
| 3 | Image forensics | ELA + CNN | URL-pattern heuristic + stable hash |
| 4 | Duplicates | MinHash + LSH | Content-shingle SimHash |
| 5 | Source credibility | XGBoost | Lookup table + live counters |

Aggregate: `confidence = source_cred - fake_penalty - image_penalty + classification_bonus`
- `>= 0.85` → verified
- `0.60–0.85` → manual_review
- `< 0.60` → rejected

## Tasks

```
#1 [completed] Set up project structure and backend skeleton
#2 [completed] Build data ingestion module with mock data sources
#3 [completed] Implement AI/ML verification pipeline
#4 [completed] Set up storage layer (SQLite via SQLAlchemy)
#5 [completed] Build FastAPI backend with REST endpoints
#6 [completed] Build React frontend dashboard with real-time map
#7 [completed] Add admin panel for monitoring and verification
#8 [completed] End-to-end integration and demo script
```

## Environment blocker — RESOLVED

The Python 3.13 dependency failure that blocked the previous session was not
real. The existing `.venv` was already system CPython **3.13.7** with a working
`_sqlite3`, and `pip install -r requirements.txt` succeeded unchanged
(fastapi 0.141.1, pydantic 2.13.5, sqlalchemy 2.0.52, aiosqlite 0.22.1,
uvicorn 0.52.4). No compiler, no Rust, no venv recreation needed.

The one caveat worth keeping: use the **python.org CPython** build, not a
`uv`-managed 3.13, some of which ship without `_sqlite3`. Check with
`python -c "import sqlite3; print('ok')"`.

## Bugs found and fixed this session

Backend — all three were found by reading, then confirmed by running:

1. **`main.py` had no `__main__` block.** The documented command
   `python -m backend.main` imported the app and exited 0, so the server never
   started. Added the `uvicorn.run(...)` entry point.
2. **`source_credibility` was never persisted** on `WeatherEvent` — the column
   sat at its 0.5 default even though the schema exposes it and the pipeline
   computes it. Added it to the constructor.
3. **The `source_credibility` table was never seeded**, so `/api/admin/sources`
   returned `[]` and the admin table was blank. Added `seed_source_credibility()`
   + `_classify_source()` called from `init_db()`, plus `_bump_source_counters()`
   so the report counters move as events arrive.

ML classifier — the lexicon matched by substring but stored inflected forms:

4. **`"waterlogged"` never matched *waterlogging***, the single most common
   Indian flood term, so genuine flood reports classified as `general`. Switched
   the lexicon to stems and added India-specific phrasing (`knee-deep`,
   `water entered`, `overflow`).
5. **Substring matching produced nonsense hits**: `"heat"` fired on *wheat*,
   `"hot"` on *photo*, `"rain"` on *brain*. Matching is now word-anchored
   (`\bstem\w*`), with a `$` suffix marking stems that must match whole-word
   (`"hot$"`, `"wind$"` — the latter was firing on *winding*).
6. **`"hail"` sat in `snowfall`**, tagging every hailstorm as snowfall too.
7. **Bare `"storm"` in `thunderstorm`** stole the top label from *dust storm*
   and *hailstorm*; **`"visibility"` in `fog`** outranked *dust storm*. Both
   removed — a bare "storm" is evidence of *a* storm, not a thunderstorm.

   Result: 16/16 correct top labels on a category spot-check, 0 false positives
   on non-weather text (was 2 mislabels + 4 false positives).

Frontend — found by self-audit before the first `tsc` run:

8. `topCategory` imported from `'../theme'` but exported from `types.ts`
   (`EventMap.tsx`, `EventList.tsx`) — would have failed the build.
9. `vite-env.d.ts` redeclared `ImportMeta`, conflicting with `vite/client`.
10. **StrictMode WebSocket leak**: a shared `stoppedRef` was reset by the second
    mount before the first socket's `onclose` fired, so the stale handler
    reconnected and two sockets double-counted the streamed total. Rewrote
    `useLiveEvents` with a per-socket generation counter.
11. `React.ReactNode` / `React.FormEvent` used without importing the React
    namespace — an error under `jsx: react-jsx`. Now `import type { ReactNode }`.
12. `.stacked` used `--hover-wash` for the 2px segment gaps, which must show the
    card surface; fractional Leaflet `zoom={4.5}` needed explicit `zoomSnap`.
13. **TS6310**: `tsconfig.node.json` was a composite reference with
    `noEmit: true`, which TypeScript rejects. Merged into a single tsconfig
    covering `src` + `vite.config.ts`.

Operational — found while watching the server run:

14. **31,157 log lines in five minutes.** `echo=settings.DEBUG` echoed every SQL
    statement and `aiosqlite`/`watchfiles` log every cursor op and FS event at
    DEBUG. Split out a `SQL_ECHO` flag (default off) and pinned the noisy
    third-party loggers to WARNING. Startup log is now 10 lines.
15. **Reload wedged the server.** With reload on, editing a backend file logged
    `Reloading...` and then hung — the child kept serving and was never
    replaced. Reload is also simply wrong for this service, which owns a
    stateful ingestion task and live WebSocket clients: an in-place reload
    restarts ingestion and drops every connected dashboard. Now its own
    `RELOAD` flag, default off, decoupled from `DEBUG`.

## Verified working (2026-09-02)

Backend, on a fresh DB:
- `python -m backend.main` serves on :8000; ingestion runs at 60 events/min
- `/health`, `/api/events`, `/api/events/stats/overview`, `/api/admin/sources`,
  `/api/admin/review-queue` all 200 with real data
- `source_credibility` persists per event (e.g. 0.82 for `news_toi`)
- `/api/admin/sources` returns 8 seeded sources with live counters
- `POST /api/admin/review-action` — approve → `verified` and leaves the queue;
  reject → `rejected`
- `/ws/stream` streams events; payload is exactly the 16 keys the frontend's
  `LiveEvent` type declares

Frontend:
- `npm install` clean (78 packages)
- `npx tsc --noEmit` clean under `strict` + `noUnusedLocals`/`noUnusedParameters`
- `npm run build` clean — 352 kB JS / 108 kB gzipped
- dev server serves `/` and `/admin` (SPA fallback) and proxies `/api` + `/ws`
- all 17 source modules transform without a resolution error

Demo contrast (the money shot) now actually holds:- genuine: *"Heavy waterlogging near Andheri station, knee-deep water since
  6:30 am"* → **manual_review, 0.635**, classified `flooding` 0.90 → lands in
  the admin queue for a human
- hoax: *"BREAKING!!! SHOCKING 500 FEET MEGA TSUNAMI…"* with a suspect image →
  **rejected, 0.000**, reasons: high fake-news score, image manipulation suspect

Before the classifier fix both came back `rejected`, so the contrast was
"rejected vs rejected". DEMO.md was rewritten to match the real behaviour —
the genuine report going to *review* rather than *verified* is the better story:
the model triages, a person decides.

## NOT verified

**The Docker path is unvalidated.** Docker is not installed on this machine, so
`Dockerfile.backend`, `Dockerfile.frontend`, `frontend/nginx.conf` and
`docker-compose.yml` have never been built or run. They are written against the
verified two-terminal setup (and the frontend image just serves the `dist/` that
`npm run build` produces cleanly), but treat the one-command stack as untested
until someone runs `docker compose up --build`. **Do not make it the primary
demo path** — use the two-terminal flow, which is verified.

## Running

Two terminals (or `docker compose up --build` for the whole stack):

```bash
# 1 — backend
cd "C:\Users\HP\Projects\SIH 2026\prototype"
.venv\Scripts\activate
cp .env.example .env
python -m backend.main          # :8000, docs at /docs, ingestion auto-starts

# 2 — frontend
cd prototype/frontend
npm install
npm run dev                     # :5173, admin at /admin
```

Optional: `python scripts/seed.py --count 200 --fast` so the map opens with history.

See `README.md` for detail and `DEMO.md` for the 6-minute judge run sheet.

## Honest framing for judges

The architecture is real and every seam is in place. The models are **not
trained** — they are heuristics behind production interfaces, so each is a
one-file swap. Say that plainly; the "What's Mocked vs Real" table in README.md
is written to be shown as-is.

## Diagrams (see `docs/`)

- `docs/system-architecture-diagram.html` — 6-layer architecture
- `docs/ml-verification-pipeline.html` — AI/ML pipeline
- `docs/data-flow-diagram.html` — End-to-end data flow
- `docs/system-architecture-new.drawio`, `docs/ml-verification-pipeline.drawio`,
  `docs/data-flow-diagram-new.drawio` — Drawio exports

All match the SIH finalist reference style (light teal containers, color-coded
rounded rectangles, orange title, labeled arrows, tech-stack logos).
