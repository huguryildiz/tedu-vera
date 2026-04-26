import { assert, assertEquals } from "jsr:@std/assert@^1.0.0";
import {
  captureHandler,
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
  // Ensure Resend path is skipped (non-fatal) so tests don't hit the network.
  Deno.env.delete("RESEND_API_KEY");
  resetMockConfig();
  const { handler } = await captureHandler(modulePath);
  return handler;
}

// qa: edge.invite.01
Deno.test("invite-org-admin — OPTIONS returns 200 with CORS", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
});

// qa: edge.invite.02
Deno.test("invite-org-admin — non-POST returns 405", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
  const body = await readJson(res) as { error: string };
  assertEquals(typeof body.error, "string");
});

// qa: edge.invite.03
Deno.test("invite-org-admin — missing Authorization returns 401", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: { org_id: "o1", email: "a@b.com" } }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Missing bearer token");
  assertEquals(typeof body.error, "string");
});

// qa: edge.invite.04
Deno.test("invite-org-admin — missing org_id returns 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ token: "valid", body: { email: "a@b.com" } }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Missing required field: org_id");
  assertEquals(typeof body.error, "string");
});

// qa: edge.invite.05
Deno.test("invite-org-admin — invalid email returns 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({
    token: "valid",
    body: { org_id: "o1", email: "not-an-email" },
  }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "A valid email is required.");
  assertEquals(typeof body.error, "string");
});

// qa: edge.invite.06
Deno.test("invite-org-admin — auth.getUser error returns 401", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: null }, error: { message: "bad jwt" } },
  });
  const res = await handler(makeRequest({
    token: "bad",
    body: { org_id: "o1", email: "a@b.com" },
  }));
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(typeof body.error, "string");
});

// qa: edge.invite.06b
Deno.test("invite-org-admin — malformed Authorization header returns 401", async () => {
  const handler = await setup();
  const req = new Request("http://localhost/fn", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer not-a-jwt-at-all",
    },
    body: JSON.stringify({ org_id: "o1", email: "a@b.com" }),
  });
  setMockConfig({
    authGetUser: { data: { user: null }, error: { message: "jwt malformed" } },
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Unauthorized");
  assertEquals(typeof body.error, "string");
});

// qa: edge.invite.07
Deno.test("invite-org-admin — non-admin caller (_assert_can_invite fails) returns 403", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "user-1" } }, error: null },
    rpc: {
      _assert_can_invite: { data: null, error: { message: "not authorized" } },
    },
  });
  const res = await handler(makeRequest({
    token: "valid",
    body: { org_id: "o1", email: "a@b.com" },
  }));
  assertEquals(res.status, 403);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "unauthorized");
  assertEquals(typeof body.error, "string");
});

// qa: edge.invite.08
Deno.test("invite-org-admin — existing member returns 409 already_member", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "caller-1" } }, error: null },
    rpc: {
      _assert_can_invite: { data: null, error: null },
      rpc_admin_find_user_by_email: {
        data: [{ id: "existing-user", email_confirmed_at: "2025-01-01T00:00:00Z" }],
        error: null,
      },
    },
    tables: {
      organizations: {
        selectSingle: { data: { institution: "Acme University" }, error: null },
      },
      memberships: {
        selectMaybeSingle: { data: { id: "m1", status: "active" }, error: null },
      },
    },
  });
  const res = await handler(makeRequest({
    token: "valid",
    body: { org_id: "o1", email: "a@b.com" },
  }));
  assertEquals(res.status, 409);
  const body = await readJson(res) as { error: string; status: string };
  assertEquals(body.error, "already_member");
  assertEquals(typeof body.error, "string");
  assertEquals(body.status, "active");
  assertEquals(typeof body.status, "string");
});

// qa: edge.invite.09
Deno.test("invite-org-admin — existing confirmed user without approval_flow → 409 already_exists_in_auth", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "caller-1" } }, error: null },
    rpc: {
      _assert_can_invite: { data: null, error: null },
      rpc_admin_find_user_by_email: {
        data: [{ id: "existing-user", email_confirmed_at: "2025-01-01T00:00:00Z" }],
        error: null,
      },
    },
    tables: {
      organizations: {
        selectSingle: { data: { institution: "Acme" }, error: null },
      },
      memberships: {
        selectMaybeSingle: { data: null, error: null },
      },
    },
  });
  const res = await handler(makeRequest({
    token: "valid",
    body: { org_id: "o1", email: "a@b.com" },
  }));
  assertEquals(res.status, 409);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "already_exists_in_auth");
  assertEquals(typeof body.error, "string");
});

