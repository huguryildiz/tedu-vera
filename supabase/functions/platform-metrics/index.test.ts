import { assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
  clearSupabaseEnv,
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

// qa: edge.platform-metrics.01
Deno.test("platform-metrics — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// qa: edge.platform-metrics.02
Deno.test("platform-metrics — non-POST returns 405", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
});

// qa: edge.platform-metrics.03
Deno.test("platform-metrics — missing Authorization returns 401", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({}));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Missing bearer token");
});

// qa: edge.platform-metrics.04
Deno.test("platform-metrics — missing env returns 500", async () => {
  const handler = await setup();
  clearSupabaseEnv();
  const res = await handler(makeRequest({ token: "abc" }));
  assertEquals(res.status, 500);
});

// qa: edge.platform-metrics.05
Deno.test("platform-metrics — invalid JWT returns 401", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: null }, error: { message: "jwt malformed" } },
  });
  const res = await handler(makeRequest({ token: "bad" }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Unauthorized");
});

// qa: edge.platform-metrics.06
Deno.test("platform-metrics — tenant admin (non-super) returns 403", async () => {
  const handler = await setup();
  // Super-admin check: memberships row with organization_id IS NULL.
  // Tenant admin → no matching row → maybeSingle returns null → 403.
  setMockConfig({
    authGetUser: { data: { user: { id: "user-tenant" } }, error: null },
    tables: {
      memberships: { selectMaybeSingle: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({ token: "valid" }));
  assertEquals(res.status, 403);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Super admin access required.");
});

// qa: edge.platform-metrics.07
Deno.test("platform-metrics — membership query error returns 500", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "user-1" } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: { data: null, error: { message: "db down" } },
      },
    },
  });
  const res = await handler(makeRequest({ token: "valid" }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "db down");
});

// qa: edge.platform-metrics.08
Deno.test("platform-metrics — super admin receives metrics JSON (200)", async () => {
  const handler = await setup();
  const metrics = {
    db_size_bytes: 1234567,
    db_size_pretty: "1.2 MB",
    active_connections: 3,
    audit_requests_24h: 42,
    total_organizations: 5,
    total_jurors: 77,
  };
  setMockConfig({
    authGetUser: { data: { user: { id: "super-1" } }, error: null },
    tables: {
      memberships: { selectMaybeSingle: { data: { user_id: "super-1" }, error: null } },
    },
    rpc: {
      rpc_platform_metrics: { data: metrics, error: null },
    },
  });
  const res = await handler(makeRequest({ token: "valid" }));
  assertEquals(res.status, 200);
  const body = await readJson(res);
  assertEquals(body, metrics);
});

// qa: edge.platform-metrics.09
Deno.test("platform-metrics — rpc error returns 500", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "super-1" } }, error: null },
    tables: {
      memberships: { selectMaybeSingle: { data: { user_id: "super-1" }, error: null } },
    },
    rpc: {
      rpc_platform_metrics: { data: null, error: { message: "rpc failed" } },
    },
  });
  const res = await handler(makeRequest({ token: "valid" }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "rpc failed");
});

// qa: edge.platform-metrics.10
Deno.test("platform-metrics — malformed JWT returns 401 with error shape", async () => {
  const handler = await setup();
  const req = new Request("http://localhost/fn", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer not.a.valid.jwt",
    },
  });
  setMockConfig({
    authGetUser: { data: { user: null }, error: { message: "jwt signature invalid" } },
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
  const body = await readJson(res) as Record<string, unknown>;
  assertEquals(typeof body.error, "string");
});
