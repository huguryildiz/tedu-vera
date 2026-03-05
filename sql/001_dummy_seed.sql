-- ============================================================
-- 011_dummy_seed.sql
-- Seed realistic dummy data for Jury Portal (run AFTER 000_bootstrap.sql)
-- Includes:
--   - Admin password bootstrap (12345678)
--   - 4 single-day semesters (2025 Spring active)
--   - 15–20 jurors (mixed Turkish + international) with "University / Department"
--   - 10–15 projects per semester (creative, globally-unique titles)
--   - group_students as "Name Surname; Name Surname; ..."
--   - juror_semester_auth (12–16 jurors per semester, overlap ensured)
--   - scores (all assigned jurors per project, avg total ~75–90, 4% one criterion NULL)
-- ============================================================

BEGIN;

-- deterministic-ish randomness
SELECT setseed(0.424242);

-- ensure pgcrypto functions are resolvable
SET search_path = public, extensions;

-- ------------------------------------------------------------
-- DEV RESET (safe order)
-- ------------------------------------------------------------
TRUNCATE TABLE
  public.audit_logs,
  public.scores,
  public.juror_semester_auth,
  public.projects,
  public.jurors,
  public.semesters
RESTART IDENTITY CASCADE;

-- ------------------------------------------------------------
-- 0) Admin password bootstrap
-- ------------------------------------------------------------
INSERT INTO public.settings (key, value)
VALUES ('admin_password_hash', crypt('12345678', gen_salt('bf')))
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.settings (key, value)
VALUES ('eval_lock_active_semester', 'false')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------
-- 1) Semesters (exactly 4, single-day) - 2025 Spring active
-- ------------------------------------------------------------
INSERT INTO public.semesters (name, is_active, starts_on, ends_on)
VALUES
  ('2024 Summer', false, DATE '2024-07-15', DATE '2024-07-15'),
  ('2025 Spring', true,  DATE '2025-04-15', DATE '2025-04-15'),
  ('2025 Summer', false, DATE '2025-07-15', DATE '2025-07-15'),
  ('2025 Fall',   false, DATE '2025-11-15', DATE '2025-11-15');

-- enforce exactly one active (defensive)
UPDATE public.semesters
SET is_active = (name = '2025 Spring');

-- normalize semester timestamps to their own timeline
UPDATE public.semesters
SET created_at = starts_on::timestamptz - interval '30 days',
    updated_at = starts_on::timestamptz - interval '10 days';

-- ------------------------------------------------------------
-- 2) Jurors (18 total) - mixed Turkish + international
--    juror_inst format: "University / Department"
-- ------------------------------------------------------------
INSERT INTO public.jurors (juror_name, juror_inst)
SELECT * FROM (VALUES
  -- international
  ('Emma Thompson',        'University of Oxford / Computer Science'),
  ('Liam O''Connor',       'University of Cambridge / Engineering'),
  ('Sofia Rossi',          'ETH Zürich / Robotics'),
  ('Noah Müller',          'EPFL / Electrical Engineering'),
  ('Isabella García',      'Imperial College London / Aeronautics'),
  ('Lucas Martin',         'UC Berkeley / Electrical Engineering'),
  ('Chloé Dubois',         'Carnegie Mellon University / Machine Learning'),
  ('Oliver Smith',         'Stanford University / AI Lab'),
  ('Ava Johnson',          'Harvard University / Applied Physics'),
  ('Mateo Fernández',      'MIT / Aerospace Engineering'),
  -- Turkish
  ('Elif Yılmaz',          'Hacettepe University / EE'),
  ('Mehmet Kaya',          'Bilkent University / Computer Engineering'),
  ('Ayşe Demir',           'Middle East Technical University / Electrical Engineering'),
  ('Caner Şahin',          'Istanbul Technical University / Aeronautics'),
  ('Zeynep Arslan',        'Boğaziçi University / Computer Engineering'),
  ('Kerem Öztürk',         'Koç University / Robotics'),
  ('Ece Kılıç',            'Sabancı University / Data Science'),
  ('Deniz Aydın',          'Ankara University / Software Engineering')
) AS v(juror_name, juror_inst);

