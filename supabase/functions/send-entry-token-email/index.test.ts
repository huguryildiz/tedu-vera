import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
  makeRequest,
  readJson,
  setDefaultEnv,
  stubFetch,
} from "../_test/harness.ts";
import { resetMockConfig, setMockConfig } from "../_test/mock-supabase.ts";

const modulePath = new URL("./index.ts", import.meta.url).href;

const TOKEN_URL = "https://vera-eval.app?eval=abc123";

const validBody = {
  recipientEmail: "juror@test.edu",
  tokenUrl: TOKEN_URL,
  periodName: "Spring 2026",
};

async function setup() {
  setDefaultEnv();
  Deno.env.delete("RESEND_API_KEY");
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  return handler;
}

function mockSuperAdmin() {
  setMockConfig({
    authGetUser: { data: { user: { id: "admin-1" } }, error: null },
    tables: {
      memberships: { selectMaybeSingle: { data: { user_id: "admin-1" }, error: null } },
      audit_logs: { insert: { data: null, error: null } },
    },
  });
}

// qa: edge.real.send-entry-token-email.01
Deno.test("send-entry-token-email — missing tokenUrl → 400 before auth", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({
    body: { recipientEmail: "juror@test.edu" },
  }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assert(body.error.includes("Missing required fields"));
});

// qa: edge.real.send-entry-token-email.02
Deno.test("send-entry-token-email — no admin membership → 403", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "user-1" } }, error: null },
    tables: {
      memberships: { selectMaybeSingle: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({ token: "valid-jwt", body: validBody }));
  assertEquals(res.status, 403);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "admin access required");
});

// qa: edge.real.send-entry-token-email.03
Deno.test("send-entry-token-email — Resend success, tokenUrl in text payload", async () => {
  const handler = await setup();
  Deno.env.set("RESEND_API_KEY", "re_test");
  mockSuperAdmin();

  const fetchCalls: Array<{ url: string; body: string }> = [];
  const restore = stubFetch(async (input, init) => {
    const url = typeof input === "string" ? input : (input as URL).toString();
    fetchCalls.push({ url, body: (init?.body ?? "").toString() });
    return new Response(JSON.stringify({ id: "email-ok" }), { status: 200 });
  });
  try {
    const res = await handler(makeRequest({ token: "jwt", body: validBody }));
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean; sent: boolean };
    assertEquals(body.ok, true);
    assertEquals(body.sent, true);
    assert(fetchCalls.length >= 1, "expected Resend fetch");
    assertEquals(fetchCalls[0].url, "https://api.resend.com/emails");
    // PII assertion: tokenUrl must appear in the text field of the Resend payload
    const parsed = JSON.parse(fetchCalls[0].body) as { text?: string };
    assert(parsed.text?.includes(TOKEN_URL), "expected tokenUrl in Resend text payload");
  } finally {
    restore();
    Deno.env.delete("RESEND_API_KEY");
  }
});

// qa: edge.real.send-entry-token-email.04
Deno.test("send-entry-token-email — Resend 429 → 200 sent=false", async () => {
  const handler = await setup();
  Deno.env.set("RESEND_API_KEY", "re_test");
  mockSuperAdmin();

  const restore = stubFetch(async () => new Response("rate limited", { status: 429 }));
  try {
    const res = await handler(makeRequest({ token: "jwt", body: validBody }));
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean; sent: boolean; error?: string };
    assertEquals(body.ok, true);
    assertEquals(body.sent, false);
    assert(body.error && body.error.includes("Resend"));
  } finally {
    restore();
    Deno.env.delete("RESEND_API_KEY");
  }
});
