# National Weather Big Data Analytics Platform (Omniroute)

## 🌍 Project Overview
The National Weather Big Data Analytics Platform is an end-to-end intelligence system designed to combat weather-related misinformation and streamline the verification of citizen-reported weather events. By combining real-time data ingestion with a multi-stage ML verification pipeline, the platform transforms chaotic, multi-source data into a trusted, actionable dashboard for administrators and the public.

### 🚀 Core Value Proposition
- **Combatting Misinformation:** A 5-model ML pipeline detects fake news, duplicate reports, and manipulated images.
- **Reducing Admin Burden:** Automated verification handles high-confidence events, while the "Manual Review Queue" prioritizes borderline cases.
- **Real-time Intelligence:** WebSocket-driven updates ensure the dashboard reflects ground reality within seconds.

---

## 🏗️ System Architecture
The platform follows a decoupled architecture to ensure scalability and reliability:
- **Ingestion Layer:** Orchestrates data from mock sensors and citizen reports.
- **Verification Layer (ML):** A serial pipeline of 5 specialized models (Fake News $\rightarrow$ Event Classification $\rightarrow$ Image Forensics $\rightarrow$ Duplicate Detection $\rightarrow$ Source Credibility).
- **Persistence Layer:** Async SQLAlchemy with SQLite (extensible to PostgreSQL/TimescaleDB).
- **Presentation Layer:** A Vite + React + TypeScript dashboard with live Leaflet maps and real-time KPI tracking.

### 🛠️ Tech Stack
- **Backend:** FastAPI, SQLAlchemy (Async), Pydantic, Python 3.13
- **Frontend:** React 18, TypeScript, Vite, Leaflet.js, Tailwind CSS
- **Communication:** REST API & WebSockets (for real-time streaming)
- **Containerization:** Docker & Docker Compose

---

## 🔬 ML Verification Pipeline (The Intelligence Engine)
Every single report is passed through a rigorous verification pipeline before it ever hits the public map.

| Stage | Model | Prototype Implementation | Purpose |
|---|---|---|---|
| 1 | **Fake News Detector** | Lexicon + Style Heuristics | Identifies bot-like language and clickbait |
| 2 | **Event Classifier** | Keyword Multi-label Scoring | Ensures the event matches a weather category |
| 3 | **Image Forensics** | URL-pattern + Stable Hashing | Detects recycled or manipulated images |
| 4 | **Duplicate Detection** | Content SimHash | Groups reports of the same event to prevent spam |
| 5 | **Source Credibility** | Dynamic Lookup Table | Weights the event based on the reporter's history |

**Verdict Logic:**
- **Verified ($\ge 0.85$):** Auto-published to the live map.
- **Review ($0.60 - 0.85$):** Sent to Admin for human verification.
- **Rejected ($< 0.60$):** Discarded as unreliable.

---

## 🚦 Quick Start Guide

### 1. Backend Setup
```bash
cd prototype
python -m venv .venv
# Windows: .venv\Scripts\activate | macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python -m backend.main
```
- **API Docs:** `http://localhost:8000/docs`

### 2. Frontend Setup
```bash
cd prototype/frontend
npm install
npm run dev
```
- **Dashboard:** `http://localhost:5173`

### 3. Docker (One-Command Setup)
```bash
cd prototype
docker compose up --build
```

---

## 📊 Key Features
### 🛰️ Live Dashboard
- **Real-time Map:** India-wide markers colored by verification status.
- **KPI Suite:** Total events, fake news caught, and mean confidence tracking.
- **Deep-Dive:** Click any event to see the exact score from each of the 5 ML models.

### 🛡️ Admin Command Center
- **Manual Review:** A dedicated queue to approve or reject borderline events.
- **Source Analytics:** Track which sources are the most reliable.
- **System Control:** Manage ingestion rates and thresholds.

---

## 📂 Project Structure
```
prototype/
├── backend/            # FastAPI application & ML pipeline
│   ├── api/            # REST & WebSocket endpoints
│   ├── ingestion/      # Data pipeline & mock generators
│   ├── ml/             # The 5-model verification logic
│   └── database.py     # Async DB orchestration
├── frontend/           # Vite + React Dashboard
│   ├── src/
│   │   ├── components/ # UI components (Map, Charts, etc.)
│   │   ├── pages/     # Dashboard & Admin panels
│   │   └── api.ts      # Type-safe backend client
├── data/               # Local SQLite storage
└── Dockerfile*         # Containerization for full stack
```
