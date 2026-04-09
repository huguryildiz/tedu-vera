-- Simplify organizations.status to active | archived only.
-- Drop limited and disabled — they were never enforced.
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_status_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_status_check
  CHECK (status IN ('active', 'archived'));

-- Migrate any existing non-standard rows to active
UPDATE organizations
  SET status = 'active'
  WHERE status NOT IN ('active', 'archived');
