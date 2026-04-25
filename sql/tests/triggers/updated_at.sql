-- pgTAP: trigger_set_updated_at Coverage Tests
--
-- Tests that the trigger_set_updated_at function correctly updates the
-- updated_at timestamp on INSERT and UPDATE for all affected tables:
-- organizations, periods, projects, jurors, juror_period_auth,
-- score_sheets, score_sheet_items

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(7);

-- Seed organizations and periods to establish foreign key relationships
SELECT pgtap_test.seed_two_orgs();
SELECT pgtap_test.seed_periods();

-- ====================================================================
-- Test 1: organizations.updated_at advances on UPDATE
-- ====================================================================
-- Create a test org with old created_at, then update it
INSERT INTO organizations (id, code, name, created_at, updated_at)
VALUES ('aaaa0000-0000-4000-8000-aaaaaaaaaaaa'::uuid, 'test-trigger-org', 'Test Trigger Org',
        now() - interval '1 second', now() - interval '1 second')
ON CONFLICT (id) DO NOTHING;

SELECT pg_sleep(0.01);

UPDATE organizations
SET name = 'Updated Org Name'
WHERE id = 'aaaa0000-0000-4000-8000-aaaaaaaaaaaa'::uuid;

SELECT ok(
  (SELECT updated_at FROM organizations
   WHERE id = 'aaaa0000-0000-4000-8000-aaaaaaaaaaaa'::uuid) >
  (SELECT created_at FROM organizations
   WHERE id = 'aaaa0000-0000-4000-8000-aaaaaaaaaaaa'::uuid),
  'trigger_set_updated_at: organizations.updated_at advances on UPDATE'
);

-- ====================================================================
-- Test 2: periods.updated_at advances on UPDATE
-- ====================================================================
INSERT INTO periods (id, organization_id, name, season, created_at, updated_at)
VALUES ('bbbb0000-0000-4000-8000-bbbbbbbbbbbb'::uuid,
        '11110000-0000-4000-8000-000000000001'::uuid, 'Test Period', 'Spring',
        now() - interval '1 second', now() - interval '1 second')
ON CONFLICT (id) DO NOTHING;

SELECT pg_sleep(0.01);

UPDATE periods
SET name = 'Updated Period Name'
WHERE id = 'bbbb0000-0000-4000-8000-bbbbbbbbbbbb'::uuid;

SELECT ok(
  (SELECT updated_at FROM periods
   WHERE id = 'bbbb0000-0000-4000-8000-bbbbbbbbbbbb'::uuid) >
  (SELECT created_at FROM periods
   WHERE id = 'bbbb0000-0000-4000-8000-bbbbbbbbbbbb'::uuid),
  'trigger_set_updated_at: periods.updated_at advances on UPDATE'
);

-- ====================================================================
-- Test 3: projects.updated_at advances on UPDATE
-- ====================================================================
INSERT INTO projects (id, period_id, title, advisor_name, created_at, updated_at)
VALUES ('cccc0000-0000-4000-8000-cccccccccccc'::uuid,
        'cccc0000-0000-4000-8000-000000000001'::uuid, 'Test Project', 'Advisor',
        now() - interval '1 second', now() - interval '1 second')
ON CONFLICT (id) DO NOTHING;

SELECT pg_sleep(0.01);

UPDATE projects
SET title = 'Updated Project Title'
WHERE id = 'cccc0000-0000-4000-8000-cccccccccccc'::uuid;

SELECT ok(
  (SELECT updated_at FROM projects
   WHERE id = 'cccc0000-0000-4000-8000-cccccccccccc'::uuid) >
  (SELECT created_at FROM projects
   WHERE id = 'cccc0000-0000-4000-8000-cccccccccccc'::uuid),
  'trigger_set_updated_at: projects.updated_at advances on UPDATE'
);

-- ====================================================================
-- Test 4: jurors.updated_at advances on UPDATE
-- ====================================================================
INSERT INTO jurors (id, organization_id, juror_name, email, affiliation, created_at, updated_at)
VALUES ('dddd0000-0000-4000-8000-dddddddddddd'::uuid,
        '11110000-0000-4000-8000-000000000001'::uuid, 'Test Juror', 'test@test.local', 'Test Affiliation',
        now() - interval '1 second', now() - interval '1 second')
