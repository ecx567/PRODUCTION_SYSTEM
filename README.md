# 🌾 Crop Production System

**Plataforma de agricultura digital** para monitoreo de cultivos en tiempo real, ingesta de sensores IoT, recomendaciones basadas en ML y predicción de rendimientos.

> **Versión:** 0.1.0 · **Estado:** Producción (web) / En desarrollo (mobile)

---

## 📸 Dashboard

| Vista previa | Descripción |
|---|---|
| ![Dashboard Overview](web/public/screenshots/dashboard-overview.png) | **Dashboard principal** — resumen con 18 campos activos, 53 sensores online, alertas en vivo |
| ![Dashboard Metrics](web/public/screenshots/dashboard-metrics.png) | **Tarjetas de métricas** — campos activos, alertas, sensores, última sincronización |
| ![Dashboard Fields](web/public/screenshots/dashboard-fields.png) | **Grid de campos** — vista rápida de todos los campos con cultivo y hectáreas |
| ![Field Detail](web/public/screenshots/field-detail.png) | **Detalle de campo** — métricas en tiempo real: temperatura, humedad, suelo, lluvia |
| ![Field Charts](web/public/screenshots/field-charts.png) | **Gráficos** — tendencia de temperatura y humedad (últimas 72h) |
| ![Field Sensors](web/public/screenshots/field-sensors.png) | **Tabla de sensores** — lecturas individuales por sensor con valores en tiempo real |
| ![Field Recommendations](web/public/screenshots/field-recommendations.png) | **Recomendaciones** — riego (FAO-56), fertilización y riesgo de plagas |
| ![Field Yield](web/public/screenshots/field-yield.png) | **Predicción de rendimiento** — forecast con intervalo de confianza y features usadas |
| ![Fields List](web/public/screenshots/fields-list.png) | **Lista completa de campos** — 18 campos con filtros por cultivo |
| ![Alerts Page](web/public/screenshots/alerts-page.png) | **Alertas** — historial de eventos con severidad y acknowledge |
| ![Rules Page](web/public/screenshots/rules-page.png) | **Reglas de alerta** — 54 reglas preconfiguradas por cultivo y condición |
| ![Analytics Page](web/public/screenshots/analytics-page.png) | **Analíticas** — tendencias históricas y predicciones ML |
| ![Devices Page](web/public/screenshots/devices-page.png) | **Dispositivos IoT** — sensores, gateways y estado de conexión SSE |

---

## 🏗️ Arquitectura

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Mobile App  │     │  Web Console │     │   MQTT IoT   │
│  (Expo/RN)   │     │  (Next.js)   │     │   Sensors    │
│  ⚠️ En pro.  │     │  🟢 Live     │     │   (futuro)   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                     │
       └──────────┬─────────┴──────────┬──────────┘
                  │                    │
         ┌───────▼────────┐    ┌──────▼──────┐
         │   FastAPI REST │    │  EMQX MQTT  │
         │  + SSE Events  │    │   Broker    │
         └───────┬────────┘    └──────┬──────┘
                 │                    │
         ┌───────▼────────────────────▼──────┐
         │        Ingestion Service          │
         │   (JSON Schema + Poison Pill)     │
         └───────┬───────────────────────────┘
                 │
     ┌───────────┼────────────┬───────────────┐
     ▼           ▼            ▼               ▼