-- normalize juror timestamps to seed clock
UPDATE public.jurors
SET created_at = (
    (SELECT MIN(starts_on)::timestamptz FROM public.semesters)
    - interval '40 days'
  ) + (random() * interval '20 days'),
    updated_at = created_at + (random() * interval '5 days');

-- ------------------------------------------------------------
-- 3) Projects (10–15 per semester)
--    - group_no sequential from 1
--    - project_title globally unique and creative
--    - group_students uses '; ' delimiter (2–4 students)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_sem record;
  v_project_count int;
  v_group_no int;

  v_students text;
  v_student_count int;

  -- name pools (mixed)
  v_first text[];
  v_last  text[];

  -- creative title pools
  v_domain text[];
  v_artifact text[];
  v_method text[];
  v_signature text[];
  v_niche text[];
  v_template int;

  v_title text;
  v_sem_tag text;
  v_used_titles text[] := ARRAY[]::text[];
BEGIN
  v_first := ARRAY[
    -- international
    'Olivia','James','Sophia','Benjamin','Mia','William','Charlotte','Henry','Amelia','Alexander',
    'Isla','Ethan','Grace','Leo','Emily','Jack','Lily','Noah','Chloe','Daniel',
    'Lucia','Marco','Hannah','Felix','Nora','Arthur','Eva','Jonas','Irene','Mateo',
    -- Turkish
    'Ahmet','Mehmet','Ayşe','Fatma','Ali','Elif','Can','Deniz','Zeynep','Kerem',
    'Ece','Mert','Seda','Emre','Selin','Hakan','Buse','Burak','Derya','Onur'
  ];

  v_last := ARRAY[
    -- international
    'Anderson','Brown','Clark','Davis','Evans','Garcia','Harris','Johnson','Lee','Martinez',
    'Miller','Robinson','Smith','Taylor','Walker','White','Young','Wilson','Moore','King',
    'Dubois','Rossi','Müller','Novak','Silva','Kowalski','Lindström','Ibrahim','Khan','Petrov',
    -- Turkish
    'Yılmaz','Kaya','Demir','Şahin','Çelik','Yıldız','Aydın','Arslan','Öztürk','Koç',
    'Polat','Aksoy','Eren','Kurt','Güneş','Şimşek','Taş','Karaca','Özdemir','Yavuz'
  ];

  v_domain := ARRAY[
    'AUV Fleet Operations','Mine Countermeasure Field Trials','Harbor Surveillance','Port Logistics',
    'Smart Campus Energy','Smart Grid Reliability','Wildfire Early Warning','Flood Forecasting',
    'Medical Triage Workflow','Wearable Health Monitoring','Drone Corridor Safety','Autonomous Inspection',
    'Indoor Positioning','Real-Time SLAM','Underwater Localization','Acoustic Telemetry',
    'Satellite Backhaul','HAPS Relay Networking','Industrial Vision QA','Micro-Mobility Safety'
  ];

  v_artifact := ARRAY[
    'Digital Twin','Anomaly Radar','Routing Fabric','Decision Engine','Copilot','Orchestrator',
    'Benchmark Suite','Reliability Layer','Knowledge Graph','Risk Ledger','Service Mesh',
    'Diagnostics Toolkit','Navigation Stack','Optimization Pipeline','Consensus Engine',
    'Edge Gateway','Simulation Workbench','Audit Trail','Model Registry','Incident Console'
  ];

  v_method := ARRAY[
    'Self-Healing','Privacy-Preserving','Fault-Tolerant','Human-Centered','Context-Aware','Bio-Inspired',
    'Federated','Carbon-Aware','Adversarial-Resistant','Multi-Modal','Explainable','Event-Driven',
    'Resource-Frugal','Latency-Sensitive','Uncertainty-Aware','Swarm-Enabled','Zero-Trust',
    'Topology-Adaptive','Spectrum-Aware','Energy-Proportional'
  ];

  v_signature := ARRAY[
    'with Drift Monitoring','under Intermittent Connectivity','for Low-SNR Acoustic Channels',
    'with Human-in-the-Loop Review','with Safety Guarantees','via Lightweight Cryptography',
    'using Self-Supervised Signals','with Fairness Constraints','with On-Device Personalization',
    'with Digital Twin Feedback','with Robustness Audits','using Incremental Updates'
  ];

  v_niche := ARRAY[
    'in Harsh Marine Environments','for Rapid Prototyping','at the Edge','in Resource-Constrained Nodes',
    'for Real-Time Decisions','for Transparent Reporting','for Cross-Team Collaboration',
    'for Long-Term Autonomy','for Secure Data Sharing','for High-Noise Sensors'
  ];

  FOR v_sem IN
    SELECT id, name FROM public.semesters ORDER BY starts_on
  LOOP
    v_project_count := 10 + floor(random() * 6)::int; -- 10..15
    v_group_no := 1;
    v_sem_tag := replace(lower(v_sem.name), ' ', '-');

    WHILE v_group_no <= v_project_count LOOP
      -- students: 2..4 joined by '; '
      v_student_count := 2 + floor(random() * 3)::int;
      v_students := '';
      FOR i IN 1..v_student_count LOOP
        IF i > 1 THEN
          v_students := v_students || '; ';
        END IF;
        v_students := v_students ||
          v_first[1 + floor(random() * array_length(v_first,1))::int] || ' ' ||
          v_last[1 + floor(random() * array_length(v_last,1))::int];
      END LOOP;

      -- title templates to reduce repetition (ensure global uniqueness without suffix)
      LOOP
        v_template := 1 + floor(random() * 4)::int;

        IF v_template = 1 THEN
          v_title :=
            v_domain[1 + floor(random()*array_length(v_domain,1))::int] || ': ' ||
            v_method[1 + floor(random()*array_length(v_method,1))::int] || ' ' ||
            v_artifact[1 + floor(random()*array_length(v_artifact,1))::int] || ' ' ||
            v_signature[1 + floor(random()*array_length(v_signature,1))::int];
        ELSIF v_template = 2 THEN
          v_title :=
            v_method[1 + floor(random()*array_length(v_method,1))::int] || ' ' ||
            v_artifact[1 + floor(random()*array_length(v_artifact,1))::int] || ' for ' ||
            v_domain[1 + floor(random()*array_length(v_domain,1))::int] || ' ' ||
            v_niche[1 + floor(random()*array_length(v_niche,1))::int];
        ELSIF v_template = 3 THEN
          v_title :=
            'From Sensors to Decisions: ' ||
            v_artifact[1 + floor(random()*array_length(v_artifact,1))::int] || ' ' ||
            v_signature[1 + floor(random()*array_length(v_signature,1))::int] || ' in ' ||
            v_domain[1 + floor(random()*array_length(v_domain,1))::int];
        ELSE
          v_title :=
            v_domain[1 + floor(random()*array_length(v_domain,1))::int] || ' — ' ||
            v_artifact[1 + floor(random()*array_length(v_artifact,1))::int] || ' (' ||
            v_method[1 + floor(random()*array_length(v_method,1))::int] || ', ' ||
            v_signature[1 + floor(random()*array_length(v_signature,1))::int] || ')';
        END IF;

        EXIT WHEN NOT (v_title = ANY(v_used_titles));
      END LOOP;

      v_used_titles := array_append(v_used_titles, v_title);

      INSERT INTO public.projects (semester_id, group_no, project_title, group_students)
      VALUES (v_sem.id, v_group_no, v_title, v_students);

      v_group_no := v_group_no + 1;
    END LOOP;
  END LOOP;
