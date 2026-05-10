/**
 * Zustand store for global app state.
 *
 * Slices:
 * - auth: token, user, tenant, login/logout
 * - fields: cached fields list, last sync timestamp
 * - alerts: active alerts, acknowledge action
 * - sync: sync status, pending count, error state
 */

import { create } from "zustand";
import * as api from "./api";
import * as database from "./database";
import { SyncStatus } from "./sync";

// ── Types ──────────────────────────────────────────────────────

export interface UserInfo {
  email: string;
  tenantId: string;
  role: string;
}

export interface FieldSummary {
  id: string;
  name: string;
  cropType: string;
  areaHa: number;
}

export interface AlertItem {
  id: string;
  fieldId: string;
  severity: string;
  message: string;
  triggeredAt: string;
  acknowledgedAt: string | null;
}

// ── Store Interface ────────────────────────────────────────────

export interface AppState {
  // Auth slice
  token: string | null;
  refreshTokenValue: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  authError: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setTokensFromStorage: (access: string, refresh: string) => void;

  // Fields slice
  fields: FieldSummary[];
  fieldsLoading: boolean;
  fieldsError: string | null;
  fieldsLastSync: number | null;

  loadFields: () => Promise<void>;
  refreshFields: () => Promise<void>;

  // Alerts slice
  alerts: AlertItem[];
  alertsLoading: boolean;
  alertsError: string | null;

  loadAlerts: () => Promise<void>;
  acknowledgeAlert: (id: string) => Promise<void>;

  // Sync slice
  syncStatus: SyncStatus;
  syncPendingCount: number;
  syncLastSyncTime: number | null;
  syncError: string | null;

  setSyncStatus: (status: SyncStatus) => void;
  setSyncPendingCount: (count: number) => void;
  setSyncLastSyncTime: (time: number | null) => void;
  setSyncError: (error: string | null) => void;
}

// ── Store Implementation ───────────────────────────────────────

