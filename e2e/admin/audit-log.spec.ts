import { test, expect } from "@playwright/test";
import { LoginPom } from "../poms/LoginPom";
import { AdminShellPom } from "../poms/AdminShellPom";
import { AuditPom } from "../poms/AuditPom";
import { adminClient, readAuditLogs } from "../helpers/supabaseAdmin";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const SEED_SUFFIX = String(Date.now());

test.describe("audit log", () => {
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

  test("category filter group is visible after opening filter panel", async ({ page }) => {
    const audit = await signInAndGoto(page);
    await audit.openFilter();
    await expect(page.locator('[data-testid="audit-filter-category"]')).toBeVisible();
  });

  test("reset button clears search input", async ({ page }) => {
    const audit = await signInAndGoto(page);
    await audit.typeSearch("admin");
    await expect(audit.searchInput()).toHaveValue("admin");
    await audit.openFilter();
    await page.locator('[data-testid="audit-filter-reset"]').click();
    await expect(audit.searchInput()).toHaveValue("");
  });

  // ── Pagination tests (P2-4) ───────────────────────────────────────────────
  // Seeds 30 audit_log rows with distinct action codes (prevents bulk grouping)
  // and a unique actor_name so the server-side ilike search isolates them.

  test.describe("pagination", () => {
    const SEED_ACTOR = `P2-4-seed-${SEED_SUFFIX}`;
    const SEED_COUNT = 30;
    let seededIds: string[] = [];

    test.beforeAll(async () => {
      const rows = Array.from({ length: SEED_COUNT }, (_, i) => ({
        organization_id: E2E_PERIODS_ORG_ID,
        action: `p2.4.pg.${i}`,
        actor_name: SEED_ACTOR,
        category: "data",
        severity: "info",
        actor_type: "admin",
      }));
      const { data, error } = await adminClient
        .from("audit_logs")
        .insert(rows)
        .select("id");
      if (error) throw new Error(`pagination seed failed: ${error.message}`);
      seededIds = (data ?? []).map((r: { id: string }) => r.id);
    });

    test.afterAll(async () => {
      if (seededIds.length > 0) {
        await adminClient.from("audit_logs").delete().in("id", seededIds);
      }
    });

    test("page size 25 limits display to 25 rows with correct info text", async ({ page }) => {
      const audit = await signInAndGoto(page);
      await audit.typeSearch(SEED_ACTOR);
      // Wait for server-side search to settle on exactly 30 rows
      await expect(audit.rows()).toHaveCount(SEED_COUNT, { timeout: 15_000 });
      // Switch from default 50 to 25 per page
      await audit.pageSizeBtn(25).click();
      await expect(audit.rows()).toHaveCount(25);
      await expect(audit.pageInfo()).toContainText("1–25 of 30");
    });

    test("next page button advances to page 2 showing remaining 5 rows", async ({ page }) => {
      const audit = await signInAndGoto(page);
      await audit.typeSearch(SEED_ACTOR);
      await expect(audit.rows()).toHaveCount(SEED_COUNT, { timeout: 15_000 });
      await audit.pageSizeBtn(25).click();
      await expect(audit.rows()).toHaveCount(25);
      await audit.nextPageBtn().click();
      await expect(audit.rows()).toHaveCount(5);
      await expect(audit.pageInfo()).toContainText("26–30 of 30");
    });
  });
});

test.describe("audit log — content verification (E2)", () => {
  test("period create → audit_logs has periods.insert entry with correct org_id", async () => {
    const since = new Date().toISOString();
    const name = `E2 AuditPeriod ${Date.now()}`;
    const { data: period, error } = await adminClient
      .from("periods")
      .insert({ organization_id: E2E_PERIODS_ORG_ID, name, season: "Spring" })
      .select()
      .single();
    expect(error).toBeNull();

    const entries = await readAuditLogs(E2E_PERIODS_ORG_ID, "periods.insert", since);
    expect(entries.length).toBeGreaterThan(0);
    const entry = entries.find((e: any) => e.resource_id === period!.id);
    expect(entry).not.toBeUndefined();
    expect(entry!.organization_id).toBe(E2E_PERIODS_ORG_ID);
    expect(entry!.resource_type).toBe("periods");

    await adminClient.from("periods").delete().eq("id", period!.id);
  });

  test("juror delete → audit_logs has jurors.delete entry with correct resource_id", async () => {
    const { data: juror } = await adminClient
      .from("jurors")
      .insert({
        organization_id: E2E_PERIODS_ORG_ID,
        juror_name: `E2 AuditJuror ${Date.now()}`,
        affiliation: "E2 Test",
      })
      .select("id")
      .single();

    const since = new Date().toISOString();
    await adminClient.from("jurors").delete().eq("id", juror!.id);

    const entries = await readAuditLogs(E2E_PERIODS_ORG_ID, "jurors.delete", since);
    expect(entries.length).toBeGreaterThan(0);
    const entry = entries.find((e: any) => e.resource_id === juror!.id);
    expect(entry).not.toBeUndefined();
    expect(entry!.resource_type).toBe("jurors");
  });

  test("failed login → audit_logs has auth.admin.login.failure entry with correct actor_name", async () => {
    const testEmail = `e2-test-${Date.now()}@audit-test.invalid`;
    const since = new Date().toISOString();

    const { data, error } = await adminClient.rpc("rpc_write_auth_failure_event", {
      p_email: testEmail,
      p_method: "password",
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);

    const entries = await readAuditLogs(null, "auth.admin.login.failure", since, testEmail);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].actor_name).toBe(testEmail);
    expect(entries[0].details?.email).toBe(testEmail);
  });

  test("entry token insert → audit_logs has entry_tokens.insert entry for the correct period", async () => {
    const { data: period } = await adminClient
      .from("periods")
      .insert({
        organization_id: E2E_PERIODS_ORG_ID,
        name: `E2 TokenPeriod ${Date.now()}`,
        season: "Fall",
      })
      .select("id")
      .single();

    const since = new Date().toISOString();
    const tokenHash = `e2test${Date.now()}`;
    const { data: token } = await adminClient
      .from("entry_tokens")
      .insert({
        period_id: period!.id,
        token_hash: tokenHash,
        token_plain: tokenHash,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      })
      .select("id")
      .single();

    const entries = await readAuditLogs(E2E_PERIODS_ORG_ID, "entry_tokens.insert", since);
    expect(entries.length).toBeGreaterThan(0);
    const entry = entries.find((e: any) => e.resource_id === token!.id);
    expect(entry).not.toBeUndefined();
    expect(entry!.resource_type).toBe("entry_tokens");

    await adminClient.from("periods").delete().eq("id", period!.id);
  });

  test("project create → audit_logs has projects.insert entry with correct resource_id", async () => {
    const suffix = `${Date.now()}`;
    const { data: period } = await adminClient
      .from("periods")
      .insert({
        organization_id: E2E_PERIODS_ORG_ID,
        name: `E2 ProjectPeriod ${suffix}`,
        season: "Spring",
      })
      .select("id")
      .single();

    const since = new Date().toISOString();
    const { data: project } = await adminClient
      .from("projects")
      .insert({ period_id: period!.id, title: `E2 AuditProject ${suffix}`, members: [] })
      .select("id")
      .single();

    const entries = await readAuditLogs(E2E_PERIODS_ORG_ID, "projects.insert", since);
    expect(entries.length).toBeGreaterThan(0);
    const entry = entries.find((e: any) => e.resource_id === project!.id);
    expect(entry).not.toBeUndefined();
    expect(entry!.resource_type).toBe("projects");

    await adminClient.from("periods").delete().eq("id", period!.id);
  });
});
