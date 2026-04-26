-- VERA v1 — All Tables, View, Indexes, Grants
-- 22 tables + scores_compat view, in FK dependency order.
-- Single-row config tables (maintenance_mode, security_policy) seeded inline.

-- =============================================================================
-- 1. ORGANIZATIONS
-- =============================================================================

CREATE TABLE organizations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT UNIQUE NOT NULL,
  name               TEXT NOT NULL,
  contact_email      TEXT,
  status             TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'archived')),
  settings           JSONB NOT NULL DEFAULT '{}',
  -- One-time onboarding flag: NULL = setup wizard still owed; set once on
  -- successful publishPeriod + generateEntryToken in the wizard's final step.
  -- Drives wizard auto-redirect and sidebar Setup link visibility — period
  -- count is intentionally NOT used (deleted periods would re-trigger).
  setup_completed_at TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_organizations_name_lower ON organizations (lower(name));

-- =============================================================================
-- 2. PROFILES
-- =============================================================================

CREATE TABLE profiles (
  id                UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name      TEXT,
  avatar_url        TEXT,
  email_verified_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email_verified_null
  ON profiles (id) WHERE email_verified_at IS NULL;

-- =============================================================================
-- EMAIL_VERIFICATION_TOKENS (custom soft-verification flow)
-- =============================================================================
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  consumed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
  ON email_verification_tokens (user_id, consumed_at);

-- =============================================================================
-- 3. MEMBERSHIPS
-- =============================================================================

CREATE TABLE memberships (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role             TEXT NOT NULL DEFAULT 'org_admin'
                   CHECK (role IN ('org_admin', 'super_admin')),
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'invited', 'requested')),
  grace_ends_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, organization_id)
);

-- organization_id is the second column of the UNIQUE composite, so lookups
-- filtering only by organization_id (common in tenant RLS checks) need a
-- standalone index to avoid full scans.
CREATE INDEX idx_memberships_organization_id ON memberships(organization_id);

-- grace_ends_at scanned by cron and GraceLockGate; partial index covers only rows
-- that still have an active grace window (verified or pre-migration rows are NULL).
CREATE INDEX idx_memberships_grace_ends_at ON memberships(grace_ends_at)
  WHERE grace_ends_at IS NOT NULL;

-- is_owner: the person who set up the org is its owner. At most one owner per org.
-- New memberships default to false; the first active org_admin per org is backfilled below.
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS memberships_one_owner_per_org
  ON memberships(organization_id) WHERE is_owner = true;

-- Backfill: earliest active org_admin per org becomes owner.
-- Idempotent: only updates rows whose target is currently is_owner = false.
UPDATE memberships m
SET is_owner = true
FROM (
  SELECT DISTINCT ON (organization_id) id
  FROM memberships
  WHERE status = 'active'
    AND role = 'org_admin'
    AND organization_id IS NOT NULL
  ORDER BY organization_id, created_at ASC
) earliest
WHERE m.id = earliest.id
  AND m.is_owner = false;

-- =============================================================================
-- 4. ORG_APPLICATIONS
-- =============================================================================

CREATE TABLE org_applications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,
  applicant_name   TEXT NOT NULL,
  contact_email    TEXT NOT NULL,
  message          TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by      UUID REFERENCES profiles(id),
  reviewed_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 5. FRAMEWORKS
-- =============================================================================

CREATE TABLE frameworks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  description          TEXT,
  default_threshold    NUMERIC DEFAULT 70,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 6. FRAMEWORK_OUTCOMES
-- =============================================================================

CREATE TABLE framework_outcomes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id   UUID NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  code           TEXT NOT NULL,
  label          TEXT NOT NULL,
  description    TEXT,
  sort_order     INT DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(framework_id, code)
);

-- =============================================================================
-- 7. FRAMEWORK_CRITERIA
-- =============================================================================

CREATE TABLE framework_criteria (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  key          TEXT NOT NULL,
  label        TEXT NOT NULL,
  description  TEXT,
  max_score    NUMERIC NOT NULL,
  weight       NUMERIC NOT NULL,
  color        TEXT,
  rubric_bands JSONB,
  sort_order   INT DEFAULT 0,
  UNIQUE(framework_id, key)
);

-- =============================================================================
-- 8. FRAMEWORK_CRITERION_OUTCOME_MAPS
-- =============================================================================

