// Real Deno tests for audit-log-sink/index.ts.
// Namespace: edge.real.sink.*
//
// NOTE: The plan originally called for rpc-proxy coverage, but that function
// does not exist in the repo. audit-log-sink is its closest security-sensitive
// analog: it acts as a forwarding proxy for audit_logs rows, gates on an HMAC
// shared-secret header, whitelists payload shape (INSERT on audit_logs only),
// and intentionally returns 200 even on downstream sink failures (to avoid
// double-forwarding via webhook retries).

import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
  makeRequest,
  readJson,
  stubFetch,
} from "../_test/harness.ts";

const modulePath = new URL("./index.ts", import.meta.url).href;

async function setup() {
  Deno.env.delete("WEBHOOK_HMAC_SECRET");
  Deno.env.delete("AUDIT_SINK_WEBHOOK_URL");
  Deno.env.delete("AUDIT_SINK_API_KEY");
  const { handler } = await captureHandler(modulePath);
  return handler;
}

// qa: edge.real.sink.01
Deno.test("audit-log-sink — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// qa: edge.real.sink.02
Deno.test("audit-log-sink — non-POST returns 405", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
});

// qa: edge.real.sink.03
Deno.test(
  "audit-log-sink — webhook secret set, wrong header → 200 {ok:false} (never retry)",
  async () => {
    const handler = await setup();
    Deno.env.set("WEBHOOK_HMAC_SECRET", "shared-secret");
    Deno.env.set("AUDIT_SINK_WEBHOOK_URL", "https://sink.example/ingest");
    const res = await handler(makeRequest({
      body: { type: "INSERT", table: "audit_logs", record: { id: 1 } },
      headers: { "x-webhook-secret": "wrong" },
    }));
    // Intentionally 200 so Supabase doesn't retry with a bad secret, but
    // body must signal failure.
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean; error?: string };
    assertEquals(body.ok, false);
    assertEquals(body.error, "Unauthorized");
    Deno.env.delete("WEBHOOK_HMAC_SECRET");
    Deno.env.delete("AUDIT_SINK_WEBHOOK_URL");
  },
);

// qa: edge.real.sink.04
Deno.test(
  "audit-log-sink — sink URL not configured → skipped without fetch",
  async () => {
    const handler = await setup();
    let fetched = false;
    const restore = stubFetch(async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    });
    try {
      const res = await handler(makeRequest({
        body: { type: "INSERT", table: "audit_logs", record: { id: 1 } },
      }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean; skipped: boolean; reason?: string };
      assertEquals(body.ok, true);
      assertEquals(body.skipped, true);
      assert(!fetched, "expected no sink fetch when URL is unset");
    } finally {
      restore();
    }
  },
);

// qa: edge.real.sink.05
Deno.test(
  "audit-log-sink — invalid JSON body returns 200 {ok:false, error:'Invalid JSON'}",
  async () => {
    const handler = await setup();
    Deno.env.set("AUDIT_SINK_WEBHOOK_URL", "https://sink.example/ingest");
    const req = new Request("http://localhost/fn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });
    const res = await handler(req);
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean; error: string };
    assertEquals(body.ok, false);
    assertEquals(body.error, "Invalid JSON");
    Deno.env.delete("AUDIT_SINK_WEBHOOK_URL");
  },
);

// qa: edge.real.sink.06
Deno.test(
  "audit-log-sink — non-INSERT event is skipped (no forward)",
  async () => {
    const handler = await setup();
    Deno.env.set("AUDIT_SINK_WEBHOOK_URL", "https://sink.example/ingest");
    let fetched = false;
    const restore = stubFetch(async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    });
    try {
      const res = await handler(makeRequest({
        body: { type: "UPDATE", table: "audit_logs", record: { id: 1 } },
      }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean; skipped: boolean };
      assertEquals(body.skipped, true);
      assert(!fetched);
    } finally {
      restore();
      Deno.env.delete("AUDIT_SINK_WEBHOOK_URL");
    }
  },
);

