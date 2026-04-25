# P1 Item 9 — Extend RPC pgTAP coverage

## Goal

Add 6 more pgTAP contract files (mirror of P0 part C) for the most critical unpinned RPCs.

## Target RPCs (in order)

The audit names these explicitly:

1. `rpc_jury_finalize_submission` — already partially covered in `sql/tests/rpcs/contracts/jury_finalize_submission.sql` (P0); skip if exists.
2. `rpc_period_freeze_snapshot` — covered in P0; skip.
3. `rpc_admin_verify_audit_chain` — covered in P0; **add a tamper case** (insert a row, mutate, expect verify to flag).
4. `rpc_juror_unlock_pin` — covered in P0; skip.
5. `rpc_admin_upsert_period_criterion_outcome_map` — covered in P0; skip.
6. `rpc_admin_delete_organization` — covered in P0; skip.

Already-covered above; **the actual P1 targets are the next 6**:

1. `rpc_jury_get_period_status` — return shape: `{ identity_required, period_locked, ... }` boolean flags. RLS: anon must call via entry_token; missing token → error.
2. `rpc_admin_save_period_outcomes` — UPSERT semantics for outcomes; period-locked → raise `period_locked`.
3. `rpc_admin_create_period` — returns new period id; RLS: only org_admin of target org; cross-tenant insert → 0 rows / error.
4. `rpc_admin_resolve_score_edit_request` — state machine: pending → approved/rejected; double-resolve → raise.
5. `rpc_admin_seed_jurors_csv` — bulk insert; UNIQUE(organization_id, email) violation → graceful error count, not full abort.
6. `rpc_jury_get_evaluation_targets` — returns project list ordered by project_no; RLS: only the calling juror's period.

## Pattern (per file)

```sql
BEGIN;
SELECT plan(N);

-- 1) function exists with right signature
SELECT has_function('public', 'rpc_…');
SELECT function_returns('public', 'rpc_…', 'TYPE');

-- 2) seed minimum fixture under SET LOCAL role authenticated + JWT claim
SET LOCAL role authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"<uuid>","role":"authenticated"}';

-- 3) happy path returns expected shape (use is() / row_eq())
-- 4) negative case raises (use throws_ok / throws_like)
-- 5) RLS / tenant isolation if applicable

SELECT * FROM finish();
ROLLBACK;
```

## Deliverable

- 6 new files in `sql/tests/rpcs/contracts/`
- Each ~7–10 assertions
- All verified on vera-demo via Supabase MCP `execute_sql` (BEGIN/ROLLBACK)
- Update `sql/tests/RUNNING.md` suite summary

## Out of scope

- Refactoring existing P0 contracts
- Rewriting the RPC implementations
