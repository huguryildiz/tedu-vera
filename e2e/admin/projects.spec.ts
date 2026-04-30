import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { ProjectsPom } from "../poms/ProjectsPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const E2E_PROJECTS_ORG_ID = "c3d4e5f6-a7b8-9012-cdef-123456789012";

function uniqueTitle(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

test.describe("projects crud", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGoto(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    await page.addInitScript((orgId) => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
        localStorage.setItem("admin.active_organization_id", orgId);
      } catch {}
    }, E2E_PROJECTS_ORG_ID);

    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const projects = new ProjectsPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await shell.clickNav("projects");
    await projects.waitForReady();
    return projects;
  }

  test("create — project appears in table", async ({ page }) => {
    // DEBUG: capture network failures + console errors so we can see the
    // real createProject error if the drawer doesn't close.
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(`[${msg.type()}] ${msg.text()}`);
    });
    page.on("response", async (resp) => {
      if (resp.status() >= 400 && resp.url().includes("/rest/v1/projects")) {
        let body = "";
        try { body = await resp.text(); } catch {}
        failedRequests.push(`${resp.status()} ${resp.request().method()} ${resp.url()} → ${body.slice(0, 500)}`);
      }
    });

    const projects = await signInAndGoto(page);
    const title = uniqueTitle("E2E Project");

    await projects.openCreateDrawer();
    await projects.fillCreateForm(title, "Alice Test");
    try {
      await projects.saveCreate();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log("=== DEBUG: createProject failure ===");
      console.log("Failed requests:", JSON.stringify(failedRequests, null, 2));
      console.log("Console errors:", JSON.stringify(consoleErrors, null, 2));
      throw err;
    }

    await projects.expectProjectVisible(title);

    // Cleanup
    await projects.clickDeleteFor(title);
    await projects.confirmDelete(title);
  });

  test("edit — rename persists", async ({ page }) => {
    const projects = await signInAndGoto(page);
    const original = uniqueTitle("E2E Project");
    const renamed = `${original}-renamed`;

    await projects.openCreateDrawer();
    await projects.fillCreateForm(original, "Alice Test");
    await projects.saveCreate();
    await projects.expectProjectVisible(original);

    await projects.clickEditFor(original);
    await projects.editDrawerTitle().fill(renamed);
    await projects.saveEdit();

    await projects.expectProjectVisible(renamed);
    await projects.expectProjectGone(original);

    // Cleanup
    await projects.clickDeleteFor(renamed);
    await projects.confirmDelete(renamed);
  });

  test("delete — project removed after confirmation", async ({ page }) => {
    const projects = await signInAndGoto(page);
    const title = uniqueTitle("E2E Project");

    await projects.openCreateDrawer();
    await projects.fillCreateForm(title, "Alice Test");
    await projects.saveCreate();
    await projects.expectProjectVisible(title);

    await projects.clickDeleteFor(title);
    // Confirm button disabled until title typed
    await expect(projects.deleteConfirmBtn()).toBeDisabled();
    await projects.confirmDelete(title);

    await projects.expectProjectGone(title);
  });
});
