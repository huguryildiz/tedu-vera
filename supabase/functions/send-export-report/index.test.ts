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

const validBody = {
  recipients: ["recipient@test.com"],
  fileName: "report.xlsx",
  fileBase64: "base64data==",
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  reportTitle: "Rankings",
};

async function setup() {
  setDefaultEnv();
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  return handler;
}

// qa: edge.real.send-export-report.01
Deno.test("send-export-report — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// qa: edge.real.send-export-report.02
Deno.test("send-export-report — non-POST returns 405", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
});

// qa: edge.real.send-export-report.03
Deno.test("send-export-report — missing required fields returns 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: { fileName: "report.xlsx" } }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error.includes("Missing required fields"), true);
});

// qa: edge.real.send-export-report.04
Deno.test("send-export-report — missing auth token returns 401", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: validBody }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Missing bearer token");
});

// qa: edge.real.send-export-report.05
Deno.test("send-export-report — non-admin caller returns 403", async () => {
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

// qa: edge.real.send-export-report.07
Deno.test("send-export-report — org-A admin requesting org-B export → 403", async () => {
  const handler = await setup();
  // org-A admin has membership for org-A only; requesting org-B export → requireAdminCaller → 403
  setMockConfig({
    authGetUser: { data: { user: { id: "org-a-admin" } }, error: null },
    tables: {
      memberships: { selectMaybeSingle: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    token: "org-a-jwt",
    body: { ...validBody, organizationId: "org-B" },
  }));
  assertEquals(res.status, 403);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "admin access required");
});

// qa: edge.real.send-export-report.06
Deno.test("send-export-report — super_admin, no RESEND_API_KEY returns 200 sent:false", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "user-1" } }, error: null },
    tables: {
      memberships: { selectMaybeSingle: { data: { user_id: "user-1" }, error: null } },
      audit_logs: { insert: { data: null, error: null } },
    },
  });
  const restoreFetch = stubFetch(async () =>
    new Response(JSON.stringify({ id: "email-id" }), { status: 200 })
  );
  try {
    const res = await handler(makeRequest({ token: "valid-jwt", body: validBody }));
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean; sent: boolean };
    assertEquals(body.ok, true);
    assertEquals(body.sent, false);
  } finally {
    restoreFetch();
  }
});
