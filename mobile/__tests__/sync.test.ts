/**
 * Sync engine unit tests.
 *
 * Tests the sync state machine, pull-then-push cycle, change application,
 * conflict handling, and the NetInfo auto-sync listener.
 */

import { performSync, onSyncEvent, getSyncStatus, startSyncEngine, stopSyncEngine } from "@/lib/sync";
import * as api from "@/lib/api";
import * as db from "@/lib/database";

// ── Mocks ───────────────────────────────────────────────────────

jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(),
}));

jest.mock("@/lib/api", () => ({
  syncWithServer: jest.fn(),
  isAuthenticated: jest.fn(),
}));

jest.mock("@/lib/database", () => ({
  getSyncRev: jest.fn(),
  setSyncRev: jest.fn(),
  getPendingMutations: jest.fn(),
  deleteMutation: jest.fn(),
  addMutation: jest.fn(),
  getPendingCount: jest.fn(),
  getLastSyncTime: jest.fn(),
  setLastSyncTime: jest.fn(),
  upsertFields: jest.fn(),
  upsertSensorReadings: jest.fn(),
  upsertAlerts: jest.fn(),
}));

import NetInfo from "@react-native-community/netinfo";

const mockNetInfoFetch = NetInfo.fetch as jest.Mock;
const mockNetInfoAddListener = NetInfo.addEventListener as jest.Mock;
const mockSyncWithServer = api.syncWithServer as jest.Mock;
const mockIsAuthenticated = api.isAuthenticated as jest.Mock;

// ── Helpers ─────────────────────────────────────────────────────

function makeSyncResponse(overrides?: Partial<api.SyncResponse>): api.SyncResponse {
  return {
    server_rev: 42,
    changes: [],
    conflicts: [],
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (db.getSyncRev as jest.Mock).mockResolvedValue(0);
  (db.getPendingMutations as jest.Mock).mockResolvedValue([]);
  (db.getPendingCount as jest.Mock).mockResolvedValue(0);
  (db.getLastSyncTime as jest.Mock).mockResolvedValue(1700000000000);
  mockNetInfoFetch.mockResolvedValue({ isConnected: true, isInternetReachable: true });
  mockIsAuthenticated.mockReturnValue(true);
});

describe("getSyncStatus", () => {
  it("returns idle by default", () => {
    expect(getSyncStatus()).toBe("idle");
  });
});

describe("onSyncEvent", () => {
  it("registers and unregisters listeners", async () => {
    const cb = jest.fn();
    const unsubscribe = onSyncEvent(cb);

    // Listener should fire immediately
    await new Promise(process.nextTick);
    expect(cb).toHaveBeenCalledWith(
      expect.objectContaining({ status: "idle" }),
    );

    unsubscribe();
    // After unsubscribing, listener should not be called on next notify
    cb.mockClear();
    // Trigger a manual sync to change status
    mockSyncWithServer.mockResolvedValue(makeSyncResponse());
    await performSync();

    expect(cb).not.toHaveBeenCalled();
  });
});

