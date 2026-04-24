// Real Deno tests for request-pin-reset/index.ts.
// Namespace: edge.real.pin.*
//
// Covers: OPTIONS, input validation, DB resolution failures, email resolution
// fallback to org contact_email, Resend send path, audit-log side-effect, and
// exception path → 500.

import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
  makeRequest,
  readJson,
  setDefaultEnv,
  stubFetch,
} from "../_test/harness.ts";
import {
  getCalls,
  resetMockConfig,
  setMockConfig,
} from "../_test/mock-supabase.ts";

const modulePath = new URL("./index.ts", import.meta.url).href;

async function setup() {
  setDefaultEnv();
  Deno.env.delete("RESEND_API_KEY");
  Deno.env.delete("NOTIFICATION_FROM");
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  return handler;
}

// Minimal period + org resolver mock so resolvePeriodInfo returns non-null.
function mockPeriodOrgResolved() {
  setMockConfig({
    tables: {
      periods: {
        selectSingle: {
          data: {
            name: "Spring 2026",
            organization_id: "org-1",
            organizations: { name: "Tedu", contact_email: "contact@tedu.edu" },
          },
          error: null,
        },
      },
      memberships: {
        // .eq().eq() → thenable list. One org_admin membership.
        selectList: {
          data: [{ user_id: "admin-1" }],
          error: null,
        },
      },
      security_policy: {
        selectSingle: { data: { policy: { ccOnPinReset: true } }, error: null },
      },
    },
    adminGetUserById: {
      "admin-1": { data: { user: { id: "admin-1", email: "admin@tedu.edu" } }, error: null },
    },
  });
}

// qa: edge.real.pin.01
Deno.test("request-pin-reset — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// qa: edge.real.pin.02
Deno.test("request-pin-reset — missing periodId returns 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: { jurorName: "Ali" } }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assert(body.error.includes("Missing required fields"));
});

// qa: edge.real.pin.03
Deno.test("request-pin-reset — missing jurorName returns 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: { periodId: "p-1" } }));
  assertEquals(res.status, 400);
});

// qa: edge.real.pin.04
Deno.test("request-pin-reset — unknown period returns 404", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      periods: { selectSingle: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    body: { periodId: "nope", jurorName: "Ali", affiliation: "CS" },
  }));
  assertEquals(res.status, 404);
  const body = await readJson(res) as { ok: boolean; error: string };
  assertEquals(body.ok, false);
  assertEquals(body.error, "Period not found");
});

// qa: edge.real.pin.05
Deno.test(
  "request-pin-reset — no admin emails and no org contact → 404",
  async () => {
    const handler = await setup();
    setMockConfig({
      tables: {
        periods: {
          selectSingle: {
            data: {
              name: "Fall 2026",
              organization_id: "org-2",
              organizations: { name: "Acme", contact_email: "" },
            },
            error: null,
          },
        },
        memberships: { selectList: { data: [], error: null } },
        security_policy: {
          selectSingle: { data: { policy: { ccOnPinReset: true } }, error: null },
        },
      },
    });
    const res = await handler(makeRequest({
      body: { periodId: "p-1", jurorName: "Ali", affiliation: "CS" },
    }));
    assertEquals(res.status, 404);
    const body = await readJson(res) as { ok: boolean; error: string };
    assertEquals(body.ok, false);
    assert(body.error.includes("No admin email"));
  },
);

// qa: edge.real.pin.06
Deno.test(
  "request-pin-reset — no memberships but org has contact_email → success 200",
  async () => {
    const handler = await setup();
    setMockConfig({
      tables: {
        periods: {
          selectSingle: {
            data: {
              name: "Fall 2026",
              organization_id: "org-2",
              organizations: { name: "Acme", contact_email: "fallback@acme.edu" },
            },
            error: null,
          },
        },
        memberships: { selectList: { data: [], error: null } },
        security_policy: {
          selectSingle: { data: { policy: { ccOnPinReset: false } }, error: null },
        },
        audit_logs: { insert: { data: null, error: null } },
      },
    });
    const res = await handler(makeRequest({
      body: { periodId: "p-1", jurorName: "Ali", affiliation: "CS" },
    }));
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean; sent: boolean; error?: string };
    assertEquals(body.ok, true);
    // RESEND_API_KEY not set → sent=false, error populated.
    assertEquals(body.sent, false);
    assertEquals(body.error, "RESEND_API_KEY not configured");
  },
);