END $$;

-- normalize project timestamps within semester window
UPDATE public.projects p
SET created_at = (s.starts_on::timestamptz - interval '14 days')
  + (random() * interval '10 days'),
    updated_at = p.created_at + (random() * interval '3 days')
FROM public.semesters s
WHERE s.id = p.semester_id;

-- ------------------------------------------------------------
-- 4) juror_semester_auth
--    - 12–16 jurors per semester
--    - overlap naturally + extra forced overlap set
-- ------------------------------------------------------------
DO $$
DECLARE
  v_sem record;
  v_pick_count int;
  v_pin text;
  v_hash text;
  v_jid uuid;
BEGIN
  -- first pass: random 12..16 per semester
  FOR v_sem IN SELECT id, name FROM public.semesters ORDER BY starts_on LOOP
    v_pick_count := 12 + floor(random() * 5)::int; -- 12..16

    FOR v_jid IN
      SELECT id FROM public.jurors ORDER BY random() LIMIT v_pick_count
    LOOP
      v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
      v_hash := crypt(v_pin, gen_salt('bf'));

      INSERT INTO public.juror_semester_auth
        (juror_id, semester_id, pin_hash, failed_attempts, locked_until, last_seen_at)
      VALUES
        (v_jid, v_sem.id, v_hash, 0, NULL, NULL)
      ON CONFLICT (juror_id, semester_id) DO UPDATE
        SET pin_hash = EXCLUDED.pin_hash,
            failed_attempts = 0,
            locked_until = NULL,
            last_seen_at = NULL;
    END LOOP;
  END LOOP;

  -- second pass: force overlap (same core jurors in all semesters)
  FOR v_jid IN
    SELECT id FROM public.jurors ORDER BY id LIMIT 6
  LOOP
    FOR v_sem IN SELECT id FROM public.semesters LOOP
      v_pin := lpad((floor(random() * 10000))::int::text, 4, '0');
      v_hash := crypt(v_pin, gen_salt('bf'));

      INSERT INTO public.juror_semester_auth
        (juror_id, semester_id, pin_hash, failed_attempts, locked_until, last_seen_at)
      VALUES
        (v_jid, v_sem.id, v_hash, 0, NULL, NULL)
      ON CONFLICT (juror_id, semester_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- normalize juror-semester auth timestamps near semester start
UPDATE public.juror_semester_auth a
SET created_at = (s.starts_on::timestamptz - interval '7 days')
  + (random() * interval '5 days')
FROM public.semesters s
WHERE s.id = a.semester_id;

-- ------------------------------------------------------------
-- 5) Scores
--    - every assigned juror scores every project (at least 1 criterion)
--    - avg total mostly 75..90
--    - 4% chance exactly one criterion NULL
--    - optional comments (~25%)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_sem record;
  v_proj record;

  v_juror uuid;

  v_tech int;
  v_writ int;
  v_oral int;
  v_team int;

  v_missing boolean;
  v_missing_pick int;

  v_comment text;
  v_comments text[];
  v_complete_jurors uuid[];
  v_complete_count int;
  v_force_complete boolean;

  v_score_date date;
  v_score_hour int;
  v_score_min int;
  v_updated_at timestamptz;
