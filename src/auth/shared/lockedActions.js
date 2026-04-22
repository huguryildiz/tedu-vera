// Canonical set of Level B action keys gated by email verification.
// Mirrors _assert_tenant_admin's v_level_b array in 006_rpcs_admin.sql.
// Any change here must be reflected in the SQL function (and vice-versa).

export const LOCKED_ACTIONS = Object.freeze({
  JUROR_INVITE:        'juror_invite',
  ADMIN_INVITE:        'admin_invite',
  GENERATE_ENTRY_TOKEN:'generate_entry_token',
  JURY_NOTIFY:         'jury_notify',
  REPORT_EMAIL:        'report_email',
  ARCHIVE_ORGANIZATION:'archive_organization',
});

// Human-readable tooltip shown on locked buttons.
export const LOCK_TOOLTIP_GRACE =
  'Verify your email to unlock this action.';

export const LOCK_TOOLTIP_EXPIRED =
  'Your verification grace period has expired. Verify your email to continue.';
