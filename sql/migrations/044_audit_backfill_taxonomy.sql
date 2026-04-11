-- sql/migrations/044_audit_backfill_taxonomy.sql
-- Backfill category, severity, actor_type, actor_name for all existing audit_logs rows.
-- New rows will be written with these columns populated directly.

UPDATE audit_logs
SET
  category = CASE
    -- auth
    WHEN action IN ('admin.login') THEN 'auth'::audit_category

    -- access
    WHEN action IN (
      'admin.create','admin.updated',
      'memberships.insert','memberships.update','memberships.delete',
      'admin_invites.insert','admin_invites.update','admin_invites.delete'
    ) THEN 'access'::audit_category

    -- config
    WHEN action IN (
      'criteria.save','criteria.update',
      'outcome.create','outcome.update','outcome.delete',
      'organization.status_changed',
      'frameworks.insert','frameworks.update','frameworks.delete'
    ) THEN 'config'::audit_category

    -- security
    WHEN action IN (
      'token.generate','token.revoke',
      'export.scores','export.rankings','export.heatmap',
      'export.analytics','export.audit','export.backup',
      'notification.application','notification.admin_invite',
      'notification.entry_token','notification.juror_pin',
      'notification.export_report','notification.password_reset',
      'backup.created','backup.deleted','backup.downloaded',
      'entry_tokens.insert','entry_tokens.update','entry_tokens.delete'
    ) THEN 'security'::audit_category

    -- data (everything else — period, juror, project, score, evaluation, trigger CRUD)
    ELSE 'data'::audit_category
  END,

  severity = CASE
    -- critical
    WHEN action IN ('juror.pin_locked','juror.blocked') THEN 'critical'::audit_severity

    -- high
    WHEN action IN (
      'period.lock','period.unlock',
      'project.delete',
      'organization.status_changed',
      'backup.deleted',
      'frameworks.delete',
      'memberships.delete'
    ) THEN 'high'::audit_severity

    -- medium
    WHEN action IN (
      'admin.create',
      'pin.reset','juror.pin_unlocked','juror.edit_mode_enabled','juror.edit_enabled',
      'period.set_current',
      'snapshot.freeze',
      'application.approved','application.rejected',
      'token.revoke',
      'export.audit',
      'backup.downloaded',
      'criteria.save','criteria.update',
      'outcome.create','outcome.update','outcome.delete',
      'frameworks.update'
    ) THEN 'medium'::audit_severity

    -- low
    WHEN action IN (
      'admin.updated',
      'juror.edit_mode_closed_on_resubmit',
      'token.generate',
      'export.scores','export.rankings','export.heatmap','export.analytics','export.backup',
      'backup.created',
      'frameworks.insert',
      'admin_invites.insert',
      'memberships.insert','memberships.update'
    ) THEN 'low'::audit_severity

    -- info (default for everything else)
    ELSE 'info'::audit_severity
  END,

  actor_type = CASE
    -- juror-initiated
    WHEN action IN (
      'evaluation.complete',
      'score.update',
      'score_sheets.insert','score_sheets.update','score_sheets.delete'
    ) THEN 'juror'::audit_actor_type

    -- system/trigger generated
    WHEN action IN (
      'snapshot.freeze',
      'juror.pin_locked',
      'juror.edit_mode_closed_on_resubmit',
      'projects.insert','projects.update','projects.delete',
      'jurors.insert','jurors.update','jurors.delete',
      'periods.insert','periods.update','periods.delete',
      'profiles.insert','profiles.update',
      'org_applications.insert','org_applications.update','org_applications.delete',
      'organizations.insert','organizations.update',
      'admin_invites.update'
    ) THEN 'system'::audit_actor_type

    -- anonymous
    WHEN action IN ('application.submitted') THEN 'anonymous'::audit_actor_type

    -- admin (default)
    ELSE 'admin'::audit_actor_type
  END,

  -- Pull actor_name from details if already stored
  actor_name = COALESCE(
    details->>'actor_name',
    details->>'adminName',
    actor_name   -- keep existing if already set
  )

WHERE category IS NULL;  -- only rows not yet backfilled (idempotent)
