# P1 Item 8 — Post-seed smoke validation

## Goal

After `demo-db-reset.yml` applies the seed, run a 5-assertion smoke check. Today the seed can silently break (e.g., FK constraint added to a column the seed forgets to populate) and nothing alarms until next E2E run hours later.

## Where

Append a new step to `.github/workflows/demo-db-reset.yml` after the existing "Apply demo seed" step.

## Five assertions

Run inside the same `psql "$DEMO_DATABASE_URL"` session, fail the workflow if any returns 0:

1. **Fixture orgs exist (6 of 6).**
   ```sql
   SELECT COUNT(*) = 6 FROM organizations
   WHERE id IN (
     'b2c3d4e5-f6a7-8901-bcde-f12345678901',
     'c3d4e5f6-a7b8-9012-cdef-123456789012',
     'd4e5f6a7-b8c9-0123-def0-234567890123',
     'e5f6a7b8-c9d0-1234-ef01-345678901234',
     'f7340e37-9349-4210-8d6b-073a5616bf49',
     'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
   );
   ```

2. **Wizard org has setup_completed_at = NULL.**
   ```sql
   SELECT setup_completed_at IS NULL FROM organizations
   WHERE id = 'e5f6a7b8-c9d0-1234-ef01-345678901234';
   ```

3. **Locked juror has expected lock state.**
   ```sql
   SELECT failed_attempts >= 3 AND locked_until > now()
   FROM juror_period_auth
   WHERE juror_id = 'eeeeeeee-0001-4000-e000-000000000001';
   ```

4. **At least one entry_token can be verified by hash for the eval period.**
   ```sql
   SELECT COUNT(*) > 0 FROM entry_tokens
   WHERE period_id = 'a0d6f60d-ece4-40f8-aca2-955b4abc5d88'
     AND is_revoked = false
     AND expires_at > now();
   ```

5. **Audit chain integrity.** Call `rpc_admin_verify_audit_chain` for the platform org (NULL) and assert `is_valid = true`.
   ```sql
   SELECT (rpc_admin_verify_audit_chain(NULL))::jsonb->>'is_valid' = 'true';
   ```

## Implementation

```yaml
- name: Post-seed smoke
  env:
    DEMO_DATABASE_URL: ${{ secrets.DEMO_DATABASE_URL }}
  run: |
    psql "$DEMO_DATABASE_URL" --no-psqlrc -v ON_ERROR_STOP=1 <<'SQL'
      DO $$
      BEGIN
        IF NOT (SELECT COUNT(*) = 6 FROM organizations WHERE id IN (...)) THEN
          RAISE EXCEPTION 'fixture orgs missing or incomplete';
        END IF;
        -- ... 4 more assertions ...
      END $$;
    SQL
```

## Deliverable

- One new step in `.github/workflows/demo-db-reset.yml`
- Workflow fails red if any assertion fails

## Manual verify

Trigger via `gh workflow run demo-db-reset.yml --ref qa/p1-test-hardening`, watch run, confirm pass.