┌──────────┐ ┌────────┐ ┌──────────┐ ┌──────────────┐
│Timescale │ │ Redis  │ │  SQLite  │ │  ML Pipeline │
│   DB     │ │Pub/Sub │ │(Offline) │ │ RF/XGBoost   │
└──────────┘ └────────┘ └──────────┘ └──────────────┘
```

### 🔄 Flujo de datos

1. **Sensores IoT** → EMQX (MQTT) → Ingestion Service → TimescaleDB + Redis Pub/Sub
2. **Dashboard web** → FastAPI REST API → TimescaleDB (lecturas) + Redis (caché)
3. **Alertas en vivo** → SSE (Server-Sent Events) desde FastAPI → navegador
4. **Recomendaciones** → Motor FAO-56 (riego) + reglas de fertilización + GDD (plagas)
5. **Predicciones** → Modelos ML (Random Forest / XGBoost) entrenados en `ml/`
6. **App mobile** → Sync offline-first con protocolo pull-then-push + SQLite local

---

## 🧰 Tech Stack

| Componente          | Tecnología                                   |
|---------------------|----------------------------------------------|
| **Backend API**     | Python 3.11+, FastAPI, SQLAlchemy (async)    |
| **Base de datos**   | TimescaleDB (PostgreSQL + time-series)       |
| **Cache / Pub/Sub** | Redis                                        |
| **IoT Broker**      | EMQX (MQTT) — opcional                      |
| **Web Dashboard**   | Next.js 15, React 19, Tailwind CSS 4        |
| **Mobile App**      | React Native, Expo SDK 52 (⚠️ en proceso)   |
| **Machine Learning**| scikit-learn, XGBoost, pandas               |
| **Autenticación**   | JWT RS256 con refresh token rotation         |
| **Sync offline**    | Pull-then-push, LWW integer revisions        |
| **Migraciones**     | Alembic (9 versiones)                       |

---

## 📁 Estructura del proyecto

```
📦 PRODUCTION_SYSTEM
├── 📁 backend/                    # FastAPI (Python)
│   ├── 📁 app/
│   │   ├── 📁 api/v1/             # Endpoints REST
│   │   ├── 📁 core/               # DB, MQTT, Redis, Scheduler
│   │   └── 📁 domain/             # Lógica de negocio
│   │       ├── auth/              # JWT, RBAC
│   │       ├── fields/            # CRUD de campos
│   │       ├── ingestion/         # Pipeline IoT
│   │       ├── analytics/         # Agregaciones + ML
│   │       ├── notifications/     # Motor de alertas
│   │       ├── recommendations/   # FAO-56, fertilización, plagas
│   │       └── sync/              # Sync offline-first
│   ├── 📁 alembic/                # Migraciones (9 versiones)
│   ├── 📁 tests/                  # Tests (pytest)
│   └── requirements.txt
│
├── 📁 web/                        # Next.js 15 Dashboard
│   ├── 📁 public/
│   │   └── 📁 screenshots/        # Capturas del dashboard
│   └── 📁 src/
│       ├── 📁 app/                # Páginas (dashboard, fields, alerts, rules, etc.)
│       │   └── 📁 dashboard/
│       │       ├── page.tsx       # Dashboard principal
│       │       ├── fields/        # Lista + detalle de campos
│       │       ├── alerts/        # Alertas
│       │       ├── rules/         # Reglas de alerta
│       │       ├── analytics/     # Analíticas
│       │       ├── devices/       # Dispositivos IoT
│       │       └── ...
│       ├── 📁 components/         # Componentes reutilizables
│       └── 📁 lib/                # API client, hooks, mock-data
│
├── 📁 mobile/                     # React Native (⚠️ en proceso)
│   └── 📁 src/
│       ├── 📁 app/                # Pantallas
│       ├── 📁 components/         # Componentes
│       └── 📁 lib/                # SQLite, sync, API client
│
├── 📁 ml/                         # Machine Learning
│   ├── 📁 notebooks/              # EDA, feature engineering
│   └── train.py                   # CLI de entrenamiento
│
├── 📁 research/                   # Investigación de cultivos
├── 📁 scripts/                    # Scripts de utilidad
├── docker-compose.yml             # TimescaleDB + Redis
├── dev.ps1                        # Dev server (todo en uno)
└── run_backend.py                 # Backend launcher
```

---

## 🚀 Cómo ejecutar el proyecto

### 1️⃣ Requisitos previos

| Herramienta | Versión | Cómo verificar |
|-------------|---------|----------------|
| **Docker Desktop** | ≥ 24+ | `docker --version` |
| **Python** | ≥ 3.11 | `python --version` |
| **Node.js** | ≥ 20 | `node --version` |
| **PowerShell** | ≥ 5.1 | `$PSVersionTable.PSVersion` |

### 2️⃣ Infraestructura (Docker)

```powershell
# Desde la raíz del proyecto:
cd D:\sistema\ de\ producción

# Levantar TimescaleDB + Redis
docker compose up -d

# Verificar que estén saludables:
docker ps
# Deberías ver: crop-timescaledb (healthy), crop-redis (healthy)
```

> ⚠️ TimescaleDB necesita unos segundos para estar lista. Esperá a que el health check pase a `healthy`.

### 3️⃣ Backend (FastAPI)

```powershell
# Ir al directorio del backend
cd D:\sistema\ de\ producción\backend

# Crear y activar entorno virtual (solo primera vez)
python -m venv .venv
.\.venv\Scripts\activate