// qa: edge.real.sink.07
Deno.test(
  "audit-log-sink — INSERT on non-audit table is skipped",
  async () => {
    const handler = await setup();
    Deno.env.set("AUDIT_SINK_WEBHOOK_URL", "https://sink.example/ingest");
    let fetched = false;
    const restore = stubFetch(async () => {
      fetched = true;
      return new Response("{}", { status: 200 });
    });
    try {
      const res = await handler(makeRequest({
        body: { type: "INSERT", table: "scores", record: { id: 1 } },
      }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { skipped: boolean };
      assertEquals(body.skipped, true);
      assert(!fetched);
    } finally {
      restore();
      Deno.env.delete("AUDIT_SINK_WEBHOOK_URL");
    }
  },
);

// qa: edge.real.sink.08
Deno.test(
  "audit-log-sink — valid INSERT forwards record as JSON array with bearer",
  async () => {
    const handler = await setup();
    Deno.env.set("AUDIT_SINK_WEBHOOK_URL", "https://sink.example/ingest");
    Deno.env.set("AUDIT_SINK_API_KEY", "sk-test");
    const captured: Array<{ url: string; auth: string; body: unknown }> = [];
    const restore = stubFetch(async (input, init) => {
      const url = typeof input === "string" ? input : (input as URL).toString();
      const headers = new Headers(init?.headers as HeadersInit);
      captured.push({
        url,
        auth: headers.get("authorization") || "",
        body: JSON.parse((init?.body ?? "").toString()),
      });
      return new Response("{}", { status: 200 });
    });
    try {
      const record = {
        id: "a-1",
        action: "data.score.updated",
        organization_id: "org-1",
      };
      const res = await handler(makeRequest({
        body: { type: "INSERT", table: "audit_logs", record },
      }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean; sink_status: number };
      assertEquals(body.ok, true);
      assertEquals(body.sink_status, 200);
      assertEquals(captured.length, 1);
      assertEquals(captured[0].url, "https://sink.example/ingest");
      assertEquals(captured[0].auth, "Bearer sk-test");
      // Record must be wrapped in an array for Axiom compatibility.
      assert(Array.isArray(captured[0].body));
      assertEquals((captured[0].body as unknown[]).length, 1);
      assertEquals((captured[0].body as Array<Record<string, unknown>>)[0].id, "a-1");
    } finally {
      restore();
      Deno.env.delete("AUDIT_SINK_WEBHOOK_URL");
      Deno.env.delete("AUDIT_SINK_API_KEY");
    }
  },
);

// qa: edge.real.sink.09
Deno.test(
  "audit-log-sink — sink returns 5xx → 200 {ok:false, sink_status:5xx} (no retry loop)",
  async () => {
    const handler = await setup();
    Deno.env.set("AUDIT_SINK_WEBHOOK_URL", "https://sink.example/ingest");
    const restore = stubFetch(async () =>
      new Response("upstream down", { status: 502 })
    );
    try {
      const res = await handler(makeRequest({
        body: { type: "INSERT", table: "audit_logs", record: { id: 1 } },
      }));
      // Critical invariant: never return non-2xx or Supabase webhook retries
      // would double-forward the event. Failure is communicated via body.
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean; sink_status: number };
      assertEquals(body.ok, false);
      assertEquals(body.sink_status, 502);
    } finally {
      restore();
      Deno.env.delete("AUDIT_SINK_WEBHOOK_URL");
    }
  },
);

// qa: edge.real.sink.10
Deno.test(
  "audit-log-sink — fetch throws (network error) → 200 {ok:false, error:<msg>}",
  async () => {
    const handler = await setup();
    Deno.env.set("AUDIT_SINK_WEBHOOK_URL", "https://sink.example/ingest");
    const restore = stubFetch(async () => {
      throw new Error("ECONNRESET");
    });
    try {
      const res = await handler(makeRequest({
        body: { type: "INSERT", table: "audit_logs", record: { id: 1 } },
      }));
      assertEquals(res.status, 200);
      const body = await readJson(res) as { ok: boolean; error: string };
      assertEquals(body.ok, false);
      assert(body.error.includes("ECONNRESET"));
    } finally {
      restore();
      Deno.env.delete("AUDIT_SINK_WEBHOOK_URL");
    }
  },
);
