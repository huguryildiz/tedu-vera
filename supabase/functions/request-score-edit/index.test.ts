import { assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
  clearSupabaseEnv,
  makeRequest,
  readJson,
  setDefaultEnv,
  stubFetch,
} from "../_test/harness.ts";
import { resetMockConfig, setMockConfig } from "../_test/mock-supabase.ts";

const modulePath = new URL("./index.ts", import.meta.url).href;

async function setup() {
  setDefaultEnv();
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  return handler;
}

// qa: edge.real.request-score-edit.01
Deno.test("request-score-edit — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// qa: edge.real.request-score-edit.02
Deno.test("request-score-edit — missing required fields returns 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: { jurorName: "Ali" } }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error.includes("Missing required fields"), true);
});

// qa: edge.real.request-score-edit.03
Deno.test("request-score-edit — missing Supabase env returns 500", async () => {
  const handler = await setup();
  clearSupabaseEnv();
  const res = await handler(makeRequest({
    body: { periodId: "p1", jurorName: "Ali", sessionToken: "tok" },
  }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { ok: boolean; error: string };
  assertEquals(body.ok, false);
  assertEquals(body.error, "Service client unavailable");
  setDefaultEnv();
});

// qa: edge.real.request-score-edit.04
Deno.test("request-score-edit — invalid session token returns 401", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      juror_period_auth: { selectMaybeSingle: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    body: { periodId: "p1", jurorName: "Ali", sessionToken: "bad-token" },
  }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { ok: boolean; error: string };
  assertEquals(body.ok, false);
  assertEquals(body.error, "Invalid or expired session");
});

// qa: edge.real.request-score-edit.05
Deno.test("request-score-edit — period not found returns 404", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      juror_period_auth: { selectMaybeSingle: { data: { juror_id: "j1" }, error: null } },
      periods: { selectSingle: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    body: { periodId: "p1", jurorName: "Ali", sessionToken: "valid-tok" },
  }));
  assertEquals(res.status, 404);
  const body = await readJson(res) as { ok: boolean; error: string };
  assertEquals(body.ok, false);
  assertEquals(body.error, "Period not found");
});

// qa: edge.real.request-score-edit.07
Deno.test("request-score-edit — session token for period-A does not validate for period-B (cross-period boundary) → 401", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      juror_period_auth: { selectMaybeSingle: { data: null, error: null } },
    },
  });
  // Token is valid for period-A but request targets period-B — DB returns no match
  const res = await handler(makeRequest({
    body: { periodId: "period-B", jurorName: "Ali", sessionToken: "token-for-period-A" },
  }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { ok: boolean; error: string };
  assertEquals(body.ok, false);
  assertEquals(body.error, "Invalid or expired session");
});

// qa: edge.real.request-score-edit.06
Deno.test("request-score-edit — no RESEND_API_KEY returns 200 sent:false", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      juror_period_auth: { selectMaybeSingle: { data: { juror_id: "j1" }, error: null } },
      periods: {
        selectSingle: {
          data: {
            name: "Spring 2026",
            organization_id: "org-1",
            organizations: { name: "Org1", contact_email: "contact@org.com" },
          },
          error: null,
        },
      },
      memberships: { selectList: { data: [], error: null } },
      security_policy: { selectSingle: { data: null, error: null } },
      audit_logs: { insert: { data: null, error: null } },
    },
  });
  const restoreFetch = stubFetch(async () =>
    new Response(JSON.stringify({ id: "email-id" }), { status: 200 })
  );
  try {
    const res = await handler(makeRequest({
      body: { periodId: "p1", jurorName: "Ali Yıldız", sessionToken: "valid-tok" },
    }));
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean; sent: boolean; error?: string };
    assertEquals(body.ok, true);
    assertEquals(body.sent, false);
    assertEquals(body.error, "RESEND_API_KEY not configured");
  } finally {
    restoreFetch();
  }
});