// qa: edge.invite.10
Deno.test("invite-org-admin — approval_flow with existing confirmed user → 200 added", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "caller-1" } }, error: null },
    rpc: {
      _assert_can_invite: { data: null, error: null },
      rpc_admin_find_user_by_email: {
        data: [{ id: "existing-user", email_confirmed_at: "2025-01-01T00:00:00Z" }],
        error: null,
      },
    },
    tables: {
      organizations: {
        selectSingle: { data: { institution: "Acme" }, error: null },
      },
      memberships: {
        selectMaybeSingle: { data: null, error: null },
        insert: { data: null, error: null },
      },
      profiles: {
        insert: { data: null, error: null },
      },
      audit_logs: {
        insert: { data: null, error: null },
      },
    },
  });
  const res = await handler(makeRequest({
    token: "valid",
    body: { org_id: "o1", email: "a@b.com", approval_flow: true },
  }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as Record<string, unknown>;
  assertEquals(body.status, "added");
  assertEquals(typeof body.status, "string");
  assertEquals(body.user_id, "existing-user");
  assertEquals(typeof body.user_id, "string");

  // Verify membership insert carried the right shape.
  const calls = getCalls();
  const insertCall = calls.find((c) => c.op === "insert" && c.table === "memberships");
  assert(insertCall, "expected insert on memberships");
  const payload = insertCall!.payload as Record<string, unknown>;
  assertEquals(payload.user_id, "existing-user");
  assertEquals(payload.organization_id, "o1");
  assertEquals(payload.role, "org_admin");
  assertEquals(payload.status, "active");
});

// qa: edge.invite.11
Deno.test("invite-org-admin — new user → generateLink + insert membership 'invited' → 200", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "caller-1" } }, error: null },
    rpc: {
      _assert_can_invite: { data: null, error: null },
      rpc_admin_find_user_by_email: { data: [], error: null },
    },
    adminGenerateLink: {
      data: {
        properties: { action_link: "https://vera-eval.app/invite/accept?token=abc" },
        user: { id: "new-user-1" },
      },
      error: null,
    },
    tables: {
      organizations: {
        selectSingle: { data: { institution: "Acme" }, error: null },
      },
      memberships: {
        insert: { data: null, error: null },
      },
      profiles: {
        insert: { data: null, error: null },
      },
      audit_logs: {
        insert: { data: null, error: null },
      },
    },
  });
  const res = await handler(makeRequest({
    token: "valid",
    body: { org_id: "o1", email: "new@example.com" },
  }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { status: string; user_id: string; email: string };
  assertEquals(body.status, "invited");
  assertEquals(typeof body.status, "string");
  assertEquals(body.user_id, "new-user-1");
  assertEquals(typeof body.user_id, "string");
  assertEquals(body.email, "new@example.com");
  assertEquals(typeof body.email, "string");

  const calls = getCalls();
  const membershipInsert = calls.find((c) => c.op === "insert" && c.table === "memberships");
  assert(membershipInsert);
  const payload = membershipInsert!.payload as Record<string, unknown>;
  assertEquals(payload.status, "invited");
  assertEquals(payload.role, "org_admin");
});

// qa: edge.invite.12
Deno.test("invite-org-admin — generateLink error returns 400", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "caller-1" } }, error: null },
    rpc: {
      _assert_can_invite: { data: null, error: null },
      rpc_admin_find_user_by_email: { data: [], error: null },
    },
    adminGenerateLink: { data: null, error: { message: "generate failed" } },
    tables: {
      organizations: {
        selectSingle: { data: { institution: "Acme" }, error: null },
      },
    },
  });
  const res = await handler(makeRequest({
    token: "valid",
    body: { org_id: "o1", email: "new@example.com" },
  }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "generate failed");
  assertEquals(typeof body.error, "string");
});

// qa: edge.invite.13
Deno.test("invite-org-admin — success with new user includes expected response shape", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "caller-1" } }, error: null },
    rpc: {
      _assert_can_invite: { data: null, error: null },
      rpc_admin_find_user_by_email: { data: [], error: null },
    },
    adminGenerateLink: {
      data: {
        properties: { action_link: "https://vera-eval.app/invite/accept?token=xyz" },
        user: { id: "new-user-2" },
      },
      error: null,
    },
    tables: {
      organizations: {
        selectSingle: { data: { institution: "Test Org" }, error: null },
      },
      memberships: {
        insert: { data: null, error: null },
      },
      profiles: {
        insert: { data: null, error: null },
      },
      audit_logs: {
        insert: { data: null, error: null },
      },
    },
  });
  const res = await handler(makeRequest({
    token: "valid",
    body: { org_id: "o1", email: "newuser@test.com" },
  }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as Record<string, unknown>;
  // Pin response shape: should have status, user_id, and email
  assertEquals(typeof body.status, "string");
  assertEquals(body.status, "invited");
  assertEquals(typeof body.user_id, "string");
  assertEquals(body.user_id, "new-user-2");
  assertEquals(typeof body.email, "string");
  assertEquals(body.email, "newuser@test.com");
});

