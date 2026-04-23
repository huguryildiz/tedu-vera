import { test, expect } from "@playwright/test";

test("email+password signup lands in /admin with verify banner", async ({ page }) => {
  const email = `e2e_${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByLabel(/Full Name/i).fill("E2E User");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Email", { exact: true }).blur();
  await page.getByLabel(/Organization/i).fill(`E2E Org ${Date.now()}`);
  await page.getByLabel("Password", { exact: true }).fill("Str0ng!Pass");
  await page.getByLabel(/Confirm Password/i).fill("Str0ng!Pass");
  await page.getByRole("button", { name: /Create workspace/i }).click();
  await page.waitForURL(/\/admin/);
  await expect(page.getByText(/Verify your email/i)).toBeVisible();
});
