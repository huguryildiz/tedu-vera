import { assertEquals, assert } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
  clearSupabaseEnv,
  makeRequest,
  readJson,
  setDefaultEnv,
} from "../_test/harness.ts";
import {
  getCalls,
  resetMockConfig,
  setMockConfig,
} from "../_test/mock-supabase.ts";

const modulePath = new URL("./index.ts", import.meta.url).href;

async function setup() {
  setDefaultEnv();
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  return handler;
}

// qa: edge.admin-session-touch.01
Deno.test("admin-session-touch — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// qa: edge.admin-session-touch.02
Deno.test("admin-session-touch — non-POST returns 405", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
});

// qa: edge.admin-session-touch.03
Deno.test("admin-session-touch — missing Authorization returns 401", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: { deviceId: "d1" } }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Missing bearer token");
});

// qa: edge.admin-session-touch.04
Deno.test("admin-session-touch — missing env returns 500", async () => {
  const handler = await setup();
  clearSupabaseEnv();
  const res = await handler(makeRequest({ token: "abc", body: { deviceId: "d1" } }));
  assertEquals(res.status, 500);
});

// qa: edge.admin-session-touch.05
Deno.test("admin-session-touch — invalid JWT returns 401 via auth.getUser error", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: null }, error: { message: "invalid token" } },
  });
  const res = await handler(makeRequest({ token: "invalid", body: { deviceId: "d1" } }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Unauthorized");
});

// qa: edge.admin-session-touch.06
Deno.test("admin-session-touch — missing deviceId returns 400", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "user-1" } }, error: null },
  });
  const res = await handler(makeRequest({ token: "valid", body: {} }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "deviceId is required");
});

// qa: edge.admin-session-touch.07
Deno.test("admin-session-touch — existing-select error returns 500", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "user-1" } }, error: null },
    tables: {
      admin_user_sessions: {
        selectMaybeSingle: { data: null, error: { message: "boom" } },
      },
    },
  });
  const res = await handler(makeRequest({ token: "valid", body: { deviceId: "d1" } }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "boom");
});

// qa: edge.admin-session-touch.08
Deno.test("admin-session-touch — valid input upserts session and returns 200", async () => {
  const handler = await setup();
  const session = {
    user_id: "user-1",
    device_id: "device-abc",
    browser: "Chrome",
    os: "macOS",
  };
  setMockConfig({
    authGetUser: { data: { user: { id: "user-1" } }, error: null },
    tables: {
      admin_user_sessions: {
        selectMaybeSingle: { data: null, error: null },
        upsert: { data: session, error: null },
        delete: { data: null, error: null },
      },
    },
  });
  const res = await handler(makeRequest({
    token: "valid",
    body: {
      deviceId: "device-abc",
      browser: "Chrome",
      os: "macOS",
      authMethod: "password",
      userAgent: "Mozilla/5.0",
    },
    headers: { "cf-ipcountry": "TR", "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
  }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; session: unknown };
  assertEquals(body.ok, true);
  assertEquals(body.session, session);

  const calls = getCalls();
  const upsertCall = calls.find((c) => c.op === "upsert" && c.table === "admin_user_sessions");
  assert(upsertCall, "expected upsert call on admin_user_sessions");
  const payload = upsertCall!.payload as Record<string, unknown>;
  assertEquals(payload.user_id, "user-1");
  assertEquals(payload.device_id, "device-abc");
  assertEquals(payload.browser, "Chrome");
  assertEquals(payload.country_code, "TR");
  assertEquals(payload.ip_address, "1.2.3.4");
  assertEquals(payload.auth_method, "password");
});

// qa: edge.admin-session-touch.09
Deno.test("admin-session-touch — upsert error returns 500", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "user-1" } }, error: null },
    tables: {
      admin_user_sessions: {
        selectMaybeSingle: { data: null, error: null },
        upsert: { data: null, error: { message: "constraint" } },
      },
    },
  });
  const res = await handler(makeRequest({ token: "valid", body: { deviceId: "d1" } }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "constraint");
});

// qa: edge.admin-session-touch.10
Deno.test("admin-session-touch — malformed JWT returns 401 with error shape", async () => {
  const handler = await setup();
  const req = new Request("http://localhost/fn", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer definitely-not-a-valid-jwt",
    },
    body: JSON.stringify({ deviceId: "d1" }),
  });
  setMockConfig({
    authGetUser: { data: { user: null }, error: { message: "jwt malformed" } },
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
  const body = await readJson(res) as Record<string, unknown>;
  assertEquals(typeof body.error, "string");
});
