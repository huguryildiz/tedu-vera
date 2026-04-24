import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { RankingsPom } from "../poms/RankingsPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const E2E_PERIODS_ORG_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901";

test.describe("rankings export", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGoto(
    page: Parameters<Parameters<typeof test>[1]>[0]["page"],
  ) {
    await page.addInitScript((orgId) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", orgId);
      } catch {}
    }, E2E_PERIODS_ORG_ID);

    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const rankings = new RankingsPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await page.goto("/admin/rankings");
    await rankings.waitForReady();
    return rankings;
  }

  test("KPI strip visible on page load", async ({ page }) => {
    const rankings = await signInAndGoto(page);
    await expect(rankings.kpiStrip()).toBeVisible();
  });

  test("export panel opens on button click", async ({ page }) => {
    const rankings = await signInAndGoto(page);
    await rankings.openExportPanel();
    await expect(rankings.exportPanel()).toHaveClass(/show/);
  });
});
