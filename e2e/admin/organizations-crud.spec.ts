import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { OrgsPom } from "../poms/OrgsPom";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

const ORG_NAME = "B3 E2E Test Organization";
const ORG_CODE = "B3E2E";
const ORG_EMAIL = "b3test@e2e.local";
const ORG_NAME_EDITED = "B3 E2E Test Organization — Edited";

test.describe("organizations crud", () => {
  test.describe.configure({ mode: "serial" });

  async function signInAndGotoOrgs(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    // Suppress the guided tour before any navigation so it never fires.
    // Also set remember_me=true so AuthProvider does not call clearPersistedSession
    // after sign-in — which would otherwise wipe the sb-*-auth-token key and leave
    // subsequent PostgREST RPC calls unauthenticated.
    await page.addInitScript(() => {
      try {
        localStorage.setItem("vera.admin_tour_done", "1");
        localStorage.setItem("admin.remember_me", "true");
      } catch {}
    });
    const login = new LoginPom(page);
    const shell = new AdminShellPom(page);
    const orgs = new OrgsPom(page);
    await login.goto();
    await login.signIn(EMAIL, PASSWORD);
    await shell.expectOnDashboard();
    await shell.clickNav("organizations");
    await orgs.waitForReady();
    return orgs;
  }

  test("create — new org appears in the table", async ({ page }) => {
    const orgs = await signInAndGotoOrgs(page);
    await orgs.openCreateDrawer();
    await orgs.fillCreateForm(ORG_NAME, ORG_CODE, ORG_EMAIL);
    await orgs.saveCreate();
    await orgs.expectOrgRowVisible(ORG_NAME);
  });

  test("edit — update org name reflects in the table", async ({ page }) => {
    const orgs = await signInAndGotoOrgs(page);
    await orgs.clickEditForOrg(ORG_NAME);
    await expect(orgs.editDrawerName()).toBeVisible();
    await orgs.fillEditName(ORG_NAME_EDITED);
    await orgs.saveEdit();
    await orgs.expectOrgRowVisible(ORG_NAME_EDITED);
  });

  test("delete — confirm-code removes the org row", async ({ page }) => {
    const orgs = await signInAndGotoOrgs(page);
    await orgs.clickDeleteForOrg(ORG_NAME_EDITED);
    await expect(orgs.deleteCodeInput()).toBeVisible();
    await orgs.confirmDelete(ORG_CODE);
    await orgs.expectOrgRowGone(ORG_NAME_EDITED);
  });

  test("create validation — empty name keeps drawer open", async ({ page }) => {
    const orgs = await signInAndGotoOrgs(page);
    await orgs.openCreateDrawer();
    await orgs.drawerCode().fill("BADTEST");
    await orgs.drawerContactEmail().fill("bad@test.local");
    // Per ui-conventions: with the required name field empty, Save must be
    // disabled (the disabled-Save + red-ring pair). Drawer stays open.
    await expect(orgs.drawerSave()).toBeDisabled();
    await expect(orgs.drawerSave()).toBeVisible();
    await expect(orgs.drawerCancel()).toBeVisible();
  });
});