-- NOTE: period_id is added via ALTER TABLE after `periods` is created
-- (section 9, below). The forward reference here would fail on a fresh
-- DB apply; on prod/demo this snapshot was reached incrementally so the
-- bug never surfaced until migration-ci was added.
CREATE TABLE framework_criterion_outcome_maps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id    UUID NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  criterion_id    UUID NOT NULL REFERENCES framework_criteria(id) ON DELETE CASCADE,
  outcome_id      UUID NOT NULL REFERENCES framework_outcomes(id) ON DELETE CASCADE,
  coverage_type   TEXT NOT NULL DEFAULT 'direct'
                  CHECK (coverage_type IN ('direct', 'indirect')),
  weight          NUMERIC,
  UNIQUE(criterion_id, outcome_id)
);

-- =============================================================================
-- 9. PERIODS
-- =============================================================================

CREATE TABLE periods (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  framework_id        UUID REFERENCES frameworks(id),
  name                TEXT NOT NULL,
  season              TEXT CHECK (season IN (
    'Fall', 'Spring', 'Summer',
    'Registration', 'Submission', 'Qualifying',
    'Semi-Finals', 'Finals', 'Evaluation',
    'Review', 'Selection', 'Announcement'
  )),
  description         TEXT,
  start_date          DATE,
  end_date            DATE,
  is_locked           BOOLEAN DEFAULT false,
  activated_at        TIMESTAMPTZ,
  snapshot_frozen_at  TIMESTAMPTZ,
  closed_at           TIMESTAMPTZ,
  criteria_name       TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Now that `periods` exists, add the deferred FK column to
-- framework_criterion_outcome_maps (see note in section 8 above).
ALTER TABLE framework_criterion_outcome_maps
  ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES periods(id) ON DELETE CASCADE;

-- =============================================================================
-- 10. PROJECTS
-- =============================================================================

CREATE TABLE projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id           UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  project_no          INT,
  title               TEXT NOT NULL,
  members             JSONB NOT NULL DEFAULT '[]',
  advisor_name        TEXT,
  advisor_affiliation TEXT,
  description         TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (period_id, project_no)
);

CREATE INDEX idx_projects_period_id ON projects (period_id);

-- =============================================================================
-- 11. JURORS
-- =============================================================================

CREATE TABLE jurors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  juror_name       TEXT NOT NULL,
  affiliation      TEXT NOT NULL,
  email            TEXT,
  avatar_color     TEXT,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_jurors_organization_id ON jurors(organization_id);

-- =============================================================================
-- 12. JUROR_PERIOD_AUTH
-- =============================================================================
-- session_token_hash: SHA-256 hex of the plain session token (never stored plain)
-- pin_pending_reveal: plain PIN shown once after admin reset (cleared on read)

CREATE TABLE juror_period_auth (
  juror_id            UUID NOT NULL REFERENCES jurors(id) ON DELETE CASCADE,
  period_id           UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  pin_hash            TEXT,
  session_token_hash  TEXT,
  session_expires_at  TIMESTAMPTZ,
  last_seen_at        TIMESTAMPTZ,
  is_blocked          BOOLEAN DEFAULT false,
  edit_enabled        BOOLEAN DEFAULT false,
  edit_reason         TEXT,
  edit_expires_at     TIMESTAMPTZ,
  failed_attempts     INT DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  locked_at           TIMESTAMPTZ,
  final_submitted_at  TIMESTAMPTZ,
  pin_pending_reveal  TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (juror_id, period_id)
);

-- =============================================================================
-- 13. ENTRY_TOKENS
-- =============================================================================
-- token_hash: SHA-256 hex of the plain token (used for verification)
-- token_plain: stored for admin QR generation (readable only by authenticated)

CREATE TABLE entry_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id     UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL UNIQUE,
  token_plain   TEXT,
  is_revoked    BOOLEAN DEFAULT false,
  revoked_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_entry_tokens_token_hash ON entry_tokens (token_hash);

-- =============================================================================
-- 13b. UNLOCK_REQUESTS
-- =============================================================================
-- Org admin cannot directly unlock a period that already has scores (fairness).
-- Super admin approval is required — this table holds pending/decided requests.

