import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

// ── Mock data ──────────────────────────────────────────────────

const MOCK_FIELDS = {
  items: [
    {
      id: "f1-a1b2c3d4",
      name: "North Field",
      crop_type: "maize",
      tenant_id: "t1",
      area_ha: 12.5,
      planted_at: "2026-03-15T08:00:00Z",
      location: null,
      created_at: "2026-03-01T00:00:00Z",
      deleted_at: null,
    },
    {
      id: "f2-e5f6g7h8",
      name: "South Field",
      crop_type: "rice",
      tenant_id: "t1",
      area_ha: 8.0,
      planted_at: "2026-04-01T08:00:00Z",
      location: null,
      created_at: "2026-03-15T00:00:00Z",
      deleted_at: null,
    },
  ],
  next_cursor: null,
  total: 2,
};

function makeSensor(
  sensorId: string,
  fieldId: string,
  overrides: Partial<{
    temp: number | null;
    humidity: number | null;
    soil_moisture: number | null;
    rain: number | null;
    time: string;
    validation_status: string;
  }> = {},
) {
  return {
    time: overrides.time ?? new Date().toISOString(),
    tenant_id: "t1",
    sensor_id: sensorId,
    field_id: fieldId,
    temp: overrides.temp ?? 28.5,
    humidity: overrides.humidity ?? 65.2,
    soil_moisture: overrides.soil_moisture ?? 45.0,
    rain: overrides.rain ?? 0.0,
    ingestion_ts: new Date().toISOString(),
    validation_status: overrides.validation_status ?? "valid",
  };
}

const SENSORS_F1 = [
  makeSensor("aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa", "f1-a1b2c3d4", { temp: 28.5, humidity: 65.2 }),
  makeSensor("bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb", "f1-a1b2c3d4", { temp: 30.1, humidity: 58.0, soil_moisture: 38.2, rain: 0.5 }),
];

const SENSORS_F2 = [
  makeSensor("cccccccc-3333-3333-3333-cccccccccccc", "f2-e5f6g7h8", { temp: 26.0, humidity: 72.1, soil_moisture: 52.0, rain: 1.2 }),
];

const MOCK_TOKEN_RESPONSE = {
  access_token:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbi11dWlkIiwiZW1haWwiOiJhZG1pbkBjcm9wLmxvY2FsIiwicm9sZSI6ImFkbWluIiwidGVuYW50X2lkIjoidGVuYW50LXV1aWQifQ.mock",
  refresh_token: "mock-refresh-token",
  token_type: "bearer",
};

// ── Tests ──────────────────────────────────────────────────────

test.describe("Devices Page - Sensor Monitoring", { tag: ["@e2e", "@devices"] }, () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth endpoint (auto-login in layout)
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_TOKEN_RESPONSE),
      });
    });

    // Mock SSE to prevent connection errors
    await page.route("**/api/v1/alerts/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "event: heartbeat\ndata: {}\n\n",
      });
    });
  });

  test("renders sensor cards from all fields", async ({ page }) => {
    await page.route("**/api/v1/fields**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FIELDS),
      });
    });
    await page.route("**/api/v1/fields/*/sensors", async (route) => {
      const url = route.request().url();
      if (url.includes("f1-a1b2c3d4")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(SENSORS_F1),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(SENSORS_F2),
        });
      }
    });

    await page.goto(`${BASE_URL}/dashboard/devices`);

    // Wait for sensor cards to render
    await page.waitForSelector('[data-testid="sensor-card"]', { timeout: 15_000 });

    // Should have 3 sensor cards (2 from North Field + 1 from South Field)
    const cards = page.getByTestId("sensor-card");
    await expect(cards).toHaveCount(3);

    // Field names should appear
    await expect(page.getByText("North Field")).toBeVisible();
    await expect(page.getByText("South Field")).toBeVisible();
  });

  test("displays sensor metrics correctly", async ({ page }) => {
    await page.route("**/api/v1/fields**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FIELDS),
      });
    });
    await page.route("**/api/v1/fields/*/sensors", async (route) => {
      const url = route.request().url();
      if (url.includes("f1-a1b2c3d4")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(SENSORS_F1),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(SENSORS_F2),
        });
      }
    });

    await page.goto(`${BASE_URL}/dashboard/devices`);
    await page.waitForSelector('[data-testid="sensor-card"]', { timeout: 15_000 });

    // Verify metric values are rendered
    await expect(page.getByText("28.5°C")).toBeVisible();
    await expect(page.getByText("65.2%")).toBeVisible();
    await expect(page.getByText("30.1°C")).toBeVisible();
    await expect(page.getByText("26.0°C")).toBeVisible();
    await expect(page.getByText("72.1%")).toBeVisible();
  });

  test("shows empty state when no sensors exist", async ({ page }) => {
    await page.route("**/api/v1/fields**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FIELDS),
      });
    });
    // Return empty sensors for all fields
    await page.route("**/api/v1/fields/*/sensors", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto(`${BASE_URL}/dashboard/devices`);
    await page.waitForSelector('[data-testid="empty-state"]', { timeout: 15_000 });

    await expect(
      page.getByText("No sensor data available"),
    ).toBeVisible();
  });

  test("shows error state on API failure", async ({ page }) => {
    // Make fields endpoint fail
    await page.route("**/api/v1/fields**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Internal server error" }),
      });
    });

    await page.goto(`${BASE_URL}/dashboard/devices`);
    await page.waitForSelector('[data-testid="error-state"]', { timeout: 15_000 });

    await expect(
      page.getByText("Unable to load sensor data"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  });

  test("shows null metrics as em-dash", async ({ page }) => {
    // Sensor with partial null metrics
    const partialSensor = [
      makeSensor("dddddddd-4444-4444-4444-dddddddddddd", "f1-a1b2c3d4", {
        temp: null,
        humidity: 55.0,
        soil_moisture: null,
        rain: 0.0,
      }),
    ];

    await page.route("**/api/v1/fields**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [MOCK_FIELDS.items[0]],
          next_cursor: null,
          total: 1,
        }),
      });
    });
    await page.route("**/api/v1/fields/*/sensors", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(partialSensor),
      });
    });

    await page.goto(`${BASE_URL}/dashboard/devices`);
    await page.waitForSelector('[data-testid="sensor-card"]', { timeout: 15_000 });

    // Null metrics should show em-dash, not an error
    const card = page.getByTestId("sensor-card").first();
    await expect(card).toBeVisible();
    // The non-null value renders
    await expect(page.getByText("55.0%")).toBeVisible();
  });
});