export const useStore = create<AppState>((set, get) => ({
  // ── Auth initial state ──────────────────────────────────────
  token: null,
  refreshTokenValue: null,
  user: null,
  isAuthenticated: false,
  isAuthLoading: false,
  authError: null,

  login: async (email: string, password: string) => {
    set({ isAuthLoading: true, authError: null });
    try {
      const tokens = await api.loginUser(email, password);
      set({
        token: tokens.access_token,
        refreshTokenValue: tokens.refresh_token,
        isAuthenticated: true,
        isAuthLoading: false,
        authError: null,
        user: { email, tenantId: "", role: "farmer" },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      set({ isAuthLoading: false, authError: msg });
      throw err;
    }
  },

  logout: () => {
    api.clearTokens();
    set({
      token: null,
      refreshTokenValue: null,
      user: null,
      isAuthenticated: false,
      fields: [],
      alerts: [],
      authError: null,
    });
  },

  setTokensFromStorage: (access: string, refresh: string) => {
    api.setTokens(access, refresh);
    set({
      token: access,
      refreshTokenValue: refresh,
      isAuthenticated: true,
    });
  },

  // ── Fields initial state ────────────────────────────────────
  fields: [],
  fieldsLoading: false,
  fieldsError: null,
  fieldsLastSync: null,

  loadFields: async () => {
    set({ fieldsLoading: true, fieldsError: null });
    try {
      // Try loading from local SQLite first (offline-first)
      const localFields = await database.getLocalFields();
      if (localFields.length > 0) {
        set({
          fields: localFields.map((f) => ({
            id: f.id,
            name: f.name,
            cropType: f.crop_type,
            areaHa: f.area_ha,
          })),
        });
      }

      // Then try loading from server (overlays local)
      if (api.isAuthenticated()) {
        const remote = await api.getFields();
        if (remote.items.length > 0) {
          // Cache to SQLite
          await database.upsertFields(
            remote.items.map((f) => ({
              id: f.id,
              tenant_id: f.tenant_id,
              name: f.name,
              crop_type: f.crop_type,
              planted_at: f.planted_at,
              area_ha: f.area_ha,
              location: f.location,
              created_at: f.created_at,
              deleted_at: f.deleted_at,
            })),
          );

          set({
            fields: remote.items.map((f) => ({
              id: f.id,
              name: f.name,
              cropType: f.crop_type,
              areaHa: f.area_ha,
            })),
            fieldsLastSync: Date.now(),
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load fields";
      set({ fieldsError: msg });
      // Don't clear local fields on error — keep showing cached data
    } finally {
      set({ fieldsLoading: false });
    }
  },

  refreshFields: async () => {
    // Force re-fetch from server
    set({ fieldsLoading: true, fieldsError: null });
    try {
      if (api.isAuthenticated()) {
        const remote = await api.getFields();
        await database.upsertFields(
          remote.items.map((f) => ({
            id: f.id,
            tenant_id: f.tenant_id,
            name: f.name,
            crop_type: f.crop_type,
            planted_at: f.planted_at,
            area_ha: f.area_ha,
            location: f.location,
            created_at: f.created_at,
            deleted_at: f.deleted_at,
          })),
        );

        set({
          fields: remote.items.map((f) => ({
            id: f.id,
            name: f.name,
            cropType: f.crop_type,
            areaHa: f.area_ha,
          })),
          fieldsLastSync: Date.now(),
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to refresh fields";
      set({ fieldsError: msg });
    } finally {
      set({ fieldsLoading: false });
    }
  },

  // ── Alerts initial state ────────────────────────────────────
  alerts: [],
  alertsLoading: false,
  alertsError: null,

  loadAlerts: async () => {
    set({ alertsLoading: true, alertsError: null });
    try {
      // Try local first
      const localAlerts = await database.getLocalAlerts();
      if (localAlerts.length > 0) {
        set({
          alerts: localAlerts.map((a) => ({
            id: a.id,
            fieldId: a.field_id,
            severity: a.severity,
            message: a.message,
            triggeredAt: a.triggered_at,
            acknowledgedAt: a.acknowledged_at,
          })),
        });
      }

      // Then remote
      if (api.isAuthenticated()) {
        const remote = await api.getAlertEvents();
        if (remote.items.length > 0) {
          await database.upsertAlerts(
            remote.items.map((a) => ({
              id: a.id,
              rule_id: a.rule_id,
              field_id: a.field_id,
              metric_type: a.metric_type,
              actual_value: a.actual_value,
              threshold: a.threshold,
              severity: a.severity,
              message: a.message,
              triggered_at: a.triggered_at,
              acknowledged_at: a.acknowledged_at,
            })),
          );

          set({
            alerts: remote.items.map((a) => ({
              id: a.id,
              fieldId: a.field_id,
              severity: a.severity,
              message: a.message,
              triggeredAt: a.triggered_at,
              acknowledgedAt: a.acknowledged_at,
            })),
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load alerts";
      set({ alertsError: msg });
    } finally {
      set({ alertsLoading: false });
    }
  },

  acknowledgeAlert: async (id: string) => {
    try {
      // Optimistic update
      set((state) => ({
        alerts: state.alerts.map((a) =>
          a.id === id
            ? { ...a, acknowledgedAt: new Date().toISOString() }
            : a,
        ),
      }));

      await database.acknowledgeLocalAlert(id);

      if (api.isAuthenticated()) {
        await api.acknowledgeAlert(id);
      }
    } catch (err) {
      // Revert on error by reloading alerts
      await get().loadAlerts();
    }
  },

  // ── Sync initial state ──────────────────────────────────────
  syncStatus: "idle",
  syncPendingCount: 0,
  syncLastSyncTime: null,
  syncError: null,

  setSyncStatus: (status) => set({ syncStatus: status }),
  setSyncPendingCount: (count) => set({ syncPendingCount: count }),
  setSyncLastSyncTime: (time) => set({ syncLastSyncTime: time }),
  setSyncError: (error) => set({ syncError: error }),
}));
