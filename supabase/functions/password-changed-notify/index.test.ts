// Real Deno tests for password-changed-notify/index.ts.
// Namespace: edge.password-changed.*
//
// Covers: OPTIONS, missing-token 401, env-missing early 200 no-op, auth
// failure 401, Resend success 200, super-admin subject variant, and hard
// failure when Resend returns non-2xx (sendViaResend THROWS → outer catch → 500).

import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
  makeRequest,
  readJson,
  setDefaultEnv,
  stubFetch,
} from "../_test/harness.ts";
import { resetMockConfig, setMockConfig } from "../_test/mock-supabase.ts";
import {
  SuccessResponseSchema,
  ValidationErrorResponseSchema,
  InternalErrorResponseSchema,
} from "./schema.ts";

const modulePath = new URL("./index.ts", import.meta.url).href;

async function setup() {
  setDefaultEnv();
  Deno.env.delete("RESEND_API_KEY");
  Deno.env.delete("NOTIFICATION_FROM");
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  return handler;
}

/**
 * Mock auth success: getUser returns user with email, rpc returns org_admin role.
 * Disables CC (security_policy ccOnPasswordChanged: false) to avoid needing
 * super-admin email mocks in the basic success case.
 */
function mockAuthSuccess() {
  setMockConfig({
    authGetUser: {
      data: { user: { id: "user-1", email: "admin@tedu.edu" } as never },
      error: null,
    },
    rpc: {
      "rpc_admin_auth_get_session": {
        data: [{ role: "org_admin" }],
        error: null,
      },
    },
    tables: {
      security_policy: {
        selectSingle: {
          data: { policy: { ccOnPasswordChanged: false } },
          error: null,
        },
      },
      audit_logs: { insert: { data: null, error: null } },
    },
  });
}

// qa: edge.password-changed.01
Deno.test("password-changed-notify — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// qa: edge.password-changed.02
Deno.test("password-changed-notify — missing bearer token returns 401", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: {} }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Missing bearer token");
  assertEquals(typeof body.error, "string");
});

// qa: edge.password-changed.03
Deno.test(
  "password-changed-notify — RESEND_API_KEY absent → 200 no-op (early return, no auth call)",
  async () => {
    // RESEND_API_KEY is already deleted in setup(); SUPABASE_URL + ANON_KEY are set.
    // The function returns 200 { ok: true } before calling auth.getUser.
    const handler = await setup();
    const res = await handler(makeRequest({ token: "any-token" }));
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean };
    assertEquals(body.ok, true);
    assertEquals(typeof body.ok, "boolean");
  },
);

// qa: edge.password-changed.04
Deno.test("password-changed-notify — auth failure returns 401", async () => {
  const handler = await setup();
  Deno.env.set("RESEND_API_KEY", "re_test");
  setMockConfig({
    authGetUser: { data: { user: null }, error: { message: "Invalid JWT" } },
  });
  try {
    const res = await handler(makeRequest({ token: "bad-token" }));
    assertEquals(res.status, 401);
    const body = await readJson(res) as { error: string };
    assert(body.error.length > 0);
    assertEquals(typeof body.error, "string");
  } finally {
    Deno.env.delete("RESEND_API_KEY");
  }
});

// qa: edge.password-changed.05
Deno.test(
  "password-changed-notify — Resend success (org_admin) → 200 { ok: true }",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    mockAuthSuccess();

    const restore = stubFetch(async () =>
      new Response(JSON.stringify({ id: "re_ok" }), { status: 200 })
    );
    try {
      const res = await handler(makeRequest({ token: "tok" }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean };
      assertEquals(body.ok, true);
      assertEquals(typeof body.ok, "boolean");
    } finally {
      restore();
      Deno.env.delete("RESEND_API_KEY");
    }
  },
);

// qa: edge.password-changed.06
Deno.test(
  "password-changed-notify — super_admin role → subject contains 'super admin'",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    setMockConfig({
      authGetUser: {
        data: { user: { id: "sa-1", email: "sa@vera.app" } as never },
        error: null,
      },
      rpc: {
        "rpc_admin_auth_get_session": {
          data: [{ role: "super_admin" }],
          error: null,
        },
      },
      tables: {
        security_policy: {
          selectSingle: {
            data: { policy: { ccOnPasswordChanged: false } },
            error: null,
          },
        },
        audit_logs: { insert: { data: null, error: null } },
      },
    });

    const sentSubjects: string[] = [];
    const restore = stubFetch(async (_, init) => {
      const payload = JSON.parse((init?.body ?? "{}").toString());
      sentSubjects.push(payload.subject ?? "");
      return new Response(JSON.stringify({ id: "re_sa" }), { status: 200 });
    });
    try {
      const res = await handler(makeRequest({ token: "tok" }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean };
      assertEquals(body.ok, true);
      assertEquals(typeof body.ok, "boolean");
      assert(sentSubjects.length >= 1);
      assert(
        sentSubjects[0].toLowerCase().includes("super admin"),
        `expected super admin in subject, got: ${sentSubjects[0]}`,
      );
    } finally {
      restore();
      Deno.env.delete("RESEND_API_KEY");
    }
  },
);

