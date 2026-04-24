import { assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
  makeRequest,
  readJson,
  setDefaultEnv,
  stubFetch,
} from "../_test/harness.ts";
import { resetMockConfig, setMockConfig } from "../_test/mock-supabase.ts";

const modulePath = new URL("./index.ts", import.meta.url).href;

// receive-email captures SUPABASE_URL, SERVICE_ROLE_KEY, RESEND_API_KEY at
// module level — env must be configured BEFORE captureHandler is called.

async function setup() {
  setDefaultEnv();
  Deno.env.delete("RESEND_API_KEY");
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  return handler;
}

async function setupWithResend() {
  setDefaultEnv();
  Deno.env.set("RESEND_API_KEY", "test-resend-key");
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  Deno.env.delete("RESEND_API_KEY");
  return handler;
}

// qa: edge.real.receive-email.01
Deno.test("receive-email — non-POST returns 405 plain text", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
  const body = await res.text();
  assertEquals(body, "Method not allowed");
});

// qa: edge.real.receive-email.02
Deno.test("receive-email — invalid JSON returns 400 plain text", async () => {
  const handler = await setup();
  const req = new Request("http://localhost/fn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "not-valid-json",
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
  const body = await res.text();
  assertEquals(body, "Invalid JSON");
});

// qa: edge.real.receive-email.03
Deno.test("receive-email — valid POST stores email and returns 200 ok:true", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      received_emails: { insert: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    body: {
      data: {
        from: "sender@example.com",
        to: ["inbox@vera-eval.app"],
        subject: "Test Subject",
        text: "Hello world",
      },
    },
  }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean };
  assertEquals(body.ok, true);
});

// qa: edge.real.receive-email.04
Deno.test("receive-email — with RESEND_API_KEY forwards email and returns 200", async () => {
  const handler = await setupWithResend();
  setMockConfig({
    tables: {
      received_emails: { insert: { data: null, error: null } },
    },
  });
  const restoreFetch = stubFetch(async () =>
    new Response(JSON.stringify({ id: "fwd-id" }), { status: 200 })
  );
  try {
    const res = await handler(makeRequest({
      body: {
        from: "sender@example.com",
        to: "inbox@vera-eval.app",
        subject: "Fwd Test",
        text: "Forwarded content",
      },
    }));
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean };
    assertEquals(body.ok, true);
  } finally {
    restoreFetch();
  }
});

// qa: edge.real.receive-email.05
Deno.test("receive-email — DB insert error is fail-open, still returns 200", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      received_emails: { insert: { data: null, error: { message: "DB unavailable" } } },
    },
  });
  const res = await handler(makeRequest({
    body: { from: "x@x.com", to: "y@y.com", subject: "hi" },
  }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean };
  assertEquals(body.ok, true);
});
