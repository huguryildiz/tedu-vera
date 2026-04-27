-- VERA E2E Seed — compact fixture set for isolated local CI runs
-- Applied after migrations 001-009 on a fresh local Supabase stack.
-- Admin password: E2eLocal!Admin123
-- Tenant admin password: TenantAdmin2026!
BEGIN;

-- ── Auth users ────────────────────────────────────────────────────────────────
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '6ea7146f-1331-4828-8b8a-e777c9a35d6a',
    'authenticated', 'authenticated',
    'demo-admin@vera-eval.app',
    extensions.crypt('E2eLocal!Admin123', extensions.gen_salt('bf')),
    now(), now(), now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '5fe4ebbf-7a95-43b0-8712-56e94d6cb5a7',
    'authenticated', 'authenticated',
    'tenant-admin@vera-eval.app',
    extensions.crypt('TenantAdmin2026!', extensions.gen_salt('bf')),
    now(), now(), now(), '', '', '', ''
  )
ON CONFLICT (id) DO UPDATE
  SET encrypted_password = EXCLUDED.encrypted_password,
      email_confirmed_at = COALESCE(auth.users.email_confirmed_at, EXCLUDED.email_confirmed_at);

-- Identities needed for GoTrue password login
-- provider_id is required (NOT NULL) in Supabase CLI v2; for email provider it is the email address
INSERT INTO auth.identities (
  id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at
) VALUES
  (
    '6ea7146f-1331-4828-8b8a-e777c9a35d6a',
    '6ea7146f-1331-4828-8b8a-e777c9a35d6a',
    'email',
    'demo-admin@vera-eval.app',
    jsonb_build_object('sub', '6ea7146f-1331-4828-8b8a-e777c9a35d6a', 'email', 'demo-admin@vera-eval.app'),
    now(), now(), now()
  ),
  (
    '5fe4ebbf-7a95-43b0-8712-56e94d6cb5a7',
    '5fe4ebbf-7a95-43b0-8712-56e94d6cb5a7',
    'email',
    'tenant-admin@vera-eval.app',
    jsonb_build_object('sub', '5fe4ebbf-7a95-43b0-8712-56e94d6cb5a7', 'email', 'tenant-admin@vera-eval.app'),
    now(), now(), now()
  )
ON CONFLICT (id) DO NOTHING;

-- ── Profiles + memberships ─────────────────────────────────────────────────────
INSERT INTO profiles (id, display_name) VALUES
  ('6ea7146f-1331-4828-8b8a-e777c9a35d6a', 'Vera Platform Admin'),
  ('5fe4ebbf-7a95-43b0-8712-56e94d6cb5a7', 'Tenant Admin E2E')
ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name;

INSERT INTO memberships (user_id, organization_id, role, status) VALUES
  ('6ea7146f-1331-4828-8b8a-e777c9a35d6a', NULL, 'super_admin', 'active')
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- ── VERA Standard framework ───────────────────────────────────────────────────
INSERT INTO frameworks (id, organization_id, name, description) VALUES
  ('a1b2c3d4-e5f6-4000-a000-000000000001', NULL, 'VERA Standard',
   'Generic capstone evaluation framework — 6 learning outcomes')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

