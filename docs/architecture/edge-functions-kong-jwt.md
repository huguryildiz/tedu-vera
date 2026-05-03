# ADR: Kong JWT Gate Workaround for Edge Functions

> _Last updated: 2026-04-25_

## Problem

Kong (Supabase's API gateway) historically rejects valid ES256-signed JWTs from Supabase Auth-v1, even when those same tokens are valid within the Supabase Auth API. When a client calls an edge function with a valid JWT in the Authorization header, Kong returns:

```
401 Unauthorized
Invalid JWT
```

This occurs despite:
- The JWT being signed correctly with Auth-v1's ES256 key
- The same token working fine when passed to `auth.getUser(token)` directly
- The token containing valid claims for the authenticated user

## Context

Supabase Auth has historically supported both HS256 (symmetric) and ES256 (asymmetric) signing keys. PostgREST (which powers RPC verification) was slow to adopt ES256 support, causing it to reject valid asymmetric tokens. While Supabase has since updated PostgREST, some project configurations still have this gap.

Kong validates JWTs as a gate before the request reaches the edge function code, using PostgREST's JWT verification logic. If Kong's gate fails, the edge function never runs.

## Solution

Set `verify_jwt: false` in the edge function's `config.toml` and implement custom JWT verification inside the function:

```toml
# config.toml
verify_jwt = false
```

Then within the function:

1. Extract the Bearer token from the `Authorization` header
2. Call `auth.getUser(token)` (Auth-v1 endpoint, which tolerates ES256)
3. Verify membership/authorization
4. Use the service role client for database operations

## Diagnosis Pattern

When debugging a 401 response from an edge function:

1. **Check Supabase logs** for the function's execution:
   - Navigate to the project's **Edge Functions** page → logs
   - Look for the most recent invocation

2. **Determine the source of the 401:**
   - **Kong pre-rejected** (gateway): `execution_time_ms ≈ 0ms` or no execution log entry at all
   - **Function-internal** (custom auth): `execution_time_ms > 50ms` with a log entry showing the auth failure

3. **If Kong pre-rejected:**
   - The 401 happened before the function ran, confirming a Kong/PostgREST JWT validation issue
   - Apply the workaround below

4. **If function-internal:**
   - The custom auth is working; the 401 is legitimate (bad token, bad membership, etc.)
   - Debug the auth logic inside the function

## Implementation Recipe

### 1. Disable Kong verification

Create or update `supabase/functions/{function-name}/config.toml`:

```toml
verify_jwt = false
```

### 2. Extract the token

```typescript
function readBearerToken(req: Request): string {
  const authHeader = req.headers.get("authorization") || "";
  return authHeader.replace(/^Bearer\s+/i, "").trim();
}

const token = readBearerToken(req);
if (!token) return json(401, { error: "Missing bearer token" });
```

### 3. Verify the caller using Auth-v1

```typescript
const authClient = createClient(supabaseUrl, anonKey);
const { data: userData, error: userErr } = await authClient.auth.getUser(token);
const userId = userData?.user?.id || null;
if (userErr || !userId) {
  return json(401, { error: "Unauthorized", details: userErr?.message });
}
```

### 4. Check authorization (tenant/org membership)

```typescript
const service = createClient(supabaseUrl, serviceKey);
const { data: membership, error: memberErr } = await service
  .from("memberships")
  .select("organization_id")
  .eq("user_id", userId)
  .maybeSingle();

if (memberErr) return json(500, { error: memberErr.message });
if (!membership) return json(403, { error: "Not a member of any organization" });
```

### 5. Use service role for database operations

Once verified, use the service role client to bypass RLS and perform privileged queries:

```typescript
const { data, error } = await service.rpc("rpc_admin_get_metrics", {
  org_id: membership.organization_id,
});
```

## Reference Implementations

### `platform-metrics/index.ts`

Full implementation checking for super-admin status:

- [Link to file](/supabase/functions/platform-metrics/index.ts)
- Verifies `organization_id IS NULL` (super-admin only)
- Fetches system-wide metrics via service role

### `admin-session-touch/index.ts`

Full implementation with session tracking:

- [Link to file](/supabase/functions/admin-session-touch/index.ts)
- Extracts bearer token, verifies via `auth.getUser()`
- Logs admin session activity to `admin_user_sessions` table
- Uses service role for upserts

## Functions Currently Using This Pattern

The following edge functions have `verify_jwt: false` and implement custom JWT auth:

1. **`admin-session-touch`** — Logs admin session activity
   - `config.toml`: `verify_jwt = false`
   - Custom auth: Bearer token → `auth.getUser()` → service role upsert

2. **`platform-metrics`** — Returns system-wide metrics (super-admin only)
   - `config.toml`: `verify_jwt = false` (implicit; no config file means false)
   - Custom auth: Bearer token → `auth.getUser()` → super-admin check → service role query

3. **`email-verification-confirm`** — Confirms email verification tokens
   - `config.toml`: `verify_jwt = false`
   - Custom auth: Email verification token (not JWT-based)

4. **`invite-org-admin`** — Accepts org admin invitations
   - `config.toml`: `verify_jwt = false`
   - Custom auth: Invite token handling

5. **`send-juror-pin-email`** — Sends PIN via email to jurors
   - `config.toml`: `verify_jwt = false`
   - Custom auth: Public endpoint with rate limiting

6. **`log-export-event`** — Audit-writes an export action via service role
   - `config.toml`: `verify_jwt = false`
   - Custom auth: Bearer token → `auth.getUser()` → tenant membership check → service-role audit write

## Why This Matters

**Never use `caller.rpc()` for JWT verification.** PostgREST's RPC JWT gate has the same Kong/ES256 issue. Instead:

- Always extract the token manually from the Authorization header
- Call `auth.getUser(token)` (Auth-v1 endpoint, ES256-tolerant)
- Use the service role client for DB operations

## Future Mitigation

When Supabase fully migrates to modern asymmetric key handling across all services (PostgREST, Kong, etc.), this workaround may no longer be necessary. However:

- The pattern is safe and performant (adds ~1 API call vs. 0 with Kong verification)
- Custom auth is more flexible (can implement org-scoped gates, rate limiting, etc.)
- Keep this ADR for historical context

## See Also

- **CLAUDE.md § Edge Function Patterns** — Quick reference for the Kong issue
- **sql/migrations/007_identity** — User and membership schema
- **src/shared/api/core/invokeEdgeFunction.js** — Client-side invocation wrapper
