/**
 * Offline sync engine: pull-then-push pattern with LWW conflict resolution.
 *
 * Flow:
 * 1. Pull: GET changes from server since last known revision
 * 2. Apply: merge pulled changes into local SQLite (LWW via updated_at)
 * 3. Push: send pending mutations from outbox to server
 * 4. Ack: delete successfully pushed mutations from outbox
 *
 * NetInfo listener auto-syncs on connectivity restore.
 */

import NetInfo from "@react-native-community/netinfo";
import * as api from "./api";
import * as db from "./database";

// ── Sync status ────────────────────────────────────────────────

export type SyncStatus =
  | "idle"
  | "syncing"
  | "success"
  | "error"
  | "offline";

export type SyncEventCallback = (status: {
  status: SyncStatus;
  pendingCount: number;
  lastSyncTime: number | null;
  error?: string;
}) => void;

let syncListeners: SyncEventCallback[] = [];
let currentStatus: SyncStatus = "idle";
let unsubscribeNetInfo: (() => void) | null = null;

function notifyListeners(overrides?: Partial<Parameters<SyncEventCallback>[0]>) {
  const event = {
    status: currentStatus,
    pendingCount: 0,
    lastSyncTime: null as number | null,
    ...overrides,
  };
  syncListeners.forEach((cb) => cb(event));
}

function updateStatus(status: SyncStatus, error?: string) {
  currentStatus = status;
  notifyListeners({ status, error });
}

// ── Public API ─────────────────────────────────────────────────

export function onSyncEvent(callback: SyncEventCallback): () => void {
  syncListeners.push(callback);
  // Emit current state immediately
  db.getPendingCount().then((count) => {
    db.getLastSyncTime().then((lastSync) => {
      callback({ status: currentStatus, pendingCount: count, lastSyncTime: lastSync });
    });
  });
  return () => {
    syncListeners = syncListeners.filter((cb) => cb !== callback);
  };
}

/**
 * Initialize the sync engine: start NetInfo listener for auto-sync.
 */
export function startSyncEngine(): void {
  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable !== false) {
      // Connectivity restored — trigger auto-sync
      if (api.isAuthenticated()) {
        performSync().catch(() => {
          // Sync failure after reconnect is handled inside performSync
        });
      }
    } else {
      updateStatus("offline");
    }
  });
}

/**
 * Stop the sync engine (cleanup on app close).
 */
export function stopSyncEngine(): void {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
  syncListeners = [];
}

/**
 * Perform a full pull-then-push sync cycle.
 *
 * @returns True if sync completed successfully, false otherwise.
 */
export async function performSync(): Promise<boolean> {
  if (currentStatus === "syncing") return false; // Already syncing

  updateStatus("syncing");

  try {
    // Step 1: Check connectivity
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      updateStatus("offline");
      return false;
    }

    // Step 2: Get current server revision
    const sinceRev = await db.getSyncRev();

    // Step 3: Get pending mutations
    const pendingMutations = await db.getPendingMutations();

    // Step 4: Prepare sync request
    const syncRequest: api.SyncRequest = {
      since_rev: sinceRev,
      mutations: pendingMutations.map((m) => ({
        table: m.table_name,
        mutation_id: m.mutation_id,
        action: m.action,
        record_id: m.record_id,
        data: JSON.parse(m.data),
        base_rev: m.base_rev,
        client_rev: m.client_rev,
      })),
    };

    // Step 5: Send sync request
    const syncResponse = await api.syncWithServer(syncRequest);

    // Step 6: Apply pulled changes (Pull phase)
    await applyPulledChanges(syncResponse);

    // Step 7: Update server revision cursor
    await db.setSyncRev(syncResponse.server_rev);

    // Step 8: Delete acked mutations (Push phase — mutations that were
    // successfully pushed are no longer pending)
    const pushedIds = new Set(
      pendingMutations.map((m) => m.id),
    );
    for (const id of pushedIds) {
      await db.deleteMutation(id);
    }

    // Step 9: Apply conflict copies (server_wins — client edits preserved as new)
    for (const conflict of syncResponse.conflicts) {
      // The server's version already won. We save the client version
      // as a new pending mutation with higher rev for user review.
      await db.addMutation({
        table_name: conflict.table,
        mutation_id: `${conflict.record_id}_conflict_${Date.now()}`,
        action: "update",
        record_id: conflict.record_id,
        data: conflict.client_data,
        base_rev: syncResponse.server_rev,
        client_rev: syncResponse.server_rev + 1,
      });
    }

    // Step 10: Update timestamps
    await db.setLastSyncTime();

    const pendingCount = await db.getPendingCount();
    const lastSync = await db.getLastSyncTime();
    updateStatus("success");
    notifyListeners({ pendingCount, lastSyncTime: lastSync });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    updateStatus("error", msg);
    return false;
  }
}

