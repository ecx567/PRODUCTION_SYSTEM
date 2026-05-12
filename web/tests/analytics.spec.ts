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

const MOCK_SUMMARY = {
  period_start: "2026-05-10T00:00:00Z",
  period_end: "2026-05-11T00:00:00Z",
  avg_temp: 28.5,
  avg_humidity: 65.2,
  avg_soil_moisture: 45.0,
  total_rain: 2.5,
  reading_count: 120,
  sensor_count: 3,
};

function makeHourlyBucket(
  hoursAgo: number,
  overrides: Partial<{
    avg_temp: number | null;
    min_temp: number | null;
    max_temp: number | null;
    avg_humidity: number | null;
    total_rain: number | null;
  }> = {},
) {
  const d = new Date(Date.now() - hoursAgo * 3_600_000);
  return {
    hour: d.toISOString(),
    avg_temp: overrides.avg_temp ?? 28 + Math.random() * 4,
    min_temp: overrides.min_temp ?? 26,
    max_temp: overrides.max_temp ?? 32,
    avg_humidity: overrides.avg_humidity ?? 60 + Math.random() * 10,
    total_rain: overrides.total_rain ?? Math.random() * 2,
  };
}

function generateHourlyData(count: number) {
  return Array.from({ length: count }, (_, i) =>
    makeHourlyBucket(count - i - 1),
  );
}

const MOCK_HOURLY = generateHourlyData(72);

const MOCK_TOKEN_RESPONSE = {
  access_token:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbi11dWlkIiwiZW1haWwiOiJhZG1pbkBjcm9wLmxvY2FsIiwicm9sZSI6ImFkbWluIiwidGVuYW50X2lkIjoidGVuYW50LXV1aWQifQ.mock",
  refresh_token: "mock-refresh-token",
  token_type: "bearer",
};

// ── Tests ──────────────────────────────────────────────────────

test.describe("Analytics Page - Charts & Gaps", { tag: ["@e2e", "@analytics"] }, () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth endpoint
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

  test("renders Recharts charts without error", async ({ page }) => {
    // Mock fields list
    await page.route("**/api/v1/fields**", async (route) => {
      const url = route.request().url();
      // Only match fields list, not field-specific analytics calls
      if (!url.includes("/analytics/") && !url.includes("/sensors")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_FIELDS),
        });
      } else {
        await route.continue();
      }
    });

    // Mock analytics summary
    await page.route("**/api/v1/fields/*/analytics/summary", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SUMMARY),
      });
    });

    // Mock hourly rollup
    await page.route("**/api/v1/fields/*/analytics/hourly", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_HOURLY),
      });
    });

    // Mock sensor gaps (no gaps — healthy)
    await page.route("**/api/v1/fields/*/analytics/gaps", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto(`${BASE_URL}/dashboard/analytics`);

    // Wait for the field selector to be populated
    await page.waitForSelector('[data-testid="field-select"]', { timeout: 15_000 });
    await page.waitForTimeout(500);

    // Verify summary cards render with values
    await expect(page.getByText("Temperature")).toBeVisible();
    await expect(page.getByText("Humidity")).toBeVisible();
    await expect(page.getByText("Soil Moisture")).toBeVisible();
    await expect(page.getByText("Total Rain")).toBeVisible();
    await expect(page.getByText("28.5°C")).toBeVisible();
    await expect(page.getByText("65.2%")).toBeVisible();

    // Verify gap detection shows healthy state
    await expect(page.getByTestId("all-healthy")).toBeVisible();
    await expect(page.getByText("All sensors reporting normally")).toBeVisible();

    // Verify chart containers exist — Recharts renders SVG elements
    const rechartsSvgs = await page.locator(".recharts-wrapper").count();
    expect(rechartsSvgs).toBeGreaterThanOrEqual(3);

    // No console errors from Recharts
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    // Verify time range selector works
    await page.getByTestId("time-range-24").click();
    await expect(page.getByTestId("time-range-24")).toHaveClass(/bg-leaf-500/);

    // Switch field
    await page.getByTestId("field-select").selectOption("f2-e5f6g7h8");
    await page.waitForTimeout(500);

    // Verify charts still render after field change
    const rechartsSvgsAfter = await page.locator(".recharts-wrapper").count();
    expect(rechartsSvgsAfter).toBeGreaterThanOrEqual(3);

    // Assert no Recharts-related errors
    const rechartsErrors = consoleErrors.filter(
      (e) => e.includes("Recharts") || e.includes("recharts"),
    );
    expect(rechartsErrors.length).toBe(0);
  });

  test("shows gap table when sensors are missing", async ({ page }) => {
    const MOCK_GAPS = [
      {
        sensor_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        last_seen: new Date(Date.now() - 3_600_000).toISOString(),
        gap_minutes: 60,
      },
      {
        sensor_id: "ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj",
        last_seen: new Date(Date.now() - 7_200_000).toISOString(),
        gap_minutes: 120,
      },
    ];

    await page.route("**/api/v1/fields**", async (route) => {
      const url = route.request().url();
      if (!url.includes("/analytics/") && !url.includes("/sensors")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_FIELDS),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/v1/fields/*/analytics/summary", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_SUMMARY),
      });
    });

    await page.route("**/api/v1/fields/*/analytics/hourly", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_HOURLY),
      });
    });

    await page.route("**/api/v1/fields/*/analytics/gaps", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_GAPS),
      });
    });

    await page.goto(`${BASE_URL}/dashboard/analytics`);

    // Wait for gaps table
    await page.waitForSelector('[data-testid="gaps-table"]', { timeout: 15_000 });

    // Verify gap rows are visible
    const rows = page.getByTestId("gaps-table").locator("tbody tr");
    await expect(rows).toHaveCount(2);

    // Verify gap durations
    await expect(page.getByText("60m")).toBeVisible();
    await expect(page.getByText("120m")).toBeVisible();
  });

  test("shows empty state when no fields exist", async ({ page }) => {
    await page.route("**/api/v1/fields**", async (route) => {
      const url = route.request().url();
      if (!url.includes("/analytics/") && !url.includes("/sensors")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [], next_cursor: null, total: 0 }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`${BASE_URL}/dashboard/analytics`);

    await page.waitForSelector('[data-testid="empty-state"]', { timeout: 15_000 });
    await expect(page.getByText("Create a field to view analytics")).toBeVisible();
  });

  test("shows error state on API failure", async ({ page }) => {
    await page.route("**/api/v1/fields**", async (route) => {
      const url = route.request().url();
      if (!url.includes("/analytics/") && !url.includes("/sensors")) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Internal server error" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`${BASE_URL}/dashboard/analytics`);

    await page.waitForSelector('[data-testid="error-state"]', { timeout: 15_000 });
    await expect(page.getByText(/Failed to load|Unable to load/i)).toBeVisible();
  });
});
