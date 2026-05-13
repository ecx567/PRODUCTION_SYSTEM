/**
 * Web-compatible sync engine.
 *
 * On web, NetInfo is not available and SQLite is mocked.
 * This provides a no-op sync that doesn't crash.
 */

import * as api from "./api";
import * as db from "./database";

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

const syncListeners: SyncEventCallback[] = [];
let currentStatus: SyncStatus = "idle";
let unsubscribeCalled = false;

function notifyListeners(
  overrides?: Partial<Parameters<SyncEventCallback>[0]>,
) {
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

export function onSyncEvent(
  callback: SyncEventCallback,
): () => void {
  syncListeners.push(callback);

  Promise.all([db.getPendingCount(), db.getLastSyncTime()])
    .then(([count, lastSync]) => {
      callback({
        status: currentStatus,
        pendingCount: count,
        lastSyncTime: lastSync,
      });
    })
    .catch(() => {
      callback({
        status: currentStatus,
        pendingCount: 0,
        lastSyncTime: null,
      });
    });

  return () => {
    const idx = syncListeners.indexOf(callback);
    if (idx !== -1) syncListeners.splice(idx, 1);
  };
}

/** Web sync — simulated connectivity: always "online" but no-op. */
export function startSyncEngine(): void {
  updateStatus("idle");
}

export function stopSyncEngine(): void {
  if (!unsubscribeCalled) {
    unsubscribeCalled = true;
  }
  syncListeners.length = 0;
}

export async function performSync(): Promise<boolean> {
  updateStatus("syncing");

  try {
    // Web: skip actual sync, just pretend it worked
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

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}
