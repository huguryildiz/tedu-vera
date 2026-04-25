import { test, expect } from "@playwright/test";
import { adminClient } from "../helpers/supabaseAdmin";
import { E2E_PERIODS_ORG_ID, E2E_PROJECTS_ORG_ID } from "../fixtures/seed-ids";

// Cross-tenant RBAC boundary: Supabase RLS must prevent a tenant-admin from
// mutating (PATCH/DELETE) another tenant's data via direct REST API.
//
// Demo org IDs (pre-seeded):
//   E2E_PERIODS_ORG_ID   — the org the tenant-admin belongs to
//   E2E_PROJECTS_ORG_ID  — a different tenant's org (used to verify isolation)

const SUPABASE_URL = process.env.VITE_DEMO_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const TENANT_EMAIL = "tenant-admin@vera-eval.app";
const TENANT_PASSWORD = "TenantAdmin2026!";

async function getTenantJwt(
  request: Parameters<Parameters<typeof test>[1]>[0]["request"],
): Promise<string> {
  const res = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: {
      apikey: process.env.VITE_DEMO_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
    },
    data: { email: TENANT_EMAIL, password: TENANT_PASSWORD },
  });
  const body = await res.json();
  return body.access_token as string;
}

test.describe("RBAC boundary (tenant-admin cross-org mutation)", () => {
  test("tenant-admin-A cannot update org-B period via REST", async ({ request }) => {
    const jwt = await getTenantJwt(request);
    const anonKey = process.env.VITE_DEMO_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

    // Use adminClient (service role) to fetch a period from Org B (E2E_PROJECTS_ORG_ID)
    const { data: periods } = await adminClient
      .from("periods")
      .select("id, name")
      .eq("organization_id", E2E_PROJECTS_ORG_ID)
      .limit(1);

    if (!periods || periods.length === 0) {
      // Skip if E2E_PROJECTS_ORG_ID has no periods (valid test dependency)
      test.skip();
    }

    const periodId = periods![0].id;
    const originalName = periods![0].name;

    // Attempt to PATCH the period with tenant A's JWT
    const res = await request.patch(
      `${SUPABASE_URL}/rest/v1/periods?id=eq.${periodId}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        data: { name: "RBAC-HACKED" },
      },
    );

    // PostgREST returns 200 with empty array if RLS blocks the row
    expect(res.ok()).toBe(true);
    const responseRows = await res.json();
    expect(Array.isArray(responseRows)).toBe(true);
    expect(responseRows.length).toBe(0); // RLS blocks the update, returns empty result

    // Verify the period name is still unchanged in the database
    const { data: verifyData } = await adminClient
      .from("periods")
      .select("name")
      .eq("id", periodId)
      .single();

    expect(verifyData?.name).toBe(originalName);
  });

  test("tenant-admin-A cannot delete org-B juror via REST", async ({ request }) => {
    const jwt = await getTenantJwt(request);
    const anonKey = process.env.VITE_DEMO_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

    // Use adminClient (service role) to fetch a juror from Org B (E2E_PROJECTS_ORG_ID)
    const { data: jurors } = await adminClient
      .from("jurors")
      .select("id")
      .eq("organization_id", E2E_PROJECTS_ORG_ID)
      .limit(1);

    if (!jurors || jurors.length === 0) {
      // Skip if E2E_PROJECTS_ORG_ID has no jurors (valid test dependency)
      test.skip();
    }

    const jurorId = jurors![0].id;

    // Attempt to DELETE the juror with tenant A's JWT
    const res = await request.delete(
      `${SUPABASE_URL}/rest/v1/jurors?id=eq.${jurorId}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${jwt}`,
          Prefer: "return=representation",
        },
      },
    );

    // PostgREST returns 200 with empty array if RLS blocks the row
    expect(res.ok()).toBe(true);
    const responseRows = await res.json();
    expect(Array.isArray(responseRows)).toBe(true);
    expect(responseRows.length).toBe(0); // RLS blocks the delete, returns empty result

    // Verify the juror still exists in the database
    const { data: verifyData } = await adminClient
      .from("jurors")
      .select("id")
      .eq("id", jurorId)
      .single();

    expect(verifyData?.id).toBe(jurorId);
  });
});

test.describe("deliberately-break evidence (RBAC boundary)", () => {
  test("tenant-admin can update own-org period (proves RLS is enforced)", async ({ request }) => {
    const jwt = await getTenantJwt(request);
    const anonKey = process.env.VITE_DEMO_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

    // Use adminClient to fetch a period from tenant A's own org (E2E_PERIODS_ORG_ID)
    const { data: periods } = await adminClient
      .from("periods")
      .select("id, name")
      .eq("organization_id", E2E_PERIODS_ORG_ID)
      .limit(1);

    if (!periods || periods.length === 0) {
      // Skip if E2E_PERIODS_ORG_ID has no periods (valid test dependency)
      test.skip();
    }

    const periodId = periods![0].id;
    const originalName = periods![0].name;
    const testName = `E2E-TEST-${Date.now()}`;

    // Attempt to PATCH the period with tenant A's JWT (same org)
    const res = await request.patch(
      `${SUPABASE_URL}/rest/v1/periods?id=eq.${periodId}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        data: { name: testName },
      },
    );

    expect(res.ok()).toBe(true);
    const responseRows = await res.json();
    expect(Array.isArray(responseRows)).toBe(true);

    // Update should succeed (at least 1 row affected)
    expect(responseRows.length).toBeGreaterThan(0);
    expect(responseRows[0].name).toBe(testName);

    // Restore the original name
    await adminClient.from("periods").update({ name: originalName }).eq("id", periodId);
  });
});