// qa: edge.real.pin.07
Deno.test(
  "request-pin-reset — invalid JSON body → 500 with error message",
  async () => {
    const handler = await setup();
    const req = new Request("http://localhost/fn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await handler(req);
    assertEquals(res.status, 500);
    const body = await readJson(res) as { ok: boolean; error: string };
    assertEquals(body.ok, false);
    assert(body.error.length > 0);
  },
);

// qa: edge.real.pin.08
Deno.test(
  "request-pin-reset — writes security.pin_reset.requested audit row with severity=medium, actor_type=juror",
  async () => {
    const handler = await setup();
    mockPeriodOrgResolved();
    // Attach audit_logs insert mock to existing config.
    const prev = (globalThis as any).__lastMockConfig;
    setMockConfig({
      tables: {
        periods: {
          selectSingle: {
            data: {
              name: "Spring 2026",
              organization_id: "org-1",
              organizations: { name: "Tedu", contact_email: "contact@tedu.edu" },
            },
            error: null,
          },
        },
        memberships: {
          selectList: { data: [{ user_id: "admin-1" }], error: null },
        },
        security_policy: {
          selectSingle: { data: { policy: { ccOnPinReset: true } }, error: null },
        },
        audit_logs: { insert: { data: null, error: null } },
      },
      adminGetUserById: {
        "admin-1": {
          data: { user: { id: "admin-1", email: "admin@tedu.edu" } },
          error: null,
        },
      },
    });
    void prev;

    const res = await handler(makeRequest({
      body: {
        periodId: "p-1",
        jurorName: "Ali",
        affiliation: "CS",
        message: "Locked out",
      },
    }));
    assertEquals(res.status, 200);

    const auditInsert = getCalls().find(
      (c) => c.table === "audit_logs" && c.op === "insert",
    );
    assert(auditInsert, "expected audit_logs insert");
    const payload = auditInsert!.payload as Record<string, unknown>;
    assertEquals(payload.action, "security.pin_reset.requested");
    assertEquals(payload.actor_type, "juror");
    assertEquals(payload.severity, "medium");
    assertEquals(payload.resource_type, "juror_period_auth");
    assertEquals(payload.resource_id, "p-1");
  },
);

// qa: edge.real.pin.09
Deno.test(
  "request-pin-reset — Resend success path → sent=true, fetch called with admin email",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    setMockConfig({
      tables: {
        periods: {
          selectSingle: {
            data: {
              name: "Spring 2026",
              organization_id: "org-1",
              organizations: { name: "Tedu", contact_email: "" },
            },
            error: null,
          },
        },
        memberships: {
          selectList: { data: [{ user_id: "admin-1" }], error: null },
        },
        security_policy: {
          selectSingle: { data: { policy: { ccOnPinReset: false } }, error: null },
        },
        audit_logs: { insert: { data: null, error: null } },
      },
      adminGetUserById: {
        "admin-1": {
          data: { user: { id: "admin-1", email: "admin@tedu.edu" } },
          error: null,
        },
      },
    });

    const fetchCalls: Array<{ url: string; body: string }> = [];
    const restore = stubFetch(async (input, init) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      fetchCalls.push({ url, body: (init?.body ?? "").toString() });
      return new Response(JSON.stringify({ id: "re_123" }), { status: 200 });
    });
    try {
      const res = await handler(makeRequest({
        body: { periodId: "p-1", jurorName: "Ali", affiliation: "CS" },
      }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean; sent: boolean };
      assertEquals(body.ok, true);
      assertEquals(body.sent, true);

      assert(fetchCalls.length >= 1, "expected Resend fetch");
      assertEquals(fetchCalls[0].url, "https://api.resend.com/emails");
      assert(
        fetchCalls[0].body.includes("admin@tedu.edu"),
        "expected admin email in Resend payload",
      );
    } finally {
      restore();
      Deno.env.delete("RESEND_API_KEY");
    }
  },
);

// qa: edge.real.pin.10
Deno.test(
  "request-pin-reset — Resend non-2xx response → sent=false, error populated, still 200",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    setMockConfig({
      tables: {
        periods: {
          selectSingle: {
            data: {
              name: "Spring 2026",
              organization_id: "org-1",
              organizations: { name: "Tedu", contact_email: "" },
            },
            error: null,
          },
        },
        memberships: {
          selectList: { data: [{ user_id: "admin-1" }], error: null },
        },
        security_policy: {
          selectSingle: { data: { policy: { ccOnPinReset: false } }, error: null },
        },
        audit_logs: { insert: { data: null, error: null } },
      },
      adminGetUserById: {
        "admin-1": {
          data: { user: { id: "admin-1", email: "admin@tedu.edu" } },
          error: null,
        },
      },
    });
    const restore = stubFetch(async () =>
      new Response("rate limited", { status: 429 })
    );
    try {
      const res = await handler(makeRequest({
        body: { periodId: "p-1", jurorName: "Ali", affiliation: "CS" },
      }));
      // Documenting current behavior: function swallows Resend failure and
      // returns 200 with sent=false so the client can tell the user the
      // request was recorded even if the email bounced.
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
