# Crop Production System

Digital agriculture management platform for real-time crop monitoring, IoT sensor ingestion, ML-driven recommendations, and yield forecasting.

## Overview

Crop Production System helps farmers monitor field conditions, receive irrigation/fertilization recommendations, track pest risks, and predict yields — all backed by IoT sensor data and machine learning models.

The system supports four crop types: **banana**, **maize**, **cacao**, and **rice**.

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
│       ├── app/          # 6 pages (overview, fields, alerts, etc.)
│       └── components/   # 9 reusable components
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

### Machine Learning

```bash
cd ml
python train.py --crop maize --model rf
```

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