# Instalar dependencias (solo primera vez)
pip install -r requirements.txt
pip install bcrypt==4.0.1   # necesario para passlib

# Configurar variable de entorno
$env:DATABASE_URL = "postgresql+asyncpg://cropuser:cropsecret@localhost:5432/cropproduction"
$env:PYTHONPATH = "D:\sistema de producción\backend"

# Correr migraciones (solo primera vez o después de cambios)
alembic upgrade head

# Iniciar servidor
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

El backend arranca automáticamente con **seed data**:
- 1 tenant (Default Farm)
- 2 usuarios (admin + farmer)
- **18 campos** agrícolas con distintos cultivos
- **2988 lecturas de sensores** (166 por campo)
- **54 reglas de alerta** preconfiguradas por cultivo
- Conexión SSE lista para streaming en vivo

📋 **Verificar que funciona:** http://localhost:8000/docs (Swagger UI) o `curl http://localhost:8000/api/v1/fields?page_size=2`

### 4️⃣ Web Dashboard (Next.js)

```powershell
# En otra terminal:
cd D:\sistema\ de\ producción\web

# Instalar dependencias (solo primera vez)
npm install

# Iniciar servidor de desarrollo
node node_modules/next/dist/bin/next dev -p 3000
```

🌐 **Abrir en el navegador:** http://localhost:3000/dashboard

> 💡 **Mock data:** Si el backend no está disponible, podés activar datos de demostración:
> 1. Editá `web/.env.local`
> 2. Agregá `NEXT_PUBLIC_USE_MOCK=true`
> 3. Reiniciá el servidor Next.js
> Esto muestra 18 campos ficticios, alertas y predicciones sin necesidad del backend.

### 5️⃣ Script todo-en-uno

```powershell
# Desde la raíz del proyecto (requiere Docker corriendo):
.\dev.ps1              # Full stack con Docker
.\dev.ps1 -NoDocker    # Solo backend + web (usa SQLite)
.\dev.ps1 -NoWeb       # Solo backend
```

---

## 🧪 Seed Data

El backend se seeda automáticamente al iniciar. Si necesitás resetear la base de datos:

```powershell
# Limpiar BD (desde la raíz del proyecto)
docker compose exec -T timescaledb psql -U cropuser -d cropproduction -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Correr migraciones de nuevo
cd D:\sistema\ de\ producción\backend
$env:DATABASE_URL = "postgresql+asyncpg://cropuser:cropsecret@localhost:5432/cropproduction"
$env:PYTHONPATH = "D:\sistema de producción\backend"
alembic upgrade head

# Iniciar backend — el seed se ejecuta automáticamente
```

También hay scripts manuales en la raíz:
```powershell
python seed_8000.py     # Seed campos y sensores
python seed_alerts.py   # Seed reglas de alerta
```

---

## 🧭 Páginas del Dashboard

| Página | Ruta | Descripción |
|--------|------|-------------|
| **Dashboard** | `/dashboard` | Resumen con tarjetas de métricas, alertas recientes y grid de campos |
| **Fields** | `/dashboard/fields` | Lista completa de 18 campos con filtros; cada campo tiene detalle con sensores, charts, recomendaciones y yield |
| **Field Detail** | `/dashboard/fields/[id]` | Vista detallada: métricas en vivo, tendencias 72h, tabla de sensores, recomendaciones, predicción |
| **Alerts** | `/dashboard/alerts` | Historial de eventos con filtro por severidad y acknowledge |
| **Rules** | `/dashboard/rules` | 54 reglas de alerta preconfiguradas con severidad y cooldown |
| **Analytics** | `/dashboard/analytics` | Tendencias históricas y predicciones ML |
| **Devices** | `/dashboard/devices` | Registro de sensores IoT, gateways, estado de conexión SSE |
| **Users** | `/dashboard/users` | Gestión de usuarios (en desarrollo) |
| **Settings** | `/dashboard/settings` | Configuración del perfil y preferencias |

---

## 📡 API Endpoints

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/v1/auth/login` | Login (JWT RS256) |
| POST | `/api/v1/auth/refresh` | Refresh token |

### Campos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/fields` | Listar campos (paginación por cursor) |
| POST | `/api/v1/fields` | Crear campo |
| GET | `/api/v1/fields/{id}` | Detalle de campo |