// qa: edge.password-changed.07
Deno.test(
  "password-changed-notify — Resend non-2xx THROWS → outer catch → 500",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    mockAuthSuccess();

    const restore = stubFetch(async () =>
      new Response("rate limited", { status: 429 })
    );
    try {
      const res = await handler(makeRequest({ token: "tok" }));
      // sendViaResend throws on non-2xx; outer catch returns 500 with { error }.
      assertEquals(res.status, 500);
      const body = await readJson(res) as { error: string };
      assert(body.error.length > 0);
      assertEquals(typeof body.error, "string");
    } finally {
      restore();
      Deno.env.delete("RESEND_API_KEY");
    }
  },
);

// ── edge.real namespace ────────────────────────────────────────────────────

// qa: edge.real.password-changed-notify.01
Deno.test("password-changed-notify — missing Authorization → 401", async () => {
  const handler = await setup();
  // Bearer absence is checked before the RESEND_API_KEY env gate, so no need
  // to set RESEND_API_KEY here.
  const res = await handler(makeRequest({ body: {} }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assert(body.error.includes("Missing bearer token"));
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.password-changed-notify.02
Deno.test("password-changed-notify — getUser returns user with no email → 401", async () => {
  const handler = await setup();
  Deno.env.set("RESEND_API_KEY", "re_test");
  setMockConfig({
    authGetUser: { data: { user: { id: "u1" } as never }, error: null },
  });
  try {
    const res = await handler(makeRequest({ token: "jwt", body: {} }));
    assertEquals(res.status, 401);
    const body = await readJson(res) as { error: string };
    assert(body.error.includes("Could not resolve user"));
    assertEquals(typeof body.error, "string");
  } finally {
    Deno.env.delete("RESEND_API_KEY");
  }
});

// qa: edge.real.password-changed-notify.03
Deno.test(
  "password-changed-notify — Resend success → 200 ok:true, user email in payload",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    setMockConfig({
      authGetUser: {
        data: { user: { id: "u1", email: "admin@test.com" } as never },
        error: null,
      },
      rpc: { "rpc_admin_auth_get_session": { data: [], error: null } },
      tables: {
        security_policy: {
          selectSingle: { data: { policy: { ccOnPasswordChanged: false } }, error: null },
        },
        audit_logs: { insert: { data: null, error: null } },
      },
    });

    const fetchCalls: Array<{ url: string; body: string }> = [];
    const restore = stubFetch(async (input, init) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      fetchCalls.push({ url, body: (init?.body ?? "").toString() });
      return new Response(JSON.stringify({ id: "email-ok" }), { status: 200 });
    });
    try {
      const res = await handler(makeRequest({ token: "jwt", body: {} }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean };
      assertEquals(body.ok, true);
      assertEquals(typeof body.ok, "boolean");
      assert(fetchCalls.length >= 1, "expected Resend fetch");
      assertEquals(fetchCalls[0].url, "https://api.resend.com/emails");
      assert(
        fetchCalls[0].body.includes("admin@test.com"),
        "expected user email in Resend payload",
      );
    } finally {
      restore();
      Deno.env.delete("RESEND_API_KEY");
    }
  },
);

// qa: edge.real.password-changed-notify.04
Deno.test(
  "password-changed-notify — Resend 429 → 500 (sendViaResend throws)",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    setMockConfig({
      authGetUser: {
        data: { user: { id: "u1", email: "admin@test.com" } as never },
        error: null,
      },
      rpc: { "rpc_admin_auth_get_session": { data: [], error: null } },
      tables: {
        security_policy: {
          selectSingle: { data: { policy: { ccOnPasswordChanged: false } }, error: null },
        },
        audit_logs: { insert: { data: null, error: null } },
      },
    });

    const restore = stubFetch(async () => new Response("rate limited", { status: 429 }));
    try {
      const res = await handler(makeRequest({ token: "jwt", body: {} }));
      assertEquals(res.status, 500);
      const body = await readJson(res) as { error: string };
      assert(body.error && body.error.includes("Resend"));
      assertEquals(typeof body.error, "string");
    } finally {
      restore();
      Deno.env.delete("RESEND_API_KEY");
    }
  },
);

// qa: edge.password-changed-notify.schema.success
Deno.test("password-changed-notify — success response parses against SuccessResponseSchema", async () => {
  const handler = await setup();
  Deno.env.set("RESEND_API_KEY", "re_test");
  mockAuthSuccess();

  const restore = stubFetch(async () =>
    new Response(JSON.stringify({ id: "re_ok" }), { status: 200 })
  );
  try {
    const res = await handler(makeRequest({ token: "tok" }));
    assertEquals(res.status, 200);
    SuccessResponseSchema.parse(await readJson(res));
  } finally {
    restore();
    Deno.env.delete("RESEND_API_KEY");
  }
});

// qa: edge.password-changed-notify.schema.validation
Deno.test("password-changed-notify — 401 missing-bearer-token response parses against ValidationErrorResponseSchema", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: {} }));
  assertEquals(res.status, 401);
  const body = await readJson(res);
  ValidationErrorResponseSchema.parse(body);
});

// qa: edge.password-changed-notify.schema.internal-error
Deno.test("password-changed-notify — 500 unhandled-exception response parses against InternalErrorResponseSchema", async () => {
  const handler = await setup();
  Deno.env.set("RESEND_API_KEY", "re_test");
  mockAuthSuccess();

  const restore = stubFetch(async () =>
    new Response("rate limited", { status: 429 })
  );
  try {
    const res = await handler(makeRequest({ token: "tok" }));
    assertEquals(res.status, 500);
    InternalErrorResponseSchema.parse(await readJson(res));
  } finally {
    restore();
    Deno.env.delete("RESEND_API_KEY");
  }
});