CREATE TABLE unlock_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id       UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by    UUID NOT NULL REFERENCES profiles(id),
  reason          TEXT NOT NULL CHECK (length(btrim(reason)) >= 10),
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by     UUID REFERENCES profiles(id),
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_unlock_requests_org_status ON unlock_requests (organization_id, status);
CREATE INDEX idx_unlock_requests_period ON unlock_requests (period_id);
-- One pending request per period at a time
CREATE UNIQUE INDEX idx_unlock_requests_one_pending_per_period
  ON unlock_requests (period_id) WHERE status = 'pending';

-- =============================================================================
-- 14. AUDIT TAXONOMY TYPES
-- =============================================================================
-- Defined here (before audit_logs) so the table can reference them directly.

CREATE TYPE audit_category  AS ENUM ('auth', 'access', 'data', 'config', 'security');
CREATE TYPE audit_severity  AS ENUM ('info', 'low', 'medium', 'high', 'critical');
CREATE TYPE audit_actor_type AS ENUM ('admin', 'juror', 'system', 'anonymous');

-- =============================================================================
-- 15. AUDIT_LOGS
-- =============================================================================

CREATE TABLE audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES profiles(id),
  action           TEXT NOT NULL,
  resource_type    TEXT,
  resource_id      UUID,
  details          JSONB,
  -- taxonomy (added via 043_audit_taxonomy)
  category         audit_category,
  severity         audit_severity DEFAULT 'info',
  actor_type       audit_actor_type,
  actor_name       TEXT,
  ip_address       INET,
  user_agent       TEXT,
  session_id       UUID,
  correlation_id   UUID,
  diff             JSONB,
  -- hash-chain (added via 054_audit_hash_chain)
  row_hash         TEXT,
  -- true insertion-order counter; avoids backdated created_at breaking the chain
  chain_seq        BIGSERIAL,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_logs_organization_created
  ON audit_logs (organization_id, created_at DESC);

CREATE INDEX idx_audit_logs_chain_seq
  ON audit_logs (organization_id, chain_seq DESC);

-- Filtered list by category (most common query pattern)
CREATE INDEX idx_audit_logs_category_created
  ON audit_logs (organization_id, category, created_at DESC);

-- Security/compliance dashboard: only ≥medium rows
CREATE INDEX idx_audit_logs_severity
  ON audit_logs (organization_id, severity, created_at DESC)
  WHERE severity IN ('medium', 'high', 'critical');

-- Actor-type drill-down (juror vs admin vs system activity)
CREATE INDEX idx_audit_logs_actor_type
  ON audit_logs (organization_id, actor_type, created_at DESC);

-- Filter by user_id (admin activity review across orgs)
CREATE INDEX idx_audit_logs_user_id
  ON audit_logs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

-- =============================================================================
-- 15. PERIOD_CRITERIA (snapshot)
-- =============================================================================

CREATE TABLE period_criteria (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id           UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  source_criterion_id UUID,
  key                 TEXT NOT NULL,
  label               TEXT NOT NULL,
  description         TEXT,
  max_score           NUMERIC NOT NULL,
  weight              NUMERIC NOT NULL,
  color               TEXT,
  rubric_bands        JSONB,
  sort_order          INT DEFAULT 0,
  UNIQUE(period_id, key)
);

-- =============================================================================
-- 16. PERIOD_OUTCOMES (snapshot)
-- =============================================================================

CREATE TABLE period_outcomes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id         UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  source_outcome_id UUID,
  code              TEXT NOT NULL,
  label             TEXT NOT NULL,
  description       TEXT,
  coverage_type     TEXT CHECK (coverage_type IN ('direct', 'indirect')),
  sort_order        INT DEFAULT 0,
  UNIQUE(period_id, code)
);

-- =============================================================================
-- 17. PERIOD_CRITERION_OUTCOME_MAPS (snapshot)
-- =============================================================================

CREATE TABLE period_criterion_outcome_maps (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id            UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  period_criterion_id  UUID NOT NULL REFERENCES period_criteria(id) ON DELETE CASCADE,
  period_outcome_id    UUID NOT NULL REFERENCES period_outcomes(id) ON DELETE CASCADE,
  coverage_type        TEXT CHECK (coverage_type IN ('direct', 'indirect')),
  weight               NUMERIC,
  UNIQUE(period_criterion_id, period_outcome_id)
);

