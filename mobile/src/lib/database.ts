/**
 * SQLite database initialization and helpers for offline-first storage.
 *
 * Uses expo-sqlite with WAL mode for performance. Manages local tables:
 * - `fields`: cached field data from server
 * - `sensor_readings`: cached sensor readings
 * - `alerts`: cached alert events
 * - `pending_mutations`: outbox for offline writes
 * - `sync_metadata`: server revision tracking
 */

import * as SQLite from "expo-sqlite";

export interface LocalField {
  id: string;
  tenant_id: string;
  name: string;
  crop_type: string;
  planted_at: string | null;
  area_ha: number;
  location: string | null;
  created_at: string | null;
  deleted_at: string | null;
  updated_at: number; // ms timestamp for LWW
}

export interface LocalSensorReading {
  time: string;
  sensor_id: string;
  field_id: string;
  temp: number | null;
  humidity: number | null;
  soil_moisture: number | null;
  rain: number | null;
  updated_at: number;
}

export interface LocalAlert {
  id: string;
  rule_id: string;
  field_id: string;
  metric_type: string;
  actual_value: number;
  threshold: number;
  severity: string;
  message: string;
  triggered_at: string;
  acknowledged_at: string | null;
  updated_at: number;
}

export interface PendingMutation {
  id: number;
  table_name: string;
  mutation_id: string;
  action: "create" | "update" | "delete";
  record_id: string;
  data: string; // JSON stringified
  base_rev: number;
  client_rev: number;
  created_at: string;
  retry_count: number;
}

export interface SyncMetadata {
  key: string;
  value: string;
}

const DB_NAME = "cropmonitor.db";

let db: SQLite.SQLiteDatabase | null = null;

