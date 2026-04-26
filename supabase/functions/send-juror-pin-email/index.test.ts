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

const validBody = {
  recipientEmail: "juror@test.edu",
  jurorName: "Ali Yılmaz",
  pin: "7842",
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

// qa: edge.real.send-juror-pin-email.01
Deno.test("send-juror-pin-email — missing pin → 400 before auth", async () => {
  const handler = await setup();
  // No auth mock needed; body validation fires first
  const res = await handler(makeRequest({
    body: { recipientEmail: "juror@test.edu", jurorName: "Ali" },
  }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assert(body.error.includes("Missing required fields"));
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.send-juror-pin-email.02
Deno.test("send-juror-pin-email — no admin membership → 403", async () => {
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
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.send-juror-pin-email.03
Deno.test("send-juror-pin-email — Resend success, PIN present in text payload", async () => {
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
    assertEquals(typeof body.ok, "boolean");
    assertEquals(body.sent, true);
    assertEquals(typeof body.sent, "boolean");
    assert(fetchCalls.length >= 1, "expected Resend fetch");
    assertEquals(fetchCalls[0].url, "https://api.resend.com/emails");
    // PII assertion: PIN must appear in the text field of the Resend payload
    const parsed = JSON.parse(fetchCalls[0].body) as { text?: string };
    assert(parsed.text?.includes("7842"), "expected PIN in Resend text payload");
  } finally {
    restore();
    Deno.env.delete("RESEND_API_KEY");
  }
});

// qa: edge.real.send-juror-pin-email.04
Deno.test("send-juror-pin-email — Resend 429 → 200 sent=false", async () => {
  const handler = await setup();
  Deno.env.set("RESEND_API_KEY", "re_test");
  mockSuperAdmin();

  const restore = stubFetch(async () => new Response("rate limited", { status: 429 }));
  try {
    const res = await handler(makeRequest({ token: "jwt", body: validBody }));
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean; sent: boolean; error?: string };
    assertEquals(body.ok, true);
    assertEquals(typeof body.ok, "boolean");
    assertEquals(body.sent, false);
    assertEquals(typeof body.sent, "boolean");
    assert(body.error && body.error.includes("Resend"));
    if (body.error) assertEquals(typeof body.error, "string");
  } finally {
    restore();
    Deno.env.delete("RESEND_API_KEY");
  }
});

// qa: edge.send-juror-pin-email.schema.success
Deno.test(
  "send-juror-pin-email — 200 success response parses against SuccessResponseSchema",
  async () => {
    const handler = await setup();
    Deno.env.set("RESEND_API_KEY", "re_test");
    mockSuperAdmin();
    const restoreFetch = stubFetch(async () =>
      new Response(JSON.stringify({ id: "email-ok" }), { status: 200 })
    );
    try {
      const res = await handler(makeRequest({ token: "jwt", body: validBody }));
      assertEquals(res.status, 200);
      const body = await readJson(res);
      SuccessResponseSchema.parse(body);
    } finally {
      restoreFetch();
      Deno.env.delete("RESEND_API_KEY");
    }
  }
);

// qa: edge.send-juror-pin-email.schema.validation
Deno.test(
  "send-juror-pin-email — 400 missing-pin response parses against ValidationErrorResponseSchema",
  async () => {
    const handler = await setup();
    const res = await handler(
      makeRequest({
        body: { recipientEmail: "juror@test.edu", jurorName: "Ali" },
      })
    );
    assertEquals(res.status, 400);
    const body = await readJson(res);
    ValidationErrorResponseSchema.parse(body);
  }
);

// qa: edge.send-juror-pin-email.schema.internal-error
Deno.test(
  "send-juror-pin-email — 500 unhandled-exception response parses against InternalErrorResponseSchema",
  async () => {
    const handler = await setup();
    const req = new Request("http://localhost/fn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{invalid json",
    });
    const res = await handler(req);
    assertEquals(res.status, 500);
    const body = await readJson(res);
    InternalErrorResponseSchema.parse(body);
  }
);
