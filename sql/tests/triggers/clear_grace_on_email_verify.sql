-- pgTAP: trigger_clear_grace_on_email_verify Coverage
--
-- Tests that when a profile's email_verified_at transitions from NULL to NOT NULL,
-- the trigger clears grace_ends_at for all memberships belonging to that user.

BEGIN;
SET LOCAL search_path = tap, public, extensions;
SELECT plan(2);

SELECT pgtap_test.seed_two_orgs();

-- ====================================================================
-- Setup: Create a test user with a profile and membership with grace_ends_at set
-- ====================================================================
INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
  ('ffff0000-0000-4000-8000-000000000001'::uuid,
   '00000000-0000-0000-0000-000000000000'::uuid,
   'authenticated', 'authenticated', 'pgtap_grace_test@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO profiles (id, display_name, email_verified_at) VALUES
  ('ffff0000-0000-4000-8000-000000000001'::uuid, 'pgtap Grace User', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO memberships (user_id, organization_id, role, status, grace_ends_at, is_owner) VALUES
  ('ffff0000-0000-4000-8000-000000000001'::uuid,
   '11110000-0000-4000-8000-000000000001'::uuid, 'org_admin', 'active',
   now() + interval '7 days', false)
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Verify initial state: grace_ends_at is NOT NULL
SELECT ok(
  EXISTS(
    SELECT 1 FROM memberships
    WHERE user_id = 'ffff0000-0000-4000-8000-000000000001'::uuid
      AND grace_ends_at IS NOT NULL
  ),
  'Setup: membership grace_ends_at initially set'
);

-- ====================================================================
-- Test: Update email_verified_at from NULL to now()
-- ====================================================================
UPDATE profiles
SET email_verified_at = now()
WHERE id = 'ffff0000-0000-4000-8000-000000000001'::uuid;

-- Verify the trigger cleared grace_ends_at
SELECT ok(
  EXISTS(
    SELECT 1 FROM memberships
    WHERE user_id = 'ffff0000-0000-4000-8000-000000000001'::uuid
      AND grace_ends_at IS NULL
  ),
  'trigger_clear_grace_on_email_verify: grace_ends_at cleared when email_verified_at set'
);

SELECT COALESCE(
  NULLIF((SELECT string_agg(t, E'\n') FROM finish() AS t), ''),
  'ALL TESTS PASSED'
) AS result;
ROLLBACK;
