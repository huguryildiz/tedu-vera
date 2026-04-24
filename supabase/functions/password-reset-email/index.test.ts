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
});

// qa: edge.real.password-reset-email.03
Deno.test("password-reset-email — missing email returns 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: {} }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "A valid email is required.");
});

// qa: edge.real.password-reset-email.04
Deno.test("password-reset-email — email without @ returns 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: { email: "notanemail" } }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "A valid email is required.");
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
});
