import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
  clearSupabaseEnv,
  makeRequest,
  readJson,
  setDefaultEnv,
} from "../_test/harness.ts";
import { resetMockConfig, setMockConfig } from "../_test/mock-supabase.ts";
import {
  SuccessResponseSchema,
  ValidationErrorResponseSchema,
  InternalErrorResponseSchema,
} from "./schema.ts";

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
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.notify-maintenance.02
Deno.test("notify-maintenance — missing Supabase env returns 500", async () => {
  const handler = await setup();
  clearSupabaseEnv();
  const res = await handler(makeRequest({ token: "any-token", body: {} }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error.includes("not configured"), true);
  assertEquals(typeof body.error, "string");
  setDefaultEnv();
});

// qa: edge.real.notify-maintenance.03
Deno.test("notify-maintenance — non-super-admin returns 403", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "u1", email: "user@test.com" } as unknown as { id: string } }, error: null },
    tables: {
      memberships: { selectMaybeSingle: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({ token: "user-jwt", body: {} }));
  assertEquals(res.status, 403);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "super_admin required");
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.notify-maintenance.04
Deno.test("notify-maintenance — no active org admins returns 200 sent:0", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "super1", email: "super@test.com" } as unknown as { id: string } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: { data: { organization_id: null }, error: null },
        selectList: { data: [], error: null },
      },
    },
  });
  const res = await handler(makeRequest({ token: "super-jwt", body: {} }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; sent: number; skipped: string };
  assertEquals(body.ok, true);
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.sent, 0);
  assertEquals(typeof body.sent, "number");
  assertEquals(body.skipped, "no active org admins found");
  assertEquals(typeof body.skipped, "string");
});

// qa: edge.real.notify-maintenance.05
Deno.test("notify-maintenance — testRecipient mismatch returns 400", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "u1", email: "caller@test.com" } as unknown as { id: string } }, error: null },
    tables: {
      memberships: { selectMaybeSingle: { data: { organization_id: null }, error: null } },
    },
  });
  const res = await handler(makeRequest({
    token: "super-jwt",
    body: { testRecipient: "other@test.com" },
  }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error.includes("testRecipient"), true);
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.notify-maintenance.06
Deno.test("notify-maintenance — members fetch error returns 500", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "super1", email: "super@test.com" } as unknown as { id: string } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: { data: { organization_id: null }, error: null },
        selectList: { data: null, error: { message: "relation not found" } },
      },
    },
  });
  const res = await handler(makeRequest({ token: "super-jwt", body: {} }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error.includes("Failed to list members"), true);
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.notify-maintenance.07
Deno.test("notify-maintenance — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  assertEquals(typeof res.headers.get("access-control-allow-origin"), "string");
});

// qa: edge.real.notify-maintenance.08
Deno.test("notify-maintenance — non-POST returns 405", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Method not allowed");
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.notify-maintenance.09
Deno.test("notify-maintenance — listUsers error returns 500", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "super1", email: "super@test.com" } as unknown as { id: string } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: { data: { organization_id: null }, error: null },
        selectList: {
          data: [
            {
              user_id: "u1",
              organization_id: "org1",
              organizations: { id: "org1", name: "Test Org", status: "active" },
            },
          ],
          error: null,
        },
      },
    },
    adminListUsers: { data: null, error: { message: "connection refused" } },
  });
  const res = await handler(makeRequest({ token: "super-jwt", body: {} }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error.includes("Failed to list auth users"), true);
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.notify-maintenance.10
Deno.test("notify-maintenance — happy path no RESEND returns 200 sent:1", async () => {
  const handler = await setup();
  Deno.env.delete("RESEND_API_KEY");
  setMockConfig({
    authGetUser: { data: { user: { id: "super1", email: "super@test.com" } as unknown as { id: string } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: { data: { organization_id: null }, error: null },
        selectList: {
          data: [
            {
              user_id: "u1",
              organization_id: "org1",
              organizations: { id: "org1", name: "Test Org", status: "active" },
            },
          ],
          error: null,
        },
      },
    },
    adminListUsers: {
      data: { users: [{ id: "u1", email: "admin@test.com" }] },
      error: null,
    },
  });
  const res = await handler(makeRequest({ token: "super-jwt", body: {} }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; sent: number; total: number };
  assertEquals(body.ok, true);
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.sent, 1);
  assertEquals(typeof body.sent, "number");
  assertEquals(body.total, 1);
  assertEquals(typeof body.total, "number");
});

// qa: edge.real.notify-maintenance.11
Deno.test("notify-maintenance — invalid JSON body returns 500", async () => {
  const handler = await setup();
  const req = new Request("http://localhost/fn", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer super-jwt",
    },
    body: "{invalid json",
  });
  const res = await handler(req);
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(typeof body.error, "string");
  assert(body.error.length > 0);
});

// qa: edge.real.notify-maintenance.12
Deno.test("notify-maintenance — profiles fetch error does not block send", async () => {
  const handler = await setup();
  Deno.env.delete("RESEND_API_KEY");
  setMockConfig({
    authGetUser: { data: { user: { id: "super1", email: "super@test.com" } as unknown as { id: string } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: { data: { organization_id: null }, error: null },
        selectList: {
          data: [
            {
              user_id: "u1",
              organization_id: "org1",
              organizations: { id: "org1", name: "Test Org", status: "active" },
            },
          ],
          error: null,
        },
      },
      profiles: {
        selectList: { data: null, error: { message: "fetch failed" } },
      },
    },
    adminListUsers: {
      data: { users: [{ id: "u1", email: "admin@test.com" }] },
      error: null,
    },
  });
  const res = await handler(makeRequest({ token: "super-jwt", body: {} }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean; sent: number };
  assertEquals(body.ok, true);
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.sent, 1);
  assertEquals(typeof body.sent, "number");
});

