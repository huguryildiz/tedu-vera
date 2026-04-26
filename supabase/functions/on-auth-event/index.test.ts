import { assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
  clearSupabaseEnv,
  makeRequest,
  readJson,
  setDefaultEnv,
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
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  return handler;
}

// qa: edge.real.on-auth-event.01
Deno.test("on-auth-event — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  // CORS responses have no body
});

// qa: edge.real.on-auth-event.02
Deno.test("on-auth-event — missing Supabase env returns 200 ok:false", async () => {
  const handler = await setup();
  clearSupabaseEnv();
  const res = await handler(makeRequest({ body: { type: "INSERT" } }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; error: string };
  assertEquals(body.ok, false);
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.error, "Environment not configured");
  assertEquals(typeof body.error, "string");
  setDefaultEnv();
});

// qa: edge.real.on-auth-event.03
Deno.test("on-auth-event — invalid JSON returns 200 ok:false", async () => {
  const handler = await setup();
  const req = new Request("http://localhost/fn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-json",
  });
  const res = await handler(req);
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; error: string };
  assertEquals(body.ok, false);
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.error, "Invalid JSON");
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.on-auth-event.04
Deno.test("on-auth-event — wrong webhook secret returns 200 ok:false Unauthorized", async () => {
  const handler = await setup();
  Deno.env.set("WEBHOOK_HMAC_SECRET", "correct-secret");
  const req = new Request("http://localhost/fn", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-secret": "wrong-secret",
    },
    body: JSON.stringify({ type: "INSERT", schema: "auth", table: "sessions", record: { user_id: "u1" } }),
  });
  const res = await handler(req);
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; error: string };
  assertEquals(body.ok, false);
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.error, "Unauthorized");
  assertEquals(typeof body.error, "string");
  Deno.env.delete("WEBHOOK_HMAC_SECRET");
});

// qa: edge.real.on-auth-event.05
Deno.test("on-auth-event — non-sessions schema returns 200 skipped:true", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({
    body: { type: "INSERT", schema: "public", table: "profiles", record: { user_id: "u1" } },
  }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; skipped: boolean };
  assertEquals(body.ok, true);
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.skipped, true);
  assertEquals(typeof body.skipped, "boolean");
});

// qa: edge.real.on-auth-event.06
Deno.test("on-auth-event — INSERT event logs login success", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      memberships: { selectSingle: { data: null, error: null } },
      audit_logs: { insert: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    body: {
      type: "INSERT",
      schema: "auth",
      table: "sessions",
      record: { user_id: "user-abc", id: "sess-1" },
    },
  }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; action: string };
  assertEquals(body.ok, true);
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.action, "auth.admin.login.success");
  assertEquals(typeof body.action, "string");
});

// qa: edge.real.on-auth-event.07
Deno.test("on-auth-event — DELETE event logs logout", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      memberships: { selectSingle: { data: null, error: null } },
      audit_logs: { insert: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    body: {
      type: "DELETE",
      schema: "auth",
      table: "sessions",
      old_record: { user_id: "user-abc", id: "sess-1" },
    },
  }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; action: string };
  assertEquals(body.ok, true);
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.action, "admin.logout");
  assertEquals(typeof body.action, "string");
});

// qa: edge.real.on-auth-event.08
Deno.test("on-auth-event — missing user_id in record returns 200 ok:false", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({
    body: {
      type: "INSERT",
      schema: "auth",
      table: "sessions",
      record: { id: "sess-1" },
    },
  }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; error: string };
  assertEquals(body.ok, false);
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.error, "No user_id");
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.on-auth-event.09
Deno.test("on-auth-event — successful INSERT returns 200 with expected response shape", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      memberships: { selectSingle: { data: null, error: null } },
      audit_logs: { insert: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    body: {
      type: "INSERT",
      schema: "auth",
      table: "sessions",
      record: {
        user_id: "user-xyz",
        id: "sess-xyz",
        ip: "192.168.1.1",
        user_agent: "Mozilla/5.0",
      },
    },
  }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as Record<string, unknown>;
  // Pin response shape: should have ok and action
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.ok, true);
  assertEquals(typeof body.action, "string");
  assertEquals(body.action, "auth.admin.login.success");
  assertEquals(body.skipped, undefined);
});

// qa: edge.on-auth-event.schema.success
Deno.test("on-auth-event — success response parses against SuccessResponseSchema", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      memberships: { selectSingle: { data: null, error: null } },
      audit_logs: { insert: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    body: {
      type: "INSERT",
      schema: "auth",
      table: "sessions",
      record: { user_id: "u1", id: "s1" },
    },
  }));
  assertEquals(res.status, 200);
  SuccessResponseSchema.parse(await readJson(res));
});

// qa: edge.on-auth-event.schema.validation
Deno.test(
  "on-auth-event — 200 invalid-JSON response parses against ValidationErrorResponseSchema",
  async () => {
    const handler = await setup();
    const req = new Request("http://localhost/fn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const res = await handler(req);
    assertEquals(res.status, 200);
    const body = await readJson(res);
    ValidationErrorResponseSchema.parse(body);
  },
);

// qa: edge.on-auth-event.schema.internal-error
Deno.test(
  "on-auth-event — 200 audit-insert-failure response parses against InternalErrorResponseSchema",
  async () => {
    const handler = await setup();
    setMockConfig({
      tables: {
        memberships: { selectSingle: { data: null, error: null } },
        audit_logs: { insert: { data: null, error: { message: "audit insert failed" } } },
      },
    });
    const res = await handler(makeRequest({
      body: {
        type: "INSERT",
        schema: "auth",
        table: "sessions",
        record: { user_id: "u1", id: "s1" },
      },
    }));
    assertEquals(res.status, 200);
    const body = await readJson(res);
    InternalErrorResponseSchema.parse(body);
  },
);