BEGIN
  v_comments := ARRAY[
    'Strong implementation; consider expanding the evaluation section.',
    'Excellent presentation and clear methodology.',
    'Promising prototype; scalability discussion would help.',
    'Well-structured report and convincing demo.',
    'Good technical depth; results could be compared to baselines.',
    'Nice idea and clean execution; add more ablation studies.',
    'Clear motivation and solid engineering trade-offs.',
    'Good progress; improve failure-case analysis.'
  ];

  FOR v_sem IN SELECT id, name, starts_on, ends_on FROM public.semesters ORDER BY starts_on LOOP
    -- pick a small subset of jurors per semester to be fully complete
    v_complete_count := 3 + floor(random() * 3)::int; -- 3..5
    v_complete_jurors := ARRAY(
      SELECT a.juror_id
      FROM public.juror_semester_auth a
      WHERE a.semester_id = v_sem.id
      ORDER BY random()
      LIMIT v_complete_count
    );

    FOR v_proj IN
      SELECT id, group_no
      FROM public.projects
      WHERE semester_id = v_sem.id
      ORDER BY group_no
    LOOP
      FOR v_juror IN
        SELECT a.juror_id
        FROM public.juror_semester_auth a
        WHERE a.semester_id = v_sem.id
        ORDER BY a.juror_id
      LOOP
        v_force_complete := v_juror = ANY(v_complete_jurors);

        -- base (keeps totals generally high): 20..30 for 3 criteria, 6..10 teamwork
        v_tech := 20 + floor(random() * 11)::int; -- 20..30
        v_writ := 20 + floor(random() * 11)::int; -- 20..30
        v_oral := 20 + floor(random() * 11)::int; -- 20..30
        v_team :=  6 + floor(random() * 5)::int;  --  6..10

        -- occasional mild penalties to create spread but keep average ~75..90
        IF random() < 0.12 THEN v_tech := GREATEST(0, LEAST(30, v_tech - (1 + floor(random()*7))::int)); END IF;
        IF random() < 0.12 THEN v_writ := GREATEST(0, LEAST(30, v_writ - (1 + floor(random()*7))::int)); END IF;
        IF random() < 0.12 THEN v_oral := GREATEST(0, LEAST(30, v_oral - (1 + floor(random()*7))::int)); END IF;
        IF random() < 0.12 THEN v_team := GREATEST(0, LEAST(10, v_team - (1 + floor(random()*4))::int)); END IF;

        -- missing data rule: 4% probability -> exactly one criterion NULL
        -- but never for "complete" jurors
        v_missing := (NOT v_force_complete) AND (random() < 0.04);
        IF v_missing THEN
          v_missing_pick := 1 + floor(random() * 4)::int; -- 1..4
          IF v_missing_pick = 1 THEN
            v_tech := NULL;
          ELSIF v_missing_pick = 2 THEN
            v_writ := NULL;
          ELSIF v_missing_pick = 3 THEN
            v_oral := NULL;
          ELSE
            v_team := NULL;
          END IF;
        END IF;

        -- optional comment (~25%)
        IF random() < 0.25 THEN
          v_comment := v_comments[1 + floor(random()*array_length(v_comments,1))::int];
        ELSE
          v_comment := NULL;
        END IF;

        -- updated_at/created_at within semester date range
        v_score_date := v_sem.starts_on
          + floor(random() * (GREATEST(0, (v_sem.ends_on - v_sem.starts_on)) + 1))::int;
        v_score_hour := 9 + floor(random() * 8)::int; -- 09..16
        v_score_min := floor(random() * 60)::int;
        IF v_score_hour = 16 THEN
          v_score_min := 0;
        END IF;
        v_updated_at := (v_score_date::timestamptz)
          + make_interval(hours => v_score_hour, mins => v_score_min);

        INSERT INTO public.scores
          (semester_id, project_id, juror_id, technical, written, oral, teamwork, comment, created_at, updated_at)
        VALUES
          (v_sem.id, v_proj.id, v_juror, v_tech, v_writ, v_oral, v_team, v_comment, v_updated_at, v_updated_at)
        ON CONFLICT (semester_id, project_id, juror_id) DO UPDATE
          SET technical = EXCLUDED.technical,
              written   = EXCLUDED.written,
              oral      = EXCLUDED.oral,
              teamwork  = EXCLUDED.teamwork,
              comment   = EXCLUDED.comment;
        -- triggers compute total (updated_at stays unless score fields change)

      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 6) Final submission flags (juror-level)
