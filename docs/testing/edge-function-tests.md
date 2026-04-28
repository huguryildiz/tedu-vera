# Edge Function Tests (Deno)

Edge Functions live in [`supabase/functions/`](../../supabase/functions/)
and are tested via Deno's built-in test runner. Tests use a custom
harness in `supabase/functions/_test/` that mocks the Supabase client.

For the production runtime details and Kong gotchas, see
[../architecture/edge-functions-kong-jwt.md](../architecture/edge-functions-kong-jwt.md).

---

## Commands

```bash
npm run test:edge        # runs Deno test against all functions
```

Equivalent of:

```bash
cd supabase/functions
deno test --allow-net --allow-env --allow-read \
          --import-map=_test/import_map.json
```

The `--allow-*` flags grant network, env, and read access to the test
process. Functions read environment variables (Supabase URL, service
role) so `--allow-env` is required.

---

## Harness

[`supabase/functions/_test/harness.ts`](../../supabase/functions/_test/harness.ts)
provides:

- `mockSupabaseClient()` — returns a stub that implements the methods
  Edge Functions call (`auth.getUser`, `from(...).select(...)`, etc.).
- `withMockEnv(...)` — runs a test with patched environment variables.
- Common request fixtures (POST body, headers).

[`supabase/functions/_test/mock-supabase.ts`](../../supabase/functions/_test/mock-supabase.ts)
holds the actual mock implementation.

---

## When to write an Edge Function test

| Behavior | Test it? |
| --- | --- |
| Custom auth (`auth.getUser` + membership check) | **Yes** — security-critical. |
| Service-role DB write after auth | **Yes** — ensures auth gate is never bypassed. |
| Kong-bypass (`verify_jwt: false`) handling | **Yes** — easy to regress. |
| Email send via SMTP | Sometimes — mock the SMTP transport. |
| Return-shape contract | **Yes** — frontend pages depend on it. |
| External API calls (third-party HTTP) | Mock the network response. |

---

## Pattern: custom-auth Edge Function

The canonical pattern (used by `platform-metrics`, `admin-session-touch`,
`process-tenant-application`):

```typescript
// supabase/functions/<name>/_test.ts
import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { mockSupabaseClient } from "../_test/harness.ts";

Deno.test("rejects request without auth token", async () => {
  const req = new Request("http://localhost", {
    method: "POST",
    body: JSON.stringify({ /* ... */ }),
  });
  const res = await handler(req);
  assertEquals(res.status, 401);
});

Deno.test("rejects non-super-admin caller", async () => {
  const supabase = mockSupabaseClient({
    user: { id: "user-1" },
    memberships: [{ user_id: "user-1", organization_id: "org-1" }],
  });
  const req = new Request("http://localhost", {
    method: "POST",
    headers: { Authorization: "Bearer fake" },
    body: JSON.stringify({ /* ... */ }),
  });
  const res = await handler(req, { supabase });
  assertEquals(res.status, 403);
});

Deno.test("super-admin call succeeds", async () => {
  const supabase = mockSupabaseClient({
    user: { id: "super-1" },
    memberships: [{ user_id: "super-1", organization_id: null }],
  });
  // ... assert 200 + expected body shape
});
```

The three-test triangle (no auth → 401, wrong scope → 403, right scope
→ 200) is the minimum for any custom-auth function.

---

## Drift sentinel

```bash
npm run check:edge-schema
```

Verifies that Edge Function argument shapes and frontend invocation
sites stay in sync. Fails CI on drift.

---

## Anti-patterns

- **Mocking `auth.getUser` to always succeed.** Defeats the entire
  point of the test. Always include "no token" + "wrong role" tests.
- **Testing through HTTP.** The Edge Function harness lets you call
  the handler directly with a `Request` object. Don't spin up a real
  HTTP server.
- **Real Supabase calls in a test.** The harness exists to avoid this.
  A test that hits real Supabase will be flaky and slow and may
  pollute prod data if env vars are misconfigured.
- **Skipping the harness for "simple" functions.** Even "just hello
  world" functions benefit from the test triangle — they grow into
  complex logic surprisingly fast.

---

## Edge Function test ↔ unit test

Edge Function tests assert *Edge Function behavior*. Frontend
invocation patterns (the React side that *calls* an Edge Function via
`invokeEdgeFunction.js`) are unit-tested separately:

- [`src/shared/api/core/__tests__/invokeEdgeFunction.test.js`](../../src/shared/api/core/__tests__/invokeEdgeFunction.test.js) —
  invocation wrapper.
- [`src/shared/api/edge/__tests__/edgeFunctions.test.js`](../../src/shared/api/edge/__tests__/edgeFunctions.test.js) —
  arg-shape and response-handling for individual Edge Functions.

These two layers must stay aligned; the `check:edge-schema` sentinel
catches drift.

---

## Real Edge Function deployment for testing

Tests run against the harness, not the deployed function. To verify a
function actually works end-to-end:

1. Deploy the function to **vera-demo only**:

   ```
   mcp call deploy_edge_function ref=<vera-demo-ref> name=<fn-slug>
   ```

2. Trigger via the application UI on `/demo/admin` or via direct curl
   with a demo super-admin JWT.
3. Inspect the result + the Edge Function logs:

   ```
   mcp call get_logs ref=<vera-demo-ref> service=edge-function
   ```

4. Once verified on demo, deploy to vera-prod in the same step (per
   [../deployment/migrations.md](../deployment/migrations.md) both-
   projects rule).

---

## Related

- [README.md](README.md)
- [../architecture/edge-functions-kong-jwt.md](../architecture/edge-functions-kong-jwt.md)
- [../decisions/0003-jwt-admin-auth.md](../decisions/0003-jwt-admin-auth.md)
- [../deployment/migrations.md](../deployment/migrations.md)
