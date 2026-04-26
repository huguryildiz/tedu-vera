// Real Deno tests for log-export-event/index.ts.
// Namespace: edge.real.log.*
//
// Covers: method/auth gate, env gate, token/auth.getUser failure, input
// validation (action must start with "export."), org membership check,
// audit-write success, audit-write failure → 500 (fail-closed).

import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
  clearSupabaseEnv,
  makeRequest,
  readJson,
  setDefaultEnv,
} from "../_test/harness.ts";
import {
  SuccessResponseSchema,
  ValidationErrorResponseSchema,
  InternalErrorResponseSchema,
} from "./schema.ts";
import {
  getCalls,
  resetMockConfig,
  setMockConfig,
} from "../_test/mock-supabase.ts";

const modulePath = new URL("./index.ts", import.meta.url).href;

async function setup() {
  setDefaultEnv();
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  return handler;
}

// qa: edge.real.log.01
Deno.test("log-export-event — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
});

// qa: edge.real.log.02
Deno.test("log-export-event — non-POST returns 405", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
});

// qa: edge.real.log.03
Deno.test("log-export-event — missing env returns 500", async () => {
  const handler = await setup();
  clearSupabaseEnv();
  const res = await handler(makeRequest({ token: "t", body: { action: "export.scores" } }));
  assertEquals(res.status, 500);
});

// qa: edge.real.log.04
Deno.test("log-export-event — missing bearer token returns 401", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: { action: "export.scores" } }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Missing bearer token");
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.log.05
Deno.test("log-export-event — invalid JWT returns 401", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: null }, error: { message: "invalid token" } },
  });
  const res = await handler(makeRequest({
    token: "bad",
    body: { action: "export.scores" },
  }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.log.06
Deno.test("log-export-event — invalid JSON body returns 400", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "u-1" } }, error: null },
  });
  const req = new Request("http://localhost/fn", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer tok",
    },
    body: "{bad",
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Invalid JSON body");
  assertEquals(typeof body.error, "string");
});

// qa: edge.real.log.07
Deno.test(
  "log-export-event — action not starting with 'export.' returns 400",
  async () => {
    const handler = await setup();
    setMockConfig({
      authGetUser: { data: { user: { id: "u-1" } }, error: null },
    });
    const res = await handler(makeRequest({
      token: "tok",
      body: { action: "data.score.edit_requested" },
    }));
    assertEquals(res.status, 400);
    const body = await readJson(res) as { error: string };
    assert(body.error.includes("export."));
    assertEquals(typeof body.error, "string");
  },
);

// qa: edge.real.log.08
Deno.test(
  "log-export-event — caller is not a member of organizationId → 403",
  async () => {
    const handler = await setup();
    setMockConfig({
      authGetUser: { data: { user: { id: "u-1" } }, error: null },
      tables: {
        memberships: {
          // Caller only belongs to a different org.
          selectList: {
            data: [{ organization_id: "other-org" }],
            error: null,
          },
        },
      },
    });
    const res = await handler(makeRequest({
      token: "tok",
      body: { action: "export.scores", organizationId: "target-org" },
    }));
    assertEquals(res.status, 403);
    const body = await readJson(res) as { error: string };
    assert(body.error.includes("Forbidden"));
    assertEquals(typeof body.error, "string");
  },
);

// qa: edge.real.log.09
Deno.test(
  "log-export-event — membership query error returns 403",
  async () => {
    const handler = await setup();
    setMockConfig({
      authGetUser: { data: { user: { id: "u-1" } }, error: null },
      tables: {
        memberships: {
          selectList: { data: null, error: { message: "rls denied" } },
        },
      },
    });
    const res = await handler(makeRequest({
      token: "tok",
      body: { action: "export.scores", organizationId: "org-1" },
    }));
    assertEquals(res.status, 403);
    const body = await readJson(res) as { error: string; details?: string };
    assertEquals(body.error, "Membership check failed");
    assertEquals(typeof body.error, "string");
    if (body.details) assertEquals(typeof body.details, "string");
  },
);

// qa: edge.real.log.10
Deno.test(
  "log-export-event — super-admin (org=null membership) passes and writes audit row",
  async () => {
    const handler = await setup();
    setMockConfig({
      authGetUser: { data: { user: { id: "super-1" } }, error: null },
      tables: {
        memberships: {
          // org=null indicates super admin; allowed for any target org.
          selectList: {
            data: [{ organization_id: null }],
            error: null,
          },
        },
        audit_logs: { insert: { data: null, error: null } },
      },
    });
    const res = await handler(makeRequest({
      token: "tok",
      body: {
        action: "export.scores",
        organizationId: "target-org",
        resourceType: "period",
        resourceId: "p-1",
        details: {
          format: "XLSX",
          row_count: 42,
          period_name: "Spring 2026",
          filters: { status: "final" },
        },
      },
    }));
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean };
    assertEquals(body.ok, true);
    assertEquals(typeof body.ok, "boolean");

    const insert = getCalls().find(
      (c) => c.table === "audit_logs" && c.op === "insert",
    );
    assert(insert, "expected audit_logs insert");
    const row = insert!.payload as Record<string, unknown>;
    assertEquals(row.action, "export.scores");
    assertEquals(row.organization_id, "target-org");
    assertEquals(row.user_id, "super-1");
    assertEquals(row.actor_type, "admin");
    assertEquals(row.category, "security");
    assertEquals(row.severity, "info");
    const details = row.details as Record<string, unknown>;
    assertEquals(details.format, "xlsx"); // normalized to lowercase
    assertEquals(details.row_count, 42);
  },
);

