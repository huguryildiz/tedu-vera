import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { AuditPom } from "../poms/AuditPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

test.describe("audit log", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGoto(
    page: Parameters<Parameters<typeof test>[1]>[0]["page"],
  ) {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
      } catch {}
    });

    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const audit = new AuditPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await page.goto("/admin/audit-log");
    await audit.waitForReady();
    return audit;
  }

  test("page renders — KPI strip and view tabs visible", async ({ page }) => {
    const audit = await signInAndGoto(page);
    await expect(audit.kpiStrip()).toBeVisible();
    await expect(audit.viewTab("All activity")).toBeVisible();
  });

  test("saved-view tab becomes active on click", async ({ page }) => {
    const audit = await signInAndGoto(page);
    await audit.clickViewTab("Failed auth");
    await expect(audit.viewTab("Failed auth")).toHaveClass(/active/);
  });

  test("search input accepts text", async ({ page }) => {
    const audit = await signInAndGoto(page);
    await audit.typeSearch("login");
    await expect(audit.searchInput()).toHaveValue("login");
  });
});
