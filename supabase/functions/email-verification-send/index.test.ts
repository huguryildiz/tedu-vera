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

// email-verification-send reads env inside the handler (not at module level),
// so a single captureHandler call works for all tests.

async function setup() {
  setDefaultEnv();
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  return handler;
}

const validUser = { id: "u1", email: "user@test.com" } as unknown as { id: string };

// qa: edge.real.email-verification-send.01
Deno.test("email-verification-send — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// qa: edge.real.email-verification-send.02
Deno.test("email-verification-send — non-POST returns 405", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Method not allowed");
});

// qa: edge.real.email-verification-send.03
Deno.test("email-verification-send — missing Supabase env returns 500", async () => {
  const handler = await setup();
  clearSupabaseEnv();
  const res = await handler(makeRequest({ token: "any-token", body: {} }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error.includes("not configured"), true);
  setDefaultEnv();
});

// qa: edge.real.email-verification-send.04
Deno.test("email-verification-send — missing bearer token returns 401", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: {} }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Missing bearer token");
});

// qa: edge.real.email-verification-send.05
Deno.test("email-verification-send — invalid JWT returns 401 Unauthorized", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: null }, error: { message: "invalid JWT" } },
  });
  const res = await handler(makeRequest({ token: "bad-token", body: {} }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Unauthorized");
});

// qa: edge.real.email-verification-send.06
Deno.test("email-verification-send — already verified user returns 200 alreadyVerified:true", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: validUser }, error: null },
    tables: {
      profiles: { selectMaybeSingle: { data: { email_verified_at: "2026-01-01T00:00:00Z" }, error: null } },
    },
  });
  const res = await handler(makeRequest({ token: "valid-jwt", body: {} }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; alreadyVerified: boolean };
  assertEquals(body.ok, true);
  assertEquals(body.alreadyVerified, true);
});

// qa: edge.real.email-verification-send.07
Deno.test("email-verification-send — token insert error returns 500", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: validUser }, error: null },
    tables: {
      profiles: { selectMaybeSingle: { data: { email_verified_at: null }, error: null } },
      email_verification_tokens: {
        selectMaybeSingle: { data: null, error: { message: "insert failed" } },
      },
    },
  });
  const res = await handler(makeRequest({ token: "valid-jwt", body: {} }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Failed to create verification token");
});

// qa: edge.real.email-verification-send.08
Deno.test("email-verification-send — success without RESEND returns 200 ok:true", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: validUser }, error: null },
    tables: {
      profiles: { selectMaybeSingle: { data: { email_verified_at: null }, error: null } },
      email_verification_tokens: {
        selectMaybeSingle: { data: { token: "verify-tok-abc123" }, error: null },
      },
    },
  });
  const res = await handler(makeRequest({ token: "valid-jwt", body: {} }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean };
  assertEquals(body.ok, true);
});

// qa: edge.real.email-verification-send.09
Deno.test("email-verification-send — response shape pinning: ok + optional alreadyVerified", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: validUser }, error: null },
    tables: {
      profiles: { selectMaybeSingle: { data: { email_verified_at: null }, error: null } },
      email_verification_tokens: {
        selectMaybeSingle: { data: { token: "verify-tok-abc123" }, error: null },
      },
    },
  });
  const res = await handler(makeRequest({ token: "valid-jwt", body: {} }));
  assertEquals(res.status, 200);
  const body = await res.json() as { ok?: boolean; alreadyVerified?: boolean; error?: string };
  assertEquals(body.ok, true);
  // Verify only expected fields are present: ok or alreadyVerified, never error on success
  const keys = Object.keys(body);
  const allowedKeys = ["ok", "alreadyVerified"];
  for (const key of keys) {
    assertEquals(allowedKeys.includes(key), true, `unexpected field in response: ${key}`);
  }
});