-- =============================================================================
-- 18. SCORE_SHEETS
-- =============================================================================

CREATE TABLE score_sheets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id        UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  juror_id         UUID NOT NULL REFERENCES jurors(id) ON DELETE CASCADE,
  comment          TEXT,
  status           TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'in_progress', 'submitted')),
  started_at       TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(juror_id, project_id)
);

CREATE INDEX idx_score_sheets_period ON score_sheets(period_id);
CREATE INDEX idx_score_sheets_juror  ON score_sheets(juror_id);

-- =============================================================================
-- 19. SCORE_SHEET_ITEMS
-- =============================================================================

CREATE TABLE score_sheet_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_sheet_id       UUID NOT NULL REFERENCES score_sheets(id) ON DELETE CASCADE,
  period_criterion_id  UUID NOT NULL REFERENCES period_criteria(id) ON DELETE CASCADE,
  score_value          NUMERIC CHECK (score_value >= 0),
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(score_sheet_id, period_criterion_id)
);

CREATE INDEX idx_score_sheet_items_sheet ON score_sheet_items(score_sheet_id);
CREATE INDEX idx_score_sheet_items_period_criterion ON score_sheet_items(period_criterion_id);

-- =============================================================================
-- 20. MAINTENANCE_MODE (single-row config)
-- =============================================================================

CREATE TABLE maintenance_mode (
  id              INT PRIMARY KEY DEFAULT 1,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  mode            TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (mode IN ('scheduled', 'immediate')),
  start_time      TIMESTAMPTZ,
  end_time        TIMESTAMPTZ,
  message         TEXT NOT NULL DEFAULT 'VERA is undergoing scheduled maintenance. We''ll be back shortly.',
  affected_org_ids UUID[],
  notify_admins   BOOLEAN NOT NULL DEFAULT true,
  activated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT maintenance_mode_single_row CHECK (id = 1)
);

INSERT INTO maintenance_mode (id, is_active, mode, message, notify_admins, updated_at)
VALUES (1, false, 'immediate', 'VERA is undergoing scheduled maintenance. We''ll be back shortly.', true, now())
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 21. SECURITY_POLICY (single-row config)
-- =============================================================================

CREATE TABLE security_policy (
  id         INT PRIMARY KEY DEFAULT 1,
  policy     JSONB NOT NULL DEFAULT '{
    "googleOAuth": true,
    "emailPassword": true,
    "rememberMe": true,
    "qrTtl": "24h",
    "maxPinAttempts": 5,
    "pinLockCooldown": "30m",
    "ccOnPinReset": true,
    "ccOnScoreEdit": false,
    "ccOnTenantApplication": true,
    "ccOnMaintenance": true,
    "ccOnPasswordChanged": true
  }'::JSONB,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT security_policy_single_row CHECK (id = 1)
);

