// Real Deno tests for notify-unlock-request/index.ts.
// Namespace: edge.unlock-request.*
//
// Covers: OPTIONS, invalid JSON (catch → 500), field validation (type +
// request_id required), request_submitted with no RESEND (200 sent=false),
// request_submitted with Resend success (200 sent=true), request_resolved with
// requester email (200 sent=true), and the "No recipient email resolved" path
// when RESEND is set but there are no super-admin emails.

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

// qa: edge.unlock-request.01
Deno.test("notify-unlock-request — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// qa: edge.unlock-request.02
Deno.test("notify-unlock-request — invalid JSON body → 500 with error message", async () => {
  const handler = await setup();
  const req = new Request("http://localhost/fn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{bad json",
  });
  const res = await handler(req);
  assertEquals(res.status, 500);
  const body = await readJson(res) as { ok: boolean; error: string };
  assertEquals(body.ok, false);
  assert(body.error.length > 0);
});

// qa: edge.unlock-request.03
Deno.test("notify-unlock-request — missing type returns 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({
    body: { request_id: "r-1", period_name: "Spring" },
  }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assert(body.error.includes("type"));
});

// qa: edge.unlock-request.04
Deno.test("notify-unlock-request — missing request_id returns 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({
    body: { type: "request_submitted" },
  }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assert(body.error.includes("request_id"));
});

// qa: edge.unlock-request.05
Deno.test(
  "notify-unlock-request — request_submitted, no RESEND_API_KEY → 200 sent=false",
  async () => {
    const handler = await setup();
    // Mock super-admin lookup (used even when resendKey absent, before the condition).
    setMockConfig({
      tables: {
        memberships: {
          selectList: { data: [{ user_id: "sa-1" }], error: null },
        },
        audit_logs: { insert: { data: null, error: null } },
      },
      adminGetUserById: {
        "sa-1": { data: { user: { id: "sa-1", email: "sa@vera.app" } }, error: null },
      },
    });
    const res = await handler(makeRequest({
      body: {
        type: "request_submitted",
        request_id: "r-1",
        period_name: "Spring 2026",
        organization_name: "TEDU",
        requester_name: "Ali",
        reason: "Need to fix scores",
      },
    }));
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean; sent: boolean; error?: string };
    assertEquals(body.ok, true);
    assertEquals(body.sent, false);
    assertEquals(body.error, "RESEND_API_KEY not configured");
  },
);

// qa: edge.unlock-request.06
Deno.test(
  "notify-unlock-request — request_submitted with Resend → 200 sent=true",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    setMockConfig({
      tables: {
        memberships: {
          selectList: { data: [{ user_id: "sa-1" }], error: null },
        },
        audit_logs: { insert: { data: null, error: null } },
      },
      adminGetUserById: {
        "sa-1": { data: { user: { id: "sa-1", email: "sa@vera.app" } }, error: null },
      },
    });

    const fetchCalls: string[] = [];
    const restore = stubFetch(async (input) => {
      fetchCalls.push(typeof input === "string" ? input : (input as URL).toString());
      return new Response(JSON.stringify({ id: "re_ok" }), { status: 200 });
    });
    try {
      const res = await handler(makeRequest({
        body: {
          type: "request_submitted",
          request_id: "r-1",
          period_name: "Spring 2026",
          organization_name: "TEDU",
          requester_name: "Ali",
        },
      }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean; sent: boolean };
      assertEquals(body.ok, true);
      assertEquals(body.sent, true);
      assert(fetchCalls.length >= 1);
    } finally {
      restore();
      Deno.env.delete("RESEND_API_KEY");
    }
  },
);

// qa: edge.unlock-request.07
Deno.test(
  "notify-unlock-request — request_resolved with requester email → 200 sent=true",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    setMockConfig({
      tables: {
        audit_logs: { insert: { data: null, error: null } },
      },
      adminGetUserById: {
        "req-1": {
          data: { user: { id: "req-1", email: "requester@tedu.edu" } },
          error: null,
        },
      },
    });

    const restore = stubFetch(async () =>
      new Response(JSON.stringify({ id: "re_ok" }), { status: 200 })
    );
    try {
      const res = await handler(makeRequest({
        body: {
          type: "request_resolved",
          request_id: "r-1",
          requester_user_id: "req-1",
          period_name: "Spring 2026",
          organization_name: "TEDU",
          decision: "approved",
        },
      }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean; sent: boolean };
      assertEquals(body.ok, true);
      assertEquals(body.sent, true);
    } finally {
      restore();
      Deno.env.delete("RESEND_API_KEY");
    }
  },
);