describe("performSync", () => {
  it("returns false if already syncing", async () => {
    // Call sync once (will stay in "syncing" because our mock never resolves)
    mockSyncWithServer.mockImplementation(() => new Promise(() => {}));
    const promise1 = performSync();
    // Second call should return false immediately
    const result = await performSync();
    expect(result).toBe(false);
  });

  it("returns false when offline", async () => {
    mockNetInfoFetch.mockResolvedValue({ isConnected: false });
    const result = await performSync();
    expect(result).toBe(false);
  });

  it("completes a full pull-then-push cycle", async () => {
    const syncResponse = makeSyncResponse({
      server_rev: 100,
      changes: [
        {
          table: "fields",
          action: "update",
          record_id: "field-1",
          data: {
            name: "North Field",
            tenant_id: "tenant-1",
            crop_type: "maize",
            area_ha: 25.0,
          },
          server_rev: 100,
        },
      ],
      conflicts: [
        {
          table: "fields",
          record_id: "field-2",
          server_data: { name: "Field 2 (server)" },
          client_data: { name: "Field 2 (client)" },
          resolution: "server_wins",
        },
      ],
    });

    mockSyncWithServer.mockResolvedValue(syncResponse);

    const result = await performSync();
    expect(result).toBe(true);

    // Server revision should be saved
    expect(db.setSyncRev).toHaveBeenCalledWith(100);

    // Pulled changes should be applied
    expect(db.upsertFields).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "field-1", name: "North Field" }),
      ]),
    );

    // Conflict copies should be saved as mutations
    expect(db.addMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        table_name: "fields",
        record_id: "field-2",
        action: "update",
      }),
    );

    // Last sync time should be updated
    expect(db.setLastSyncTime).toHaveBeenCalled();
  });

  it("handles server errors gracefully", async () => {
    mockSyncWithServer.mockRejectedValue(new Error("Server unreachable"));

    const result = await performSync();
    expect(result).toBe(false);
    expect(getSyncStatus()).toBe("error");
  });

  it("applies deleted fields as tombstones", async () => {
    const syncResponse = makeSyncResponse({
      changes: [
        {
          table: "fields",
          action: "delete",
          record_id: "field-3",
          data: { name: "Old Field", tenant_id: "tenant-1", deleted_at: new Date().toISOString() },
          server_rev: 43,
        },
      ],
    });

    mockSyncWithServer.mockResolvedValue(syncResponse);
    await performSync();

    expect(db.upsertFields).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "field-3", deleted_at: expect.any(String) }),
      ]),
    );
  });

  it("applies sensor reading changes", async () => {
    const syncResponse = makeSyncResponse({
      changes: [
        {
          table: "sensor_readings",
          action: "create",
          record_id: "sensor-1",
          data: { time: "2025-01-01T00:00:00Z", sensor_id: "s1", field_id: "f1", temp: 28.5 },
          server_rev: 50,
        },
      ],
    });

    mockSyncWithServer.mockResolvedValue(syncResponse);
    await performSync();
    expect(db.upsertSensorReadings).toHaveBeenCalled();
  });

  it("applies alert changes", async () => {
    const syncResponse = makeSyncResponse({
      changes: [
        {
          table: "alerts",
          action: "create",
          record_id: "alert-1",
          data: {
            rule_id: "r1",
            field_id: "f1",
            metric_type: "temp",
            actual_value: 38,
            threshold: 35,
            severity: "critical",
            message: "High temperature",
            triggered_at: "2025-01-01T00:00:00Z",
          },
          server_rev: 55,
        },
      ],
    });

    mockSyncWithServer.mockResolvedValue(syncResponse);
    await performSync();
    expect(db.upsertAlerts).toHaveBeenCalled();
  });

  it("acks mutations after successful push", async () => {
    (db.getPendingMutations as jest.Mock).mockResolvedValue([
      { id: 1, table_name: "fields", mutation_id: "m1", action: "update", record_id: "f1", data: "{}", base_rev: 0, client_rev: 1, created_at: "2025-01-01", retry_count: 0 },
      { id: 2, table_name: "fields", mutation_id: "m2", action: "update", record_id: "f2", data: "{}", base_rev: 0, client_rev: 1, created_at: "2025-01-01", retry_count: 0 },
    ]);

    mockSyncWithServer.mockResolvedValue(makeSyncResponse());
    await performSync();

    // Both mutations should be deleted (acked)
    expect(db.deleteMutation).toHaveBeenCalledTimes(2);
    expect(db.deleteMutation).toHaveBeenCalledWith(1);
    expect(db.deleteMutation).toHaveBeenCalledWith(2);
  });
});

describe("startSyncEngine / stopSyncEngine", () => {
  it("starts NetInfo listener for auto-sync", () => {
    const unsubscribe = jest.fn();
    mockNetInfoAddListener.mockReturnValue(unsubscribe);
    mockIsAuthenticated.mockReturnValue(true);
    mockSyncWithServer.mockResolvedValue(makeSyncResponse());

    startSyncEngine();

    expect(mockNetInfoAddListener).toHaveBeenCalled();

    const handler = mockNetInfoAddListener.mock.calls[0][0];
    // Simulate connectivity restored
    handler({ isConnected: true, isInternetReachable: true });
  });

  it("cleans up on stop", () => {
    const unsubscribe = jest.fn();
    mockNetInfoAddListener.mockReturnValue(unsubscribe);

    startSyncEngine();
    stopSyncEngine();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it("does not sync on restore if not authenticated", () => {
    mockNetInfoAddListener.mockReturnValue(jest.fn());
    mockIsAuthenticated.mockReturnValue(false);

    startSyncEngine();
    const handler = mockNetInfoAddListener.mock.calls[0][0];
    handler({ isConnected: true, isInternetReachable: true });

    expect(mockSyncWithServer).not.toHaveBeenCalled();
  });

  it("sets offline status when connectivity lost", () => {
    mockNetInfoAddListener.mockReturnValue(jest.fn());

    startSyncEngine();
    const handler = mockNetInfoAddListener.mock.calls[0][0];
    handler({ isConnected: false, isInternetReachable: false });

    expect(getSyncStatus()).toBe("offline");
  });
});
