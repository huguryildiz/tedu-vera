# G3 Implementation Report — Mail Template Edge Functions

## Summary

All 5 mail template functions now have Deno unit tests. Session G is complete: 21/21 edge functions covered.

| Function | Tests written | Namespace | Status |
|---|---|---|---|
| `notify-juror` | 14 | `edge.notify-juror.*` + `edge.real.notify-juror.*` | ✅ (typo fix applied) |
| `send-juror-pin-email` | 4 | `edge.real.send-juror-pin-email.*` | ✅ |
| `send-entry-token-email` | 4 | `edge.real.send-entry-token-email.*` | ✅ |
| `password-changed-notify` | 11 | `edge.password-changed.*` + `edge.real.password-changed-notify.*` | ✅ |
| `notify-unlock-request` | 12 | `edge.unlock-request.*` + `edge.real.notify-unlock-request.*` | ✅ |
| **Session G total** | **188** edge tests | 21/21 functions | **0 failures** |

Vitest (React/Vite) suite unaffected: 938/938 pass.

---

## Function Analysis

### `notify-juror` (14 tests: .01–.10 + real.01–.04)

**Auth:** Own auth path (not `requireAdminCaller`). Extracts bearer token → `authClient.auth.getUser(token)` → memberships `.maybeSingle()` for org_admin/super_admin membership.

**Critical fix:** File written in a prior session used `selectMaybySingle` (with 'y') as mock config keys. `mock-supabase.ts` interface declares `selectMaybeSingle` (with 'e'). Fixed all 6 occurrences via `replace_all: true`. Without the fix auth mocks silently returned null causing tests .05–.10 to fail with the wrong reason.

**Coverage highlights:**
- OPTIONS → 200 CORS
- Missing bearer → 401
- Invalid JWT → 401
- Non-admin membership → 403
- Missing `juror_id` / `period_id` → 400
- Juror not found → 404
- Juror has no email → 422
- Period not found → 404
- RESEND absent → 500 hard fail (function throws, not soft-fail)
- Resend success → 200 sent=true, juror email in Resend payload asserted
- Resend 429 → 500 sent=false

### `send-juror-pin-email` (4 tests)

**Auth:** `requireAdminCaller(req, organizationId || null)`. Validation fires **before** auth — no auth call needed in validation tests.

**Coverage highlights:**
- Missing `pin` → 400 before any auth call
- Non-admin membership → 403 "admin access required"
- Resend success → 200 sent=true; PIN literal "7842" asserted present in Resend `text` field
- Resend 429 → 200 sent=false, error includes "Resend" (soft-fail — `sendViaResend` catches non-2xx)

**Key mock pattern:** `memberships.selectMaybeSingle: { data: { user_id: "admin-1" }, error: null }` — `isSuperAdmin` short-circuits on truthy `data?.user_id`, avoiding the need for two separate membership mock states.

### `send-entry-token-email` (4 tests)

**Auth:** Same as `send-juror-pin-email` (`requireAdminCaller`). Validation: `recipientEmail` + `tokenUrl` both required.

**Coverage highlights:**
- Missing `tokenUrl` → 400 before auth
- Non-admin → 403
- Resend success → 200 sent=true; `tokenUrl` literal asserted present in Resend `text` field
- Resend 429 → 200 sent=false (soft-fail)

### `password-changed-notify` (11 tests: .01–.07 + real.01–.04)

**Auth:** No JSON body — user resolved from bearer JWT via `auth.getUser(token)`.

**Critical behavioral difference:** `sendViaResend` in this function **throws** on non-2xx (no try/catch wrapper), so outer catch returns 500 `{ error }` (no `ok` field). All other mail functions use soft-fail `sendViaResend` that returns `{ ok: false, error }` and always 200.

**Early no-op:** If `SUPABASE_URL`, `SUPABASE_ANON_KEY`, or `RESEND_API_KEY` is missing → 200 `{ ok: true }` before any auth call. Test .03 verifies this fires without touching `authGetUser`.

**Coverage highlights (edge.password-changed.01–07):**
- OPTIONS → 200 CORS
- Missing bearer → 401 "Missing bearer token"
- RESEND absent → 200 `{ ok: true }` (early no-op, no auth)
- RESEND set, auth failure → 401
- RESEND set, org_admin, Resend 200 → 200 `{ ok: true }`
- super_admin role → subject contains "super admin" (captured via `stubFetch`)
- Resend 429 → throws → outer catch → 500 `{ error }` (no `ok`)

**edge.real.password-changed-notify.01–04 (appended this sprint):**
- Missing Authorization header → 401 (bearer check fires before env gate)
- `getUser` returns user with no email → 401 "Could not resolve user"
- Resend success → 200 ok:true; user email asserted present in Resend payload
- Resend 429 → 500 (sendViaResend throws → outer catch)

### `notify-unlock-request` (12 tests: .01–.08 + real.01–.04)

**Auth:** None. No bearer token required; any caller can submit unlock requests.

**JSON parse in outer try:** Invalid JSON → catch → 500 `{ ok: false, error }`.

**Routing logic:** `type === "request_submitted"` → `getSuperAdminEmails` (memberships.selectList + adminGetUserById per user); `type === "request_resolved"` → `getUserEmail` for `requester_user_id`. Send condition: `if (resendKey && to.length > 0)`.

**Coverage highlights (edge.unlock-request.01–08):**
- OPTIONS → 200 CORS
- Invalid JSON → 500 `{ ok: false, error }`
- Missing `type` → 400
- Missing `request_id` → 400
- `request_submitted` + no RESEND → 200 sent=false "RESEND_API_KEY not configured"
- `request_submitted` + RESEND + super-admin email resolved → 200 sent=true
- `request_resolved` + RESEND + requester email → 200 sent=true
- `request_submitted` + RESEND + empty super-admin list → 200 sent=false "No recipient email resolved"

**edge.real.notify-unlock-request.01–04 (appended this sprint):**
- Missing `request_id` → 400 (duplicate guard path, no auth needed)
- `request_submitted` + RESEND + super-admin email → 200 sent=true; `superadmin@vera.app` asserted in Resend payload
- `request_submitted` + RESEND + empty memberships → 200 sent=false, error includes "No recipient"
- `request_submitted` + RESEND + Resend 429 → 200 sent=false, error includes "Resend" (`sendViaResend` returns `{ok:false}`, no throw)

---

## Test Infrastructure Notes

- All tests use `captureHandler(modulePath)` — intercepts `Deno.serve` before module import
- `setDefaultEnv()` sets `SUPABASE_URL`, `SUPABASE_ANON_KEY` (both with "service" in key), `SUPABASE_SERVICE_ROLE_KEY`
- `resetMockConfig()` between tests ensures clean state
- `stubFetch` replaces `globalThis.fetch`; always restored in `finally` blocks
- `RESEND_API_KEY` deleted in `setup()` and restored in `finally` where set per-test

---

## Final Edge Coverage State (Session G complete)

| Group | Functions | Tests |
|---|---|---|
| G1 Critical Business | audit-anomaly-sweep, invite-org-admin, on-auth-event, log-export-event, receive-email, request-score-edit | 54 |
| G2 Critical Infra | notify-maintenance, password-reset-email, email-verification-send | 25 |
| G3 Mail Templates | notify-juror, send-juror-pin-email, send-entry-token-email, password-changed-notify, notify-unlock-request | 45 |
| Pre-existing | admin-session-touch, platform-metrics, audit-log-sink, auto-backup, email-verification-confirm, request-pin-reset, send-export-report | 64 |
| **Total** | **21/21** | **188** |