ON CONFLICT (id) DO NOTHING;

SELECT pg_sleep(0.01);

UPDATE jurors
SET juror_name = 'Updated Juror Name'
WHERE id = 'dddd0000-0000-4000-8000-dddddddddddd'::uuid;

SELECT ok(
  (SELECT updated_at FROM jurors
   WHERE id = 'dddd0000-0000-4000-8000-dddddddddddd'::uuid) >
  (SELECT created_at FROM jurors
   WHERE id = 'dddd0000-0000-4000-8000-dddddddddddd'::uuid),
  'trigger_set_updated_at: jurors.updated_at advances on UPDATE'
);

-- ====================================================================
-- Test 5: score_sheets.updated_at advances on UPDATE
-- ====================================================================
INSERT INTO score_sheets (id, project_id, juror_id, period_id, created_at, updated_at)
VALUES ('eeee0000-0000-4000-8000-eeeeeeeeeeee'::uuid,
        'cccc0000-0000-4000-8000-cccccccccccc'::uuid,
        'dddd0000-0000-4000-8000-dddddddddddd'::uuid,
        'cccc0000-0000-4000-8000-000000000001'::uuid,
        now() - interval '1 second', now() - interval '1 second');

SELECT pg_sleep(0.01);

UPDATE score_sheets
SET comment = 'Updated comment'
WHERE id = 'eeee0000-0000-4000-8000-eeeeeeeeeeee'::uuid;

SELECT ok(
  (SELECT updated_at FROM score_sheets
   WHERE id = 'eeee0000-0000-4000-8000-eeeeeeeeeeee'::uuid) >
  (SELECT created_at FROM score_sheets
   WHERE id = 'eeee0000-0000-4000-8000-eeeeeeeeeeee'::uuid),
  'trigger_set_updated_at: score_sheets.updated_at advances on UPDATE'
);

-- ====================================================================
-- Test 6: score_sheet_items.updated_at advances on UPDATE
-- ====================================================================
INSERT INTO score_sheet_items (id, score_sheet_id, period_criterion_id, score_value, created_at, updated_at)
VALUES ('ffff0000-0000-4000-8000-ffffffffffff'::uuid,
        'eeee0000-0000-4000-8000-eeeeeeeeeeee'::uuid,
        (SELECT id FROM period_criteria LIMIT 1),
        5,
        now() - interval '1 second', now() - interval '1 second');

SELECT pg_sleep(0.01);

UPDATE score_sheet_items
SET score_value = 8
WHERE id = 'ffff0000-0000-4000-8000-ffffffffffff'::uuid;

SELECT ok(
  (SELECT updated_at FROM score_sheet_items
   WHERE id = 'ffff0000-0000-4000-8000-ffffffffffff'::uuid) >
  (SELECT created_at FROM score_sheet_items
   WHERE id = 'ffff0000-0000-4000-8000-ffffffffffff'::uuid),
  'trigger_set_updated_at: score_sheet_items.updated_at advances on UPDATE'
);

-- ====================================================================
-- Test 7: juror_period_auth.updated_at advances on UPDATE
-- ====================================================================
INSERT INTO juror_period_auth (juror_id, period_id, pin_hash, created_at, updated_at)
VALUES ('dddd0000-0000-4000-8000-dddddddddddd'::uuid,
        'cccc0000-0000-4000-8000-000000000001'::uuid,
        'test-pin-hash',
        now() - interval '1 second', now() - interval '1 second');

SELECT pg_sleep(0.01);

UPDATE juror_period_auth
SET is_blocked = true
WHERE juror_id = 'dddd0000-0000-4000-8000-dddddddddddd'::uuid
  AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid;

SELECT ok(
  (SELECT updated_at FROM juror_period_auth
   WHERE juror_id = 'dddd0000-0000-4000-8000-dddddddddddd'::uuid
     AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid) >
  (SELECT created_at FROM juror_period_auth
   WHERE juror_id = 'dddd0000-0000-4000-8000-dddddddddddd'::uuid
     AND period_id = 'cccc0000-0000-4000-8000-000000000001'::uuid),
  'trigger_set_updated_at: juror_period_auth.updated_at advances on UPDATE'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