// ── edge.schema namespace ──────────────────────────────────────────────────

// qa: edge.schema.invite-org-admin.success
Deno.test("invite-org-admin — schema.success pins status/user_id response shape", async () => {
  const handler = await setup();
  setMockConfig({
    authGetUser: { data: { user: { id: "caller-1" } }, error: null },
    rpc: {
      _assert_can_invite: { data: null, error: null },
      rpc_admin_find_user_by_email: { data: [], error: null },
    },
    adminGenerateLink: {
      data: {
        properties: { action_link: "https://vera-eval.app/invite?token=xyz" },
        user: { id: "new-user-3" },
      },
      error: null,
    },
    tables: {
      organizations: { selectSingle: { data: { institution: "Test Org" }, error: null } },
      memberships: { insert: { data: null, error: null } },
      profiles: { insert: { data: null, error: null } },
      audit_logs: { insert: { data: null, error: null } },
    },
  });
  const res = await handler(makeRequest({
    token: "valid",
    body: { org_id: "o1", email: "new@test.com" },
  }));
  assertEquals(res.status, 200);
  const body = await res.json() as Record<string, unknown>;
  assertEquals(typeof body.status, "string");
  assertEquals(body.status, "invited");
  assertEquals(typeof body.user_id, "string");
  // email is optional in success response
  if (body.email !== undefined) {
    assertEquals(typeof body.email, "string");
  }
});

// qa: edge.invite-org-admin.schema.success
Deno.test(
  "invite-org-admin — 200 success response parses against SuccessResponseSchema",
  async () => {
    const handler = await setup();
    setMockConfig({
      authGetUser: { data: { user: { id: "caller-1" } }, error: null },
      rpc: {
        _assert_can_invite: { data: null, error: null },
        rpc_admin_find_user_by_email: { data: [], error: null },
      },
      adminGenerateLink: {
        data: {
          properties: { action_link: "https://vera-eval.app/invite?token=schema-test" },
          user: { id: "new-user-schema" },
        },
        error: null,
      },
      tables: {
        organizations: { selectSingle: { data: { institution: "Test Org" }, error: null } },
        memberships: { insert: { data: null, error: null } },
        profiles: { insert: { data: null, error: null } },
        audit_logs: { insert: { data: null, error: null } },
      },
    });
    const res = await handler(makeRequest({
      token: "valid",
      body: { org_id: "o1", email: "new@test.com" },
    }));
    assertEquals(res.status, 200);
    const body = await readJson(res);
    SuccessResponseSchema.parse(body);
  }
);

// qa: edge.invite-org-admin.schema.validation
Deno.test(
  "invite-org-admin — 400 invalid-email response parses against ValidationErrorResponseSchema",
  async () => {
    const handler = await setup();
    const res = await handler(makeRequest({
      token: "valid",
      body: { org_id: "o1", email: "invalid-email" },
    }));
    assertEquals(res.status, 400);
    const body = await readJson(res);
    ValidationErrorResponseSchema.parse(body);
  }
);

// qa: edge.invite-org-admin.schema.internal-error
Deno.test(
  "invite-org-admin — 500 unhandled-exception response parses against InternalErrorResponseSchema",
  async () => {
    const handler = await setup();
    setMockConfig({
      authGetUser: { data: { user: { id: "caller-1" } }, error: null },
      rpc: {
        _assert_can_invite: { data: null, error: null },
        rpc_admin_find_user_by_email: { data: [], error: null },
      },
      // action_link present but no user.id → "Could not create invited user." → 500
      adminGenerateLink: {
        data: { properties: { action_link: "https://vera-eval.app/invite?token=x" } },
        error: null,
      },
      tables: {
        organizations: { selectSingle: { data: { institution: "Test Org" }, error: null } },
      },
    });
    const res = await handler(makeRequest({
      token: "valid",
      body: { org_id: "o1", email: "new@test.com" },
    }));
    assertEquals(res.status, 500);
    const body = await readJson(res);
    InternalErrorResponseSchema.parse(body);
  }
);
