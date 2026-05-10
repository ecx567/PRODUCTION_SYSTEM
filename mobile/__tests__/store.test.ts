/**
 * Zustand store unit tests.
 *
 * Tests auth, fields, alerts, and sync slices of the global store
 * with mocked API and database modules.
 */

import { useStore } from "@/lib/store";
import * as api from "@/lib/api";
import * as db from "@/lib/database";

// ── Mocks ───────────────────────────────────────────────────────

jest.mock("@/lib/api", () => ({
  loginUser: jest.fn(),
  clearTokens: jest.fn(),
  setTokens: jest.fn(),
  isAuthenticated: jest.fn(),
  getFields: jest.fn(),
  getAlertEvents: jest.fn(),
  acknowledgeAlert: jest.fn(),
}));

jest.mock("@/lib/database", () => ({
  getLocalFields: jest.fn(),
  getLocalAlerts: jest.fn(),
  upsertFields: jest.fn(),
  upsertAlerts: jest.fn(),
  acknowledgeLocalAlert: jest.fn(),
}));

// ── Helpers ─────────────────────────────────────────────────────

function resetStore() {
  useStore.setState({
    token: null,
    refreshTokenValue: null,
    user: null,
    isAuthenticated: false,
    isAuthLoading: false,
    authError: null,
    fields: [],
    fieldsLoading: false,
    fieldsError: null,
    fieldsLastSync: null,
    alerts: [],
    alertsLoading: false,
    alertsError: null,
    syncStatus: "idle",
    syncPendingCount: 0,
    syncLastSyncTime: null,
    syncError: null,
  });
}

// ── Auth Slice ──────────────────────────────────────────────────

describe("Auth Slice", () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  it("starts unauthenticated", () => {
    const state = useStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
  });

  it("sets authenticated state on successful login", async () => {
    (api.loginUser as jest.Mock).mockResolvedValue({
      access_token: "access-123",
      refresh_token: "refresh-456",
    });

    await useStore.getState().login("test@example.com", "password123");

    const state = useStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe("access-123");
    expect(state.refreshTokenValue).toBe("refresh-456");
    expect(state.user).toEqual(
      expect.objectContaining({ email: "test@example.com" }),
    );
    expect(state.isAuthLoading).toBe(false);
    expect(state.authError).toBeNull();
  });

  it("sets authError on failed login", async () => {
    (api.loginUser as jest.Mock).mockRejectedValue(
      new api.ApiError(401, "Invalid credentials"),
    );

    await expect(
      useStore.getState().login("test@example.com", "wrong"),
    ).rejects.toThrow();

    const state = useStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isAuthLoading).toBe(false);
    expect(state.authError).toBeTruthy();
  });

  it("clears state on logout", () => {
    // Set authenticated first
    useStore.setState({
      token: "access-123",
      refreshTokenValue: "refresh-456",
      user: { email: "test@example.com", tenantId: "t1", role: "farmer" },
      isAuthenticated: true,
      fields: [{ id: "f1", name: "Field 1", cropType: "maize", areaHa: 10 }],
    });

    useStore.getState().logout();

    const state = useStore.getState();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.fields).toEqual([]);
  });

  it("restores tokens from storage", () => {
    useStore.getState().setTokensFromStorage("stored-access", "stored-refresh");

    const state = useStore.getState();
    expect(state.token).toBe("stored-access");
    expect(state.isAuthenticated).toBe(true);
  });
});

// ── Fields Slice ────────────────────────────────────────────────

