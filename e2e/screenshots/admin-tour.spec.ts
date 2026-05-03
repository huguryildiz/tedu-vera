import { test, expect } from "@playwright/test";
import {
  gotoAdminPage,
  captureScreenshot,
} from "./_helpers";

// Admin product-tour: 14 independent screenshot captures against /demo/* (TEDU-EE / Spring 2026).
// Each spec navigates to one screen, waits for meaningful content, then writes a PNG.
// No assertions beyond "content is visible" — captions in the Markdown carry the narrative.

test("admin tour: 01 overview", async ({ page }) => {
  await gotoAdminPage(page, "overview");
  await expect(page.getByTestId("overview-kpi-active-jurors")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("overview-kpi-projects")).toBeVisible();
  await captureScreenshot(page, "admin/01-overview.png");
});

test("admin tour: 02 setup wizard", async ({ page }) => {
  await gotoAdminPage(page, "setup?fresh=1");
  await expect(page.getByTestId("wizard-stepper")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("wizard-welcome-continue")).toBeVisible();
  await captureScreenshot(page, "admin/02-setup-wizard.png");
});

test("admin tour: 03 periods", async ({ page }) => {
  await gotoAdminPage(page, "periods");
  await expect(page.getByTestId("period-row").first()).toBeVisible({ timeout: 15_000 });
  await captureScreenshot(page, "admin/03-periods.png");
});

test("admin tour: 04 period actions menu", async ({ page }) => {
  await gotoAdminPage(page, "periods");
  await expect(page.getByTestId("period-row").first()).toBeVisible({ timeout: 15_000 });
  // Open the kebab actions menu on the first period row
  await page.getByTestId("period-row-kebab").first().click();
  await expect(page.getByTestId("period-menu-edit")).toBeVisible({ timeout: 10_000 });
  await captureScreenshot(page, "admin/04-period-actions.png");
});

test("admin tour: 05 criteria", async ({ page }) => {
  await gotoAdminPage(page, "criteria");
  await expect(page.getByTestId("criteria-row").first()).toBeVisible({ timeout: 15_000 });
  await captureScreenshot(page, "admin/05-criteria.png");
});

test("admin tour: 06 outcomes", async ({ page }) => {
  await gotoAdminPage(page, "outcomes");
  await expect(page.getByTestId("outcome-row").first()).toBeVisible({ timeout: 15_000 });
  await captureScreenshot(page, "admin/06-outcomes.png");
});

test("admin tour: 07 projects", async ({ page }) => {
  await gotoAdminPage(page, "projects");
  await expect(page.getByTestId("project-row").first()).toBeVisible({ timeout: 15_000 });
  await captureScreenshot(page, "admin/07-projects.png");
});

test("admin tour: 08 jurors", async ({ page }) => {
  await gotoAdminPage(page, "jurors");
  await expect(page.getByTestId("jurors-create-btn")).toBeVisible({ timeout: 15_000 });
  // Wait for at least one juror row action to confirm the table loaded
  await expect(page.locator("[data-testid^='jurors-row-kebab-']").first()).toBeVisible({ timeout: 15_000 });
  await captureScreenshot(page, "admin/08-jurors.png");
});

test("admin tour: 09 entry control", async ({ page }) => {
  await gotoAdminPage(page, "entry-control");
  await expect(page.getByTestId("entry-tokens-generate-btn")).toBeVisible({ timeout: 15_000 });
  await captureScreenshot(page, "admin/09-entry-control.png");
});

test("admin tour: 10 heatmap", async ({ page }) => {
  await gotoAdminPage(page, "heatmap");
  await expect(page.getByTestId("heatmap-grid")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("heatmap-overall-avg")).toBeVisible();
  await captureScreenshot(page, "admin/10-heatmap.png");
});

test("admin tour: 11 rankings", async ({ page }) => {
  await gotoAdminPage(page, "rankings");
  await expect(page.getByTestId("rankings-kpi-strip")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("rankings-table")).toBeVisible();
  await captureScreenshot(page, "admin/11-rankings.png");
});

test("admin tour: 12 analytics outcome attainment", async ({ page }) => {
  await gotoAdminPage(page, "analytics");
  await expect(page.getByTestId("analytics-chart-container")).toBeVisible({ timeout: 20_000 });
  // Wait for at least one attainment card to confirm data loaded
  await expect(page.locator("[data-testid^='analytics-att-card-']").first()).toBeVisible({ timeout: 15_000 });
  await captureScreenshot(page, "admin/12-analytics.png");
});

test("admin tour: 13 audit log", async ({ page }) => {
  await gotoAdminPage(page, "audit-log");
  await expect(page.getByTestId("audit-log-page")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("audit-kpi-strip")).toBeVisible();
  await expect(page.getByTestId("audit-row").first()).toBeVisible({ timeout: 15_000 });
  await captureScreenshot(page, "admin/13-audit-log.png");
});

test("admin tour: 14 export panel", async ({ page }) => {
  await gotoAdminPage(page, "rankings");
  await expect(page.getByTestId("rankings-kpi-strip")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("rankings-export-btn").click();
  await expect(page.getByTestId("rankings-export-panel")).toBeVisible({ timeout: 10_000 });
  await captureScreenshot(page, "admin/14-export.png");
});
