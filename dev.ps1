<#
.SYNOPSIS
    Dev server — un solo comando para correr todo el stack.

    Arranca TimescaleDB (Docker), corre migraciones, y lanza
    backend (FastAPI) + frontend (Next.js) en paralelo.

    Uso:
        .\dev.ps1              # full stack con Docker
        .\dev.ps1 -NoDocker    # usa SQLite (sin Docker)
        .\dev.ps1 -NoWeb       # solo backend
#>

param(
    [switch]$NoDocker,
    [switch]$NoWeb
)

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path
$BACKEND = Join-Path $ROOT "backend"
$WEB = Join-Path $ROOT "web"
$DB_URL = $env:DATABASE_URL

# ── Ensures bcrypt 4.0.1 (lib bcrypt 5.x rompe passlib) ──────
pip install bcrypt==4.0.1 -q 2>&1 | Out-Null

# ── Helper ───────────────────────────────────────────────────
function Log($color, $msg) { Write-Host "${color}[dev]${RESET} $msg" }
$GREEN = "`e[32m"; $YELLOW = "`e[33m"; $CYAN = "`e[36m"; $RED = "`e[31m"; $RESET = "`e[0m"

# ── 1. Database ──────────────────────────────────────────────
if (-not $NoDocker) {
    Log $CYAN "Arrancando servicios via Docker Compose..."
    docker compose -f "$ROOT\docker-compose.yml" up -d timescaledb redis 2>&1

    Log $CYAN "Esperando que TimescaleDB esté lista..."
    # Intentar healthcheck primero; si falla, esperar a que aparezca en logs
    $ready = $false
    for ($i = 0; $i -lt 20; $i++) {
        $status = docker inspect --format='{{.State.Health.Status}}' crop-timescaledb 2>&1
        if ($status -eq "healthy") { $ready = $true; break }
        # Fallback: verificar si el log dice "ready to accept connections"
        $logs = docker logs crop-timescaledb 2>&1 | Select-String "ready to accept connections"
        if ($logs) { $ready = $true; break }
        Start-Sleep -Seconds 3
    }
    if ($ready) {
        $DB_URL = "postgresql+asyncpg://cropuser:cropsecret@localhost:5432/cropproduction"
        Log $GREEN "TimescaleDB lista!"
    } else {
        Log $RED "TimescaleDB no respondió. Revisá 'docker compose logs timescaledb'."
        exit 1
    }

    Log $CYAN "Esperando que Redis esté lista..."
    $redisReady = $false
    for ($i = 0; $i -lt 10; $i++) {
        $rStatus = docker inspect --format='{{.State.Health.Status}}' crop-redis 2>&1
        if ($rStatus -eq "healthy") { $redisReady = $true; break }
        Start-Sleep -Seconds 2
    }
    if ($redisReady) {
        Log $GREEN "Redis lista!"
    } else {
        Log $YELLOW "Redis no responde — refresh tokens no funcionarán."
    }
} else {
    # SQLite mode: fix test.db path (relative to backend/)
    if (-not $DB_URL) {
        $DB_URL = "sqlite+aiosqlite:///./test.db"
    }
    Log $YELLOW "Usando SQLite: $DB_URL"
}

# ── 2. Migraciones ──────────────────────────────────────────
Push-Location $BACKEND
$env:DATABASE_URL = $DB_URL
try {
    if (-not $NoDocker) {
        Log $CYAN "Limpiando BD previa..."
        docker compose -f "$ROOT\docker-compose.yml" exec -T timescaledb psql -U cropuser -d cropproduction -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>&1 | Out-Null
    }

    Log $CYAN "Corriendo migraciones (alembic upgrade head)..."
    $env:PYTHONPATH = "$BACKEND;$env:PYTHONPATH"
    & alembic upgrade head
    if ($LASTEXITCODE -eq 0) {
        Log $GREEN "Migraciones aplicadas."
    } else {
        Log $RED "Migraciones fallaron. Revisá el error arriba."
        exit 1
    }
} finally {
    Pop-Location
}

# ── 3. Iniciar backend (background) ─────────────────────────
Log $CYAN "Iniciando backend (FastAPI) en puerto 8000..."
$backendJob = Start-Job -Name "backend" -ScriptBlock {
    param($dir, $dbUrl)
    Set-Location $dir
    $env:PYTHONPATH = "$dir;$env:PYTHONPATH"
    $env:DATABASE_URL = $dbUrl
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
} -ArgumentList $BACKEND, $DB_URL

Start-Sleep -Seconds 4  # esperar que compile

# ── 4. Iniciar web (foreground, segundo plano) ──────────────
if (-not $NoWeb) {
    Log $CYAN "Iniciando web (Next.js) en puerto 3000..."
    $webJob = Start-Job -Name "web" -ScriptBlock {
        param($dir)
        Set-Location $dir
        & ".\node_modules\.bin\next.cmd" dev
    } -ArgumentList $WEB
} else {
    $webJob = $null
    Log $YELLOW "Web omitida. Arrancala manual: .\node_modules\.bin\next.cmd dev"
}

# ── 5. Mostrar info ─────────────────────────────────────────
Log $GREEN "══════════════════════════════════════"
Log $GREEN "  Backend:  http://localhost:8000"
Log $GREEN "  Docs API: http://localhost:8000/docs"
if ($webJob) { Log $GREEN "  Web:      http://localhost:3000" }
Log $GREEN "══════════════════════════════════════"
Log $YELLOW "Presioná Ctrl+C para detener todo."

# ── 6. Esperar Ctrl+C ───────────────────────────────────────
try {
    while ($true) {
        Start-Sleep -Seconds 3
        # Si el backend se cae, avisar
        if ($backendJob.State -eq "Failed") {
            Log $RED "╳ El backend se detuvo inesperadamente."
            $output = Receive-Job -Job $backendJob -ErrorAction SilentlyContinue
            if ($output) { Write-Host $output -ForegroundColor Red }
            break
        }
    }
} finally {
    # Cleanup
    Log $CYAN "Deteniendo servidores..."
    Get-Job -Name "backend", "web" -ErrorAction SilentlyContinue | Stop-Job
    Get-Job -Name "backend", "web" -ErrorAction SilentlyContinue | Remove-Job

    if (-not $NoDocker) {
        Log $CYAN "Deteniendo Docker containers..."
        docker compose -f "$ROOT\docker-compose.yml" down 2>&1 | Out-Null
    }
    Log $GREEN "Todo detenido. ¡Hasta la próxima!"
}