INSERT INTO security_policy (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 22. JURY_FEEDBACK
-- =============================================================================

CREATE TABLE jury_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id   UUID NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  juror_id    UUID NOT NULL REFERENCES jurors(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  is_public   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_jury_feedback_juror_period
  ON jury_feedback(period_id, juror_id);

-- =============================================================================
-- 23. RECEIVED_EMAILS
-- =============================================================================
-- Stores inbound emails forwarded via the Resend webhook Edge Function
-- (supabase/functions/receive-email/index.ts).
-- Access is service_role-only (no GRANT to authenticated/anon; no RLS needed).

CREATE TABLE IF NOT EXISTS received_emails (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  from_address TEXT,
  to_address   TEXT,
  subject      TEXT,
  text_body    TEXT,
  html_body    TEXT,
  raw_payload  JSONB
);

-- =============================================================================
-- VIEW: scores_compat (backward-compatibility bridge for admin pages)
-- =============================================================================
-- Pivots normalized score_sheet_items to flat wide-row shape.
-- Criterion key mapping (matches fieldMapping.js):
--   technical -> technical, design -> written, delivery -> oral, teamwork -> teamwork

CREATE OR REPLACE VIEW scores_compat AS
SELECT
  ss.id,
  ss.juror_id,
  ss.project_id,
  ss.period_id,
  MAX(ssi.score_value) FILTER (WHERE pc.key = 'technical') AS technical,
  MAX(ssi.score_value) FILTER (WHERE pc.key = 'design')    AS written,
  MAX(ssi.score_value) FILTER (WHERE pc.key = 'delivery')  AS oral,
  MAX(ssi.score_value) FILTER (WHERE pc.key = 'teamwork')  AS teamwork,
  ss.comment AS comments,
  ss.created_at,
  ss.updated_at
FROM score_sheets ss
LEFT JOIN score_sheet_items ssi ON ssi.score_sheet_id = ss.id
LEFT JOIN period_criteria   pc  ON pc.id = ssi.period_criterion_id
GROUP BY ss.id;

-- =============================================================================
-- GRANTS
-- =============================================================================

-- Identity
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON memberships      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_applications TO authenticated;
GRANT SELECT ON organizations    TO anon;
GRANT SELECT ON org_applications TO anon;

-- Service role (Edge Functions bypass RLS but still need table-level grants)
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations    TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles         TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON memberships      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON org_applications TO service_role;

-- Frameworks
GRANT SELECT, INSERT, UPDATE, DELETE ON frameworks                       TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON framework_outcomes               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON framework_criteria               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON framework_criterion_outcome_maps TO authenticated;
GRANT SELECT ON frameworks                       TO anon;
GRANT SELECT ON framework_outcomes               TO anon;
GRANT SELECT ON framework_criteria               TO anon;
GRANT SELECT ON framework_criterion_outcome_maps TO anon;

-- Execution
GRANT SELECT, INSERT, UPDATE, DELETE ON periods           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON jurors            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON juror_period_auth TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON entry_tokens      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_logs        TO authenticated;
GRANT SELECT ON periods           TO anon;
GRANT SELECT ON projects          TO anon;
GRANT SELECT ON jurors            TO anon;
GRANT SELECT ON entry_tokens      TO anon;
GRANT SELECT ON memberships       TO anon;
GRANT SELECT ON juror_period_auth TO anon;

-- Snapshots
GRANT SELECT, INSERT, UPDATE, DELETE ON period_criteria              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON period_outcomes              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON period_criterion_outcome_maps TO authenticated;
GRANT SELECT ON period_criteria               TO anon;
GRANT SELECT ON period_outcomes               TO anon;
GRANT SELECT ON period_criterion_outcome_maps TO anon;

-- Scoring
GRANT SELECT, INSERT, UPDATE, DELETE ON score_sheets      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON score_sheet_items TO authenticated;
GRANT SELECT ON scores_compat                             TO authenticated;
GRANT SELECT ON score_sheets      TO anon;
GRANT SELECT ON score_sheet_items TO anon;
GRANT SELECT ON scores_compat     TO anon;

-- Unlock requests (read-only for authenticated; writes go through SECURITY
-- DEFINER RPCs rpc_admin_request_unlock + rpc_super_admin_resolve_unlock).
-- Without this grant, the unlock_requests_select RLS policy would be dead
-- code and tenant admins would receive "permission denied for table" before
-- RLS even evaluates. Pinned by sql/tests/rls/unlock_requests_isolation.sql.
GRANT SELECT ON unlock_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON unlock_requests TO service_role;

-- Config
GRANT SELECT ON maintenance_mode TO anon, authenticated;

-- Sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- =============================================================================
-- TRIGGER: handle_invite_confirmed
-- =============================================================================
-- Fires when a user confirms their email via Supabase Auth. Handles:
--   1. Invited users      → promote membership 'invited' → 'active'
--   2. Self-serve signup  → materialize organization + membership from
--                           raw_user_meta_data (orgName or joinOrgId).
-- Runs atomically in the same transaction as the auth.users UPDATE, so the
-- client never sees a window of "verified email but no org".

CREATE OR REPLACE FUNCTION public.handle_invite_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metadata    JSONB;
  v_org_name    TEXT;
  v_join_id     UUID;
  v_org_id      UUID;
  v_code        TEXT;
BEGIN
  -- Only fire on the newly-confirmed transition.
  IF NOT (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  -- (1) Invite flow: activate any pending invited memberships.
  UPDATE memberships
  SET status = 'active'
  WHERE user_id = NEW.id AND status = 'invited';

  -- Self-serve signup only applies when the user has no memberships yet.
  -- If the invite UPDATE above activated rows, skip self-serve creation.
  IF EXISTS (SELECT 1 FROM memberships WHERE user_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_metadata    := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_org_name    := NULLIF(trim(COALESCE(v_metadata->>'orgName', '')), '');
  BEGIN
    v_join_id := NULLIF(v_metadata->>'joinOrgId', '')::UUID;
  EXCEPTION WHEN invalid_text_representation THEN
    v_join_id := NULL;
  END;

  -- Ensure profile row exists (required for FK from memberships.user_id).
  INSERT INTO profiles(id) VALUES (NEW.id) ON CONFLICT (id) DO NOTHING;

  IF v_join_id IS NOT NULL THEN
    -- (2a) Join existing org: create 'requested' membership for admin review.
    IF EXISTS (SELECT 1 FROM organizations WHERE id = v_join_id AND status = 'active') THEN
      INSERT INTO memberships (user_id, organization_id, role, status)
      VALUES (NEW.id, v_join_id, 'org_admin', 'requested')
      ON CONFLICT DO NOTHING;
    END IF;
  ELSIF v_org_name IS NOT NULL THEN
    -- (2b) Create new organization + active org_admin membership.
    -- Mirrors rpc_admin_create_org_and_membership code-generation logic.
    v_code := upper(regexp_replace(left(v_org_name, 4), '[^A-Z0-9]', '', 'g'))
              || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4));

    BEGIN
      INSERT INTO organizations(code, name, status)
      VALUES (v_code, v_org_name, 'active')
      RETURNING id INTO v_org_id;

      INSERT INTO memberships (user_id, organization_id, role, status)
      VALUES (NEW.id, v_org_id, 'org_admin', 'active');

      -- Audit (best-effort; never block signup on audit failure).
      BEGIN
        PERFORM public._audit_write(
          v_org_id,
          'organization.created',
          'organizations',
          v_org_id,
          'config'::audit_category,
          'high'::audit_severity,
          jsonb_build_object('org_name', v_org_name, 'created_by', NEW.id, 'flow', 'email_signup'),
          jsonb_build_object('before', null, 'after', jsonb_build_object('status', 'active', 'role', 'org_admin'))
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    EXCEPTION WHEN unique_violation THEN
      -- Org code/name collision: skip silently. User lands without an org and
      -- can retry via completeProfile() from the app (idempotent path).
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_invite_confirmed();

-- =============================================================================
-- Supabase Realtime Publication
-- =============================================================================
-- Only tables that need live updates are included to minimise WAL overhead.
-- RLS still applies to all realtime subscriptions.
-- Note: ALTER PUBLICATION is idempotent for tables already in the publication.
--
-- audit_logs intentionally excluded: every mutation trigger writes here, so
-- including it in the publication causes WAL amplification on every admin
-- action. The Audit Log page uses polling/on-demand refresh instead.

ALTER PUBLICATION supabase_realtime ADD TABLE
  score_sheets,
  score_sheet_items,
  juror_period_auth,
  projects,
  periods,
  jurors;

-- =============================================================================
-- BACKFILL: periods.criteria_name
-- =============================================================================
-- Periods that have criteria saved in period_criteria but no criteria_name set
-- (created before the criteria_name column was introduced) get a default label
-- so the Periods page shows a meaningful badge instead of "N criteria".
-- Idempotent: WHERE criteria_name IS NULL — safe to re-run.

UPDATE periods
SET criteria_name = 'Custom Criteria'
WHERE criteria_name IS NULL
  AND id IN (SELECT DISTINCT period_id FROM period_criteria);

-- =============================================================================
-- BACKFILL: organizations.setup_completed_at
-- =============================================================================
-- Make existing prod/demo deploys idempotent: any org that already has a
-- published (locked) period has, by definition, completed onboarding. Mark
-- them done so the wizard never reopens for them. New orgs created after
-- this migration start with NULL and go through the wizard normally.
-- ALTER ... ADD COLUMN IF NOT EXISTS makes this safe on a fresh-from-zero
-- apply too, since the CREATE TABLE above already includes the column.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ;

UPDATE organizations o
SET setup_completed_at = COALESCE(
  (SELECT MIN(p.activated_at)
     FROM periods p
    WHERE p.organization_id = o.id
      AND p.is_locked = true
      AND p.activated_at IS NOT NULL),
  now()
)
WHERE setup_completed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM periods p
    WHERE p.organization_id = o.id AND p.is_locked = true
  );
