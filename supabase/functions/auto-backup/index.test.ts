import { assertEquals, assert } from "jsr:@std/assert@^1.0.0";
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

// qa: edge.real.auto-backup.01
Deno.test("auto-backup — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// qa: edge.real.auto-backup.02
Deno.test("auto-backup — non-POST returns 405", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
});

// qa: edge.real.auto-backup.03
Deno.test("auto-backup — missing token returns 401", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: {} }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Missing bearer token");
});

// qa: edge.real.auto-backup.04
Deno.test("auto-backup — non-super-admin JWT returns 403", async () => {
  const handler = await setup();
  setMockConfig({
    rpc: { current_user_is_super_admin: { data: false, error: null } },
  });
  const res = await handler(makeRequest({ token: "user-jwt", body: {} }));
  assertEquals(res.status, 403);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "super_admin or service role required");
});

// qa: edge.real.auto-backup.05
Deno.test("auto-backup — organizations fetch error returns 500", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      organizations: { selectList: { data: null, error: { message: "DB unavailable" } } },
    },
  });
  const res = await handler(makeRequest({ token: "test-service-role-key", body: {} }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assert(body.error.includes("Failed to list organizations"));
});

// qa: edge.real.auto-backup.06
Deno.test("auto-backup — no active organizations returns 200 with empty backed_up", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      organizations: { selectList: { data: [], error: null } },
    },
  });
  const res = await handler(makeRequest({ token: "test-service-role-key", body: {} }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; backed_up: unknown[]; message: string };
  assertEquals(body.ok, true);
  assertEquals(body.backed_up.length, 0);
  assertEquals(body.message, "No active organizations");
});

// qa: edge.real.auto-backup.08
Deno.test("auto-backup — manual path: super_admin JWT → 200 backed_up", async () => {
  const handler = await setup();
  setMockConfig({
    rpc: {
      current_user_is_super_admin: { data: true, error: null },
      rpc_backup_register: { data: null, error: null },
    },
    tables: {
      organizations: { selectList: { data: [{ id: "org-2", name: "SuperAdminOrg" }], error: null } },
      periods: { selectList: { data: [], error: null } },
      jurors: { selectList: { data: [], error: null } },
      audit_logs: { selectList: { data: [], error: null } },
    },
    storageUpload: { data: { path: "org-2/backup.json" }, error: null },
  });
  const res = await handler(makeRequest({ token: "super-admin-jwt", body: {} }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as {
    ok: boolean;
    backed_up: Array<{ orgId: string; orgName: string; path: string; sizeBytes: number }>;
  };
  assertEquals(body.ok, true);
  assertEquals(body.backed_up.length, 1);
  assertEquals(body.backed_up[0].orgId, "org-2");
  assertEquals(body.backed_up[0].orgName, "SuperAdminOrg");
  assert(body.backed_up[0].sizeBytes > 0, "backup must have positive size");
});

// qa: edge.real.auto-backup.09
Deno.test("auto-backup — tenant_admin manual trigger → 403", async () => {
  const handler = await setup();
  setMockConfig({
    rpc: { current_user_is_super_admin: { data: false, error: null } },
  });
  const res = await handler(makeRequest({ token: "tenant-admin-jwt", body: {} }));
  assertEquals(res.status, 403);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "super_admin or service role required");
});

// qa: edge.real.auto-backup.07
Deno.test("auto-backup — cron path with one org returns 200 backed_up", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      organizations: { selectList: { data: [{ id: "org-1", name: "Org1" }], error: null } },
      periods: { selectList: { data: [], error: null } },
      jurors: { selectList: { data: [], error: null } },
      audit_logs: { selectList: { data: [], error: null } },
    },
    storageUpload: { data: { path: "org-1/backup.json" }, error: null },
    rpc: { rpc_backup_register: { data: null, error: null } },
  });
  const res = await handler(makeRequest({ token: "test-service-role-key", body: {} }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; backed_up: Array<{ orgId: string }> };
  assertEquals(body.ok, true);
  assertEquals(body.backed_up.length, 1);
  assertEquals(body.backed_up[0].orgId, "org-1");
});