// qa: edge.unlock-request.08
Deno.test(
  "notify-unlock-request — request_submitted, RESEND set but no super-admin emails → 200 sent=false 'No recipient email resolved'",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    setMockConfig({
      tables: {
        memberships: {
          selectList: { data: [], error: null },
        },
        audit_logs: { insert: { data: null, error: null } },
      },
    });
    try {
      const res = await handler(makeRequest({
        body: {
          type: "request_submitted",
          request_id: "r-2",
          period_name: "Fall 2026",
          organization_name: "Acme",
        },
      }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean; sent: boolean; error?: string };
      assertEquals(body.ok, true);
      assertEquals(body.sent, false);
      assertEquals(body.error, "No recipient email resolved");
    } finally {
      Deno.env.delete("RESEND_API_KEY");
    }
  },
);

// ── edge.real namespace ────────────────────────────────────────────────────

// qa: edge.real.notify-unlock-request.01
Deno.test("notify-unlock-request — missing request_id → 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: { type: "request_submitted" } }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assert(body.error.includes("request_id"));
});

// qa: edge.real.notify-unlock-request.02
Deno.test(
  "notify-unlock-request — request_submitted, super admin emails resolved → 200 sent=true, email in payload",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    setMockConfig({
      tables: {
        memberships: { selectList: { data: [{ user_id: "sa-1" }], error: null } },
        audit_logs: { insert: { data: null, error: null } },
      },
      adminGetUserById: {
        "sa-1": { data: { user: { id: "sa-1", email: "superadmin@vera.app" } }, error: null },
      },
    });

    const fetchCalls: Array<{ url: string; body: string }> = [];
    const restore = stubFetch(async (input, init) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      fetchCalls.push({ url, body: (init?.body ?? "").toString() });
      return new Response(JSON.stringify({ id: "email-ok" }), { status: 200 });
    });
    try {
      const res = await handler(makeRequest({
        body: {
          type: "request_submitted",
          request_id: "r-1",
          period_name: "Spring 2026",
          organization_name: "TEDU",
          requester_name: "Ali",
        },
      }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean; sent: boolean };
      assertEquals(body.ok, true);
      assertEquals(body.sent, true);
      assert(fetchCalls.length >= 1, "expected Resend fetch");
      assertEquals(fetchCalls[0].url, "https://api.resend.com/emails");
      assert(
        fetchCalls[0].body.includes("superadmin@vera.app"),
        "expected super admin email in Resend payload",
      );
    } finally {
      restore();
      Deno.env.delete("RESEND_API_KEY");
    }
  },
);

// qa: edge.real.notify-unlock-request.03
Deno.test(
  "notify-unlock-request — request_submitted, no super-admin memberships → 200 sent=false",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    setMockConfig({
      tables: {
        memberships: { selectList: { data: [], error: null } },
        audit_logs: { insert: { data: null, error: null } },
      },
    });
    try {
      const res = await handler(makeRequest({
        body: {
          type: "request_submitted",
          request_id: "r-2",
          period_name: "Fall 2026",
          organization_name: "Acme",
        },
      }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean; sent: boolean; error?: string };
      assertEquals(body.ok, true);
      assertEquals(body.sent, false);
      assert(body.error && body.error.includes("No recipient"));
    } finally {
      Deno.env.delete("RESEND_API_KEY");
    }
  },
);

// qa: edge.real.notify-unlock-request.04
Deno.test(
  "notify-unlock-request — Resend 429 → 200 sent=false (sendViaResend returns {ok:false})",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    setMockConfig({
      tables: {
        memberships: { selectList: { data: [{ user_id: "sa-1" }], error: null } },
        audit_logs: { insert: { data: null, error: null } },
      },
      adminGetUserById: {
        "sa-1": { data: { user: { id: "sa-1", email: "superadmin@vera.app" } }, error: null },
      },
    });

    const restore = stubFetch(async () => new Response("rate limited", { status: 429 }));
    try {
      const res = await handler(makeRequest({
        body: {
          type: "request_submitted",
          request_id: "r-1",
          period_name: "Spring 2026",
        },
      }));
      // sendViaResend RETURNS {ok:false, error} on non-2xx (does not throw) → always 200
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean; sent: boolean; error?: string };
      assertEquals(body.ok, true);
      assertEquals(body.sent, false);
      assert(body.error && body.error.includes("Resend"));
    } finally {
      restore();
      Deno.env.delete("RESEND_API_KEY");
    }
  },
);
