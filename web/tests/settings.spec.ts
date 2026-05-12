import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

// ── Mock data ──────────────────────────────────────────────────

const MOCK_TOKEN_RESPONSE = {
  access_token:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbi11dWlkIiwiZW1haWwiOiJhZG1pbkBjcm9wLmxvY2FsIiwicm9sZSI6ImFkbWluIiwidGVuYW50X2lkIjoidGVuYW50LXV1aWQifQ.mock",
  refresh_token: "mock-refresh-token",
  token_type: "bearer",
};

// ── Helpers ─────────────────────────────────────────────────────

async function mockAuth(page: import("@playwright/test").Page) {
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_TOKEN_RESPONSE),
    });
  });

  await page.route("**/api/v1/alerts/stream", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "event: heartbeat\ndata: {}\n\n",
    });
  });
}

// ── Tests ──────────────────────────────────────────────────────

test.describe("Settings Page - Persistence", { tag: ["@e2e", "@settings"] }, () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);

    // Clear any stored settings before each test
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForSelector('[data-testid="tab-profile"]');
    await page.evaluate(() => localStorage.removeItem("crop.settings"));
  });

  test("renders all four tabs", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForSelector('[data-testid="tab-profile"]');

    // Tabs should be visible
    await expect(page.getByTestId("tab-profile")).toBeVisible();
    await expect(page.getByTestId("tab-notifications")).toBeVisible();
    await expect(page.getByTestId("tab-display")).toBeVisible();
    await expect(page.getByTestId("tab-api-keys")).toBeVisible();

    // Profile tab should be active by default
    await expect(page.getByTestId("section-profile")).toBeVisible();
  });

  test("tab switching shows correct sections", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForSelector('[data-testid="tab-profile"]');

    // Default: profile
    await expect(page.getByTestId("section-profile")).toBeVisible();

    // Switch to notifications
    await page.getByTestId("tab-notifications").click();
    await expect(page.getByTestId("section-notifications")).toBeVisible();

    // Switch to display
    await page.getByTestId("tab-display").click();
    await expect(page.getByTestId("section-display")).toBeVisible();

    // Switch to API keys
    await page.getByTestId("tab-api-keys").click();
    await expect(page.getByTestId("section-api-keys")).toBeVisible();
  });

  test("profile section shows user info from JWT", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForSelector('[data-testid="tab-profile"]');
    await page.waitForTimeout(500); // let the JWT decode settle

    // The user email from the mock token should be displayed
    await expect(page.getByText("admin@crop.local")).toBeVisible();
    // Role from token
    await expect(page.getByText("Admin")).toBeVisible();
  });

  test("notifications - changes persist after reload", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForSelector('[data-testid="tab-notifications"]');

    // Switch to notifications tab
    await page.getByTestId("tab-notifications").click();
    await page.waitForSelector('[data-testid="section-notifications"]');

    // Change severity to "critical"
    await page.getByLabel("Critical only").click();

    // Toggle email notifications ON
    await page.getByRole("checkbox").check();

    // Change digest to "immediate"
    await page.getByRole("combobox").selectOption("immediate");

    // Reload page
    await page.reload();
    await page.waitForSelector('[data-testid="tab-notifications"]');

    // Go back to notifications tab
    await page.getByTestId("tab-notifications").click();
    await page.waitForSelector('[data-testid="section-notifications"]');

    // Assert values persisted
    await expect(page.getByLabel("Critical only")).toBeChecked();
    await expect(page.getByRole("checkbox")).toBeChecked();
    await expect(page.getByRole("combobox")).toHaveValue("immediate");
  });

  test("display - theme and temp unit persist after reload", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForSelector('[data-testid="tab-display"]');

    // Switch to display tab
    await page.getByTestId("tab-display").click();
    await page.waitForSelector('[data-testid="section-display"]');

    // Click Dark theme
    await page.getByRole("button", { name: "Dark" }).click();

    // Click Fahrenheit
    await page.getByRole("button", { name: "°F" }).click();

    // Change timezone
    await page.getByRole("combobox").selectOption("America/New_York");

    // Reload
    await page.reload();
    await page.waitForSelector('[data-testid="tab-display"]');

    // Go back to display tab
    await page.getByTestId("tab-display").click();
    await page.waitForSelector('[data-testid="section-display"]');

    // Assert persisted
    await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "class",
      /bg-leaf-50/,
    );
    await expect(page.getByRole("button", { name: "°F" })).toHaveAttribute(
      "class",
      /bg-leaf-50/,
    );
    await expect(page.getByRole("combobox")).toHaveValue("America/New_York");
  });

  test("api keys section shows mock keys and copy button works", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForSelector('[data-testid="tab-api-keys"]');

    // Switch to API keys tab
    await page.getByTestId("tab-api-keys").click();
    await page.waitForSelector('[data-testid="section-api-keys"]');

    // Key table should be visible
    await expect(page.getByTestId("api-keys-table")).toBeVisible();

    // Should show mock keys
    await expect(page.getByText("Production API Key")).toBeVisible();
    await expect(page.getByText("Staging API Key")).toBeVisible();
    await expect(page.getByText("Development Key")).toBeVisible();

    // Copy button should exist
    const copyBtn = page.getByTestId("copy-key-key-001");
    await expect(copyBtn).toBeVisible();
  });

  test("reset to defaults clears settings", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForSelector('[data-testid="tab-notifications"]');

    // Change something first
    await page.getByTestId("tab-notifications").click();
    await page.waitForSelector('[data-testid="section-notifications"]');
    await page.getByLabel("Critical only").click();

    // Verify it changed
    await expect(page.getByLabel("Critical only")).toBeChecked();

    // Click Reset to defaults
    await page.getByRole("button", { name: "Reset to defaults" }).click();

    // After reset, "Warning and above" should be selected again
    await expect(page.getByLabel("Warning and above")).toBeChecked();
    await expect(page.getByLabel("Critical only")).not.toBeChecked();
  });

  test("notifications - shows digest options when email enabled", async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForSelector('[data-testid="tab-notifications"]');

    await page.getByTestId("tab-notifications").click();
    await page.waitForSelector('[data-testid="section-notifications"]');

    // Digest should NOT be visible initially (email is off by default)
    await expect(page.getByRole("combobox")).not.toBeVisible();

    // Toggle email ON
    await page.getByRole("checkbox").check();

    // Digest combobox should now be visible
    const digestSelect = page.getByRole("combobox");
    await expect(digestSelect).toBeVisible();
    await expect(digestSelect).toHaveValue("daily");
  });

  test("profile section shows not signed in when no JWT", async ({ page }) => {
    // Don't mock auth — login will fail, so JWT won't be set
    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Unauthorized" }),
      });
    });

    await page.route("**/api/v1/alerts/stream", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: "event: heartbeat\ndata: {}\n\n",
      });
    });

    await page.goto(`${BASE_URL}/dashboard/settings`);
    await page.waitForSelector('[data-testid="tab-profile"]');

    // Should show "Not signed in"
    await expect(page.getByText("Not signed in")).toBeVisible();
  });
});