describe("Fields Slice", () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  it("loads fields from local DB first", async () => {
    (db.getLocalFields as jest.Mock).mockResolvedValue([
      { id: "f1", name: "North Field", crop_type: "maize", area_ha: 25 },
    ]);
    (api.isAuthenticated as jest.Mock).mockReturnValue(false);

    await useStore.getState().loadFields();

    const state = useStore.getState();
    expect(state.fields).toHaveLength(1);
    expect(state.fields[0].name).toBe("North Field");
    expect(state.fieldsLoading).toBe(false);
    expect(state.fieldsError).toBeNull();
  });

  it("fetches from server when authenticated", async () => {
    (db.getLocalFields as jest.Mock).mockResolvedValue([]);
    (api.isAuthenticated as jest.Mock).mockReturnValue(true);
    (api.getFields as jest.Mock).mockResolvedValue({
      items: [{ id: "f2", tenant_id: "t1", name: "South Field", crop_type: "rice", area_ha: 30, planted_at: null, location: null, created_at: null, deleted_at: null }],
      next_cursor: null,
      total: 1,
    });

    await useStore.getState().loadFields();

    const state = useStore.getState();
    expect(state.fields).toHaveLength(1);
    expect(state.fields[0].name).toBe("South Field");
    expect(db.upsertFields).toHaveBeenCalled();
  });

  it("handles load error gracefully, preserves local data", async () => {
    (db.getLocalFields as jest.Mock).mockResolvedValue([
      { id: "f1", name: "Cached Field", crop_type: "cacao", area_ha: 5 },
    ]);
    (api.isAuthenticated as jest.Mock).mockReturnValue(true);
    (api.getFields as jest.Mock).mockRejectedValue(new Error("Network error"));

    await useStore.getState().loadFields();

    const state = useStore.getState();
    // Local data should still be there
    expect(state.fields).toHaveLength(1);
    expect(state.fieldsError).toBeTruthy();
    expect(state.fieldsLoading).toBe(false);
  });
});

// ── Alerts Slice ────────────────────────────────────────────────

describe("Alerts Slice", () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  it("loads alerts from local DB first", async () => {
    (db.getLocalAlerts as jest.Mock).mockResolvedValue([
      { id: "a1", rule_id: "r1", field_id: "f1", metric_type: "temp", actual_value: 38, threshold: 35, severity: "critical", message: "High temp", triggered_at: "2025-01-01T00:00:00Z", acknowledged_at: null },
    ]);
    (api.isAuthenticated as jest.Mock).mockReturnValue(false);

    await useStore.getState().loadAlerts();

    const state = useStore.getState();
    expect(state.alerts).toHaveLength(1);
    expect(state.alerts[0].severity).toBe("critical");
  });

  it("acknowledges alert optimistically", async () => {
    useStore.setState({
      alerts: [{ id: "a1", fieldId: "f1", severity: "critical", message: "Test", triggeredAt: "2025-01-01", acknowledgedAt: null }],
    });
    (db.acknowledgeLocalAlert as jest.Mock).mockResolvedValue(undefined);
    (api.acknowledgeAlert as jest.Mock).mockResolvedValue({} as any);

    await useStore.getState().acknowledgeAlert("a1");

    const state = useStore.getState();
    expect(state.alerts[0].acknowledgedAt).toBeTruthy();
  });

  it("reloads alerts on acknowledge failure", async () => {
    useStore.setState({
      alerts: [{ id: "a1", fieldId: "f1", severity: "critical", message: "Test", triggeredAt: "2025-01-01", acknowledgedAt: null }],
    });
    (db.acknowledgeLocalAlert as jest.Mock).mockRejectedValue(new Error("DB error"));
    (db.getLocalAlerts as jest.Mock).mockResolvedValue([]);

    await useStore.getState().acknowledgeAlert("a1");

    // Should have reloaded (calling loadAlerts which calls db.getLocalAlerts)
    expect(db.getLocalAlerts).toHaveBeenCalled();
  });
});

// ── Sync Slice ──────────────────────────────────────────────────

describe("Sync Slice", () => {
  beforeEach(() => {
    resetStore();
  });

  it("starts with idle status", () => {
    const state = useStore.getState();
    expect(state.syncStatus).toBe("idle");
    expect(state.syncPendingCount).toBe(0);
  });

  it("updates sync status", () => {
    useStore.getState().setSyncStatus("syncing");
    expect(useStore.getState().syncStatus).toBe("syncing");

    useStore.getState().setSyncStatus("success");
    expect(useStore.getState().syncStatus).toBe("success");
  });

  it("updates sync pending count", () => {
    useStore.getState().setSyncPendingCount(3);
    expect(useStore.getState().syncPendingCount).toBe(3);
  });

  it("updates sync error", () => {
    useStore.getState().setSyncError("Connection failed");
    expect(useStore.getState().syncError).toBe("Connection failed");
  });

  it("updates last sync time", () => {
    const now = Date.now();
    useStore.getState().setSyncLastSyncTime(now);
    expect(useStore.getState().syncLastSyncTime).toBe(now);
  });
});
