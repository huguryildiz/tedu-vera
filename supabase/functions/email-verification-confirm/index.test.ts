import { assertEquals } from "jsr:@std/assert@^1.0.0";
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

// qa: edge.verify.01
Deno.test("email-verification-confirm — OPTIONS returns 200 with CORS headers", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "OPTIONS" }));
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  assertEquals(typeof res.headers.get("access-control-allow-origin"), "string");
});

// qa: edge.verify.02
Deno.test("email-verification-confirm — non-POST returns 405", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ method: "GET" }));
  assertEquals(res.status, 405);
  const body = await readJson(res) as { error: string };
  assertEquals(typeof body.error, "string");
});

// qa: edge.verify.03
Deno.test("email-verification-confirm — missing env returns 500", async () => {
  const handler = await setup();
  clearSupabaseEnv();
  const res = await handler(makeRequest({ body: { token: "11111111-1111-1111-1111-111111111111" } }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Supabase environment is not configured.");
  assertEquals(typeof body.error, "string");
});

// qa: edge.verify.04
Deno.test("email-verification-confirm — invalid JSON returns 400", async () => {
  const handler = await setup();
  const req = new Request("http://localhost/fn", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not valid",
  });
  const res = await handler(req);
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "Invalid JSON");
  assertEquals(typeof body.error, "string");
});

// qa: edge.verify.05
Deno.test("email-verification-confirm — missing token returns 400", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: {} }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "token is required and must be a string");
  assertEquals(typeof body.error, "string");
});

// qa: edge.verify.06
Deno.test("email-verification-confirm — non-UUID token returns 400 invalid_token_format", async () => {
  const handler = await setup();
  const res = await handler(makeRequest({ body: { token: "not-a-uuid" } }));
  assertEquals(res.status, 400);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "invalid_token_format");
  assertEquals(typeof body.error, "string");
});

// qa: edge.verify.07
Deno.test("email-verification-confirm — unknown token returns 404", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      email_verification_tokens: {
        selectMaybeSingle: { data: null, error: null },
      },
    },
  });
  const res = await handler(makeRequest({ body: { token: "11111111-1111-1111-1111-111111111111" } }));
  assertEquals(res.status, 404);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "token_not_found");
  assertEquals(typeof body.error, "string");
});

// qa: edge.verify.08
Deno.test("email-verification-confirm — already-consumed token returns 410", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      email_verification_tokens: {
        selectMaybeSingle: {
          data: {
            token: "11111111-1111-1111-1111-111111111111",
            user_id: "user-1",
            email: "a@b.com",
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
            consumed_at: new Date().toISOString(),
          },
          error: null,
        },
      },
    },
  });
  const res = await handler(makeRequest({ body: { token: "11111111-1111-1111-1111-111111111111" } }));
  assertEquals(res.status, 410);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "token_already_used");
  assertEquals(typeof body.error, "string");
});

// qa: edge.verify.09
Deno.test("email-verification-confirm — expired token returns 410", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      email_verification_tokens: {
        selectMaybeSingle: {
          data: {
            token: "11111111-1111-1111-1111-111111111111",
            user_id: "user-1",
            email: "a@b.com",
            expires_at: new Date(Date.now() - 3600_000).toISOString(),
            consumed_at: null,
          },
          error: null,
        },
      },
    },
  });
  const res = await handler(makeRequest({ body: { token: "11111111-1111-1111-1111-111111111111" } }));
  assertEquals(res.status, 410);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "token_expired");
  assertEquals(typeof body.error, "string");
});

// qa: edge.verify.10
Deno.test("email-verification-confirm — valid token returns 200 and marks verified", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      email_verification_tokens: {
        selectMaybeSingle: {
          data: {
            token: "11111111-1111-1111-1111-111111111111",
            user_id: "user-1",
            email: "a@b.com",
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
            consumed_at: null,
          },
          error: null,
        },
        update: { data: null, error: null },
      },
      profiles: {
        update: { data: null, error: null },
      },
    },
  });
  const res = await handler(makeRequest({ body: { token: "11111111-1111-1111-1111-111111111111" } }));
  assertEquals(res.status, 200);
  const body = await readJson(res) as { ok: boolean };
  assertEquals(body.ok, true);
  assertEquals(typeof body.ok, "boolean");
});

