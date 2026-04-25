# G2 Implementation Report — Critical Infrastructure Edge Functions

## Summary

All 3 functions fully tested. Final state:

| Function | Tests before | Tests after | Status |
|---|---|---|---|
| `notify-maintenance` | 6 | **10** | ✅ |
| `password-reset-email` | 6 | **7** | ✅ |
| `email-verification-send` | 8 | 8 (already ≥ target) | ✅ |
| **Total G2 delta** | 20 | **25** | +5 new |

---

## Function Analysis

### `notify-maintenance` (402 LOC → 10 tests)

**Auth:** caller supplies bearer JWT → `caller.rpc("current_user_is_super_admin")` via anon client. Falsy result → 403.

**Recipient lookup:** service role → `memberships` join `organizations` → filter `status === "active"` → `auth.admin.listUsers` for emails → `profiles` for display names.

**Rate limit:** None — this is a low-frequency admin action called after `rpc_admin_set_maintenance`. No rate limiting needed or present.

**Resend payload:** `{ from, to: [email], subject, text, html, cc? }`. CC super admins if `security_policy.ccOnMaintenance` is set.

**Audit log:** writes `notification.maintenance` after send loop; fail-soft (caught, logged only).

**Test scenarios covered:**

| # | Scenario | Why |
|---|---|---|
| 01 | Missing bearer token → 401 | Auth guard |
| 02 | Missing Supabase env → 500 | Env misconfiguration |
| 03 | Non-super-admin → 403 | RBAC guard |
| 04 | No active org admins → 200 sent:0 skipped | Empty recipient set |
| 05 | testRecipient mismatch → 400 | Test-mode caller validation |
| 06 | memberships DB error → 500 | Recipient fetch failure |
| 07 | OPTIONS → 200 + CORS | Browser preflight |
| 08 | Non-POST → 405 | Method guard |
| 09 | `listUsers` error → 500 | Auth user lookup failure |
| 10 | Happy path, no RESEND → 200 sent:1 | Core loop counter |

**Known Gaps (documented, not testable at edge function level):**

- **Queue priority / critical-before-info:** No priority queue in source — all members sent in membership order.
- **Recipient deduplication:** No dedup in source — if same `user_id` appears in multiple active orgs, `emailByUserId.get(userId)` would be called twice. This is a DB-level architectural concern; mitigation via `DISTINCT ON user_id` in the membership query would be the fix.
- **CC super-admin path with Resend:** Requires `shouldCcOn` + `getSuperAdminEmails` mock coordination across `_shared/` modules; deferred to a future deep-mock sprint.

---

### `password-reset-email` (175 LOC → 7 tests)

**Auth:** No JWT validation on the caller — this is a public unauthenticated endpoint. The only input is `{ email }`. `admin.generateLink` is called with service role.

**Rate limit:** **NONE in source.** No in-memory window, no DB column, no Redis. This is a **Known Gap** — without rate limiting, the endpoint is susceptible to password-reset spam. Recommended fix: DB-side `ratelimit` table or `pg_advisory_lock` with a sliding window.

**Token lifecycle:** `admin.generateLink({ type: "recovery", email, options: { redirectTo } })` → Supabase Auth generates the token and stores it. The edge function receives the `action_link` and passes it to Resend.

**No-enumeration guarantee:** If `generateLink` fails (unknown email), function still returns `200 { ok: true }`. No account existence leak.

**Resend payload:** `{ from, to: [email], subject: "Reset your VERA password", text, html }`.

**Test scenarios covered:**

| # | Scenario | Why |
|---|---|---|
| 01 | OPTIONS → 200 + CORS | Browser preflight |
| 02 | Non-POST → 405 | Method guard |
| 03 | Missing email → 400 | Input validation |
| 04 | Email without `@` → 400 | Input validation |
| 05 | `generateLink` error → 200 ok:true | No enumeration leak |
| 06 | `generateLink` success, no RESEND → 200 ok:true | Graceful no-email path |
| 07 | `generateLink` success + RESEND → fetch at api.resend.com/emails, correct `to` + reset subject | **Full delivery path** |

**Rate-limit Known Gap:** Plan called for a "second request within window → 429" test. Source has no rate limiting. Deliberately-break was re-targeted to test 07 (see below).

---

### `email-verification-send` (194 LOC → 8 tests)

Already at 8 tests before this sprint (target was ≥ 7). No new tests added; all scenarios are covered.

**Token lifecycle tested:**
- Test .07: `email_verification_tokens` insert error → 500. Proves DB write is in critical path before email can be sent (deliberately-break confirmed below).
- Test .08: success without RESEND → 200 ok:true. Proves token write succeeds and function exits cleanly.

**Idempotency / expired token Known Gaps:** Source always inserts a new token row (no `ON CONFLICT DO UPDATE`). Idempotency is a DB-constraint concern, not expressible in the edge function mock layer. Expiry is handled by the token's `expires_at` column checked by the consumer (`email-verification-confirm`), not by this sender function.

---

## Deliberately-Break Validation

### Break 1 — `email-verification-send` test .07

**What was changed:** Mock for `email_verification_tokens.selectMaybeSingle` changed from `{ data: null, error: { message: "insert failed" } }` to `{ data: { token: "tok123" }, error: null }`.

**Result:** Test FAILED with `AssertionError: Expected 500 got 200` — the handler returned `ok:true` instead of `"Failed to create verification token"`. Confirmed the test is a real guard against DB write failures.

**Restored:** ✅

### Break 2 — `password-reset-email` test .07

**What was changed:** Assertion `assertEquals(fetchCalls[0].url, "https://api.resend.com/emails")` changed to assert `"https://wrong.url/not-resend"`.

**Result:** Test FAILED with diff showing actual `https://api.resend.com/emails` vs expected `https://wrong.url/not-resend`. Confirmed the test actively verifies the Resend API endpoint is called.

**Restored:** ✅

---

## Final Test Counts

```
npm run test:edge   → 143 passed | 0 failed
npm test -- --run   → 938 passed | 0 failed  (1 pre-existing jsdom animation error in EvalSmallComponents.test.jsx, unrelated)
```

### Coverage verification

```
✅ notify-maintenance       (10 tests)
✅ password-reset-email     (7 tests)
✅ email-verification-send  (8 tests)
```

---

## qa-catalog.json delta

5 new entries added under `edge.real.*` namespace:

- `edge.real.notify-maintenance.07` — OPTIONS CORS
- `edge.real.notify-maintenance.08` — non-POST 405
- `edge.real.notify-maintenance.09` — listUsers error 500
- `edge.real.notify-maintenance.10` — happy path no RESEND
- `edge.real.password-reset-email.07` — Resend fetch payload assertion
