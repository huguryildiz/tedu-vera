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

// qa: edge.real.notify-maintenance.01
Deno.test("notify-maintenance — missing token returns 401", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: {} }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Missing bearer token");
});

// qa: edge.real.notify-maintenance.02
Deno.test("notify-maintenance — missing Supabase env returns 500", async () => {
  const handler = await setup();
  clearSupabaseEnv();
  const res = await handler(makeRequest({ token: "any-token", body: {} }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error.includes("not configured"), true);
  setDefaultEnv();
});

// qa: edge.real.notify-maintenance.03
Deno.test("notify-maintenance — non-super-admin returns 403", async () => {
  const handler = await setup();
  setMockConfig({
    rpc: { current_user_is_super_admin: { data: false, error: null } },
  });
  const res = await handler(makeRequest({ token: "user-jwt", body: {} }));
  assertEquals(res.status, 403);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "super_admin required");
});

// qa: edge.real.notify-maintenance.04
Deno.test("notify-maintenance — no active org admins returns 200 sent:0", async () => {
  const handler = await setup();
  setMockConfig({
    rpc: { current_user_is_super_admin: { data: true, error: null } },
    tables: {
      memberships: { selectList: { data: [], error: null } },
    },
  });
  const res = await handler(makeRequest({ token: "super-jwt", body: {} }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; sent: number; skipped: string };
  assertEquals(body.ok, true);
  assertEquals(body.sent, 0);
  assertEquals(body.skipped, "no active org admins found");
});

// qa: edge.real.notify-maintenance.05
Deno.test("notify-maintenance — testRecipient mismatch returns 400", async () => {
  const handler = await setup();
  setMockConfig({
    rpc: { current_user_is_super_admin: { data: true, error: null } },
    authGetUser: { data: { user: { id: "u1", email: "caller@test.com" } as unknown as { id: string } }, error: null },
  });
  const res = await handler(makeRequest({
    token: "super-jwt",
    body: { testRecipient: "other@test.com" },
  }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error.includes("testRecipient"), true);
});

// qa: edge.real.notify-maintenance.06
Deno.test("notify-maintenance — members fetch error returns 500", async () => {
  const handler = await setup();
  setMockConfig({
    rpc: { current_user_is_super_admin: { data: true, error: null } },
    tables: {
      memberships: { selectList: { data: null, error: { message: "relation not found" } } },
    },
  });
  const res = await handler(makeRequest({ token: "super-jwt", body: {} }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error.includes("Failed to list members"), true);
});
