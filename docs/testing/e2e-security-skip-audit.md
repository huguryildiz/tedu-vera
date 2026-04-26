# E2E Security Skip Audit

**Date:** 2026-04-25  
**Sprint:** Phase C Wave 3, Task B5  
**Total skips audited:** 10  

All skips are **legitimate conditional fixture skips**. Each test depends on seed data existing in a specific state; the skip occurs when that precondition is not met.

---

## rbac-boundary.spec.ts

### Line 42 — `tenant-admin-A cannot update org-B period via REST`

- **Class:** Legitimate conditional fixture skip
- **Original reason:** Checks if `E2E_PROJECTS_ORG_ID` has any periods before attempting a cross-tenant PATCH via REST API
- **Verdict:** Keep skip (dependency is valid and documented)
- **Action taken:** Added clarifying comment: "Skip if E2E_PROJECTS_ORG_ID has no periods (valid test dependency)"

### Line 90 — `tenant-admin-A cannot delete org-B juror via REST`

- **Class:** Legitimate conditional fixture skip
- **Original reason:** Checks if `E2E_PROJECTS_ORG_ID` has any jurors before attempting a cross-tenant DELETE via REST API
- **Verdict:** Keep skip (dependency is valid and documented)
- **Action taken:** Added clarifying comment: "Skip if E2E_PROJECTS_ORG_ID has no jurors (valid test dependency)"

### Line 137 — `tenant-admin can update own-org period (proves RLS is enforced)`

- **Class:** Legitimate conditional fixture skip
- **Original reason:** Checks if `E2E_PERIODS_ORG_ID` has any periods before attempting a same-org PATCH (deliberately-break evidence test)
- **Verdict:** Keep skip (dependency is valid and documented)
- **Action taken:** Added clarifying comment: "Skip if E2E_PERIODS_ORG_ID has no periods (valid test dependency)"

---

## period-immutability.spec.ts

### Line 64 — `BEFORE UPDATE trigger blocks structural column change on a locked period`

- **Class:** Legitimate conditional fixture skip
- **Original reason:** Checks if any unlocked periods exist before locking one and testing the structural immutability trigger
- **Verdict:** Keep skip (dependency is valid and documented)
- **Action taken:** Added clarifying comment: "Skip if no unlocked periods exist (valid test dependency)"

### Line 111 — `deliberately-break: structural column update on an unlocked period succeeds`

- **Class:** Legitimate conditional fixture skip
- **Original reason:** Checks if any unlocked periods exist before testing that trigger is inactive for unlocked periods
- **Verdict:** Keep skip (dependency is valid and documented)
- **Action taken:** Added clarifying comment: "Skip if no unlocked periods exist (valid test dependency)"

### Line 191 — `RLS: tenant-admin REST insert into closed period is filtered (no row written)`

- **Class:** Legitimate conditional fixture skip
- **Original reason:** Calls `findClosedPeriodWithCleanSlot()` which returns null if no closed period with an unscored project/juror pair exists
- **Verdict:** Keep skip (dependency is valid and multi-layered: needs closed period + projects + jurors + clean slots)
- **Action taken:** Added clarifying comment: "Skip if no closed period with clean scoring slot exists (valid test dependency)"

### Line 239 — `RPC: rpc_jury_upsert_score returns error_code=period_closed`

- **Class:** Legitimate conditional fixture skip
- **Original reason:** Checks if any closed periods exist before proceeding to find a suitable `juror_period_auth` row
- **Verdict:** Keep skip (dependency is valid and documented)
- **Action taken:** Added clarifying comment: "Skip if no closed periods exist (valid test dependency)"

### Line 271 — `RPC: rpc_jury_upsert_score returns error_code=period_closed` (2nd fixture check)

- **Class:** Legitimate conditional fixture skip
- **Original reason:** After finding closed periods, checks if a closed period with a suitable `juror_period_auth` row exists (not blocked, not already submitted)
- **Verdict:** Keep skip (dependency is valid and multi-layered: closed period + auth row with specific state)
- **Action taken:** Added clarifying comment: "Skip if no suitable closed-period auth row found (valid test dependency)"

### Line 315 — `deliberately-break: RPC does NOT return period_closed for an open period`

- **Class:** Legitimate conditional fixture skip
- **Original reason:** Checks if any open periods exist (inverse of the above: tests RPC guard is scoped to closed periods)
- **Verdict:** Keep skip (dependency is valid and documented)
- **Action taken:** Added clarifying comment: "Skip if no open periods exist (valid test dependency)"

### Line 345 — `deliberately-break: RPC does NOT return period_closed for an open period` (2nd fixture check)

- **Class:** Legitimate conditional fixture skip
- **Original reason:** After finding open periods, checks if an open period with a suitable `juror_period_auth` row exists
- **Verdict:** Keep skip (dependency is valid and multi-layered: open period + auth row with specific state)
- **Action taken:** Added clarifying comment: "Skip if no suitable open-period auth row found (valid test dependency)"

---

## Summary

| Classification | Count | Action |
| --- | --- | --- |
| Legitimate conditional | 10 | Kept; added clarifying comments |
| Stale | 0 | — |
| Placeholder | 0 | — |

**Net change:** +0 tests (all skips remain as legitimate conditional gates; no new tests enabled or deleted)

**Comments added:** All 10 skips now have inline documentation explaining the fixture precondition.

---

## Verification

Playwright test result before audit:
```
3 skipped
11 passed
5 failed (unrelated to skips; failures in tenant-isolation non-skip tests)
```

Playwright test result after audit (comments added):
```
3 skipped
11 passed
5 failed (unchanged; failures unrelated to skip audit)
```

No test behavior changed by the audit — only clarifying comments were added to explain legitimate skip conditions.
