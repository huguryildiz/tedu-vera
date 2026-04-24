import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { ProjectsPom } from "../poms/ProjectsPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const E2E_PROJECTS_ORG_ID = "c3d4e5f6-a7b8-9012-cdef-123456789012";

test.describe("projects csv import", () => {
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

  test("import — csv projects appear in table", async ({ page }) => {
    const projects = await signInAndGoto(page);

    // Use unique titles to avoid conflicts on repeated test runs
    const tag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const title1 = `E2E Import A-${tag}`;
    const title2 = `E2E Import B-${tag}`;
    const csvContent = `Title,Team Members\n${title1},Alice Test; Bob Demo\n${title2},Carol Sample`;

    // Open import modal
    await projects.openImportModal();

    // Upload in-memory CSV
    await projects.uploadCsvInMemory(csvContent);

    // Wait for preview (the submit button enables when validCount > 0 and file is set)
    await expect(projects.importSubmitBtn()).toBeEnabled({ timeout: 10000 });

    // Submit import
    await projects.submitImport();

    // Close success screen
    await projects.closeImportModal();

    // Verify rows appear in the table
    await projects.expectProjectVisible(title1);
    await projects.expectProjectVisible(title2);

    // Cleanup
    await projects.clickDeleteFor(title1);
    await projects.confirmDelete(title1);
    await projects.clickDeleteFor(title2);
    await projects.confirmDelete(title2);
  });
});
