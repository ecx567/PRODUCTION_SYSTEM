/**
 * Web-compatible mock for expo-sqlite.
 *
 * Uses in-memory Maps to simulate the SQLite interface so the app
 * renders in the browser for preview/demo purposes.
 * All data is ephemeral — refreshes on reload.
 */

// ── In-memory stores ──────────────────────────────────────────

const fieldsStore = new Map<string, LocalField>();
const readingsStore = new Map<string, LocalSensorReading[]>();
const alertsStore = new Map<string, LocalAlert>();
const pendingMutations: PendingMutation[] = [];
const syncMeta = new Map<string, string>();

// ── Types (mirror database.ts) ────────────────────────────────

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
  updated_at: number;
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
  data: string;
  base_rev: number;
  client_rev: number;
  created_at: string;
  retry_count: number;
}

export interface SyncMetadata {
  key: string;
  value: string;
}

// ── Database initialization ───────────────────────────────────

let initialized = false;

async function ensureInit(): Promise<void> {
  if (initialized) return;
  initialized = true;
  // Pre-populate fields DB info
  syncMeta.set("server_rev", "0");
  syncMeta.set("last_sync_time", "0");
}

// ── Field helpers ─────────────────────────────────────────────

export async function getDatabase(): Promise<null> {
  await ensureInit();
  return null;
}

export async function upsertFields(
  fields: Omit<LocalField, "updated_at">[],
): Promise<void> {
  await ensureInit();
  const now = Date.now();
  for (const f of fields) {
    fieldsStore.set(f.id, { ...f, updated_at: now });
  }
}

export async function getLocalFields(): Promise<LocalField[]> {
  await ensureInit();
  return Array.from(fieldsStore.values()).filter((f) => !f.deleted_at);
}

export async function getLocalField(id: string): Promise<LocalField | null> {
  await ensureInit();
  const f = fieldsStore.get(id);
  return f && !f.deleted_at ? f : null;
}

// ── Sensor reading helpers ────────────────────────────────────

export async function upsertSensorReadings(
  readings: Omit<LocalSensorReading, "updated_at">[],
): Promise<void> {
  await ensureInit();
  const now = Date.now();
  for (const r of readings) {
    const key = `${r.time}_${r.sensor_id}`;
    readingsStore.set(key, [{
      ...r,
      updated_at: now,
    }]);
  }
}

export async function getLatestReadings(
  fieldId: string,
): Promise<LocalSensorReading[]> {
  await ensureInit();
  return Array.from(readingsStore.values())
    .flat()
    .filter((r) => r.field_id === fieldId)
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 50);
}

// ── Alert helpers ─────────────────────────────────────────────

export async function upsertAlerts(
  alerts: Omit<LocalAlert, "updated_at">[],
): Promise<void> {
  await ensureInit();
  const now = Date.now();
  for (const a of alerts) {
    alertsStore.set(a.id, { ...a, updated_at: now });
  }
}

export async function getLocalAlerts(
  severity?: string,
): Promise<LocalAlert[]> {
  await ensureInit();
  const all = Array.from(alertsStore.values());
  if (severity) {
    return all.filter((a) => a.severity === severity);
  }
  return all.sort(
    (a, b) => b.triggered_at.localeCompare(a.triggered_at),
  );
}

export async function acknowledgeLocalAlert(id: string): Promise<void> {
  await ensureInit();
  const alert = alertsStore.get(id);
  if (alert) {
    alert.acknowledged_at = new Date().toISOString();
    alert.updated_at = Date.now();
  }
}

// ── Pending mutation helpers ──────────────────────────────────

let mutationIdCounter = 0;

export async function addMutation(mutation: {
  table_name: string;
  mutation_id: string;
  action: "create" | "update" | "delete";
  record_id: string;
  data: Record<string, unknown>;
  base_rev: number;
  client_rev: number;
}): Promise<void> {
  await ensureInit();
  mutationIdCounter++;
  pendingMutations.push({
    id: mutationIdCounter,
    table_name: mutation.table_name,
    mutation_id: mutation.mutation_id,
    action: mutation.action,
    record_id: mutation.record_id,
    data: JSON.stringify(mutation.data),
    base_rev: mutation.base_rev,
    client_rev: mutation.client_rev,
    created_at: new Date().toISOString(),
    retry_count: 0,
  });
}

export async function getPendingMutations(): Promise<PendingMutation[]> {
  await ensureInit();
  return [...pendingMutations];
}

export async function deleteMutation(id: number): Promise<void> {
  await ensureInit();
  const idx = pendingMutations.findIndex((m) => m.id === id);
  if (idx !== -1) pendingMutations.splice(idx, 1);
}

export async function getPendingCount(): Promise<number> {
  await ensureInit();
  return pendingMutations.length;
}

// ── Sync metadata helpers ─────────────────────────────────────

export async function getSyncRev(): Promise<number> {
  await ensureInit();
  const v = syncMeta.get("server_rev");
  return v ? parseInt(v, 10) : 0;
}

export async function setSyncRev(rev: number): Promise<void> {
  await ensureInit();
  syncMeta.set("server_rev", String(rev));
}

export async function getLastSyncTime(): Promise<number | null> {
  await ensureInit();
  const v = syncMeta.get("last_sync_time");
  return v ? parseInt(v, 10) : null;
}

export async function setLastSyncTime(): Promise<void> {
  await ensureInit();
  syncMeta.set("last_sync_time", String(Date.now()));
}