--    - only set when ALL projects are fully scored
--    - final_submitted_at is always AFTER latest updated_at
-- ------------------------------------------------------------
UPDATE public.scores
SET final_submitted_at = NULL;

WITH totals AS (
  SELECT p.semester_id, COUNT(*)::int AS total_projects
  FROM public.projects p
  GROUP BY p.semester_id
),
per_juror AS (
  SELECT
    sc.semester_id,
    sc.juror_id,
    COUNT(*) FILTER (
      WHERE sc.technical IS NOT NULL
        AND sc.written   IS NOT NULL
        AND sc.oral      IS NOT NULL
        AND sc.teamwork  IS NOT NULL
    )::int AS completed_projects,
    MAX(sc.updated_at) AS max_updated_at
  FROM public.scores sc
  GROUP BY sc.semester_id, sc.juror_id
)
UPDATE public.scores s
SET final_submitted_at = pj.max_updated_at + interval '30 minutes'
FROM per_juror pj
JOIN totals t ON t.semester_id = pj.semester_id
WHERE s.semester_id = pj.semester_id
  AND s.juror_id = pj.juror_id
  AND pj.completed_projects = t.total_projects
  AND pj.max_updated_at IS NOT NULL;

WITH totals AS (
  SELECT p.semester_id, COUNT(*)::int AS total_projects
  FROM public.projects p
  GROUP BY p.semester_id
),
per_juror AS (
  SELECT
    sc.semester_id,
    sc.juror_id,
    COUNT(*) FILTER (
      WHERE sc.technical IS NOT NULL
        AND sc.written   IS NOT NULL
        AND sc.oral      IS NOT NULL
        AND sc.teamwork  IS NOT NULL
    )::int AS completed_projects,
    MAX(sc.updated_at) AS max_updated_at
  FROM public.scores sc
  GROUP BY sc.semester_id, sc.juror_id
)
UPDATE public.juror_semester_auth a
SET edit_enabled = false
FROM per_juror pj
JOIN totals t ON t.semester_id = pj.semester_id
WHERE a.semester_id = pj.semester_id
  AND a.juror_id = pj.juror_id
  AND pj.completed_projects = t.total_projects
  AND pj.max_updated_at IS NOT NULL;

