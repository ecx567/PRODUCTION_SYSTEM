#!/bin/bash
# TimescaleDB initialization script.
# Runs automatically on first container start via docker-entrypoint-initdb.d.
set -e

echo "=== Initializing TimescaleDB extensions ==="

# Create the TimescaleDB extension (already loaded by the Docker image)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    -- TimescaleDB extension is loaded by the Docker image.
    -- Uncomment if needed:
    -- CREATE EXTENSION IF NOT EXISTS "timescaledb";
EOSQL

echo "=== Extensions created successfully ==="
