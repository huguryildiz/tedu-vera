// Real Deno tests for notify-juror/index.ts.
// Namespace: edge.notify-juror.*
//
// Covers: OPTIONS, bearer token auth (own logic, not requireAdminCaller),
// admin membership gate, body validation (juror_id + period_id required),
// juror lookup failures (404 / 422), period lookup failure (404), and
// the hard-failure path when RESEND_API_KEY is absent → 500.

import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
  makeRequest,
  readJson,
  setDefaultEnv,
  stubFetch,
} from "../_test/harness.ts";
import { resetMockConfig, setMockConfig } from "../_test/mock-supabase.ts";

const modulePath = new URL("./index.ts", import.meta.url).href;

async function setup() {
  setDefaultEnv();
  Deno.env.delete("RESEND_API_KEY");
  Deno.env.delete("NOTIFICATION_FROM");
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  return handler;
}

/** Mock valid auth: authGetUser resolves + membership maybySingle returns a row. */
function mockValidAuth() {
  setMockConfig({
    authGetUser: { data: { user: { id: "user-1" } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: {
          data: { organization_id: "org-1", role: "org_admin" },
          error: null,
        },
      },
    },
  });
}

/** Full happy-path mock up to the email-send step (RESEND absent → 500). */
function mockFullPath() {
  setMockConfig({
    authGetUser: { data: { user: { id: "user-1" } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: {
          data: { organization_id: "org-1", role: "org_admin" },
          error: null,
        },
      },
      jurors: {
        selectSingle: {
          data: { juror_name: "Ali Veli", email: "ali@test.com" },
          error: null,
        },
      },
      periods: {
        selectSingle: {
          data: { id: "p-1", name: "Spring 2026", organization_id: "org-1" },
          error: null,
        },
      },
      audit_logs: { insert: { data: null, error: null } },
    },
  });
}

// qa: edge.notify-juror.01
Deno.test("notify-juror — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  assertEquals(typeof res.headers.get("access-control-allow-origin"), "string");
});

// qa: edge.notify-juror.02
Deno.test("notify-juror — missing bearer token returns 401", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: {} }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Missing bearer token");
  assertEquals(typeof body.error, "string");
});

// qa: edge.notify-juror.03
Deno.test("notify-juror — invalid auth token returns 401", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: null }, error: { message: "Invalid JWT" } },
  });
  const res = await handler(makeRequest({
    token: "bad-token",
    body: { juror_id: "j-1", period_id: "p-1" },
  }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(typeof body.error, "string");
});

// qa: edge.notify-juror.04
Deno.test("notify-juror — non-admin user returns 403", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "user-2" } }, error: null },
    tables: {
      memberships: { selectMaybeSingle: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    token: "tok",
    body: { juror_id: "j-1", period_id: "p-1" },
  }));
  assertEquals(res.status, 403);
  const body = await readJson(res) as { error: string };
  assertEquals(typeof body.error, "string");
});

// qa: edge.notify-juror.05
Deno.test("notify-juror — missing juror_id returns 400", async () => {
  const handler = await setup();
  mockValidAuth();
  const res = await handler(makeRequest({
    token: "tok",
    body: { period_id: "p-1" },
  }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "juror_id and period_id are required");
  assertEquals(typeof body.error, "string");
});

// qa: edge.notify-juror.06
Deno.test("notify-juror — missing period_id returns 400", async () => {
  const handler = await setup();
  mockValidAuth();
  const res = await handler(makeRequest({
    token: "tok",
    body: { juror_id: "j-1" },
  }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "juror_id and period_id are required");
  assertEquals(typeof body.error, "string");
});

// qa: edge.notify-juror.07
Deno.test("notify-juror — juror not found returns 404", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "user-1" } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: {
          data: { organization_id: "org-1", role: "org_admin" },
          error: null,
        },
      },
      jurors: { selectSingle: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    token: "tok",
    body: { juror_id: "missing-j", period_id: "p-1" },
  }));
  assertEquals(res.status, 404);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Juror not found");
  assertEquals(typeof body.error, "string");
});