INSERT INTO framework_outcomes (id, framework_id, code, label, description, sort_order) VALUES
  ('7d3f42cc-5c0b-4069-a668-8ea0cfadb363', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'LO 1', 'Domain Knowledge',            'Ability to apply discipline-specific knowledge', 1),
  ('b8ed8649-3893-48f0-a6f8-fa102ee94df6', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'LO 2', 'Design & Problem Solving',     'Ability to design creative solutions', 2),
  ('3431bc18-9075-421b-ad1f-650554c87955', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'LO 3', 'Written Communication',        'Ability to communicate technical content in writing', 3),
  ('f3d660b6-6a2c-4ea0-a19f-c03c4e450073', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'LO 4', 'Oral Communication',           'Ability to present technical work verbally', 4),
  ('9d802418-d562-471d-a240-9096a93f0d43', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'LO 5', 'Teamwork & Collaboration',     'Ability to contribute effectively as a team member', 5),
  ('3541d166-6c58-4033-a5e9-4d4c929c0126', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'LO 6', 'Professional & Ethical Conduct','Awareness of professional and ethical responsibilities', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO framework_criteria (id, framework_id, key, label, description, max_score, weight, color, rubric_bands, sort_order) VALUES
  ('fc2a0001-0000-4000-a000-000000000001', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'technical', 'Technical Content',     'Technical depth and correctness', 30, 30, '#F59E0B', '[]'::jsonb, 1),
  ('fc2a0001-0000-4000-a000-000000000002', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'design',    'Written Communication', 'Written and visual communication quality', 30, 30, '#22C55E', '[]'::jsonb, 2),
  ('fc2a0001-0000-4000-a000-000000000003', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'delivery',  'Oral Communication',    'Verbal presentation and Q&A ability', 30, 30, '#3B82F6', '[]'::jsonb, 3),
  ('fc2a0001-0000-4000-a000-000000000004', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'teamwork',  'Teamwork',              'Team participation and professional conduct', 10, 10, '#EF4444', '[]'::jsonb, 4)
ON CONFLICT (id) DO NOTHING;

INSERT INTO framework_criterion_outcome_maps (id, framework_id, period_id, criterion_id, outcome_id, coverage_type, weight) VALUES
  ('b5019289-69d9-4abb-a7ee-83a72ebafe42', 'a1b2c3d4-e5f6-4000-a000-000000000001', NULL, 'fc2a0001-0000-4000-a000-000000000001', '7d3f42cc-5c0b-4069-a668-8ea0cfadb363', 'direct',   0.5),
  ('768ff6d1-d37f-4a1b-a310-9d8f862d8b83', 'a1b2c3d4-e5f6-4000-a000-000000000001', NULL, 'fc2a0001-0000-4000-a000-000000000001', 'b8ed8649-3893-48f0-a6f8-fa102ee94df6', 'direct',   0.5),
  ('9c667df5-86c5-4626-abd1-80df1d7f3f3a', 'a1b2c3d4-e5f6-4000-a000-000000000001', NULL, 'fc2a0001-0000-4000-a000-000000000001', '3541d166-6c58-4033-a5e9-4d4c929c0126', 'indirect', NULL),
  ('4515d982-9d17-4f4c-a288-3e56ab1752de', 'a1b2c3d4-e5f6-4000-a000-000000000001', NULL, 'fc2a0001-0000-4000-a000-000000000002', '3431bc18-9075-421b-ad1f-650554c87955', 'direct',   1),
  ('d10c52ef-7ca8-4754-a82a-fcab986e6ef8', 'a1b2c3d4-e5f6-4000-a000-000000000001', NULL, 'fc2a0001-0000-4000-a000-000000000002', 'b8ed8649-3893-48f0-a6f8-fa102ee94df6', 'indirect', NULL),
  ('2c486057-8fee-4cdf-aee9-d921512b494a', 'a1b2c3d4-e5f6-4000-a000-000000000001', NULL, 'fc2a0001-0000-4000-a000-000000000003', 'f3d660b6-6a2c-4ea0-a19f-c03c4e450073', 'direct',   1),
  ('29d59219-fff7-4564-ace9-7b19c6885beb', 'a1b2c3d4-e5f6-4000-a000-000000000001', NULL, 'fc2a0001-0000-4000-a000-000000000003', '3431bc18-9075-421b-ad1f-650554c87955', 'indirect', NULL),
  ('fb288759-8a0c-4261-a41e-f333f593acaa', 'a1b2c3d4-e5f6-4000-a000-000000000001', NULL, 'fc2a0001-0000-4000-a000-000000000004', '9d802418-d562-471d-a240-9096a93f0d43', 'direct',   0.6),
  ('c6ce781c-6277-452e-a51f-deba966b8aac', 'a1b2c3d4-e5f6-4000-a000-000000000001', NULL, 'fc2a0001-0000-4000-a000-000000000004', '3541d166-6c58-4033-a5e9-4d4c929c0126', 'direct',   0.4)
ON CONFLICT (criterion_id, outcome_id) DO NOTHING;

-- ── E2E organizations ─────────────────────────────────────────────────────────
INSERT INTO organizations (id, name, code, status, settings, contact_email, setup_completed_at, updated_at) VALUES
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'E2E Periods Org',    'E2E-PER', 'active', '{}', 'e2e-per@vera-eval.test', now(), now()),
  ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'E2E Projects Org',   'E2E-PRJ', 'active', '{}', 'e2e-prj@vera-eval.test', now(), now()),
  ('d4e5f6a7-b8c9-0123-def0-234567890123', 'E2E Lifecycle Org',  'E2E-LIF', 'active', '{}', 'e2e-lif@vera-eval.test', now(), now()),
  ('e5f6a7b8-c9d0-1234-ef01-345678901234', 'E2E Wizard Org',     'E2E-WIZ', 'active', '{}', 'e2e-wiz@vera-eval.test', NULL,  now()),
  ('f7340e37-9349-4210-8d6b-073a5616bf49', 'E2E Criteria Org',   'E2E-CRT', 'active', '{}', 'e2e-crt@vera-eval.test', now(), now()),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'E2E Entry Token Org','E2E-TOK', 'active', '{}', 'e2e-tok@vera-eval.test', now(), now())