// qa: edge.real.log.11
Deno.test(
  "log-export-event — nullable optional fields match browser export payload",
  async () => {
    const handler = await setup();
    setMockConfig({
      authGetUser: { data: { user: { id: "u-1" } }, error: null },
      tables: {
        memberships: {
          selectList: { data: [{ organization_id: "org-1" }], error: null },
        },
        audit_logs: { insert: { data: null, error: null } },
      },
    });
    const res = await handler(makeRequest({
      token: "tok",
      body: {
        action: "export.rankings",
        organizationId: "org-1",
        resourceType: "score_sheets",
        resourceId: null,
        details: {
          format: "xlsx",
          period_name: null,
          row_count: 2,
          project_count: 2,
          juror_count: null,
          filters: {
            search: null,
            consensus: "all",
            criterion: "all",
            min_avg: null,
            max_avg: null,
          },
        },
      },
    }));
    assertEquals(res.status, 200);
    const body = await readJson(res) as { ok: boolean };
    assertEquals(body.ok, true);

    const insert = getCalls().find(
      (c) => c.table === "audit_logs" && c.op === "insert",
    );
    assert(insert, "expected audit_logs insert");
    const row = insert!.payload as Record<string, unknown>;
    assertEquals(row.action, "export.rankings");
    assertEquals(row.resource_type, "score_sheets");
    assertEquals(row.resource_id, null);
    const details = row.details as Record<string, unknown>;
    assertEquals(details.period_name, null);
    assertEquals(details.juror_count, null);
  },
);

// qa: edge.real.log.12
Deno.test(
  "log-export-event — audit insert failure → 500 (fail-closed guarantee)",
  async () => {
    const handler = await setup();
    setMockConfig({
      authGetUser: { data: { user: { id: "u-1" } }, error: null },
      tables: {
        memberships: {
          selectList: { data: [{ organization_id: "org-1" }], error: null },
        },
        audit_logs: {
          insert: { data: null, error: { message: "chain hash failed" } },
        },
      },
    });
    const res = await handler(makeRequest({
      token: "tok",
      body: { action: "export.scores", organizationId: "org-1" },
    }));
    assertEquals(res.status, 500);
    const body = await readJson(res) as { error: string };
    assertEquals(body.error, "Audit write failed");
    assertEquals(typeof body.error, "string");
  },
);

// ── edge.schema namespace ──────────────────────────────────────────────────

// qa: edge.schema.log-export-event.success
Deno.test("log-export-event — schema.success pins ok field on audit write success", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "u-1" } }, error: null },
    tables: {
      memberships: { selectList: { data: [{ organization_id: "org-1" }], error: null } },
      audit_logs: { insert: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    token: "tok",
    body: { action: "export.scores", organizationId: "org-1" },
  }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as Record<string, unknown>;
  assertEquals(typeof body.ok, "boolean");
  assertEquals(body.ok, true);
});

// qa: edge.log-export-event.schema.success
Deno.test(
  "log-export-event — 200 success response parses against SuccessResponseSchema",
  async () => {
    const handler = await setup();
    setMockConfig({
      authGetUser: { data: { user: { id: "u-1" } }, error: null },
      tables: {
        memberships: { selectList: { data: [{ organization_id: "org-1" }], error: null } },
        audit_logs: { insert: { data: null, error: null } },
      },
    });
    const res = await handler(makeRequest({
      token: "tok",
      body: { action: "export.scores", organizationId: "org-1" },
    }));
    assertEquals(res.status, 200);
    const body = await readJson(res);
    SuccessResponseSchema.parse(body);
  }
);

// qa: edge.log-export-event.schema.validation
Deno.test(
  "log-export-event — 400 invalid-action response parses against ValidationErrorResponseSchema",
  async () => {
    const handler = await setup();
    setMockConfig({
      authGetUser: { data: { user: { id: "u-1" } }, error: null },
    });
    const res = await handler(makeRequest({
      token: "tok",
      body: { action: "notexport.scores", organizationId: "org-1" },
    }));
    assertEquals(res.status, 400);
    const body = await readJson(res);
    ValidationErrorResponseSchema.parse(body);
  }
);

// qa: edge.log-export-event.schema.internal-error
Deno.test(
  "log-export-event — 500 unhandled-exception response parses against InternalErrorResponseSchema",
  async () => {
    const handler = await setup();
    setMockConfig({
      authGetUser: { data: { user: { id: "u-1" } }, error: null },
      tables: {
        memberships: { selectList: { data: [{ organization_id: "org-1" }], error: null } },
        audit_logs: { insert: { data: null, error: { message: "write failed" } } },
      },
    });
    const res = await handler(makeRequest({
      token: "tok",
      body: { action: "export.scores", organizationId: "org-1" },
    }));
    assertEquals(res.status, 500);
    const body = await readJson(res);
    InternalErrorResponseSchema.parse(body);
  }
);