// qa: edge.real.notify-maintenance.13
Deno.test("notify-maintenance — response shape pins ok/sent/total/errors fields", async () => {
  const handler = await setup();
  Deno.env.delete("RESEND_API_KEY");
  setMockConfig({
    authGetUser: { data: { user: { id: "super1", email: "super@test.com" } as unknown as { id: string } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: { data: { organization_id: null }, error: null },
        selectList: {
          data: [
            {
              user_id: "u1",
              organization_id: "org1",
              organizations: { id: "org1", name: "Test Org", status: "active" },
            },
          ],
          error: null,
        },
      },
    },
    adminListUsers: {
      data: { users: [{ id: "u1", email: "admin@test.com" }] },
      error: null,
    },
  });
  const res = await handler(makeRequest({ token: "super-jwt", body: {} }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as Record<string, unknown>;
  assertEquals(typeof body.ok, "boolean");
  assertEquals(typeof body.sent, "number");
  assertEquals(typeof body.total, "number");
  // errors field is optional (only present if errors.length > 0)
  if (body.errors) {
    assertEquals(Array.isArray(body.errors), true);
  }
});

// ── edge.schema namespace ──────────────────────────────────────────────────

// qa: edge.schema.notify-maintenance.success
Deno.test("notify-maintenance — schema.success pins ok/sent/total response shape on success", async () => {
  const handler = await setup();
  Deno.env.delete("RESEND_API_KEY");
  setMockConfig({
    authGetUser: { data: { user: { id: "super1", email: "super@test.com" } as unknown as { id: string } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: { data: { organization_id: null }, error: null },
        selectList: {
          data: [
            {
              user_id: "u1",
              organization_id: "org1",
              organizations: { id: "org1", name: "Test Org", status: "active" },
            },
          ],
          error: null,
        },
      },
    },
    adminListUsers: {
      data: { users: [{ id: "u1", email: "admin@test.com" }] },
      error: null,
    },
  });
  const res = await handler(makeRequest({ token: "super-jwt", body: {} }));
  assertEquals(res.status, 200);
  const body = await res.json() as { ok: boolean; sent: number; total: number };
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.ok, true);
  assertEquals(typeof body.sent, "number");
  assertEquals(typeof body.total, "number");
  assertEquals(body.sent >= 0, true);
  assertEquals(body.total >= 0, true);
});

// qa: edge.schema.notify-maintenance.internal-error
Deno.test("notify-maintenance — schema.internal-error pins error field on listUsers failure", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "super1", email: "super@test.com" } as unknown as { id: string } }, error: null },
    tables: {
      memberships: {
        selectMaybeSingle: { data: { organization_id: null }, error: null },
        selectList: {
          data: [
            {
              user_id: "u1",
              organization_id: "org1",
              organizations: { id: "org1", name: "Test Org", status: "active" },
            },
          ],
          error: null,
        },
      },
    },
    adminListUsers: { data: null, error: { message: "auth unavailable" } },
  });
  const res = await handler(makeRequest({ token: "super-jwt", body: {} }));
  assertEquals(res.status, 500);
  const body = await res.json() as Record<string, unknown>;
  assertEquals(typeof body.error, "string");
  assert(body.error && String(body.error).length > 0);
});

// qa: edge.notify-maintenance.schema.success
Deno.test(
  "notify-maintenance — 200 success response parses against SuccessResponseSchema",
  async () => {
    const handler = await setup();
    Deno.env.delete("RESEND_API_KEY");
    setMockConfig({
      authGetUser: { data: { user: { id: "super1", email: "super@test.com" } as unknown as { id: string } }, error: null },
      tables: {
        memberships: {
          selectMaybeSingle: { data: { organization_id: null }, error: null },
          selectList: {
            data: [
              {
                user_id: "u1",
                organization_id: "org1",
                organizations: { id: "org1", name: "Test Org", status: "active" },
              },
            ],
            error: null,
          },
        },
      },
      adminListUsers: {
        data: { users: [{ id: "u1", email: "admin@test.com" }] },
        error: null,
      },
    });
    const res = await handler(makeRequest({ token: "super-jwt", body: {} }));
    assertEquals(res.status, 200);
    const body = await readJson(res);
    SuccessResponseSchema.parse(body);
  }
);

// qa: edge.notify-maintenance.schema.validation
Deno.test(
  "notify-maintenance — 401 missing-token response parses against ValidationErrorResponseSchema",
  async () => {
    const handler = await setup();
    const res = await handler(makeRequest({ body: {} }));
    assertEquals(res.status, 401);
    const body = await readJson(res);
    ValidationErrorResponseSchema.parse(body);
  }
);

// qa: edge.notify-maintenance.schema.internal-error
Deno.test(
  "notify-maintenance — 500 members-fetch-error response parses against InternalErrorResponseSchema",
  async () => {
    const handler = await setup();
    setMockConfig({
      authGetUser: { data: { user: { id: "super1", email: "super@test.com" } as unknown as { id: string } }, error: null },
      tables: {
        memberships: {
          selectMaybeSingle: { data: { organization_id: null }, error: null },
          selectList: { data: null, error: { message: "fetch failed" } },
        },
      },
    });
    const res = await handler(makeRequest({ token: "super-jwt", body: {} }));
    assertEquals(res.status, 500);
    const body = await readJson(res);
    InternalErrorResponseSchema.parse(body);
  }
);
