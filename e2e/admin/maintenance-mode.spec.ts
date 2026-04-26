import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { OrgsPom } from "../poms/OrgsPom";
import { adminClient } from "../helpers/supabaseAdmin";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:5174";

test.describe("maintenance mode", () => {
  test.describe.configure({ mode: "serial" });

  // Ensure maintenance is OFF before tests run
  test.beforeAll(async () => {
    const { data, error } = await adminClient
      .from("maintenance_mode")
      .select("*")
      .eq("id", 1)
      .single();
    if (!error && data?.is_active) {
      const { error: updateErr } = await adminClient
        .from("maintenance_mode")
        .update({ is_active: false, end_time: null })
        .eq("id", 1);
      if (updateErr) throw new Error(`Failed to reset maintenance: ${updateErr.message}`);
    }
  });

  // Ensure maintenance is OFF after all tests complete
  test.afterAll(async () => {
    const { error } = await adminClient
      .from("maintenance_mode")
      .update({ is_active: false, start_time: null, end_time: null })
      .eq("id", 1);
    if (error) console.error("Failed to reset maintenance after tests:", error);
  });

  async function signInAndGotoOrgs(page: Parameters<Parameters<typeof test>[1]>[0]["page"]) {
    // Suppress the guided tour and preserve auth state
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

  test("activate immediate maintenance via admin drawer", async ({ page }) => {
    await signInAndGotoOrgs(page);

    // Open maintenance drawer from Platform Governance section
    const maintenanceBtn = page.getByRole("button", { name: "Maintenance" });
    await expect(maintenanceBtn).toBeVisible({ timeout: 10_000 });
    await maintenanceBtn.click();

    // Wait for maintenance drawer to open
    const drawerTitle = page.getByText("Maintenance Mode");
    await expect(drawerTitle).toBeVisible();

    // Set to immediate mode
    const immediateRadio = page.locator('input[type="radio"][value="immediate"]');
    await expect(immediateRadio).toBeVisible();
    await immediateRadio.click();

    // Clear and set message
    const messageInput = page.locator('textarea').first();
    await messageInput.fill("E2E Test: Maintenance Active");

    // Activate maintenance
    const activateBtn = page.getByRole("button", { name: /Activate Now/i });
    await expect(activateBtn).toBeVisible();
    await activateBtn.click();

    // Expect success toast
    const successToast = page.getByText("Maintenance activated", { exact: false });
    await expect(successToast).toBeVisible({ timeout: 5000 });

    // Verify DB state: maintenance_mode table has is_active=true
    const { data, error } = await adminClient
      .from("maintenance_mode")
      .select("*")
      .eq("id", 1)
      .single();

    console.log("[Test1] DB state after activation:", { data, error });
    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.is_active).toBe(true);
    expect(data.mode).toBe("immediate");
    expect(data.message).toBe("E2E Test: Maintenance Active");
    console.log("[Test1] About to complete, is_active should still be true");
  });

  test("public RPC returns maintenance status to anon user", async () => {
    // Verify DB state before calling RPC
    const { data: dbBefore, error: dbErr } = await adminClient
      .from("maintenance_mode")
      .select("*")
      .eq("id", 1)
      .single();
    console.log("[Test2] DB state before RPC:", { dbBefore, dbErr });

    // Call rpc_public_maintenance_status from anon context via service role
    const { data, error } = await adminClient.rpc("rpc_public_maintenance_status", {});
    console.log("[Test2] RPC returned:", { data, error });

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.is_active).toBe(true);
    expect(data.mode).toBe("immediate");
    expect(data.message).toBe("E2E Test: Maintenance Active");
    // RPC returns maintenance status fields
    expect(data).toHaveProperty("is_active");
    expect(data).toHaveProperty("mode");
  });

  test("non-admin user sees maintenance page at /eval", async ({ browser, page: adminPage }) => {
    // Ensure maintenance is active before test (in case previous test left it in unknown state)
    const { error: updateErr } = await adminClient
      .from("maintenance_mode")
      .update({
        is_active: true,
        mode: "immediate",
        message: "E2E Test: Maintenance Active",
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      .eq("id", 1);
    expect(updateErr).toBeNull();

    // First, verify raw DB state and RPC result from admin context
    const { data: rawDbData, error: dbErr } = await adminClient
      .from("maintenance_mode")
      .select("*")
      .eq("id", 1)
      .single();
    console.log("[maintenance-mode.spec.ts] Raw DB state before anon test:", { rawDbData, error: dbErr });

    const { data: verifyData, error: rpcErr } = await adminClient.rpc("rpc_public_maintenance_status", {});
    console.log("[maintenance-mode.spec.ts] Maintenance status before anon test (admin RPC context):", { verifyData, error: rpcErr });

    // Log environment info
    console.log("[maintenance-mode.spec.ts] E2E_SUPABASE_URL:", process.env.E2E_SUPABASE_URL);
    console.log("[maintenance-mode.spec.ts] BASE_URL:", BASE_URL);

    // Create a new context without authentication (anonymous user)
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();

    // Capture console messages for debugging
    const consoleLogs: string[] = [];
    anonPage.on("console", (msg) => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    try {
      // Navigate to /eval (jury entry page)
      await anonPage.goto(`${BASE_URL}/eval`);

      // Wait for the page to be fully loaded and MaintenanceGate to have time to fetch status
      await anonPage.waitForLoadState("networkidle");
      await anonPage.waitForTimeout(3000);

      // Check if maintenance heading exists
      const maintenanceHeading = anonPage.getByText("Scheduled Maintenance");
      const hasHeading = await maintenanceHeading.isVisible({ timeout: 5000 }).catch(() => false);

      if (!hasHeading) {
        console.log("[maintenance-mode.spec.ts] Console logs from anon page:");
        consoleLogs.forEach((log) => console.log(log));

        // Log the actual page content to understand what's being rendered
        const pageContent = await anonPage.content();
        console.log("[maintenance-mode.spec.ts] Page length:", pageContent.length);
        console.log("[maintenance-mode.spec.ts] Contains 'Scheduled Maintenance':", pageContent.includes("Scheduled Maintenance"));
        console.log("[maintenance-mode.spec.ts] Contains 'Enter Your Access Code':", pageContent.includes("Enter Your Access Code"));

        // Try calling the RPC directly from the anon page context after load
        console.log("[maintenance-mode.spec.ts] Attempting direct RPC call from anon page...");
        const result = await anonPage.evaluate(async () => {
          try {
            const { data, error } = await (window as any).supabase.rpc("rpc_public_maintenance_status");
            return { data, error };
          } catch (e) {
            return { error: String(e) };
          }
        });
        console.log("[maintenance-mode.spec.ts] Direct RPC call result from anon page:", result);
      }

      expect(hasHeading).toBe(true);
    } finally {
      await anonContext.close();
    }
  });

  test("deactivate maintenance via admin drawer", async ({ page }) => {
    await signInAndGotoOrgs(page);

    // Open maintenance drawer from Platform Governance section
    const maintenanceBtn = page.getByRole("button", { name: "Maintenance" });
    await expect(maintenanceBtn).toBeVisible({ timeout: 10_000 });
    await maintenanceBtn.click();

    // Wait for maintenance drawer to open
    const drawerTitle = page.getByText("Maintenance Mode");
    await expect(drawerTitle).toBeVisible();

    // Click cancel button
    const cancelBtn = page.getByRole("button", { name: /Cancel Maintenance/i });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    // Expect success toast
    const successToast = page.getByText("Maintenance cancelled", { exact: false });
    await expect(successToast).toBeVisible({ timeout: 5000 });

    // Verify DB state: maintenance_mode table has is_active=false
    const { data, error } = await adminClient
      .from("maintenance_mode")
      .select("*")
      .eq("id", 1)
      .single();

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(data.is_active).toBe(false);
  });

  test("anon user no longer sees maintenance page after deactivation", async ({ browser }) => {
    // Create a new context without authentication
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();

    try {
      // Navigate to /eval
      await anonPage.goto(`${BASE_URL}/eval`);
      await anonPage.waitForLoadState("networkidle");

      // Maintenance screen should NOT be visible
      const maintenanceHeading = anonPage.getByText("Scheduled Maintenance");
      const messageText = anonPage.getByText("E2E Test: Maintenance Active");

      // Both should be hidden or not present
      const hasHeading = await maintenanceHeading.isVisible().catch(() => false);
      const hasMessage = await messageText.isVisible().catch(() => false);

      expect(hasHeading || hasMessage).toBe(false);
    } finally {
      await anonContext.close();
    }
  });
});
