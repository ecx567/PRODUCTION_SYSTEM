import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3000";

test.describe("Alert Rules CRUD", { tag: ["@e2e", "@alert-rules"] }, () => {
  // Note: These tests require authentication. For a full E2E test,
  // you would first login via the login page or seed test user data.
  // This test suite documents the expected CRUD flow.

  test.describe("Rule Form - Client Validation", () => {
    test("shows validation error when submitting empty form", async ({ page }) => {
      // This test assumes user is already authenticated.
      // In CI, setup should handle login via storageState.

      // Navigate to rules page
      await page.goto(`${BASE_URL}/dashboard/rules`);

      // Wait for page to load (either list or empty state)
      await Promise.race([
        page.waitForSelector('[data-testid="rules-list"]'),
        page.waitForSelector('[data-testid="empty-state"]'),
        page.waitForSelector('[data-testid="loading-spinner"]', { state: "hidden" }),
      ]);

      // Click "New Rule" button
      await page.getByTestId("new-rule-button").click();

      // Wait for modal to appear
      await page.waitForSelector('h2:has-text("New Alert Rule")');

      // Try to submit without filling fields
      await page.getByRole("button", { name: "Create Rule" }).click();

      // Should show validation errors
      await expect(page.getByText("Name is required")).toBeVisible();
      await expect(page.getByText("Metric type is required")).toBeVisible();
      await expect(page.getByText("Condition is required")).toBeVisible();
      await expect(page.getByText("Threshold is required")).toBeVisible();
    });

    test("shows threshold_max error for 'between' condition without upper bound", async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/rules`);
      await page.waitForSelector('[data-testid="new-rule-button"]');
      await page.getByTestId("new-rule-button").click();
      await page.waitForSelector('h2:has-text("New Alert Rule")');

      // Fill minimum required
      await page.getByLabel("Rule Name").fill("Test Between Rule");
      await page.getByLabel("Metric").selectOption({ value: "temp" });

      // Select "between" condition
      await page.getByLabel("Condition").selectOption({ value: "between" });

      // Fill only lower threshold
      await page.getByLabel("Threshold", { exact: false }).first().fill("20");
      // Leave upper empty

      await page.getByRole("button", { name: "Create Rule" }).click();

      // Should show error about threshold_max
      await expect(page.getByText(/Upper bound.*required/i)).toBeVisible();
    });

    test("shows error when threshold_max <= threshold for between", async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard/rules`);
      await page.waitForSelector('[data-testid="new-rule-button"]');
      await page.getByTestId("new-rule-button").click();
      await page.waitForSelector('h2:has-text("New Alert Rule")');

      await page.getByLabel("Rule Name").fill("Test Between Rule");
      await page.getByLabel("Metric").selectOption({ value: "temp" });
      await page.getByLabel("Condition").selectOption({ value: "between" });

      // Invalid: upper <= lower
      await page.getByLabel("Threshold", { exact: false }).first().fill("30");
      await page.getByLabel("Upper Bound").fill("20");

      await page.getByRole("button", { name: "Create Rule" }).click();

      await expect(page.getByText(/Upper bound must be greater than threshold/i)).toBeVisible();
    });
  });
});

// Page Object Model for Rules Page
export class RulesPage {
  constructor(protected page: any) {}

  async goto(): Promise<void> {
    await this.page.goto(`${BASE_URL}/dashboard/rules`);
    await this.page.waitForLoadState("networkidle");
  }

  async clickNewRule(): Promise<void> {
    await this.page.getByTestId("new-rule-button").click();
  }

  async waitForModalTitle(title: string): Promise<void> {
    await this.page.waitForSelector(`h2:has-text("${title}")`);
  }

  async fillRuleForm(data: {
    name: string;
    metric_type: string;
    condition: string;
    threshold: number;
    threshold_max?: number;
    severity?: string;
    cooldown_minutes?: number;
  }): Promise<void> {
    const { page } = this;

    await page.getByLabel("Rule Name").fill(data.name);
    await page.getByLabel("Metric").selectOption({ value: data.metric_type });
    await page.getByLabel("Condition").selectOption({ value: data.condition });

    const thresholdInputs = page.getByLabel("Threshold", { exact: false });
    await thresholdInputs.first().fill(String(data.threshold));

    if (data.threshold_max !== undefined) {
      await page.getByLabel("Upper Bound").fill(String(data.threshold_max));
    }

    if (data.severity) {
      await page.getByLabel("Severity").selectOption({ value: data.severity });
    }

    if (data.cooldown_minutes !== undefined) {
      await page.locator('input[id="rule-cooldown"]').fill(String(data.cooldown_minutes));
    }
  }

  async submitCreate(): Promise<void> {
    await this.page.getByRole("button", { name: "Create Rule" }).click();
  }

  async submitUpdate(): Promise<void> {
    await this.page.getByRole("button", { name: "Update Rule" }).click();
  }

  async clickEdit(ruleId: string): Promise<void> {
    await this.page.getByTestId(`edit-rule-${ruleId}`).click();
  }

  async clickDelete(ruleId: string): Promise<void> {
    await this.page.getByTestId(`delete-rule-${ruleId}`).click();
  }

  async confirmDelete(): Promise<void> {
    await this.page.getByRole("button", { name: "Delete Rule" }).click();
  }

  async waitForNotification(message: string): Promise<void> {
    await this.page.waitForSelector(`[role="status"]:has-text("${message}")`);
  }

  async ruleIsVisible(ruleName: string): Promise<boolean> {
    return await this.page.getByText(ruleName).isVisible();
  }
}
