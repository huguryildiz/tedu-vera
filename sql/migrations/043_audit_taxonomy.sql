-- sql/migrations/043_audit_taxonomy.sql
-- Add taxonomy columns to audit_logs:
-- category, severity, actor_type, actor_name, ip_address, user_agent,
-- session_id, correlation_id, diff
-- Plus 3 composite indexes for efficient filtered queries.

CREATE TYPE audit_category AS ENUM ('auth','access','data','config','security');
CREATE TYPE audit_severity AS ENUM ('info','low','medium','high','critical');
CREATE TYPE audit_actor_type AS ENUM ('admin','juror','system','anonymous');

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS category       audit_category,
  ADD COLUMN IF NOT EXISTS severity       audit_severity DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS actor_type     audit_actor_type,
  ADD COLUMN IF NOT EXISTS actor_name     TEXT,
  ADD COLUMN IF NOT EXISTS ip_address     INET,
  ADD COLUMN IF NOT EXISTS user_agent     TEXT,
  ADD COLUMN IF NOT EXISTS session_id     UUID,
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS diff           JSONB;

-- Filtered list by category (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_audit_logs_category_created
  ON audit_logs (organization_id, category, created_at DESC);

-- Security/compliance dashboard: only ≥medium rows
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity
  ON audit_logs (organization_id, severity, created_at DESC)
  WHERE severity IN ('medium','high','critical');

-- Actor-type drill-down (juror vs admin vs system activity)
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_type
  ON audit_logs (organization_id, actor_type, created_at DESC);