// qa: edge.notify-juror.08
Deno.test("notify-juror — juror has no email returns 422", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "user-1" } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: {
          data: { organization_id: "org-1", role: "org_admin" },
          error: null,
        },
      },
      jurors: { selectSingle: { data: { juror_name: "Ali Veli", email: "" }, error: null } },
    },
  });
  const res = await handler(makeRequest({
    token: "tok",
    body: { juror_id: "j-1", period_id: "p-1" },
  }));
  assertEquals(res.status, 422);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Juror has no email address");
  assertEquals(typeof body.error, "string");
});

// qa: edge.notify-juror.09
Deno.test("notify-juror — period not found returns 404", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "user-1" } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: {
          data: { organization_id: "org-1", role: "org_admin" },
          error: null,
        },
      },
      jurors: {
        selectSingle: {
          data: { juror_name: "Ali Veli", email: "ali@test.com" },
          error: null,
        },
      },
      periods: { selectSingle: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    token: "tok",
    body: { juror_id: "j-1", period_id: "missing-p" },
  }));
  assertEquals(res.status, 404);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Period not found");
  assertEquals(typeof body.error, "string");
});

// qa: edge.notify-juror.10
Deno.test(
  "notify-juror — RESEND_API_KEY absent → 500 with sent=false (hard failure)",
  async () => {
    const handler = await setup();
    mockFullPath();
    const res = await handler(makeRequest({
      token: "tok",
      body: { juror_id: "j-1", period_id: "p-1" },
    }));
    assertEquals(res.status, 500);
    const body = await readJson(res) as { ok: boolean; sent: boolean; error: string };
    assertEquals(body.ok, false);
    assertEquals(typeof body.ok, "boolean");
    assertEquals(body.sent, false);
    assertEquals(typeof body.sent, "boolean");
    assert(body.error.length > 0);
    assertEquals(typeof body.error, "string");
  },
);

// ── edge.real namespace ────────────────────────────────────────────────────

// qa: edge.real.notify-juror.01
Deno.test("notify-juror — missing Authorization → 401", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: { juror_id: "j-1", period_id: "p-1" } }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Missing bearer token");
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.notify-juror.02
Deno.test("notify-juror — non-admin membership → 403", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "user-x" } }, error: null },
    tables: {
      memberships: { selectMaybeSingle: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({ token: "jwt", body: { juror_id: "j-1", period_id: "p-1" } }));
  assertEquals(res.status, 403);
});

// qa: edge.real.notify-juror.03
Deno.test("notify-juror — Resend success → 200 sent=true, juror email in payload", async () => {
  const handler = await setup();
  Deno.env.set("RESEND_API_KEY", "re_test");
  mockFullPath();

  const fetchCalls: Array<{ url: string; body: string }> = [];
  const restore = stubFetch(async (input, init) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    fetchCalls.push({ url, body: (init?.body ?? "").toString() });
    return new Response(JSON.stringify({ id: "email-ok" }), { status: 200 });
  });
  try {
    const res = await handler(makeRequest({ token: "jwt", body: { juror_id: "j-1", period_id: "p-1" } }));
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean; sent: boolean };
    assertEquals(body.ok, true);
    assertEquals(typeof body.ok, "boolean");
    assertEquals(body.sent, true);
    assertEquals(typeof body.sent, "boolean");
    assert(fetchCalls.length >= 1, "expected Resend fetch");
    assertEquals(fetchCalls[0].url, "https://api.resend.com/emails");
    assert(fetchCalls[0].body.includes("ali@test.com"), "expected juror email in Resend payload");
  } finally {
    restore();
    Deno.env.delete("RESEND_API_KEY");
  }
});

// qa: edge.real.notify-juror.04
Deno.test("notify-juror — Resend non-2xx (429) → 500 sent=false", async () => {
  const handler = await setup();
  Deno.env.set("RESEND_API_KEY", "re_test");
  mockFullPath();

  const restore = stubFetch(async () => new Response("rate limited", { status: 429 }));
  try {
    const res = await handler(makeRequest({ token: "jwt", body: { juror_id: "j-1", period_id: "p-1" } }));
    assertEquals(res.status, 500);
    const body = await readJson(res) as { ok: boolean; sent: boolean; error?: string };
    assertEquals(body.ok, false);
    assertEquals(typeof body.ok, "boolean");
    assertEquals(body.sent, false);
    assertEquals(typeof body.sent, "boolean");
    assert(body.error && body.error.includes("Resend"));
    assertEquals(typeof body.error, "string");
  } finally {
    restore();
    Deno.env.delete("RESEND_API_KEY");
  }
});
