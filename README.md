# Crop Production System

Digital agriculture management platform for real-time crop monitoring, IoT sensor ingestion, ML-driven recommendations, and yield forecasting.

## Overview

Crop Production System helps farmers monitor field conditions, receive irrigation/fertilization recommendations, track pest risks, and predict yields — all backed by IoT sensor data and machine learning models.

The system supports four crop types: **banana**, **maize**, **cacao**, and **rice** — with extensible architecture for additional crops.

### v0.1 Features

- **Real-time monitoring** via SSE (Server-Sent Events) — live sensor data streaming to the dashboard
- **Smart alert rules** — 20 preconfigured rules (temperature, humidity, soil moisture, rain) with per-crop thresholds
- **Field management** — organize fields by crop type with area and planting dates
- **JWT authentication** — RS256 with refresh token rotation
- **IoT ingestion pipeline** — MQTT-based sensor data processing with Redis pub/sub
- **Seed data** — demo scripts to bootstrap fields, sensors, and alert rules for testing

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Mobile App  │     │  Web Console │     │   MQTT IoT   │
│  (Expo/RN)   │     │  (Next.js)   │     │   Sensors    │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └──────────┬─────────┴─────────┬──────────┘
                  │                   │
         ┌────────▼────────┐   ┌─────▼──────┐
         │   FastAPI REST  │   │  EMQX MQTT │
         │   + SSE Events  │   │   Broker   │
         └────────┬────────┘   └─────┬──────┘
                  │                  │
         ┌────────▼──────────────────▼──────┐
         │        Ingestion Service         │
         │   (JSON Schema + Poison Pill)    │
         └────────┬─────────────────────────┘
                  │
     ┌────────────┼────────────┬──────────────┐
     ▼            ▼            ▼              ▼
┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐
│Timescale│ │  Redis  │ │  SQLite  │ │  ML Pipeline  │
│   DB    │ │  Pub/Sub│ │(Offline) │ │ RF/XGBoost   │
└─────────┘ └─────────┘ └──────────┘ └──────────────┘
```

## Tech Stack

| Component        | Technology                              |
|------------------|-----------------------------------------|
| Backend API      | Python 3.11, FastAPI                    |
| Database         | TimescaleDB (PostgreSQL + time-series)  |
| Cache / Pub/Sub  | Redis                                   |
| IoT Broker       | EMQX (MQTT)                             |
| Web Dashboard    | Next.js 15, React, Tailwind CSS 4       |
| Mobile App       | React Native, Expo SDK 52               |
| Machine Learning | scikit-learn, XGBoost, pandas           |
| Auth             | JWT RS256 with refresh rotation         |
| Sync Protocol    | Pull-then-push, LWW integer revisions   |

## Project Structure

```
├── backend/              # FastAPI application
│   ├── app/
│   │   ├── api/v1/       # REST endpoints (auth, sse, mobile sync)
│   │   ├── core/         # Database, MQTT, Redis clients
│   │   └── domain/       # Business logic modules
│   │       ├── auth/           # JWT auth, RBAC
│   │       ├── fields/         # Field CRUD
│   │       ├── ingestion/      # IoT data pipeline
│   │       ├── analytics/      # Aggregations + ML predictions
│   │       ├── notifications/  # Alert engine
│   │       ├── recommendations/# FAO-56 irrigation, fertilization
│   │       └── sync/          # Mobile offline-first sync
│   ├── alembic/          # Database migrations (5 versions)
│   └── tests/            # 132+ tests (pytest)
├── web/                  # Next.js 15 dashboard
│   └── src/
│       ├── app/          # Pages (dashboard, fields, analytics, devices, rules, alerts, users, settings, iot)
│       ├── components/   # Reusable components (sidebar, topbar, lock-screen)
│       └── lib/          # API client, React hooks (SSE, alerts)
├── mobile/               # React Native Expo app
│   └── src/
│       ├── app/          # 5 screens (login, fields, alerts, etc.)
│       ├── components/   # 6 components
│       └── lib/          # API client, SQLite DB, Zustand store, Sync
├── ml/                   # ML notebooks and training scripts
│   ├── notebooks/        # EDA, feature engineering, model training
│   └── train.py          # CLI training script
└── research/             # Crop case studies and production system analysis
```

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 20+
- Docker (for EMQX, TimescaleDB, Redis)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate     # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Infrastructure (Docker)

```bash
docker compose up -d
```

Starts EMQX (MQTT broker), TimescaleDB, and Redis.

### Web Dashboard

```bash
cd web
npm install
npm run dev
```

### Mobile App

```bash
cd mobile
npm install --legacy-peer-deps
npx expo start
```

### Seed Demo Data

Populate the database with sample fields, sensors, and alert rules:

```bash
# Start the backend first, then:
python run_backend.py          # Start backend + seed
# Or manually:
python seed_8000.py            # Seed fields and sensors
python seed_alerts.py          # Seed 20 alert rules with events
```

### Machine Learning

```bash
cd ml
python train.py --crop maize --model rf
```

## Dashboard Pages

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/dashboard` | Real-time metrics, field summaries, sensor status |
| **Fields** | `/dashboard/fields` | Field registry with crop types, area, planted dates |
| **Devices** | `/dashboard/devices` | IoT sensor registry, gateways, SSE connection status |
| **Analytics** | `/dashboard/analytics` | Historical trends, ML predictions, pest risk (in development) |
| **Alerts** | `/dashboard/alerts` | Event log with severity filters and acknowledgment |
| **Rules** | `/dashboard/rules` | 20 alert rule definitions with severity and cooldowns |
| **Users** | `/dashboard/users` | User management (in development) |

## API Endpoints

| Method | Path                           | Description                    |
|--------|--------------------------------|--------------------------------|
| POST   | `/api/v1/auth/login`           | Login (JWT RS256)              |
| POST   | `/api/v1/auth/refresh`         | Refresh token                  |
| GET    | `/api/v1/fields`               | List tenant fields             |
| POST   | `/api/v1/fields`               | Create field                   |
| GET    | `/api/v1/fields/{id}`          | Field details                  |
| GET    | `/api/v1/fields/{id}/sensors`  | Latest sensor readings         |
| GET    | `/api/v1/fields/{id}/analytics/summary` | Analytics summary   |
| GET    | `/api/v1/alerts/events`        | List alert events              |
| POST   | `/api/v1/sse/stream`           | Server-Sent Events stream      |
| POST   | `/api/v1/mobile/sync`          | Offline sync protocol          |
| GET    | `/health`                      | Health check                   |

## Testing

```bash
cd backend
pytest -v
```
## Research

See the [research](./research/) directory for crop case studies and production system analyses.

## License

Private — internal development project.
