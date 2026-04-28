import { test, expect } from "@playwright/test";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

// demo read-only enforcement: writes to demo org rejected for non-demo callers
//
// The demo Supabase project enforces RLS — an unauthenticated request (no JWT)
// or a JWT for a different org must not be able to mutate demo data.
// This spec verifies that direct REST API writes are rejected (0 rows affected).

const DEMO_URL =
  process.env.VITE_DEMO_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const DEMO_ANON_KEY =
  process.env.VITE_DEMO_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

test.describe("demo write reject — demo org read-only for unauthenticated callers", () => {
  test("unauthenticated REST PATCH to demo org organizations is rejected", async ({
    request,
  }) => {
    // demo write reject: no-JWT PATCH must not modify any row (RLS blocks anonymous writes)
    const res = await request.patch(
      `${DEMO_URL}/rest/v1/organizations?id=eq.${E2E_PERIODS_ORG_ID}`,
      {
        headers: {
          apikey: DEMO_ANON_KEY,
          // Deliberately omit Authorization header — anonymous caller
          "Content-Type": "application/json",
          Prefer: "return=representation,count=exact",
        },
        data: { name: "demo-write-reject-probe" },
      },
    );
    // RLS must silently block the write: 200 with 0 rows, or a 4xx rejection
    const affectedRows = parseInt(
      res.headers()["content-range"]?.split("/")[1] ?? "0",
      10,
    );
    const status = res.status();
    const isBlocked =
      (status >= 400 && status < 600) ||
      ((status === 200 || status === 206) && affectedRows === 0);
    expect(
      isBlocked,
      `demo write reject PATCH: status=${status} affectedRows=${affectedRows}`,
    ).toBe(true);
  });

  test("unauthenticated REST DELETE on demo org projects is rejected", async ({
    request,
  }) => {
    // demo read-only: anon delete must affect 0 rows
    const res = await request.delete(
      `${DEMO_URL}/rest/v1/projects?organization_id=eq.${E2E_PERIODS_ORG_ID}`,
      {
        headers: {
          apikey: DEMO_ANON_KEY,
          "Content-Type": "application/json",
          Prefer: "return=minimal,count=exact",
        },
      },
    );
    const affectedRows = parseInt(
      res.headers()["content-range"]?.split("/")[1] ?? "0",
      10,
    );
    // demo read-only DELETE: any 4xx/5xx is a rejection by the server (PostgREST
    // can also return 400 for unsupported DELETE shapes), or success status with
    // 0 affected rows means RLS silently filtered the write to a no-op.
    const status = res.status();
    const isBlocked =
      (status >= 400 && status < 600) ||
      ((status === 200 || status === 204) && affectedRows === 0);
    expect(
      isBlocked,
      `demo write reject DELETE: status=${status} affectedRows=${affectedRows}`,
    ).toBe(true);
  });
});
