-- ============================================================
-- 001_core_schema.sql
-- Core table definitions, indexes, and constraints.
-- Canonical schema — all column names are final.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS extensions;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL   ON SCHEMA public TO postgres, service_role;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── Tenants ────────────────────────────────────────────────

CREATE TABLE public.tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL,
  short_label text NOT NULL,
  university  text NOT NULL DEFAULT '',
  department  text NOT NULL DEFAULT '',
  status      text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'disabled', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tenants_code_ci_unique
  ON public.tenants (lower(trim(code)));

-- ── Semesters ──────────────────────────────────────────────

CREATE TABLE public.semesters (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              uuid NOT NULL REFERENCES public.tenants(id),
  semester_name          text NOT NULL,
  is_current             boolean NOT NULL DEFAULT false,
  is_locked              boolean NOT NULL DEFAULT false,
  poster_date            date,
  criteria_template      jsonb NOT NULL DEFAULT '[]'::jsonb,
  mudek_template         jsonb NOT NULL DEFAULT '[]'::jsonb,
  entry_token_hash       text,
  entry_token_enabled    boolean NOT NULL DEFAULT false,
  entry_token_created_at timestamptz,
  entry_token_expires_at timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX semesters_tenant_semester_name_ci_unique
  ON public.semesters (tenant_id, lower(trim(semester_name)));

CREATE UNIQUE INDEX semesters_one_current_per_tenant
  ON public.semesters (tenant_id) WHERE is_current = true;

CREATE INDEX idx_semesters_tenant_id
  ON public.semesters (tenant_id);

CREATE INDEX idx_semesters_entry_token_hash
  ON public.semesters (entry_token_hash)
  WHERE entry_token_hash IS NOT NULL;

-- ── Projects ───────────────────────────────────────────────

CREATE TABLE public.projects (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id    uuid NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  tenant_id      uuid NOT NULL REFERENCES public.tenants(id),
  group_no       integer NOT NULL,
  project_title  text NOT NULL,
  group_students text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX projects_semester_group_no_key
  ON public.projects (semester_id, group_no);

CREATE INDEX idx_projects_tenant_id
  ON public.projects (tenant_id);

-- ── Jurors ──────────────────────────────────────────────────

CREATE TABLE public.jurors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  juror_name text NOT NULL,
  juror_inst text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX jurors_name_inst_norm_uniq
  ON public.jurors (
    lower(regexp_replace(trim(juror_name), '\s+', ' ', 'g')),
    lower(regexp_replace(trim(juror_inst), '\s+', ' ', 'g'))
  );

-- ── Scores ─────────────────────────────────────────────────

CREATE TABLE public.scores (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_id        uuid NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  project_id         uuid NOT NULL REFERENCES public.projects(id)  ON DELETE CASCADE,
  juror_id           uuid NOT NULL REFERENCES public.jurors(id)    ON DELETE CASCADE,
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id),
  poster_date        date,
  criteria_scores    jsonb,
  total              integer,
  comment            text,
  final_submitted_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scores
  ADD CONSTRAINT scores_unique_eval
    UNIQUE (semester_id, project_id, juror_id);

ALTER TABLE public.scores
  ADD CONSTRAINT scores_total_range
    CHECK (total IS NULL OR (total >= 0 AND total <= 100));

CREATE INDEX idx_scores_tenant_id
  ON public.scores (tenant_id);

-- ── Settings ───────────────────────────────────────────────

CREATE TABLE public.settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL,
  tenant_id  uuid REFERENCES public.tenants(id),
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique (key, tenant_id) — uses sentinel UUID for NULL tenant_id.
CREATE UNIQUE INDEX settings_key_tenant_unique
  ON public.settings (
    key,
    COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- v1 compat: unique key for global settings (tenant_id IS NULL).
CREATE UNIQUE INDEX settings_key_global_unique
  ON public.settings (key)
  WHERE tenant_id IS NULL;

-- ── Juror Semester Auth ────────────────────────────────────

CREATE TABLE public.juror_semester_auth (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  juror_id           uuid NOT NULL REFERENCES public.jurors(id)    ON DELETE CASCADE,
  semester_id        uuid NOT NULL REFERENCES public.semesters(id) ON DELETE CASCADE,
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id),
  pin_hash           text NOT NULL,
  pin_reveal_pending boolean NOT NULL DEFAULT false,
  pin_plain_once     text,
  edit_enabled       boolean NOT NULL DEFAULT false,
  session_token_hash text,
  session_expires_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  failed_attempts    integer NOT NULL DEFAULT 0,
  locked_until       timestamptz,
  last_seen_at       timestamptz
);

ALTER TABLE public.juror_semester_auth
  ADD CONSTRAINT juror_semester_auth_unique
    UNIQUE (juror_id, semester_id);

CREATE INDEX idx_jsa_tenant_id
  ON public.juror_semester_auth (tenant_id);

-- ── Audit Logs ─────────────────────────────────────────────

CREATE TABLE public.audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  actor_type  text NOT NULL CHECK (actor_type IN ('admin', 'juror', 'system')),
  actor_id    uuid,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  message     text NOT NULL,
  metadata    jsonb,
  tenant_id   uuid REFERENCES public.tenants(id)
);

CREATE INDEX audit_logs_created_at_idx
  ON public.audit_logs (created_at DESC);

CREATE INDEX idx_audit_logs_tenant
  ON public.audit_logs (tenant_id);

-- ── Tenant Admin Memberships ───────────────────────────────

CREATE TABLE public.tenant_admin_memberships (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  role        text NOT NULL DEFAULT 'tenant_admin'
    CHECK (role IN ('tenant_admin', 'super_admin')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX tam_user_tenant_unique
  ON public.tenant_admin_memberships (user_id, tenant_id)
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX tam_user_super_unique
  ON public.tenant_admin_memberships (user_id)
  WHERE role = 'super_admin' AND tenant_id IS NULL;

ALTER TABLE public.tenant_admin_memberships
  ADD CONSTRAINT tam_tenant_admin_requires_tenant
    CHECK (role <> 'tenant_admin' OR tenant_id IS NOT NULL);

-- ── Tenant Admin Applications ──────────────────────────────

CREATE TABLE public.tenant_admin_applications (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  applicant_email    text NOT NULL,
  applicant_name     text NOT NULL,
  university         text NOT NULL DEFAULT '',
  department         text NOT NULL DEFAULT '',
  encrypted_password text,
  status             text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by        uuid,
  reviewed_at        timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX taa_pending_email_tenant_unique
  ON public.tenant_admin_applications (lower(trim(applicant_email)), tenant_id)
  WHERE status = 'pending';

-- ── Admin Profiles ─────────────────────────────────────────

CREATE TABLE public.admin_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
