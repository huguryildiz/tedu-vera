# P1 Item 7 — Constraint + trigger pgTAP

## Goal

Pin schema-level invariants so a future migration that drops a CHECK / NOT NULL / UNIQUE silently fails CI.

## Targets

### NOT NULL violations (1 file)

`sql/tests/constraints/not_null.sql` — for each table+column where NOT NULL is critical, attempt INSERT NULL → expect rejection.

Critical columns:
- `organizations.name`
- `periods.organization_id`, `periods.name`
- `period_criteria.period_id`, `period_criteria.key`, `period_criteria.max_score`
- `jurors.organization_id`, `jurors.juror_name`
- `score_sheets.juror_id`, `score_sheets.project_id`, `score_sheets.period_id`
- `score_sheet_items.score_sheet_id`, `score_sheet_items.period_criterion_id`

### UNIQUE violations (1 file)

`sql/tests/constraints/unique.sql`:
- `period_criteria(period_id, key)` — duplicate criteria.key in same period
- `score_sheets(juror_id, project_id)` — same juror×project twice
- `score_sheet_items(score_sheet_id, period_criterion_id)` — same criterion scored twice
- `juror_period_auth(juror_id, period_id)` — auth row per (juror, period)
- `entry_tokens(token_hash)` — token_hash global unique

### CHECK violations (1 file)

`sql/tests/constraints/check.sql`:
- `period_criteria.max_score > 0`
- `period_criteria.weight >= 0`
- `score_sheet_items.score_value >= 0` and `<= period_criteria.max_score`
- `juror_period_auth.failed_attempts >= 0`
- Period status transitions (if enforced via CHECK)

### Triggers (1 file)

`sql/tests/triggers/triggers.sql`:
- `trigger_assign_project_no` — INSERT 5 projects under one period; assert project_no is 1..5 in INSERT order; INSERT one more under a different period; assert it gets 1.
- `trigger_audit_log` diff accuracy — UPDATE a period's `name` only; assert audit_logs `details` has only `name` in `before`/`after`, not unrelated fields.
- `block_period_*_on_locked` — INSERT into period_criteria when period.is_locked=true → expect `period_locked` exception.

## Pattern

```sql
BEGIN;
SELECT plan(N);

PREPARE bad AS INSERT INTO foo (col) VALUES (NULL);
SELECT throws_ok('EXECUTE bad', '23502', NULL, 'foo.col is NOT NULL');

SELECT * FROM finish();
ROLLBACK;
```

`throws_ok` SQLSTATEs:
- `23502` not_null_violation
- `23505` unique_violation
- `23514` check_violation
- `P0001` raise_exception (custom RAISE in triggers)

## Deliverable

- 4 new files in `sql/tests/constraints/` and `sql/tests/triggers/`
- Update `sql/tests/RUNNING.md`
- Update `.github/workflows/migration-ci.yml` `pg_prove` glob to include the new dirs

## Verify

Run on vera-demo via MCP `execute_sql` BEGIN/ROLLBACK before commit.