ON CONFLICT (id) DO UPDATE SET setup_completed_at = EXCLUDED.setup_completed_at;

-- Tenant admin membership — scoped to E2E Periods Org (b2c3d4e5)
INSERT INTO memberships (user_id, organization_id, role, status, is_owner) VALUES
  ('5fe4ebbf-7a95-43b0-8712-56e94d6cb5a7', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'org_admin', 'active', false)
ON CONFLICT (user_id, organization_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

-- ── Periods ───────────────────────────────────────────────────────────────────
-- The eval period (a0d6f60d) MUST be `is_locked: true` so the jury entry flow
-- treats it as evaluable. `isEvaluablePeriod()` requires `is_locked && !closed_at`.
-- Other periods stay `is_locked: false` so the structural-immutability E2E test
-- can scan for an unlocked period.
INSERT INTO periods (id, organization_id, framework_id, name, season, description, start_date, end_date, is_locked, criteria_name, snapshot_frozen_at, activated_at, closed_at, updated_at) VALUES
  ('a0d6f60d-ece4-40f8-aca2-955b4abc5d88', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'Spring 2026',         'Spring', 'E2E fixture period', CURRENT_DATE, CURRENT_DATE, true,  'VERA Standard', now(), now(), NULL, now()),
  ('cccccccc-0004-4000-c000-000000000004', 'f7340e37-9349-4210-8d6b-073a5616bf49', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'E2E Criteria Period', 'Spring', 'E2E fixture period', CURRENT_DATE, CURRENT_DATE, false, 'VERA Standard', now(), now(), NULL, now()),
  ('cccccccc-0005-4000-c000-000000000005', 'f7340e37-9349-4210-8d6b-073a5616bf49', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'E2E Outcomes Period', 'Spring', 'E2E fixture period', CURRENT_DATE, CURRENT_DATE, false, 'VERA Standard', now(), now(), NULL, now()),
  ('cccccccc-0006-4000-c000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'E2E Token Period',    'Spring', 'E2E fixture period', CURRENT_DATE, CURRENT_DATE, false, 'VERA Standard', now(), now(), NULL, now()),
  ('cccccccc-0007-4000-c000-000000000007', 'c3d4e5f6-a7b8-9012-cdef-123456789012', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'E2E Projects Period', 'Spring', 'E2E fixture period', CURRENT_DATE, CURRENT_DATE, false, 'VERA Standard', now(), now(), NULL, now()),
  ('cccccccc-0008-4000-c000-000000000008', 'd4e5f6a7-b8c9-0123-def0-234567890123', 'a1b2c3d4-e5f6-4000-a000-000000000001', 'E2E Lifecycle Period','Spring', 'E2E fixture period', CURRENT_DATE, CURRENT_DATE, false, 'VERA Standard', now(), now(), NULL, now())
ON CONFLICT (id) DO NOTHING;

-- ── Period criteria ───────────────────────────────────────────────────────────
-- Eval period (a0d6f60d) — VERA Standard criteria
-- rubric_bands MUST be populated (non-empty jsonb array) so the period passes
-- the publish-readiness check (rpc_admin_check_period_publish_ready). Without
-- bands the entry-tokens admin page reports "missing rubric bands" and the
-- generate-token flow is blocked.
INSERT INTO period_criteria (id, period_id, source_criterion_id, key, label, description, max_score, weight, color, rubric_bands, sort_order) VALUES
  ('787e905a-a2da-431e-af63-00cea2ea7bb5', 'a0d6f60d-ece4-40f8-aca2-955b4abc5d88', 'fc2a0001-0000-4000-a000-000000000001', 'technical', 'Technical Content',     'E2E fixture criterion', 30, 30, '#F59E0B', '[{"min":27,"max":30,"label":"Excellent","description":"Outstanding work."},{"min":21,"max":26,"label":"Good","description":"Solid work."},{"min":13,"max":20,"label":"Developing","description":"Some gaps."},{"min":0,"max":12,"label":"Insufficient","description":"Major gaps."}]'::jsonb, 1),
  ('25fdf203-ff5f-4c31-ab09-3ac8bd726e65', 'a0d6f60d-ece4-40f8-aca2-955b4abc5d88', 'fc2a0001-0000-4000-a000-000000000002', 'design',    'Written Communication', 'E2E fixture criterion', 30, 30, '#22C55E', '[{"min":27,"max":30,"label":"Excellent","description":"Outstanding work."},{"min":21,"max":26,"label":"Good","description":"Solid work."},{"min":13,"max":20,"label":"Developing","description":"Some gaps."},{"min":0,"max":12,"label":"Insufficient","description":"Major gaps."}]'::jsonb, 2),
  ('ecc8c71e-2fca-4ab8-aaa9-9efbe29700c6', 'a0d6f60d-ece4-40f8-aca2-955b4abc5d88', 'fc2a0001-0000-4000-a000-000000000003', 'delivery',  'Oral Communication',    'E2E fixture criterion', 30, 30, '#3B82F6', '[{"min":27,"max":30,"label":"Excellent","description":"Outstanding work."},{"min":21,"max":26,"label":"Good","description":"Solid work."},{"min":13,"max":20,"label":"Developing","description":"Some gaps."},{"min":0,"max":12,"label":"Insufficient","description":"Major gaps."}]'::jsonb, 3),
  ('dc46db4d-fa3a-4c22-a64a-b5c07a94ebe6', 'a0d6f60d-ece4-40f8-aca2-955b4abc5d88', 'fc2a0001-0000-4000-a000-000000000004', 'teamwork',  'Teamwork',              'E2E fixture criterion', 10, 10, '#EF4444', '[{"min":9,"max":10,"label":"Excellent","description":"Outstanding."},{"min":7,"max":8,"label":"Good","description":"Solid."},{"min":4,"max":6,"label":"Developing","description":"Some gaps."},{"min":0,"max":3,"label":"Insufficient","description":"Major gaps."}]'::jsonb, 4)
ON CONFLICT (id) DO UPDATE SET rubric_bands = EXCLUDED.rubric_bands;

-- Criteria period (cccccccc-0004)
INSERT INTO period_criteria (id, period_id, source_criterion_id, key, label, description, max_score, weight, color, rubric_bands, sort_order) VALUES
  ('5f133f88-83c6-4151-a0f1-7f8ebe49eff0', 'cccccccc-0004-4000-c000-000000000004', 'fc2a0001-0000-4000-a000-000000000001', 'technical', 'Technical Content',     'E2E fixture criterion', 30, 30, '#F59E0B', '[]'::jsonb, 1),
  ('323fe389-a490-41e6-aabd-ff8cd78dd62e', 'cccccccc-0004-4000-c000-000000000004', 'fc2a0001-0000-4000-a000-000000000002', 'design',    'Written Communication', 'E2E fixture criterion', 30, 30, '#22C55E', '[]'::jsonb, 2),
  ('c7afc49d-f949-4d18-ab39-44be03f56f29', 'cccccccc-0004-4000-c000-000000000004', 'fc2a0001-0000-4000-a000-000000000003', 'delivery',  'Oral Communication',    'E2E fixture criterion', 30, 30, '#3B82F6', '[]'::jsonb, 3),
  ('7e6c39e8-7caf-40ec-a6b5-b8e28c756d82', 'cccccccc-0004-4000-c000-000000000004', 'fc2a0001-0000-4000-a000-000000000004', 'teamwork',  'Teamwork',              'E2E fixture criterion', 10, 10, '#EF4444', '[]'::jsonb, 4)
ON CONFLICT (id) DO NOTHING;

-- Outcomes period (cccccccc-0005)
INSERT INTO period_criteria (id, period_id, source_criterion_id, key, label, description, max_score, weight, color, rubric_bands, sort_order) VALUES
  ('232d8aac-e6cc-45b9-a8b2-a927af032981', 'cccccccc-0005-4000-c000-000000000005', 'fc2a0001-0000-4000-a000-000000000001', 'technical', 'Technical Content',     'E2E fixture criterion', 30, 30, '#F59E0B', '[]'::jsonb, 1),
  ('015a6bc1-f3ba-48f0-a205-8f8c81296d5d', 'cccccccc-0005-4000-c000-000000000005', 'fc2a0001-0000-4000-a000-000000000002', 'design',    'Written Communication', 'E2E fixture criterion', 30, 30, '#22C55E', '[]'::jsonb, 2),
  ('68c24e4f-8a8c-4807-afc8-3c980ba187ab', 'cccccccc-0005-4000-c000-000000000005', 'fc2a0001-0000-4000-a000-000000000003', 'delivery',  'Oral Communication',    'E2E fixture criterion', 30, 30, '#3B82F6', '[]'::jsonb, 3),
  ('34af39dd-4d0d-4656-a9a3-51100392ca5c', 'cccccccc-0005-4000-c000-000000000005', 'fc2a0001-0000-4000-a000-000000000004', 'teamwork',  'Teamwork',              'E2E fixture criterion', 10, 10, '#EF4444', '[]'::jsonb, 4)
ON CONFLICT (id) DO NOTHING;

-- ── Period outcomes ───────────────────────────────────────────────────────────
-- Outcomes period (cccccccc-0005)
INSERT INTO period_outcomes (id, period_id, source_outcome_id, code, label, description, sort_order) VALUES
  ('e5ea5df5-eadd-44fd-af5c-fe620c7c2535', 'cccccccc-0005-4000-c000-000000000005', '7d3f42cc-5c0b-4069-a668-8ea0cfadb363', 'LO 1', 'Engineering knowledge', 'E2E fixture outcome', 1),
  ('41d9d9c8-754f-4465-a358-9e848ea8ae3d', 'cccccccc-0005-4000-c000-000000000005', 'b8ed8649-3893-48f0-a6f8-fa102ee94df6', 'LO 2', 'Problem analysis',      'E2E fixture outcome', 2),
  ('1fb221ee-3802-4116-aa69-9dea2d2afb3e', 'cccccccc-0005-4000-c000-000000000005', '3431bc18-9075-421b-ad1f-650554c87955', 'LO 3', 'Design / development',  'E2E fixture outcome', 3),
  ('6f220881-8876-4b49-af51-59e59997b711', 'cccccccc-0005-4000-c000-000000000005', 'f3d660b6-6a2c-4ea0-a19f-c03c4e450073', 'LO 4', 'Communication',         'E2E fixture outcome', 4),
  ('a3ca3328-27cf-4f88-a980-29756e506242', 'cccccccc-0005-4000-c000-000000000005', '9d802418-d562-471d-a240-9096a93f0d43', 'LO 5', 'Teamwork',              'E2E fixture outcome', 5),
  ('c24ac33d-3c8d-4637-af32-9f598eec4e13', 'cccccccc-0005-4000-c000-000000000005', '3541d166-6c58-4033-a5e9-4d4c929c0126', 'LO 6', 'Lifelong learning',     'E2E fixture outcome', 6)
ON CONFLICT (id) DO NOTHING;

-- ── Projects for eval period (required by jury/edit-mode.spec.ts) ─────────────
INSERT INTO projects (id, period_id, project_no, title, members, advisor_name) VALUES
  ('aaaaaaaa-0001-4000-a000-000000000001', 'a0d6f60d-ece4-40f8-aca2-955b4abc5d88', 1, 'E2E Project Alpha', '["Alice","Bob"]'::jsonb, 'Dr. Smith'),
  ('aaaaaaaa-0002-4000-a000-000000000002', 'a0d6f60d-ece4-40f8-aca2-955b4abc5d88', 2, 'E2E Project Beta',  '["Carol","Dave"]'::jsonb, 'Dr. Jones')
ON CONFLICT (id) DO NOTHING;

-- ── Jurors ────────────────────────────────────────────────────────────────────
INSERT INTO jurors (id, organization_id, juror_name, affiliation, email, avatar_color) VALUES
  ('eeeeeeee-0001-4000-e000-000000000001', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'E2E Locked Juror',  'E2E Test Affiliation', 'e2e-locked@vera-eval.test',  '#EF4444'),
  ('b3aa250b-3049-4788-9c68-5fa0e8aec86a', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'E2E Eval Render',   'E2E Test Affiliation', 'e2e-render@vera-eval.test',  '#3B82F6'),
  ('bbbbbbbb-e2e0-4000-b000-000000000001', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'E2E Eval Blur',     'E2E Test Affiliation', 'e2e-blur@vera-eval.test',    '#3B82F6'),
  ('bbbbbbbb-e2e0-4000-b000-000000000002', 'b2c3d4e5-f6a7-8901-bcde-f12345678901', 'E2E Eval Submit',   'E2E Test Affiliation', 'e2e-submit@vera-eval.test',  '#3B82F6')
ON CONFLICT (id) DO NOTHING;

INSERT INTO juror_period_auth (juror_id, period_id, pin_hash, last_seen_at, session_expires_at, final_submitted_at, edit_enabled, edit_reason, edit_expires_at, failed_attempts, locked_until, locked_at, is_blocked) VALUES
  -- Locked juror: 3 failed attempts, locked for 1 hour. pin_hash NULL — lockout check fires before PIN check.
  ('eeeeeeee-0001-4000-e000-000000000001', 'a0d6f60d-ece4-40f8-aca2-955b4abc5d88', NULL, now(), NULL, NULL, false, NULL, NULL, 3, now() + interval '1 hour', now(), false),
  -- Eval jurors: pre-seeded with PIN "9999" so jury specs can drive returning-juror flow deterministically.
  ('b3aa250b-3049-4788-9c68-5fa0e8aec86a', 'a0d6f60d-ece4-40f8-aca2-955b4abc5d88', extensions.crypt('9999', extensions.gen_salt('bf')), NULL, NULL, NULL, false, NULL, NULL, 0, NULL, NULL, false),
  ('bbbbbbbb-e2e0-4000-b000-000000000001', 'a0d6f60d-ece4-40f8-aca2-955b4abc5d88', extensions.crypt('9999', extensions.gen_salt('bf')), NULL, NULL, NULL, false, NULL, NULL, 0, NULL, NULL, false),
  ('bbbbbbbb-e2e0-4000-b000-000000000002', 'a0d6f60d-ece4-40f8-aca2-955b4abc5d88', extensions.crypt('9999', extensions.gen_salt('bf')), NULL, NULL, NULL, false, NULL, NULL, 0, NULL, NULL, false)
ON CONFLICT (juror_id, period_id) DO UPDATE
  SET pin_hash       = EXCLUDED.pin_hash,
      failed_attempts = EXCLUDED.failed_attempts,
      locked_until    = EXCLUDED.locked_until,
      locked_at       = EXCLUDED.locked_at;

-- ── Entry token ───────────────────────────────────────────────────────────────
-- token_plain = 'demo-tedu-ee'  →  sha256 hash below
INSERT INTO entry_tokens (id, period_id, token_hash, token_plain, is_revoked, expires_at, last_used_at, created_at) VALUES
  (
    'ebfe0c97-cc98-41ac-ab4f-9fc539fc187e',
    'a0d6f60d-ece4-40f8-aca2-955b4abc5d88',
    'b21753a65d3e039d77e6ae4d95258460f73d6ac3859c8c07d1e8cac85764b524',
    'demo-tedu-ee',
    false,
    now() + interval '7 days',
    NULL,
    now()
  )
ON CONFLICT DO NOTHING;

-- ── Maintenance mode singleton ────────────────────────────────────────────────
INSERT INTO maintenance_mode (id) VALUES (1) ON CONFLICT DO NOTHING;

COMMIT;