// qa: edge.verify.11
Deno.test("email-verification-confirm — profile update error returns 500", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      email_verification_tokens: {
        selectMaybeSingle: {
          data: {
            token: "11111111-1111-1111-1111-111111111111",
            user_id: "user-1",
            email: "a@b.com",
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
            consumed_at: null,
          },
          error: null,
        },
      },
      profiles: {
        update: { data: null, error: { message: "update failed" } },
      },
    },
  });
  const res = await handler(makeRequest({ body: { token: "11111111-1111-1111-1111-111111111111" } }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "update failed");
  assertEquals(typeof body.error, "string");
});

// qa: edge.verify.12
Deno.test("email-verification-confirm — token mark-consumed error returns 500", async () => {
  const handler = await setup();
  setMockConfig({
    tables: {
      email_verification_tokens: {
        selectMaybeSingle: {
          data: {
            token: "11111111-1111-1111-1111-111111111111",
            user_id: "user-1",
            email: "a@b.com",
            expires_at: new Date(Date.now() + 3600_000).toISOString(),
            consumed_at: null,
          },
          error: null,
        },
        update: { data: null, error: { message: "token update failed" } },
      },
      profiles: {
        update: { data: null, error: null },
      },
    },
  });
  const res = await handler(makeRequest({ body: { token: "11111111-1111-1111-1111-111111111111" } }));
  assertEquals(res.status, 500);
  const body = await readJson(res) as { error: string };
  assertEquals(body.error, "token update failed");
  assertEquals(typeof body.error, "string");
});

// qa: edge.email-verification-confirm.schema.success
Deno.test(
  "email-verification-confirm — 200 success response parses against SuccessResponseSchema",
  async () => {
    const handler = await setup();
    setMockConfig({
      tables: {
        email_verification_tokens: {
          selectMaybeSingle: {
            data: {
              token: "11111111-1111-1111-1111-111111111111",
              user_id: "user-1",
              email: "a@b.com",
              expires_at: new Date(Date.now() + 3600_000).toISOString(),
              consumed_at: null,
            },
            error: null,
          },
          update: { data: null, error: null },
        },
        profiles: {
          update: { data: null, error: null },
        },
      },
    });
    const res = await handler(makeRequest({ body: { token: "11111111-1111-1111-1111-111111111111" } }));
    assertEquals(res.status, 200);
    const body = await readJson(res);
    SuccessResponseSchema.parse(body);
  },
);

// qa: edge.email-verification-confirm.schema.validation
Deno.test(
  "email-verification-confirm — 400 missing-token response parses against ValidationErrorResponseSchema",
  async () => {
    const handler = await setup();
    const res = await handler(makeRequest({ body: {} }));
    assertEquals(res.status, 400);
    const body = await readJson(res);
    ValidationErrorResponseSchema.parse(body);
  },
);

// qa: edge.email-verification-confirm.schema.internal-error
Deno.test(
  "email-verification-confirm — 500 unhandled-exception response parses against InternalErrorResponseSchema",
  async () => {
    const handler = await setup();
    setMockConfig({
      tables: {
        email_verification_tokens: {
          selectMaybeSingle: {
            data: {
              token: "11111111-1111-1111-1111-111111111111",
              user_id: "user-1",
              email: "a@b.com",
              expires_at: new Date(Date.now() + 3600_000).toISOString(),
              consumed_at: null,
            },
            error: null,
          },
        },
        profiles: {
          update: { data: null, error: { message: "profile update failed" } },
        },
      },
    });
    const res = await handler(makeRequest({ body: { token: "11111111-1111-1111-1111-111111111111" } }));
    assertEquals(res.status, 500);
    const body = await readJson(res);
    InternalErrorResponseSchema.parse(body);
  },
);
