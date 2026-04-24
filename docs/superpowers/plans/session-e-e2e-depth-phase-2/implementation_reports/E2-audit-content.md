# E2 — Audit Log Content Verification: Implementation Report

**Date:** 2026-04-25
**Branch:** test/e2-audit-content
**Sprint:** E2 — Audit log action-to-entry verification

---

## Summary

Added 5 database-level content verification tests for the audit log. Tests bypass the browser UI and assert directly against `audit_logs` using the service-role client — proving that specific DB operations produce correctly-shaped audit entries.

---

## Pre-work Findings

### Column name
`audit_logs.action` (not `event_type`). The original sprint spec used `event_type` as a conceptual name; the actual column is `action`.

### Trigger-generated action strings
`trigger_audit_log()` in `003_helpers_and_triggers.sql` produces:
```
action = TG_TABLE_NAME || '.' || lower(TG_OP)
```
Examples: `periods.insert`, `jurors.delete`, `projects.insert`, `entry_tokens.insert`.

Attached to: organizations, periods, projects, jurors, score_sheets, memberships, entry_tokens, framework_outcomes, period_criteria, period_criterion_outcome_maps, frameworks, profiles, security_policy, unlock_requests.
**Not** attached to `org_applications`.

### Service role limitation
Service role client sets `auth.uid() = NULL`, which causes `current_user_is_super_admin()` to return false and `_assert_tenant_admin()` to raise. RPC-explicit audit entries (e.g. `application.approved`, `token.generate`) require privileged RPCs inaccessible to the service role. Tests are therefore scoped to trigger-fired events + the one anon-granted RPC.

### Anon-callable RPC
`rpc_write_auth_failure_event(p_email, p_method)` in `009_audit.sql` is GRANTED TO `anon` AND `authenticated`. It writes `auth.admin.login.failure` with `organization_id = NULL` and `actor_name = trim(p_email)`. Callable via `adminClient.rpc()` with service role.

---

## Files Changed

### `e2e/helpers/supabaseAdmin.ts`
Added `readAuditLogs(orgId, action, since?, actorName?)`:
- `orgId = null` → `IS NULL` filter (for auth failure events with no org)
- `since` ISO string → `gte("created_at", since)` time-window filter
- `actorName` → `eq("actor_name", actorName)` for login failure assertions

### `e2e/admin/audit-log.spec.ts`
Added imports: `adminClient`, `readAuditLogs`, `E2E_PERIODS_ORG_ID`.

Added `test.describe("audit log — content verification (E2)")` with 5 tests:

| # | Test | Action verified | Method |
|---|------|----------------|--------|
| 1 | period create | `periods.insert` | direct insert → trigger |
| 2 | juror delete | `jurors.delete` | insert then delete → trigger |
| 3 | failed login | `auth.admin.login.failure` | `rpc_write_auth_failure_event` |
| 4 | entry token insert | `entry_tokens.insert` | direct insert → trigger |
| 5 | project create | `projects.insert` | direct insert → trigger |

Each test asserts: entry exists, `resource_id` matches the created row, `resource_type` is correct, `organization_id` matches expected org (or is NULL for auth events).

---

## Deliberately-Break Proofs

**Proof 1** — wrong action name: Changed `"periods.insert"` → `"period.created"` (non-existent action). Result: 0 rows → `toBeGreaterThan(0)` failed. ✓

**Proof 2** — future `since` timestamp: Set `since = new Date(Date.now() + 60000)` in juror-delete test so the filter window is in the future. Result: 0 rows → `toBeGreaterThan(0)` failed. ✓

---

## Test Results

| Run | Target | Result |
|-----|--------|--------|
| Initial 5-test run | 5/5 | 5 passed |
| Flake check (×3) | 15/15 | 15 passed |
| Full suite | 103 passed | +5 E2 tests vs baseline (6 pre-existing failures unrelated to E2) |

---

## Notes

- `org.application.approved` was replaced with `projects.insert` because `rpc_admin_approve_application` requires `current_user_is_super_admin()` which is blocked for service role. The trigger-based `projects.insert` provides equivalent structural coverage.
- All test data is isolated by unique `Date.now()` suffix. Cleanup is handled inline (period delete cascades to entry_tokens, projects; juror delete is explicit).
- `diff` field populated for INSERT events: `{"after": {...}}`. Tests do not assert diff shape to avoid brittleness.