-- ------------------------------------------------------------
-- 6b) Audit logs (demo)
-- ------------------------------------------------------------
-- Admin setup events anchored to semester timelines
INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  (s.starts_on::timestamptz - interval '20 days'),
  'admin',
  null,
  'admin_password_change',
  'settings',
  null,
  'Admin changed admin password',
  null
FROM public.semesters s
ORDER BY s.starts_on
LIMIT 1;

INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  (s.starts_on::timestamptz - interval '19 days'),
  'admin',
  null,
  'delete_password_change',
  'settings',
  null,
  'Admin changed delete password',
  null
FROM public.semesters s
ORDER BY s.starts_on
LIMIT 1;

INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  (s.starts_on::timestamptz - interval '3 days'),
  'admin',
  null,
  'eval_lock_toggle',
  'settings',
  null,
  'Admin turned evaluation lock OFF (active semester)',
  jsonb_build_object('semester_id', s.id, 'semester_name', s.name, 'enabled', false)
FROM public.semesters s
WHERE s.is_active = true
LIMIT 1;

-- Semesters: create / update / active
INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  (s.starts_on::timestamptz - interval '30 days'),
  'admin',
  null,
  'semester_create',
  'semester',
  s.id,
  format('Admin created semester %s', s.name),
  jsonb_build_object('starts_on', s.starts_on, 'ends_on', s.ends_on)
FROM public.semesters s;

INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  (s.starts_on::timestamptz - interval '7 days'),
  'admin',
  null,
  'semester_update',
  'semester',
  s.id,
  format('Admin updated semester %s', s.name),
  null
FROM public.semesters s
WHERE s.name = '2025 Fall'
LIMIT 1;

INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  (s.starts_on::timestamptz - interval '1 day'),
  'admin',
  null,
  'set_active_semester',
  'semester',
  s.id,
  format('Admin set active semester to %s', s.name),
  null
FROM public.semesters s
WHERE s.is_active = true
LIMIT 1;

-- Jurors: create / update (timestamps from juror table)
INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  j.created_at,
  'admin',
  null,
  'juror_create',
  'juror',
  j.id,
  format('Admin created juror %s (%s)', j.juror_name, j.juror_inst),
  null
FROM public.jurors j;

INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  j.updated_at,
  'admin',
  null,
  'juror_update',
  'juror',
  j.id,
  format('Admin updated juror %s', j.juror_name),
  null
FROM public.jurors j
WHERE j.updated_at > j.created_at
ORDER BY j.updated_at DESC
LIMIT 4;

-- Projects: create / update (use project timestamps; sample to avoid spam)
INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  p.created_at,
  'admin',
  null,
  'project_create',
  'project',
  p.id,
  format('Admin created project Group %s — %s', p.group_no, p.project_title),
  jsonb_build_object('semester_id', p.semester_id, 'group_no', p.group_no)
FROM public.projects p
ORDER BY p.created_at
LIMIT 12;

INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  p.updated_at,
  'admin',
  null,
  'project_update',
  'project',
  p.id,
  format('Admin updated project Group %s — %s', p.group_no, p.project_title),
  jsonb_build_object('semester_id', p.semester_id, 'group_no', p.group_no)
FROM public.projects p
WHERE p.updated_at > p.created_at
ORDER BY p.updated_at DESC
LIMIT 8;

