-- sql/migrations/042_backfill_audit_period_name.sql
-- Backfill periodName into existing evaluation.complete and
-- juror.edit_mode_closed_on_resubmit audit log entries that only
-- stored period_id (UUID) but never the human-readable period name.
-- Safe to re-run: WHERE NOT (details ? 'periodName') is idempotent.

UPDATE audit_logs
SET details = details || jsonb_build_object('periodName', p.name)
FROM periods p
WHERE audit_logs.action IN (
  'evaluation.complete',
  'juror.edit_mode_closed_on_resubmit'
)
  AND audit_logs.details ? 'period_id'
  AND NOT (audit_logs.details ? 'periodName')
  AND p.id = (audit_logs.details->>'period_id')::UUID;
