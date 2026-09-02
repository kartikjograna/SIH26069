# Demo walkthrough — 6 minutes

A run sheet for demoing the prototype. The arc: **many noisy sources in → one
trustworthy map out**, with the filtering visible at every step.

---

## Before the judges arrive (5 min)

```bash
# Terminal 1
cd prototype
.venv\Scripts\activate            # Windows
python scripts/seed.py --count 250 --fast   # history, so nothing opens empty
python -m backend.main

# Terminal 2
cd prototype/frontend
npm run dev
```

Open **http://localhost:5173**. Checklist:

- [ ] Top bar reads **Live** with a pulsing green dot
- [ ] KPI row shows a few hundred events
- [ ] Map has markers in three colors
- [ ] `/admin` review queue is non-empty
- [ ] Browser zoom at 100%, dev console closed
- [ ] Pick your theme — the toggle is top-right

If the dot says *Reconnecting…*, the backend isn't up. Restart Terminal 1.

---

## The script

### 1. Frame the problem (30s)

> "During a cyclone, IMD's official feed is one voice among thousands. Citizens
> post faster than any agency can verify, and misinformation travels with them.
> A disaster manager needs one screen that separates signal from noise —
> and needs to know *why* each call was made."

Point at the KPI row. Total ingested, then the split: verified, manual review,
rejected.

> "Every one of these went through five models before it reached this map."

### 2. Show live ingestion (45s)

Say nothing for a beat and let the feed move — the counter climbs and new cards
flash in.

> "60 events a minute, continuously. Seven source types: IMD official, three
> news wires, verified and unverified social, and citizen reports."

### 3. Read the map (45s)

> "Color is the verification decision — green verified, amber awaiting a human,
> red rejected. Size is confidence."

Filter to **Verified** in the sidebar.

> "This is what a disaster manager would actually act on."

Then switch to **Rejected**.

> "And this is what we kept off their screen."

That contrast is the whole product. Don't rush it.

### 4. Open one event — the money shot (90s)

Click a **rejected** event. The right panel opens.

Walk the five models top to bottom:

| Model | What to say |
|---|---|
| 1 · Fake-news detection | "Sensational phrasing, all-caps, no corroborating detail. Risk score, so lower is better." |
| 2 · Source credibility | "Unverified social account. IMD scores 0.98; this scores 0.45." |
| 3 · Image forensics | "ELA plus CNN on any attached photo — manipulation probability." |
| 4 · Event classification | "Multi-label. One report can be rainfall *and* flooding." |
| 5 · Duplicate detection | "MinHash and LSH catch the same claim re-posted in different words." |

Then land on **Why this decision**:

> "It doesn't just score — it explains. An operator overriding the model can see
> exactly what it saw. That auditability is what makes it deployable in
> government."

### 5. Submit a citizen report (60s)

Use the form in the left column. Type something deliberately credible:

> `Waterlogging near Andheri station, knee-deep since 6:30 am, traffic diverted`

Submit. The verdict appears inline: **manual review, ~0.64 confidence**, classified
`flooding` at 0.90. Say the quiet part out loud — this is the interesting result,
not a weak one:

> "It read an unverified citizen and correctly called it flooding — but it did not
> publish it. An anonymous source caps out in the review band, so it goes to a
> human. That's the design: the model triages, a person decides."

Now do it again, deliberately fake:

> `BREAKING!!! SHOCKING cyclone to hit Mumbai TONIGHT — share now before they delete this!!!`

This one comes back **rejected at 0.000**, with its reasons listed: high fake-news
score, and image manipulation suspect if you ticked the photo box.

> "Same pipeline, same source, opposite outcome. The second one never reaches the map."

This is the single most convincing 20 seconds in the demo — the judges watch the
system make a decision on input *they* chose. It also sets up the next beat: the
credible report you just filed is now sitting in the queue you're about to open.

### 6. Admin panel (60s)

Go to **/admin**.

> "Models don't decide alone. Anything between 60 and 85 percent confidence
> routes to a human, with the flagged reason attached."

Find the Andheri report from the previous step and approve it — it leaves the
queue immediately.

Open the **Source credibility** tab.

> "Every source carries a score that feeds model 5, and these counters move as
> reports arrive. A source that keeps getting rejected loses standing over time."

### 7. Close (30s)

> "SQLite and heuristic models here so it runs on one laptop. In production the
> same seams take PostgreSQL with TimescaleDB, Elasticsearch, MinIO for media,
> and the real DistilBERT and CNN weights. The interfaces don't change —
> the architecture is the deliverable, and it's already end to end."

---

## Q&A — the questions that actually get asked

**"Are these real trained models?"**
No, and say so plainly. Heuristic stand-ins behind production interfaces, so the
whole pipeline runs on a laptop with no GPU. Swapping in DistilBERT is one file —
`backend/ml/pipeline.py`. Claiming trained models here is the fastest way to lose
a technical judge.

**"Where does the data come from?"**
Templated generators over 42 real Indian cities with true coordinates and seven
source types. The ingestion interface (`RawEvent`) is what a real Twitter or IMD
adapter would fill in.

**"Does it scale?"**
The path is async end to end and the ingestion layer is already a
queue-and-worker shape. Production swaps SQLite for TimescaleDB, adds Kafka
between ingestion and verification, and runs the models behind a batching
inference server. Nothing in the current structure has to move.

**"What if the model is wrong?"**
Three ways it's contained: the 60–85% band routes to a human rather than
auto-publishing; every decision carries its reasons; and an operator override
feeds back into source credibility.

**"Why is confidence a formula rather than a learned combiner?"**
Because for the prototype it needs to be inspectable. In production the
aggregator is a trained stacking model — the individual scores it consumes are
already being produced.

**"What's the actual novelty?"**
Not any single model — it's that verification is a *pipeline with an audit trail
and a human in the loop*, rather than one classifier's yes/no.

---

## If something breaks

| Symptom | Fix |
|---|---|
| Dot stuck on *Reconnecting…* | Backend down. Restart Terminal 1. |
| Map tiles blank | OpenStreetMap needs internet; markers still render without tiles. |
| Empty dashboard | Run the seed command, then reload. |
| `_sqlite3` import error | Wrong Python build — use the python.org CPython 3.13 installer. |
| Port 8000 taken | `APP_PORT=8001` in `.env`, and `BACKEND_URL=http://localhost:8001 npm run dev`. |

**Have a fallback.** Screenshot the dashboard, the model breakdown, and the admin
queue beforehand and keep them in a folder. If the laptop fails on stage, you
still have something to talk over.
