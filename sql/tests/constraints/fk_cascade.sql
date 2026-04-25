-- pgTAP: FK ON DELETE CASCADE Verification
--
-- Tests that foreign key constraints with ON DELETE CASCADE properly cascade
-- deletes from parent to child tables. We verify several critical cascade
-- chains to ensure data integrity.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(6);

SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ====================================================================
-- Test 1: organizations CASCADE → memberships
-- ====================================================================
-- Insert an org and a membership pointing to it
INSERT INTO organizations (id, code, name) VALUES
  ('aaaa0000-0000-4000-8000-000000000aa1'::uuid, 'cascade-test-org', 'Cascade Test Org');

INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
  ('aaaa0000-0000-4000-8000-000000000bb1'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'cascade_test@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, display_name) VALUES
  ('aaaa0000-0000-4000-8000-000000000bb1'::uuid, 'Cascade Test User')
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (user_id, organization_id, role, status) VALUES
  ('aaaa0000-0000-4000-8000-000000000bb1'::uuid,
   'aaaa0000-0000-4000-8000-000000000aa1'::uuid, 'org_admin', 'active');

-- Delete the org; cascade should delete the membership
DELETE FROM organizations
WHERE id = 'aaaa0000-0000-4000-8000-000000000aa1'::uuid;

SELECT is(
  (SELECT count(*) FROM memberships
   WHERE organization_id = 'aaaa0000-0000-4000-8000-000000000aa1'::uuid),
  0::bigint,
  'FK CASCADE: organizations → memberships'
);

-- ====================================================================
-- Test 2: organizations CASCADE → periods
-- ====================================================================
-- Insert an org and a period pointing to it
INSERT INTO organizations (id, code, name) VALUES
  ('aaaa0000-0000-4000-8000-000000000cc1'::uuid, 'cascade-test-org-2', 'Cascade Test Org 2');

INSERT INTO periods (id, organization_id, name, season) VALUES
  ('aaaa0000-0000-4000-8000-000000000dd1'::uuid,
   'aaaa0000-0000-4000-8000-000000000cc1'::uuid, 'Test Period', 'Spring');

-- Delete the org; cascade should delete the period
DELETE FROM organizations
WHERE id = 'aaaa0000-0000-4000-8000-000000000cc1'::uuid;

SELECT is(
  (SELECT count(*) FROM periods
   WHERE organization_id = 'aaaa0000-0000-4000-8000-000000000cc1'::uuid),
  0::bigint,
  'FK CASCADE: organizations → periods'
);

-- ====================================================================
-- Test 3: organizations CASCADE → jurors
-- ====================================================================
-- Insert an org and a juror pointing to it
INSERT INTO organizations (id, code, name) VALUES
  ('aaaa0000-0000-4000-8000-000000000ee1'::uuid, 'cascade-test-org-3', 'Cascade Test Org 3');

INSERT INTO jurors (id, organization_id, juror_name, email, affiliation) VALUES
  ('aaaa0000-0000-4000-8000-000000000ff1'::uuid,
   'aaaa0000-0000-4000-8000-000000000ee1'::uuid, 'Test Juror', 'juror@test.local', 'Test Affiliation');

-- Delete the org; cascade should delete the juror
DELETE FROM organizations
WHERE id = 'aaaa0000-0000-4000-8000-000000000ee1'::uuid;

SELECT is(
  (SELECT count(*) FROM jurors
   WHERE organization_id = 'aaaa0000-0000-4000-8000-000000000ee1'::uuid),
  0::bigint,
  'FK CASCADE: organizations → jurors'
);

-- ====================================================================
-- Test 4: periods CASCADE → projects
-- ====================================================================
-- Create a new period for this test
INSERT INTO periods (id, organization_id, name, season) VALUES
  ('aaaa0000-0000-4000-8000-000000ee0001'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid, 'Cascade Test Period for Projects', 'Summer');

-- Insert a project into this period
INSERT INTO projects (id, period_id, title, advisor_name) VALUES
  ('aaaa0000-0000-4000-8000-000000aaa001'::uuid,
   'aaaa0000-0000-4000-8000-000000ee0001'::uuid, 'Cascade Test Project', 'Advisor');

-- Count projects before delete
SELECT ok(
  EXISTS(
    SELECT 1 FROM projects
    WHERE period_id = 'aaaa0000-0000-4000-8000-000000ee0001'::uuid
      AND id = 'aaaa0000-0000-4000-8000-000000aaa001'::uuid
  ),
  'Setup: project exists before period deletion'
);

-- Delete the period; cascade should delete the project
DELETE FROM periods
WHERE id = 'aaaa0000-0000-4000-8000-000000ee0001'::uuid;

SELECT is(
  (SELECT count(*) FROM projects
   WHERE period_id = 'aaaa0000-0000-4000-8000-000000ee0001'::uuid),
  0::bigint,
  'FK CASCADE: periods → projects'
);

-- ====================================================================
-- Test 5: periods CASCADE → score_sheets
-- ====================================================================
SELECT pgtap_test.seed_projects();
SELECT pgtap_test.seed_jurors();

-- Create a new period for this test
INSERT INTO periods (id, organization_id, name, season) VALUES
  ('aaaa0000-0000-4000-8000-000000ff0001'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid, 'Cascade Test Period for Score Sheets', 'Fall');

-- Use existing project and juror; insert a score sheet
INSERT INTO score_sheets (id, project_id, juror_id, period_id) VALUES
  ('aaaa0000-0000-4000-8000-000000bbb001'::uuid,
   '44440000-0000-4000-8000-000000000002'::uuid,
   '66660000-0000-4000-8000-000000000002'::uuid,
   'aaaa0000-0000-4000-8000-000000ff0001'::uuid);

-- Delete the period; cascade should delete the score sheet
DELETE FROM periods
WHERE id = 'aaaa0000-0000-4000-8000-000000ff0001'::uuid;

SELECT is(
  (SELECT count(*) FROM score_sheets
   WHERE id = 'aaaa0000-0000-4000-8000-000000bbb001'::uuid),
  0::bigint,
  'FK CASCADE: periods → score_sheets'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