// ── Pull changes application ───────────────────────────────────

async function applyPulledChanges(response: api.SyncResponse): Promise<void> {
  for (const change of response.changes) {
    switch (change.table) {
      case "fields":
        await applyFieldChange(change);
        break;
      case "sensor_readings":
        await applySensorReadingChange(change);
        break;
      case "alerts":
        await applyAlertChange(change);
        break;
      // Future tables can be added here
    }
  }
}

async function applyFieldChange(
  change: api.SyncChange,
): Promise<void> {
  const data = change.data;

  if (change.action === "delete" || data.deleted_at) {
    // Tombstone: mark as deleted locally
    await db.upsertFields([{
      id: change.record_id,
      tenant_id: String(data.tenant_id ?? ""),
      name: String(data.name ?? "Deleted Field"),
      crop_type: String(data.crop_type ?? "unknown"),
      planted_at: data.planted_at as string | null ?? null,
      area_ha: Number(data.area_ha ?? 0),
      location: data.location as string | null ?? null,
      created_at: data.created_at as string | null ?? null,
      deleted_at: data.deleted_at as string | null ?? new Date().toISOString(),
    }]);
  } else {
    await db.upsertFields([{
      id: change.record_id,
      tenant_id: String(data.tenant_id ?? ""),
      name: String(data.name ?? ""),
      crop_type: String(data.crop_type ?? ""),
      planted_at: data.planted_at as string | null ?? null,
      area_ha: Number(data.area_ha ?? 0),
      location: data.location as string | null ?? null,
      created_at: data.created_at as string | null ?? null,
      deleted_at: null,
    }]);
  }
}

async function applySensorReadingChange(
  change: api.SyncChange,
): Promise<void> {
  const data = change.data;
  await db.upsertSensorReadings([{
    time: String(data.time ?? ""),
    sensor_id: String(data.sensor_id ?? ""),
    field_id: String(data.field_id ?? ""),
    temp: (data.temp as number | null) ?? null,
    humidity: (data.humidity as number | null) ?? null,
    soil_moisture: (data.soil_moisture as number | null) ?? null,
    rain: (data.rain as number | null) ?? null,
  }]);
}

async function applyAlertChange(change: api.SyncChange): Promise<void> {
  const data = change.data;
  await db.upsertAlerts([{
    id: change.record_id,
    rule_id: String(data.rule_id ?? ""),
    field_id: String(data.field_id ?? ""),
    metric_type: String(data.metric_type ?? ""),
    actual_value: Number(data.actual_value ?? 0),
    threshold: Number(data.threshold ?? 0),
    severity: String(data.severity ?? "info"),
    message: String(data.message ?? ""),
    triggered_at: String(data.triggered_at ?? ""),
    acknowledged_at: data.acknowledged_at as string | null ?? null,
  }]);
}

/**
 * Get the current sync status without subscribing.
 */
export function getSyncStatus(): SyncStatus {
  return currentStatus;
}