/**
 * Get or initialize the SQLite database connection.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;

  db = await SQLite.openDatabaseAsync(DB_NAME);

  // Enable WAL mode for performance
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");

  // Run migrations
  await runMigrations(db);

  return db;
}

// ── Schema version tracking ────────────────────────────────────

const CURRENT_SCHEMA_VERSION = 1;

async function runMigrations(database: SQLite.SQLiteDatabase): Promise<void> {
  // Create schema version table if not exists
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const row = await database.getFirstAsync<{ version: number }>(
    "SELECT MAX(version) as version FROM schema_version;",
  );
  const currentVersion = row?.version ?? 0;

  if (currentVersion < 1) {
    await migrationV1(database);
    await database.runAsync(
      "INSERT INTO schema_version (version) VALUES (?);",
      1,
    );
  }

  // Future migrations go here:
  // if (currentVersion < 2) { await migrationV2(database); ... }
}

async function migrationV1(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    -- Local cache of server fields (matches server schema + updated_at for LWW)
    CREATE TABLE IF NOT EXISTS fields (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      name TEXT NOT NULL,
      crop_type TEXT NOT NULL,
      planted_at TEXT,
      area_ha REAL NOT NULL DEFAULT 0,
      location TEXT,
      created_at TEXT,
      deleted_at TEXT,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    -- Local cache of sensor readings
    CREATE TABLE IF NOT EXISTS sensor_readings (
      time TEXT NOT NULL,
      sensor_id TEXT NOT NULL,
      field_id TEXT NOT NULL,
      temp REAL,
      humidity REAL,
      soil_moisture REAL,
      rain REAL,
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (time, sensor_id)
    );

    -- Local cache of alert events
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      field_id TEXT NOT NULL,
      metric_type TEXT NOT NULL,
      actual_value REAL NOT NULL,
      threshold REAL NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      triggered_at TEXT NOT NULL,
      acknowledged_at TEXT,
      updated_at INTEGER NOT NULL DEFAULT 0
    );

    -- Outbox for offline mutations (synced via push)
    CREATE TABLE IF NOT EXISTS pending_mutations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT NOT NULL,
      mutation_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
      record_id TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      base_rev INTEGER NOT NULL DEFAULT 0,
      client_rev INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      retry_count INTEGER NOT NULL DEFAULT 0
    );

    -- Server revision tracking (LWW cursor)
    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Indexes for sync queries
    CREATE INDEX IF NOT EXISTS idx_fields_updated ON fields(updated_at);
    CREATE INDEX IF NOT EXISTS idx_sensor_readings_field ON sensor_readings(field_id, time);
    CREATE INDEX IF NOT EXISTS idx_alerts_field ON alerts(field_id, triggered_at);
    CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
    CREATE INDEX IF NOT EXISTS idx_pending_mutations_table ON pending_mutations(table_name);
    CREATE INDEX IF NOT EXISTS idx_pending_mutations_created ON pending_mutations(created_at);
  `);
}

// ── Field helpers ──────────────────────────────────────────────

export async function upsertFields(
  fields: Omit<LocalField, "updated_at">[],
): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();

  for (const field of fields) {
    await database.runAsync(
      `INSERT OR REPLACE INTO fields
       (id, tenant_id, name, crop_type, planted_at, area_ha, location, created_at, deleted_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        field.id,
        field.tenant_id,
        field.name,
        field.crop_type,
        field.planted_at,
        field.area_ha,
        field.location,
        field.created_at,
        field.deleted_at,
        now,
      ],
    );
  }
}

export async function getLocalFields(): Promise<LocalField[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalField>(
    "SELECT * FROM fields WHERE deleted_at IS NULL ORDER BY name ASC",
  );
}

export async function getLocalField(id: string): Promise<LocalField | null> {
  const database = await getDatabase();
  return database.getFirstAsync<LocalField>(
    "SELECT * FROM fields WHERE id = ?",
    id,
  );
}

// ── Sensor reading helpers ─────────────────────────────────────

export async function upsertSensorReadings(
  readings: Omit<LocalSensorReading, "updated_at">[],
): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();

  for (const r of readings) {
    await database.runAsync(
      `INSERT OR REPLACE INTO sensor_readings
       (time, sensor_id, field_id, temp, humidity, soil_moisture, rain, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [r.time, r.sensor_id, r.field_id, r.temp, r.humidity, r.soil_moisture, r.rain, now],
    );
  }
}

export async function getLatestReadings(
  fieldId: string,
): Promise<LocalSensorReading[]> {
  const database = await getDatabase();
  return database.getAllAsync<LocalSensorReading>(
    `SELECT * FROM sensor_readings
     WHERE field_id = ?
     ORDER BY time DESC
     LIMIT 50`,
    fieldId,
  );
}

// ── Alert helpers ──────────────────────────────────────────────

export async function upsertAlerts(
  alerts: Omit<LocalAlert, "updated_at">[],
): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();

  for (const a of alerts) {
    await database.runAsync(
      `INSERT OR REPLACE INTO alerts
       (id, rule_id, field_id, metric_type, actual_value, threshold, severity, message, triggered_at, acknowledged_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        a.id,
        a.rule_id,
        a.field_id,
        a.metric_type,
        a.actual_value,
        a.threshold,
        a.severity,
        a.message,
        a.triggered_at,
        a.acknowledged_at,
        now,
      ],
    );
  }
}

export async function getLocalAlerts(
  severity?: string,
): Promise<LocalAlert[]> {
  const database = await getDatabase();
  if (severity) {
    return database.getAllAsync<LocalAlert>(
      "SELECT * FROM alerts WHERE severity = ? ORDER BY triggered_at DESC",
      severity,
    );
  }
  return database.getAllAsync<LocalAlert>(
    "SELECT * FROM alerts ORDER BY triggered_at DESC",
  );
}

export async function acknowledgeLocalAlert(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    "UPDATE alerts SET acknowledged_at = datetime('now'), updated_at = ? WHERE id = ?",
    Date.now(),
    id,
  );
}

// ── Pending mutation helpers ───────────────────────────────────

export async function addMutation(mutation: {
  table_name: string;
  mutation_id: string;
  action: "create" | "update" | "delete";
  record_id: string;
  data: Record<string, unknown>;
  base_rev: number;
  client_rev: number;
}): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `INSERT INTO pending_mutations
     (table_name, mutation_id, action, record_id, data, base_rev, client_rev)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      mutation.table_name,
      mutation.mutation_id,
      mutation.action,
      mutation.record_id,
      JSON.stringify(mutation.data),
      mutation.base_rev,
      mutation.client_rev,
    ],
  );
}

export async function getPendingMutations(): Promise<PendingMutation[]> {
  const database = await getDatabase();
  return database.getAllAsync<PendingMutation>(
    "SELECT * FROM pending_mutations ORDER BY created_at ASC",
  );
}

export async function deleteMutation(id: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync("DELETE FROM pending_mutations WHERE id = ?", id);
}

export async function getPendingCount(): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM pending_mutations",
  );
  return row?.count ?? 0;
}

// ── Sync metadata helpers ──────────────────────────────────────

export async function getSyncRev(): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_metadata WHERE key = 'server_rev'",
  );
  return row ? parseInt(row.value, 10) : 0;
}

export async function setSyncRev(rev: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    "INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('server_rev', ?)",
    String(rev),
  );
}

export async function getLastSyncTime(): Promise<number | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM sync_metadata WHERE key = 'last_sync_time'",
  );
  return row ? parseInt(row.value, 10) : null;
}

export async function setLastSyncTime(): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    "INSERT OR REPLACE INTO sync_metadata (key, value) VALUES ('last_sync_time', ?)",
    String(Date.now()),
  );
}