### Sensores
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/fields/{id}/sensors` | Últimas lecturas de sensores |
| GET | `/api/v1/fields/{id}/sensors/history` | Historial de lecturas |

### Analíticas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/fields/{id}/analytics/summary` | Resumen analítico |
| GET | `/api/v1/fields/{id}/analytics/hourly` | Rollup horario (charts) |
| GET | `/api/v1/fields/{id}/analytics/gaps` | Brechas de sensores |
| GET | `/api/v1/fields/{id}/predictions/yield` | Predicción de rendimiento |
| GET | `/api/v1/fields/{id}/predictions/history` | Historial de predicciones |

### Alertas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/alerts/events` | Listar eventos de alerta |
| POST | `/api/v1/alerts/events/{id}/acknowledge` | Reconocer alerta |
| GET | `/api/v1/alerts/rules` | Listar reglas |
| POST | `/api/v1/alerts/rules` | Crear regla |
| PUT | `/api/v1/alerts/rules/{id}` | Actualizar regla |
| DELETE | `/api/v1/alerts/rules/{id}` | Eliminar regla |

### Streaming y Sync
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/alerts/stream` | SSE — alertas en tiempo real |
| POST | `/api/v1/mobile/sync` | Sync offline-first (mobile) |

### Recomendaciones
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/fields/{id}/recommendations` | Recomendaciones en tiempo real |
| GET | `/api/v1/recommendations` | Recomendaciones almacenadas |
| PATCH | `/api/v1/recommendations/{id}/status` | Actualizar estado (acknowledge/dismiss/apply) |

### Weather
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/weather/current` | Clima actual |
| GET | `/api/v1/weather/forecast` | Pronóstico (7 días) |

### Crop Profiles
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/v1/crop-profiles` | Perfiles de cultivo (FAO-56 coefficients) |

### Salud
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |

---

## 🧪 Testing

```powershell
cd D:\sistema\ de\ producción\backend
pytest -v           # 132+ tests
pytest -v -x        # Parar en el primer fallo
pytest -v --cov     # Con cobertura
```

---

## 📱 Mobile App (⚠️ En desarrollo)

La app móvil está en construcción activa. Estado actual:

| Feature | Estado |
|---------|--------|
| Dashboard con campos | ✅ Completado |
| NativeWind (Tailwind) | ✅ Completado |
| SQLite offline-first | ✅ Completado |
| Sync con backend | ✅ Completado |
| Alertas | ✅ Completado |
| Charts y gráficos | ✅ Completado |
| Web preview | ✅ Completado |
| Testing en dispositivo real | 🔄 Pendiente |
| Push notifications | 📋 Planificado |
| Escaneo QR de sensores | 📋 Planificado |

```powershell
# Para probar la web preview del mobile:
cd D:\sistema\ de\ producción\mobile
node node_modules/tailwindcss/lib/cli.js -i src/global.css -o src/global.generated.css
node node_modules/expo/bin/cli start --web
```

---

## 🤖 Machine Learning

```powershell
cd D:\sistema\ de\ producción\ml
python train.py --crop maize --model rf    # Random Forest
python train.py --crop maize --model xgb   # XGBoost
```

Los notebooks de exploración están en `ml/notebooks/`.

---

## 🔧 Solución de problemas

| Problema | Causa | Solución |
|----------|-------|----------|
| `ERR_CONNECTION_REFUSED` en API | Backend no iniciado | `python -m uvicorn app.main:app --port 8000` |
| `@tailwind` unknown at-rule | CSS no compilado | `node node_modules/tailwindcss/lib/cli.js -i src/global.css -o src/global.generated.css` |
| Dashboard muestra 0 datos | Backend caído o mock no activo | Iniciar backend o activar `NEXT_PUBLIC_USE_MOCK=true` |
| Puerto 3000/8000 ocupado | Proceso anterior vivo | `taskkill /F /IM node.exe` + reiniciar |
| MQTT connection failed | EMQX no instalado | No crítico — el sistema funciona sin MQTT |
| `bcrypt` error al iniciar | Versión incompatible | `pip install bcrypt==4.0.1` |
| `alembic upgrade head` falla | BD PostgreSQL sucia | Limpiar schema: `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` |

---

## 📚 Más información

- [Documentación del dashboard](web/src/app/dashboard/documentation/page.tsx) — guía integrada en la app
- [Research](research/) — case studies de cultivos y análisis de sistemas de producción
- [API Docs](http://localhost:8000/docs) — Swagger UI (con el backend corriendo)

---

## 📄 Licencia

**Privado** — proyecto interno de desarrollo.
