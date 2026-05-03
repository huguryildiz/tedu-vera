// e2e/screenshots/_helpers.ts
// Shared utilities for the product-tour screenshot project.
// Auth: /demo/* routes use DemoAdminLoader auto-login — no storageState required.
// Jury entry: demo entry token from VITE_DEMO_ENTRY_TOKEN pre-fills the gate (?t=).

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import fs from "fs";
import path from "path";

const ENTRY_TOKEN = process.env.VITE_DEMO_ENTRY_TOKEN || "demo-tedu-ee";
const ENTRY_URL = `/demo/eval?t=${ENTRY_TOKEN}`;
const IMAGES_ROOT = path.resolve(process.cwd(), "docs/tutorials/_images");

/** Navigate to /demo and wait for DemoAdminLoader to complete. */
export async function gotoDemoAdmin(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("vera.admin_tour_done", "1");
    } catch {}
  });
  await page.goto("/demo");
  await page.waitForURL(/\/demo\/admin/);
  await expect(page.getByTestId("admin-shell-root")).toBeVisible({ timeout: 20_000 });
}

/** Navigate to a specific admin page under /demo/admin/<path>. */
export async function gotoAdminPage(page: Page, adminPath: string): Promise<void> {
  await gotoDemoAdmin(page);
  await page.goto(`/demo/admin/${adminPath}`);
  await expect(page.getByTestId("admin-shell-root")).toBeVisible({ timeout: 10_000 });
}

/** Set mobile-portrait viewport (iPhone 12 size used across jury mobile captures). */
export async function setMobileViewport(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
}

/**
 * Capture a full-page PNG and write it to docs/tutorials/_images/<relativePath>.
 * Parent directories are created automatically.
 * relativePath example: "admin/01-overview.png"
 */
export async function captureScreenshot(page: Page, relativePath: string): Promise<void> {
  const outPath = path.join(IMAGES_ROOT, relativePath);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  await page.screenshot({ path: outPath, fullPage: true });
}

/**
 * Navigate through the jury gate using the demo entry token.
 * Lands on the arrival step (/demo/jury/arrival) and suppresses SpotlightTour overlays.
 * Returns once the arrival "Begin" button is visible — caller captures or continues.
 */
export async function freshJurorEntryFlow(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("dj_tour_done", "1");
      sessionStorage.setItem("dj_tour_eval", "1");
      sessionStorage.setItem("dj_tour_rubric", "1");
      sessionStorage.setItem("dj_tour_confirm", "1");
    } catch {}
  });
  await page.goto(ENTRY_URL);
  await page.waitForURL(/\/demo\/jury\/arrival/, { timeout: 20_000 });
  await expect(page.getByTestId("jury-arrival-begin")).toBeVisible();
}

/**
 * Complete jury arrival → identity steps with a unique juror name.
 * Stops at the PIN input step so the caller can capture or continue.
 * @param jurorName Defaults to a timestamped name so each run creates a fresh juror.
 */
export async function juryFlowToPin(
  page: Page,
  jurorName = `Tour Demo ${Date.now()}`,
): Promise<void> {
  await freshJurorEntryFlow(page);
  await page.getByTestId("jury-arrival-begin").click();
  await expect(page.getByTestId("jury-name-input")).toBeVisible();
  await page.getByTestId("jury-name-input").fill(jurorName);
  await page.getByTestId("jury-affiliation-input").fill("Demo University");
  await page.getByTestId("jury-identity-submit").click();
  await page.waitForURL(/\/demo\/jury\/pin(?:-reveal)?/, { timeout: 15_000 });
}

/**
 * Continue from the PIN reveal step to the progress step.
 * Clicks "Begin Evaluation" and waits for the project list.
 */
export async function juryFlowFromPinRevealToProgress(page: Page): Promise<void> {
  await page.waitForURL(/\/demo\/jury\/pin-reveal/, { timeout: 10_000 });
  await page.locator("button:has-text('Begin Evaluation')").click();
  await page.waitForURL(/\/demo\/jury\/progress/, { timeout: 15_000 });
  await expect(page.getByTestId("jury-progress-title")).toBeVisible();
}

/**
 * Continue from the progress step to the first project's evaluate step.
 * Clicks the action button (Start / Resume Evaluation) on the progress page.
 */
export async function juryFlowFromProgressToEvaluate(page: Page): Promise<void> {
  await expect(page.getByTestId("jury-progress-action")).toBeVisible();
  await page.getByTestId("jury-progress-action").click();
  await page.waitForURL(/\/demo\/jury\/evaluate/, { timeout: 15_000 });
  await expect(page.locator("[data-testid^='jury-eval-score-']").first()).toBeVisible();
}
