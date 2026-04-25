import { assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
  makeRequest,
  readJson,
  setDefaultEnv,
} from "../_test/harness.ts";
import { resetMockConfig, setMockConfig } from "../_test/mock-supabase.ts";

const modulePath = new URL("./index.ts", import.meta.url).href;

async function setup() {
  setDefaultEnv();
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  return handler;
}

// qa: edge.real.password-reset-email.01
Deno.test("password-reset-email — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// qa: edge.real.password-reset-email.02
Deno.test("password-reset-email — non-POST returns 405", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Method not allowed");
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.password-reset-email.03
Deno.test("password-reset-email — missing email returns 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: {} }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "A valid email is required.");
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.password-reset-email.04
Deno.test("password-reset-email — email without @ returns 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: { email: "notanemail" } }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "A valid email is required.");
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.password-reset-email.05
Deno.test("password-reset-email — generateLink error returns 200 ok:true (no leakage)", async () => {
  const handler = await setup();
  setMockConfig({
    adminGenerateLink: { data: null, error: { message: "user not found" } },
    tables: {
      audit_logs: { insert: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({ body: { email: "unknown@test.com" } }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean };
  assertEquals(body.ok, true);
  assertEquals(typeof body.ok, "boolean");
});

// qa: edge.real.password-reset-email.06
Deno.test("password-reset-email — generateLink success without RESEND returns 200 ok:true", async () => {
  const handler = await setup();
  setMockConfig({
    adminGenerateLink: {
      data: {
        properties: { action_link: "https://test.supabase.co/auth/v1/verify?token=abc" },
        user: { id: "user-1" },
      },
      error: null,
    },
    tables: {
      audit_logs: { insert: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({ body: { email: "user@test.com" } }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean };
  assertEquals(body.ok, true);
  assertEquals(typeof body.ok, "boolean");
});

// qa: edge.real.password-reset-email.07
Deno.test("password-reset-email — generateLink success with RESEND calls fetch with correct payload", async () => {
  const handler = await setup();
  Deno.env.set("RESEND_API_KEY", "re_test_key");
  const fetchCalls: { url: string; init: RequestInit }[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
    fetchCalls.push({ url: url.toString(), init: init! });
    return new Response(JSON.stringify({ id: "msg_123" }), { status: 200 });
  };
  try {
    setMockConfig({
      adminGenerateLink: {
        data: {
          properties: { action_link: "https://test.supabase.co/auth/v1/verify?token=reset-tok-abc" },
          user: { id: "user-42" },
        },
        error: null,
      },
      tables: {
        audit_logs: { insert: { data: null, error: null } },
      },
    });
    const res = await handler(makeRequest({ body: { email: "user@test.com" } }));
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean };
    assertEquals(body.ok, true);
    assertEquals(typeof body.ok, "boolean");
    assertEquals(fetchCalls.length, 1);
    assertEquals(fetchCalls[0].url, "https://api.resend.com/emails");
    const payload = JSON.parse(fetchCalls[0].init.body as string);
    assertEquals(payload.to, ["user@test.com"]);
    assertEquals(typeof payload.subject, "string");
    assertEquals((payload.subject as string).toLowerCase().includes("reset"), true);
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("RESEND_API_KEY");
  }
});

// qa: edge.real.password-reset-email.08
Deno.test("password-reset-email — response shape pinning: only ok field on success", async () => {
  const handler = await setup();
  setMockConfig({
    adminGenerateLink: {
      data: {
        properties: { action_link: "https://test.supabase.co/auth/v1/verify?token=abc" },
        user: { id: "user-1" },
      },
      error: null,
    },
    tables: {
      audit_logs: { insert: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({ body: { email: "user@test.com" } }));
  assertEquals(res.status, 200);
  const body = await res.json() as Record<string, unknown>;
  assertEquals(body.ok, true);
  assertEquals(typeof body.ok, "boolean");
  // Verify only 'ok' field is present on success (no extra fields like 'sent' or 'error')
  const keys = Object.keys(body);
  assertEquals(keys.length, 1);
  assertEquals(keys[0], "ok");
});

// qa: edge.real.password-reset-email.09
Deno.test("password-reset-email — audit write failure is logged but returns 200 ok:true", async () => {
  const handler = await setup();
  setMockConfig({
    adminGenerateLink: {
      data: {
        properties: { action_link: "https://test.supabase.co/auth/v1/verify?token=abc" },
        user: { id: "user-1" },
      },
      error: null,
    },
    tables: {
      audit_logs: { insert: { data: null, error: { message: "audit DB error" } } },
    },
  });
  const res = await handler(makeRequest({ body: { email: "user@test.com" } }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean };
  assertEquals(body.ok, true);
  assertEquals(typeof body.ok, "boolean");
});