-- PIN resets — at most once per (juror_id, semester_id):
-- juror_semester_auth has UNIQUE(juror_id, semester_id) so each pair appears at most
-- once in the source; ORDER BY random() LIMIT 12 therefore yields no duplicate pairs.
INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  (s.starts_on::timestamptz - interval '2 days') + (random() * interval '1 day'),
  'admin',
  null,
  'juror_pin_reset',
  'juror',
  a.juror_id,
  format(
    'Admin reset PIN for juror %s',
    CASE
      WHEN trim(coalesce(j.juror_inst, '')) = '' THEN j.juror_name
      ELSE j.juror_name || ' (' || j.juror_inst || ')'
    END
  ),
  jsonb_build_object('semester_id', a.semester_id)
FROM public.juror_semester_auth a
JOIN public.jurors j ON j.id = a.juror_id
JOIN public.semesters s ON s.id = a.semester_id
ORDER BY random()
LIMIT 12;

-- Edit mode toggle (admin) during semester day
INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  (s.starts_on::timestamptz + interval '2 hours') + (random() * interval '3 hours'),
  'admin',
  null,
  'admin_juror_edit_toggle',
  'juror',
  a.juror_id,
  format(
    'Admin %s edit mode for Juror %s (%s)',
    CASE WHEN x.enabled THEN 'enabled' ELSE 'disabled' END,
    j.juror_name,
    s.name
  ),
  jsonb_build_object('semester_id', a.semester_id, 'enabled', x.enabled)
FROM public.juror_semester_auth a
JOIN public.jurors j ON j.id = a.juror_id
JOIN public.semesters s ON s.id = a.semester_id
CROSS JOIN LATERAL (SELECT (random() < 0.5) AS enabled) x
ORDER BY random()
LIMIT 8;

-- Juror events derived from scores
-- juror_group_completed: sample from fully-scored rows (all 4 criteria NOT NULL)
INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  sc.updated_at,
  'juror',
  sc.juror_id,
  'juror_group_completed',
  'project',
  sc.project_id,
  format('Juror %s completed evaluation for Group %s', j.juror_name, p.group_no),
  jsonb_build_object('semester_id', sc.semester_id, 'group_no', p.group_no, 'project_title', p.project_title)
FROM public.scores sc
JOIN public.jurors j ON j.id = sc.juror_id
JOIN public.projects p ON p.id = sc.project_id
WHERE sc.technical IS NOT NULL
  AND sc.written   IS NOT NULL
  AND sc.oral      IS NOT NULL
  AND sc.teamwork  IS NOT NULL
ORDER BY random()
LIMIT 30;

-- juror_group_started: 15-row subset drawn from the completed events above.
-- Derives actor_id, entity_id, and metadata from the already-inserted completed rows,
-- so every started event is guaranteed to have a matching completed event, and
-- started.created_at (= completed.created_at - 45 min) is always strictly earlier.
INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  al.created_at - interval '45 minutes',
  'juror',
  al.actor_id,
  'juror_group_started',
  'project',
  al.entity_id,
  format('Juror %s started evaluating Group %s',
    j.juror_name,
    (al.metadata->>'group_no')::int),
  al.metadata
FROM public.audit_logs al
JOIN public.jurors j ON j.id = al.actor_id
WHERE al.action = 'juror_group_completed'
ORDER BY random()
LIMIT 15;

INSERT INTO public.audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata)
SELECT
  MAX(sc.final_submitted_at),
  'juror',
  sc.juror_id,
  'juror_finalize_submission',
  'semester',
  sc.semester_id,
  format('Juror %s finalized submission', j.juror_name),
  jsonb_build_object('semester_name', s.name)
FROM public.scores sc
JOIN public.jurors j ON j.id = sc.juror_id
JOIN public.semesters s ON s.id = sc.semester_id
WHERE sc.final_submitted_at IS NOT NULL
GROUP BY sc.semester_id, sc.juror_id, j.juror_name, s.name;

-- ------------------------------------------------------------
-- 7) Sanity check: v_active_scores exposes expected join data
-- ------------------------------------------------------------
DO $$
DECLARE
  v_missing int;
BEGIN
  SELECT COUNT(*) INTO v_missing
  FROM public.v_active_scores
  WHERE semester_name IS NULL
     OR project_title IS NULL
     OR group_students IS NULL
     OR juror_name IS NULL
     OR juror_inst IS NULL
     OR group_no IS NULL;

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'v_active_scores join mismatch: % rows missing metadata', v_missing;
  END IF;
END;
$$;

COMMIT;
