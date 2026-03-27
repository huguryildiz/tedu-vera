-- ============================================================
-- 002_multi_tenant_seed.sql
-- Phase C: Multi-tenant demo/dev seed data — full rewrite.
--
-- Database-side only. Does NOT create Supabase Auth users.
-- Auth user creation is a separate step documented in the
-- Phase C rollout guide.
--
-- Deterministic: uses setseed(0.424242) for reproducibility.
-- Workflow-state consistency is the top priority.
-- ============================================================

BEGIN;

SELECT setseed(0.424242);
SET search_path = public, extensions;

-- ── Clean slate: truncate all data tables (idempotent re-run) ──
TRUNCATE
  audit_logs, scores, juror_semester_auth, projects,
  admin_profiles, tenant_admin_applications, tenant_admin_memberships,
  settings, jurors, semesters, tenants
CASCADE;

-- ── Section 1: Tenants ──────────────────────────────────────
-- 3 universities × 2 departments each = 6 tenants
-- All 6 tenants created here (including tedu-ee).

INSERT INTO tenants (id, code, short_label, university, department) VALUES
  ('4b9adf8f-d234-4c46-a93d-d7010616b42a', 'tedu-ee', 'TEDU EE',
   'TED University', 'Electrical & Electronics Engineering'),
  ('3497069f-260e-4b84-afac-4ffff39c18d2', 'tedu-ce', 'TEDU CE',
   'TED University', 'Civil Engineering'),
  ('85b3df4b-b92f-47b7-84b6-b2a0a9b557c7', 'boun-chem', 'Boğaziçi CHEM',
   'Boğaziçi University', 'Chemical Engineering'),
  ('ec880532-9b44-4757-ab48-326b7faa2136', 'boun-cmpe', 'Boğaziçi CMPE',
   'Boğaziçi University', 'Computer Engineering'),
  ('e799be65-bb52-4f8a-9011-e83d28fe0ed0', 'metu-me', 'METU ME',
   'Middle East Technical University', 'Mechanical Engineering'),
  ('6566d9e3-14a1-4cf7-8d23-82195beb03fd', 'metu-ie', 'METU IE',
   'Middle East Technical University', 'Industrial Engineering')
ON CONFLICT ((lower(trim(code)))) DO NOTHING;

-- ── Section 2: Tenant admin memberships (DB side only) ──────
-- IMPORTANT: user_id values below must match the real UUIDs from
-- Supabase Auth (auth.users table). If you recreate auth users,
-- run `SELECT id, email FROM auth.users ORDER BY email;` and
-- update the UUIDs here accordingly.
--
-- Super-admin (global scope, tenant_id = NULL)
INSERT INTO tenant_admin_memberships (id, tenant_id, user_id, role) VALUES
  ('e80b938a-4a87-4b3b-b449-62641a08deed', NULL,
   '88265507-a25d-4cc0-ba22-d57151802bfc', 'super_admin')
ON CONFLICT DO NOTHING;

-- Tenant admins (one per tenant)
INSERT INTO tenant_admin_memberships (id, tenant_id, user_id, role) VALUES
  ('56fdfc57-f5be-4f40-b8cd-c15c7dfb4e1a',
   '4b9adf8f-d234-4c46-a93d-d7010616b42a',
   'ba34acd9-678b-4a40-bf86-cdf96b773cc7', 'tenant_admin'),
  ('61ae9b03-e943-43d2-abd0-a837cc5acafd',
   '3497069f-260e-4b84-afac-4ffff39c18d2',
   '0ad71a4f-a424-4d68-8f37-d72df1f176a1', 'tenant_admin'),
  ('c1a8ed35-a1de-47e4-b63a-3b283629c137',
   '85b3df4b-b92f-47b7-84b6-b2a0a9b557c7',
   '97741fa5-430e-4421-85c1-8582e299ce97', 'tenant_admin'),
  ('070adbc4-ba91-4307-a96c-a52e6a19eb9f',
   'ec880532-9b44-4757-ab48-326b7faa2136',
   '73d0a0bd-c1c1-4ba8-9e6c-bacc119b20da', 'tenant_admin'),
  ('82396548-ef64-492d-a831-c6e7c08898e7',
   'e799be65-bb52-4f8a-9011-e83d28fe0ed0',
   'bba141f5-49df-486c-b42a-dc7f7dc51263', 'tenant_admin'),
  ('825e878d-9812-4945-85fc-ed6b17dc2c24',
   '6566d9e3-14a1-4cf7-8d23-82195beb03fd',
   'f688fc98-c5a7-4888-b47d-3e4cafc5b5ba', 'tenant_admin')
ON CONFLICT DO NOTHING;

-- Pending application test user (no membership)
INSERT INTO tenant_admin_applications (id, tenant_id, applicant_email, applicant_name, university, department, status) VALUES
  ('c2dcad4f-79c7-4d11-9c16-eeeb7ad98c52',
   '4b9adf8f-d234-4c46-a93d-d7010616b42a',
   'pending@test.dev', 'Pending User', 'Test University', 'Test Department', 'pending')
ON CONFLICT DO NOTHING;

-- ── Section 3: Admin profiles ───────────────────────────────
INSERT INTO admin_profiles (user_id, display_name)
SELECT v.uid, v.dname
FROM (VALUES
  ('88265507-a25d-4cc0-ba22-d57151802bfc'::uuid, 'Demo Admin'),
  ('ba34acd9-678b-4a40-bf86-cdf96b773cc7'::uuid, 'Dr. Selim Karataş (TEDU EE Admin)'),
  ('0ad71a4f-a424-4d68-8f37-d72df1f176a1'::uuid, 'Assoc. Prof. Dilan Yurt (TEDU CE Admin)'),
  ('97741fa5-430e-4421-85c1-8582e299ce97'::uuid, 'Prof. Cenk Akman (Boğaziçi CHEM Admin)'),
  ('73d0a0bd-c1c1-4ba8-9e6c-bacc119b20da'::uuid, 'Dr. Aslı Korur (Boğaziçi CMPE Admin)'),
  ('bba141f5-49df-486c-b42a-dc7f7dc51263'::uuid, 'Dr. Elif Tunalı (METU ME Admin)'),
  ('f688fc98-c5a7-4888-b47d-3e4cafc5b5ba'::uuid, 'Prof. Gökhan Demirel (METU IE Admin)')
) AS v(uid, dname)
WHERE EXISTS (SELECT 1 FROM auth.users WHERE id = v.uid)
ON CONFLICT (user_id) DO NOTHING;

-- ── Section 4: Semesters (3 per tenant) ─────────────────────
-- Each tenant × semester gets a unique criteria template (18 total).
-- MÜDEK outcome dictionaries are auto-derived from criteria mudek_outcomes.

DO $$
DECLARE
  v_t record;
  v_mi int; v_mj int;
  v_used_pos text[];
  -- ── Per-semester criteria templates (18 total) ────────────
  -- Each tenant × semester gets a unique template to demonstrate JSONB flexibility.
  -- MÜDEK dictionary is auto-derived from template mudek_outcomes (see loop body).

  -- TEDU EE Fall: 4 criteria, balanced EE evaluation
  v_template_ee_fall jsonb := '[
    {"key":"technical","color":"#F59E0B","label":"Technical Merit","shortLabel":"Tech","blurb":"Evaluate the depth of circuit/system analysis, theoretical grounding, and correctness of engineering calculations.","max":30,"mudek":["1.2","2","3.1"],"mudek_outcomes":["po_1_2","po_2","po_3_1"],"rubric":[{"level":"Excellent","min":25,"max":30,"range":"25–30","desc":"Thorough analysis with strong theoretical grounding"},{"level":"Good","min":18,"max":24,"range":"18–24","desc":"Solid technical work with minor gaps"},{"level":"Developing","min":10,"max":17,"range":"10–17","desc":"Basic understanding shown but lacks depth"},{"level":"Insufficient","min":0,"max":9,"range":"0–9","desc":"Fundamental technical deficiencies"}]},
    {"key":"written","color":"#22C55E","label":"Written & Visual Quality","shortLabel":"Written","blurb":"Assess poster layout, figure quality, labelling, and overall visual communication effectiveness.","max":30,"mudek":["9.2","3.2"],"mudek_outcomes":["po_9_2","po_3_2"],"rubric":[{"level":"Excellent","min":25,"max":30,"range":"25–30","desc":"Clear, well-structured poster with effective visuals"},{"level":"Good","min":18,"max":24,"range":"18–24","desc":"Readable poster with adequate figures and layout"},{"level":"Developing","min":10,"max":17,"range":"10–17","desc":"Poster conveys idea but organization is weak"},{"level":"Insufficient","min":0,"max":9,"range":"0–9","desc":"Poor layout, unclear or missing key content"}]},
    {"key":"oral","color":"#3B82F6","label":"Oral Presentation","shortLabel":"Oral","blurb":"Evaluate presentation clarity, confidence, audience adaptation, and quality of Q&A responses.","max":30,"mudek":["9.1"],"mudek_outcomes":["po_9_1"],"rubric":[{"level":"Excellent","min":25,"max":30,"range":"25–30","desc":"Confident delivery with clear command of material"},{"level":"Good","min":18,"max":24,"range":"18–24","desc":"Good presentation with minor hesitations"},{"level":"Developing","min":10,"max":17,"range":"10–17","desc":"Adequate but lacks fluency or confidence"},{"level":"Insufficient","min":0,"max":9,"range":"0–9","desc":"Unable to explain work or answer questions"}]},
    {"key":"teamwork","color":"#EF4444","label":"Teamwork","shortLabel":"Team","blurb":"Assess balance of contributions, role clarity, and evidence of collaborative effort across the team.","max":10,"mudek":["8.1","8.2","11"],"mudek_outcomes":["po_8_1","po_8_2","po_11"],"rubric":[{"level":"Excellent","min":9,"max":10,"range":"9–10","desc":"Balanced contributions and strong collaboration"},{"level":"Good","min":6,"max":8,"range":"6–8","desc":"Team functions well with minor imbalances"},{"level":"Developing","min":3,"max":5,"range":"3–5","desc":"Uneven workload distribution evident"},{"level":"Insufficient","min":0,"max":2,"range":"0–2","desc":"Little evidence of collaborative effort"}]}
  ]'::jsonb;
  -- TEDU EE Spring: Capstone emphasis with heavier circuit design weight
  v_template_ee_spring jsonb := '[{"key":"circuit_design","color":"#F59E0B","label":"Circuit Design","shortLabel":"Circuit","blurb":"Evaluate schematic quality, component selection rationale, simulation results, and PCB layout decisions.","max":35,"mudek":["1.2","2","4"],"mudek_outcomes":["po_1_2","po_2","po_4"],"rubric":[{"level":"Outstanding","min":29,"max":35,"range":"29–35","desc":"Innovative circuit with optimized component selection"},{"level":"Proficient","min":22,"max":28,"range":"22–28","desc":"Well-executed circuit meeting specifications with room for minor optimization"},{"level":"Competent","min":14,"max":21,"range":"14–21","desc":"Functional design meeting most specifications"},{"level":"Emerging","min":7,"max":13,"range":"7–13","desc":"Basic circuit works but lacks optimization"},{"level":"Inadequate","min":0,"max":6,"range":"0–6","desc":"Circuit incomplete or fundamentally flawed"}]},{"key":"poster_quality","color":"#22C55E","label":"Poster Quality","shortLabel":"Poster","blurb":"Assess poster organization, technical figure clarity, annotation quality, and visual hierarchy.","max":25,"mudek":["9.2","3.2"],"mudek_outcomes":["po_9_2","po_3_2"],"rubric":[{"level":"Outstanding","min":21,"max":25,"range":"21–25","desc":"Professional poster with clear schematics and data"},{"level":"Proficient","min":16,"max":20,"range":"16–20","desc":"Clean poster with good technical figures and logical layout"},{"level":"Competent","min":10,"max":15,"range":"10–15","desc":"Well-organized poster with adequate detail"},{"level":"Emerging","min":5,"max":9,"range":"5–9","desc":"Poster present but missing key technical figures"},{"level":"Inadequate","min":0,"max":4,"range":"0–4","desc":"Incomplete or poorly structured poster"}]},{"key":"oral_defense","color":"#3B82F6","label":"Oral Defense","shortLabel":"Defense","blurb":"Assess persuasiveness of defense, depth of knowledge demonstrated, and Q&A responsiveness.","max":25,"mudek":["9.1","5"],"mudek_outcomes":["po_9_1","po_5"],"rubric":[{"level":"Outstanding","min":21,"max":25,"range":"21–25","desc":"Defends design choices with strong justification"},{"level":"Proficient","min":16,"max":20,"range":"16–20","desc":"Confident presentation with well-prepared responses to technical probing"},{"level":"Competent","min":10,"max":15,"range":"10–15","desc":"Explains work clearly, answers most questions"},{"level":"Emerging","min":5,"max":9,"range":"5–9","desc":"Presents but struggles with follow-up questions"},{"level":"Inadequate","min":0,"max":4,"range":"0–4","desc":"Cannot articulate design rationale"}]},{"key":"collaboration","color":"#EF4444","label":"Collaboration","shortLabel":"Collab","blurb":"Assess evidence of shared ownership, task division, and coordination throughout the project.","max":15,"mudek":["8.1","8.2","11"],"mudek_outcomes":["po_8_1","po_8_2","po_11"],"rubric":[{"level":"Outstanding","min":12,"max":15,"range":"12–15","desc":"Seamless teamwork with shared ownership of design"},{"level":"Proficient","min":9,"max":11,"range":"9–11","desc":"Effective teamwork with well-defined roles and regular coordination"},{"level":"Competent","min":6,"max":8,"range":"6–8","desc":"Good cooperation with clear role division"},{"level":"Emerging","min":3,"max":5,"range":"3–5","desc":"Some collaboration but uneven contributions"},{"level":"Inadequate","min":0,"max":2,"range":"0–2","desc":"Minimal evidence of team coordination"}]}]'::jsonb;
  -- TEDU EE Summer: Individual research, no teamwork
  v_template_ee_summer jsonb := '[{"key":"technical","color":"#F59E0B","label":"Technical Content","shortLabel":"Technical","blurb":"Evaluate the engineering depth of the project, clarity of the problem definition, and justification of technical decisions.","max":30,"mudek":["1.2","2","3.1","3.2"],"mudek_outcomes":["po_1_2","po_2","po_3_1","po_3_2"],"rubric":[{"range":"27–30","level":"Excellent","min":27,"max":30,"desc":"Problem is clearly defined with strong motivation. Design decisions are well-justified with engineering depth. Originality and mastery of relevant tools or methods are evident."},{"range":"21–26","level":"Good","min":21,"max":26,"desc":"Design is mostly clear and technically justified. Engineering decisions are largely supported."},{"range":"13–20","level":"Developing","min":13,"max":20,"desc":"Problem is stated but motivation or technical justification is insufficient."},{"range":"0–12","level":"Insufficient","min":0,"max":12,"desc":"Vague problem definition and unjustified decisions. Superficial technical content."}]},{"key":"design","color":"#22C55E","label":"Written Communication","shortLabel":"Written","blurb":"Evaluate the clarity, structure, and visual effectiveness of the poster and written materials.","max":30,"mudek":["9.2"],"mudek_outcomes":["po_9_2"],"rubric":[{"range":"27–30","level":"Excellent","min":27,"max":30,"desc":"Poster layout is intuitive with clear information flow. Visuals are fully labelled and high quality."},{"range":"21–26","level":"Good","min":21,"max":26,"desc":"Layout is mostly logical. Visuals are readable with minor gaps."},{"range":"13–20","level":"Developing","min":13,"max":20,"desc":"Occasional gaps in information flow. Some visuals are missing labels or captions."},{"range":"0–12","level":"Insufficient","min":0,"max":12,"desc":"Confusing layout. Low-quality or unlabelled visuals. Technical content is unclear or missing."}]},{"key":"delivery","color":"#3B82F6","label":"Oral Communication","shortLabel":"Oral","blurb":"Evaluate the clarity of the presentation, pacing, and the quality of answers during the Q&A.","max":30,"mudek":["9.1"],"mudek_outcomes":["po_9_1"],"rubric":[{"range":"27–30","level":"Excellent","min":27,"max":30,"desc":"Presentation is consciously adapted for both technical and non-technical jury members. Q&A responses are accurate and audience-appropriate."},{"range":"21–26","level":"Good","min":21,"max":26,"desc":"Presentation is mostly clear and well-paced. Most questions answered correctly."},{"range":"13–20","level":"Developing","min":13,"max":20,"desc":"Understandable but inconsistent. Limited audience adaptation. Q&A depth needs improvement."},{"range":"0–12","level":"Insufficient","min":0,"max":12,"desc":"Unclear or disorganised presentation. Most questions answered incorrectly or not at all."}]},{"key":"teamwork","color":"#EF4444","label":"Teamwork","shortLabel":"Teamwork","blurb":"Evaluate how effectively team members collaborate and contribute to the project.","max":10,"mudek":["8.1","8.2"],"mudek_outcomes":["po_8_1","po_8_2"],"rubric":[{"range":"9–10","level":"Excellent","min":9,"max":10,"desc":"All members participate actively and equally. Professional and ethical conduct observed throughout."},{"range":"7–8","level":"Good","min":7,"max":8,"desc":"Most members contribute. Minor knowledge gaps. Professionalism mostly observed."},{"range":"4–6","level":"Developing","min":4,"max":6,"desc":"Uneven participation. Some members are passive or unprepared."},{"range":"0–3","level":"Insufficient","min":0,"max":3,"desc":"Very low participation or dominated by one person. Lack of professionalism observed."}]}]'::jsonb;
  -- TEDU CE Fall: 4 criteria, code-compliance & fieldwork emphasis
  v_template_ce_fall jsonb := '[
    {"key":"structural_analysis","color":"#F59E0B","label":"Structural Analysis","shortLabel":"Analysis","blurb":"Evaluate load path tracing, FEM usage, boundary conditions, and validation of structural calculations.","max":30,"mudek":["1.2","2","3.1"],"mudek_outcomes":["po_1_2","po_2","po_3_1"],"rubric":[{"level":"Excellent","min":25,"max":30,"range":"25–30","desc":"Rigorous analysis with validated load calculations"},{"level":"Good","min":18,"max":24,"range":"18–24","desc":"Sound analysis with minor computational gaps"},{"level":"Developing","min":10,"max":17,"range":"10–17","desc":"Basic calculations present but incomplete"},{"level":"Insufficient","min":0,"max":9,"range":"0–9","desc":"Analysis missing or fundamentally incorrect"}]},
    {"key":"code_compliance","color":"#22C55E","label":"Code Compliance","shortLabel":"Compliance","blurb":"Assess adherence to applicable building codes (TBDY, Eurocode, ACI) with specific clause references.","max":25,"mudek":["4","7"],"mudek_outcomes":["po_4","po_7"],"rubric":[{"level":"Excellent","min":21,"max":25,"range":"21–25","desc":"Full adherence to relevant building codes"},{"level":"Good","min":15,"max":20,"range":"15–20","desc":"Mostly compliant with minor omissions"},{"level":"Developing","min":8,"max":14,"range":"8–14","desc":"Partial compliance, several standards missed"},{"level":"Insufficient","min":0,"max":7,"range":"0–7","desc":"Ignores applicable codes and standards"}]},
    {"key":"visual_presentation","color":"#3B82F6","label":"Visual Presentation","shortLabel":"Visual","blurb":"Evaluate quality of engineering drawings including dimensioning, notation, and cross-section details.","max":30,"mudek":["9.2","3.2"],"mudek_outcomes":["po_9_2","po_3_2"],"rubric":[{"level":"Excellent","min":25,"max":30,"range":"25–30","desc":"Professional drawings with clear annotations"},{"level":"Good","min":18,"max":24,"range":"18–24","desc":"Good visual quality with adequate detail"},{"level":"Developing","min":10,"max":17,"range":"10–17","desc":"Drawings present but lack precision"},{"level":"Insufficient","min":0,"max":9,"range":"0–9","desc":"Missing or illegible technical drawings"}]},
    {"key":"fieldwork","color":"#EF4444","label":"Fieldwork & Site Skills","shortLabel":"Field","blurb":"Assess quality of site observations, soil/material data collection, and field documentation.","max":15,"mudek":["5","8.1"],"mudek_outcomes":["po_5","po_8_1"],"rubric":[{"level":"Excellent","min":13,"max":15,"range":"13–15","desc":"Excellent site observation and data collection"},{"level":"Good","min":9,"max":12,"range":"9–12","desc":"Competent fieldwork with useful observations"},{"level":"Developing","min":5,"max":8,"range":"5–8","desc":"Limited field engagement or incomplete data"},{"level":"Insufficient","min":0,"max":4,"range":"0–4","desc":"No meaningful fieldwork conducted"}]}
  ]'::jsonb;
  -- TEDU CE Spring: Granular 5-criteria capstone
  v_template_ce_spring jsonb := '[{"key":"structural_design","color":"#F59E0B","label":"Structural Design","shortLabel":"Struct","blurb":"Evaluate the structural system selection, member sizing, detailing, and design optimization.","max":25,"mudek":["1.2","2","3.1"],"mudek_outcomes":["po_1_2","po_2","po_3_1"],"rubric":[{"level":"Exemplary","min":21,"max":25,"range":"21–25","desc":"Optimized structural system with proper detailing"},{"level":"Accomplished","min":16,"max":20,"range":"16–20","desc":"Sound structural system meeting code requirements with adequate detailing"},{"level":"Satisfactory","min":10,"max":15,"range":"10–15","desc":"Adequate design meeting safety requirements"},{"level":"Marginal","min":5,"max":9,"range":"5–9","desc":"Basic design with significant gaps"},{"level":"Unacceptable","min":0,"max":4,"range":"0–4","desc":"Structural design incomplete or unsafe"}]},{"key":"geotechnical","color":"#22C55E","label":"Geotechnical Assessment","shortLabel":"Geotech","blurb":"Assess soil investigation methodology, foundation design rationale, and bearing capacity analysis.","max":20,"mudek":["2","5"],"mudek_outcomes":["po_2","po_5"],"rubric":[{"level":"Exemplary","min":17,"max":20,"range":"17–20","desc":"Thorough soil analysis with proper foundation design"},{"level":"Accomplished","min":13,"max":16,"range":"13–16","desc":"Strong soil analysis with proper foundation design"},{"level":"Satisfactory","min":8,"max":12,"range":"8–12","desc":"Adequate geotechnical investigation performed"},{"level":"Marginal","min":4,"max":7,"range":"4–7","desc":"Basic soil data with limited interpretation"},{"level":"Unacceptable","min":0,"max":3,"range":"0–3","desc":"No geotechnical assessment conducted"}]},{"key":"engineering_drawings","color":"#3B82F6","label":"Engineering Drawings","shortLabel":"Drawings","blurb":"Evaluate CAD drawing completeness, standards compliance, and technical detailing quality.","max":20,"mudek":["4","9.2"],"mudek_outcomes":["po_4","po_9_2"],"rubric":[{"level":"Exemplary","min":17,"max":20,"range":"17–20","desc":"Complete CAD drawings to professional standards"},{"level":"Accomplished","min":13,"max":16,"range":"13–16","desc":"Detailed CAD drawings with minor standards compliance gaps"},{"level":"Satisfactory","min":8,"max":12,"range":"8–12","desc":"Clear drawings with minor detailing issues"},{"level":"Marginal","min":4,"max":7,"range":"4–7","desc":"Incomplete drawings missing key views"},{"level":"Unacceptable","min":0,"max":3,"range":"0–3","desc":"Drawings absent or unusable"}]},{"key":"oral_defense","color":"#EF4444","label":"Oral Defense","shortLabel":"Defense","blurb":"Assess persuasiveness of defense, depth of knowledge demonstrated, and Q&A responsiveness.","max":20,"mudek":["9.1","3.2"],"mudek_outcomes":["po_9_1","po_3_2"],"rubric":[{"level":"Exemplary","min":17,"max":20,"range":"17–20","desc":"Confident defense of design decisions"},{"level":"Accomplished","min":13,"max":16,"range":"13–16","desc":"Confident presentation with well-prepared responses to technical probing"},{"level":"Satisfactory","min":8,"max":12,"range":"8–12","desc":"Clear presentation with adequate responses"},{"level":"Marginal","min":4,"max":7,"range":"4–7","desc":"Presents but struggles under questioning"},{"level":"Unacceptable","min":0,"max":3,"range":"0–3","desc":"Unable to defend design choices"}]},{"key":"site_work","color":"#8B5CF6","label":"Site Work","shortLabel":"Site","blurb":"Assess field engagement, safety awareness during site visits, and data collection methodology.","max":15,"mudek":["5","8.1","7"],"mudek_outcomes":["po_5","po_8_1","po_7"],"rubric":[{"level":"Exemplary","min":12,"max":15,"range":"12–15","desc":"Exemplary site engagement with safety awareness"},{"level":"Accomplished","min":9,"max":11,"range":"9–11","desc":"Active site participation with thorough safety documentation"},{"level":"Satisfactory","min":6,"max":8,"range":"6–8","desc":"Good field participation and documentation"},{"level":"Marginal","min":3,"max":5,"range":"3–5","desc":"Minimal site involvement observed"},{"level":"Unacceptable","min":0,"max":2,"range":"0–2","desc":"No site work contribution"}]}]'::jsonb;
  -- TEDU CE Summer: Desk study, no fieldwork
  v_template_ce_summer jsonb := '[{"key":"analytical_methods","color":"#F59E0B","label":"Analytical Methods","shortLabel":"Analysis","blurb":"Evaluate the rigor of computational methods, model validation, and sensitivity analysis.","max":40,"mudek":["1.2","2","3.1","4"],"mudek_outcomes":["po_1_2","po_2","po_3_1","po_4"],"rubric":[{"level":"Strong","min":28,"max":40,"range":"28–40","desc":"Rigorous methodology with validated computations"},{"level":"Adequate","min":12,"max":27,"range":"12–27","desc":"Sound approach with minor analytical gaps Basic methods applied without verification"},{"level":"Weak","min":0,"max":11,"range":"0–11","desc":"Analytical approach absent or incorrect"}]},{"key":"standards_knowledge","color":"#22C55E","label":"Standards & Codes","shortLabel":"Standards","blurb":"Assess familiarity with applicable codes, standards citations, and regulatory compliance.","max":30,"mudek":["4","7","6"],"mudek_outcomes":["po_4","po_7","po_6"],"rubric":[{"level":"Strong","min":21,"max":30,"range":"21–30","desc":"Comprehensive standards review with proper citations"},{"level":"Adequate","min":9,"max":20,"range":"9–20","desc":"Key standards identified and referenced Limited standards awareness in analysis"},{"level":"Weak","min":0,"max":8,"range":"0–8","desc":"No reference to applicable standards"}]},{"key":"technical_report","color":"#3B82F6","label":"Technical Report","shortLabel":"Report","blurb":"Evaluate report structure, clarity of conclusions, methodology documentation, and references.","max":30,"mudek":["9.2","3.2","10"],"mudek_outcomes":["po_9_2","po_3_2","po_10"],"rubric":[{"level":"Strong","min":21,"max":30,"range":"21–30","desc":"Well-structured report with clear conclusions"},{"level":"Adequate","min":9,"max":20,"range":"9–20","desc":"Readable report covering all required sections Report present but disorganized or incomplete"},{"level":"Weak","min":0,"max":8,"range":"0–8","desc":"Report missing or unacceptable quality"}]}]'::jsonb;
  -- Boğaziçi CHEM Fall: Process-focused 3-criteria evaluation
  v_template_chem_fall jsonb := '[
    {"key":"process_design","color":"#F59E0B","label":"Process Design & Analysis","shortLabel":"Process","blurb":"Evaluate mass/energy balances, equipment sizing, PFD completeness, and simulation validation.","max":40,"mudek":["1.2","2","3.1","4"],"mudek_outcomes":["po_1_2","po_2","po_3_1","po_4"],"rubric":[{"level":"Excellent","min":33,"max":40,"range":"33–40","desc":"Optimized process with mass/energy balance verified"},{"level":"Good","min":24,"max":32,"range":"24–32","desc":"Functional process design with minor issues"},{"level":"Developing","min":14,"max":23,"range":"14–23","desc":"Basic process flow but lacks quantitative rigor"},{"level":"Insufficient","min":0,"max":13,"range":"0–13","desc":"Process design incomplete or infeasible"}]},
    {"key":"hseq","color":"#22C55E","label":"HSEQ Awareness","shortLabel":"HSEQ","blurb":"Assess hazard identification methodology, environmental impact analysis, and safety mitigation plans.","max":25,"mudek":["6","7"],"mudek_outcomes":["po_6","po_7"],"rubric":[{"level":"Excellent","min":21,"max":25,"range":"21–25","desc":"Thorough hazard analysis with mitigation plans"},{"level":"Good","min":15,"max":20,"range":"15–20","desc":"Good safety awareness with adequate measures"},{"level":"Developing","min":8,"max":14,"range":"8–14","desc":"Safety mentioned but not systematically addressed"},{"level":"Insufficient","min":0,"max":7,"range":"0–7","desc":"No health, safety, or environmental consideration"}]},
    {"key":"technical_comm","color":"#3B82F6","label":"Technical Communication","shortLabel":"Comm","blurb":"Evaluate clarity of process diagrams, oral fluency, and written report quality.","max":35,"mudek":["9.1","9.2","3.2"],"mudek_outcomes":["po_9_1","po_9_2","po_3_2"],"rubric":[{"level":"Excellent","min":29,"max":35,"range":"29–35","desc":"Exceptional clarity in both written and oral forms"},{"level":"Good","min":21,"max":28,"range":"21–28","desc":"Clear communication with well-prepared materials"},{"level":"Developing","min":12,"max":20,"range":"12–20","desc":"Conveys main ideas but lacks polish"},{"level":"Insufficient","min":0,"max":11,"range":"0–11","desc":"Poor communication impeding understanding"}]}
  ]'::jsonb;
  -- Boğaziçi CHEM Spring: Lab emphasis with safety review
  v_template_chem_spring jsonb := '[{"key":"reaction_engineering","color":"#F59E0B","label":"Reaction Engineering","shortLabel":"Reaction","blurb":"Evaluate kinetic modeling, reactor design rationale, and optimization of operating conditions.","max":30,"mudek":["1.2","2","3.1"],"mudek_outcomes":["po_1_2","po_2","po_3_1"],"rubric":[{"level":"Superior","min":25,"max":30,"range":"25–30","desc":"Kinetics and reactor design rigorously analyzed"},{"level":"Proficient","min":19,"max":24,"range":"19–24","desc":"Correct kinetic analysis with well-chosen operating parameters"},{"level":"Developing","min":12,"max":18,"range":"12–18","desc":"Sound reaction analysis with minor omissions"},{"level":"Novice","min":6,"max":11,"range":"6–11","desc":"Basic kinetics applied without optimization"},{"level":"Unsatisfactory","min":0,"max":5,"range":"0–5","desc":"Reaction analysis missing or incorrect"}]},{"key":"lab_technique","color":"#22C55E","label":"Lab Technique","shortLabel":"Lab","blurb":"Assess experimental precision, reproducibility of results, and proper use of lab equipment.","max":25,"mudek":["5","4"],"mudek_outcomes":["po_5","po_4"],"rubric":[{"level":"Superior","min":21,"max":25,"range":"21–25","desc":"Precise technique with reproducible results"},{"level":"Proficient","min":16,"max":20,"range":"16–20","desc":"Consistent lab results with good reproducibility across runs"},{"level":"Developing","min":10,"max":15,"range":"10–15","desc":"Competent lab work with acceptable accuracy"},{"level":"Novice","min":5,"max":9,"range":"5–9","desc":"Lab work completed but lacks precision"},{"level":"Unsatisfactory","min":0,"max":4,"range":"0–4","desc":"Poor technique leading to unreliable data"}]},{"key":"safety_review","color":"#3B82F6","label":"Safety Review","shortLabel":"Safety","blurb":"Evaluate SDS review completeness, risk assessment methodology, and safety protocol adherence.","max":20,"mudek":["6","7"],"mudek_outcomes":["po_6","po_7"],"rubric":[{"level":"Superior","min":17,"max":20,"range":"17–20","desc":"Comprehensive SDS review and risk assessment done"},{"level":"Proficient","min":13,"max":16,"range":"13–16","desc":"Solid hazard review covering major risk scenarios systematically"},{"level":"Developing","min":8,"max":12,"range":"8–12","desc":"Adequate safety protocols identified"},{"level":"Novice","min":4,"max":7,"range":"4–7","desc":"Basic safety awareness but gaps in protocol"},{"level":"Unsatisfactory","min":0,"max":3,"range":"0–3","desc":"Safety considerations absent"}]},{"key":"comm_skills","color":"#EF4444","label":"Communication Skills","shortLabel":"Comm","blurb":"Assess written report quality, oral presentation confidence, and technical figure clarity.","max":25,"mudek":["9.1","9.2"],"mudek_outcomes":["po_9_1","po_9_2"],"rubric":[{"level":"Superior","min":21,"max":25,"range":"21–25","desc":"Professional report and confident oral delivery"},{"level":"Proficient","min":16,"max":20,"range":"16–20","desc":"Well-written report with clear figures and confident delivery"},{"level":"Developing","min":10,"max":15,"range":"10–15","desc":"Clear writing and adequate presentation"},{"level":"Novice","min":5,"max":9,"range":"5–9","desc":"Communication functional but unpolished"},{"level":"Unsatisfactory","min":0,"max":4,"range":"0–4","desc":"Written and oral delivery both weak"}]}]'::jsonb;
  -- Boğaziçi CHEM Summer: Research focus
  v_template_chem_summer jsonb := '[{"key":"literature_review","color":"#F59E0B","label":"Literature Review","shortLabel":"LitRev","blurb":"Evaluate breadth of sources, gap identification, and critical analysis of prior work.","max":35,"mudek":["2","5","10"],"mudek_outcomes":["po_2","po_5","po_10"],"rubric":[{"level":"Advanced","min":24,"max":35,"range":"24–35","desc":"Exhaustive review with clear gap identification"},{"level":"Intermediate","min":10,"max":23,"range":"10–23","desc":"Good coverage of relevant prior work Limited sources reviewed, gaps not identified"},{"level":"Beginning","min":0,"max":9,"range":"0–9","desc":"No meaningful literature survey conducted"}]},{"key":"experiment_design","color":"#22C55E","label":"Experiment Design","shortLabel":"ExpDesign","blurb":"Assess experimental plan, control variables, statistical design, and data collection methodology.","max":35,"mudek":["1.2","3.1","5","4"],"mudek_outcomes":["po_1_2","po_3_1","po_5","po_4"],"rubric":[{"level":"Advanced","min":24,"max":35,"range":"24–35","desc":"Well-controlled experiments with statistical rigor"},{"level":"Intermediate","min":10,"max":23,"range":"10–23","desc":"Sound experimental plan with adequate controls Experiments run but design has weaknesses"},{"level":"Beginning","min":0,"max":9,"range":"0–9","desc":"No coherent experimental methodology"}]},{"key":"research_report","color":"#3B82F6","label":"Research Report","shortLabel":"Report","blurb":"Evaluate academic writing quality, results presentation, and discussion of findings.","max":30,"mudek":["9.2","3.2"],"mudek_outcomes":["po_9_2","po_3_2"],"rubric":[{"level":"Advanced","min":21,"max":30,"range":"21–30","desc":"Publication-quality report with clear findings"},{"level":"Intermediate","min":9,"max":20,"range":"9–20","desc":"Well-written report meeting academic standards Report present but lacks academic rigor"},{"level":"Beginning","min":0,"max":8,"range":"0–8","desc":"Report incomplete or poorly written"}]}]'::jsonb;
  -- Boğaziçi CMPE Fall: Granular 5-criteria CS evaluation
  v_template_cmpe_fall jsonb := '[
    {"key":"algorithm_design","color":"#F59E0B","label":"Algorithm Design","shortLabel":"Algo","blurb":"Evaluate algorithmic correctness, complexity analysis, and justification of design choices.","max":25,"mudek":["1.2","2","3.1"],"mudek_outcomes":["po_1_2","po_2","po_3_1"],"rubric":[{"level":"Excellent","min":21,"max":25,"range":"21–25","desc":"Elegant algorithm with proven complexity bounds"},{"level":"Good","min":15,"max":20,"range":"15–20","desc":"Correct algorithm with reasonable efficiency"},{"level":"Developing","min":8,"max":14,"range":"8–14","desc":"Working solution but suboptimal approach"},{"level":"Insufficient","min":0,"max":7,"range":"0–7","desc":"Algorithm incorrect or not implemented"}]},
    {"key":"experimentation","color":"#22C55E","label":"Experimentation","shortLabel":"Experiment","blurb":"Assess benchmark methodology, dataset selection, metric choices, and statistical significance.","max":20,"mudek":["5","3.2"],"mudek_outcomes":["po_5","po_3_2"],"rubric":[{"level":"Excellent","min":17,"max":20,"range":"17–20","desc":"Thorough benchmarks with statistical validation"},{"level":"Good","min":12,"max":16,"range":"12–16","desc":"Adequate experiments supporting conclusions"},{"level":"Developing","min":7,"max":11,"range":"7–11","desc":"Some experiments but methodology is weak"},{"level":"Insufficient","min":0,"max":6,"range":"0–6","desc":"No experimental evaluation performed"}]},
    {"key":"demo","color":"#3B82F6","label":"Live Demo","shortLabel":"Demo","blurb":"Evaluate prototype functionality, edge case handling, and ability to explain system architecture live.","max":20,"mudek":["4","9.1"],"mudek_outcomes":["po_4","po_9_1"],"rubric":[{"level":"Excellent","min":17,"max":20,"range":"17–20","desc":"Smooth demo showcasing all key features"},{"level":"Good","min":12,"max":16,"range":"12–16","desc":"Demo works with minor glitches"},{"level":"Developing","min":7,"max":11,"range":"7–11","desc":"Partial demo with significant issues"},{"level":"Insufficient","min":0,"max":6,"range":"0–6","desc":"Demo fails or not attempted"}]},
    {"key":"writing_quality","color":"#EF4444","label":"Writing Quality","shortLabel":"Writing","blurb":"Assess academic writing structure, related work coverage, and proper citation practices.","max":20,"mudek":["9.2","10"],"mudek_outcomes":["po_9_2","po_10"],"rubric":[{"level":"Excellent","min":17,"max":20,"range":"17–20","desc":"Clear academic writing with proper references"},{"level":"Good","min":12,"max":16,"range":"12–16","desc":"Well-organized paper with minor issues"},{"level":"Developing","min":7,"max":11,"range":"7–11","desc":"Writing present but disorganized"},{"level":"Insufficient","min":0,"max":6,"range":"0–6","desc":"Paper missing or unreadable"}]},
    {"key":"collab","color":"#8B5CF6","label":"Collaboration","shortLabel":"Collab","blurb":"Evaluate git contribution balance, code review practices, and documentation quality.","max":15,"mudek":["8.1","8.2","11"],"mudek_outcomes":["po_8_1","po_8_2","po_11"],"rubric":[{"level":"Excellent","min":13,"max":15,"range":"13–15","desc":"Equal contributions with effective coordination"},{"level":"Good","min":9,"max":12,"range":"9–12","desc":"Good teamwork with clear role allocation"},{"level":"Developing","min":5,"max":8,"range":"5–8","desc":"Uneven effort among team members"},{"level":"Insufficient","min":0,"max":4,"range":"0–4","desc":"No evidence of collaborative work"}]}
  ]'::jsonb;
  -- Boğaziçi CMPE Spring: Systems focus
  v_template_cmpe_spring jsonb := '[{"key":"system_architecture","color":"#F59E0B","label":"System Architecture","shortLabel":"SysArch","blurb":"Evaluate scalability considerations, design trade-offs, and component interaction design.","max":30,"mudek":["1.2","3.1","3.2"],"mudek_outcomes":["po_1_2","po_3_1","po_3_2"],"rubric":[{"level":"Outstanding","min":25,"max":30,"range":"25–30","desc":"Scalable architecture with justified design trade-offs"},{"level":"Strong","min":19,"max":24,"range":"19–24","desc":"Well-structured system with documented design decisions and trade-offs"},{"level":"Acceptable","min":12,"max":18,"range":"12–18","desc":"Sound architecture meeting functional requirements"},{"level":"Below Expectations","min":6,"max":11,"range":"6–11","desc":"Basic system structure with scalability concerns"},{"level":"Unsatisfactory","min":0,"max":5,"range":"0–5","desc":"No coherent system design presented"}]},{"key":"benchmarking","color":"#22C55E","label":"Benchmarking & Evaluation","shortLabel":"Bench","blurb":"Assess evaluation protocol rigor, baseline comparisons, and performance metric selection.","max":25,"mudek":["2","5","4"],"mudek_outcomes":["po_2","po_5","po_4"],"rubric":[{"level":"Outstanding","min":21,"max":25,"range":"21–25","desc":"Rigorous benchmarks with baseline comparisons"},{"level":"Strong","min":16,"max":20,"range":"16–20","desc":"Solid benchmarks with baseline comparisons"},{"level":"Acceptable","min":10,"max":15,"range":"10–15","desc":"Meaningful performance metrics collected"},{"level":"Below Expectations","min":5,"max":9,"range":"5–9","desc":"Some measurements but no systematic evaluation"},{"level":"Unsatisfactory","min":0,"max":4,"range":"0–4","desc":"No performance evaluation conducted"}]},{"key":"live_demo","color":"#3B82F6","label":"Live Demo","shortLabel":"Demo","blurb":"Evaluate real-time system demonstration, feature coverage, and graceful error handling.","max":25,"mudek":["4","9.1"],"mudek_outcomes":["po_4","po_9_1"],"rubric":[{"level":"Outstanding","min":21,"max":25,"range":"21–25","desc":"Polished demo with real-time interaction"},{"level":"Strong","min":16,"max":20,"range":"16–20","desc":"Functional demo covering all main features with minor rough edges"},{"level":"Acceptable","min":10,"max":15,"range":"10–15","desc":"Functional demo covering main use cases"},{"level":"Below Expectations","min":5,"max":9,"range":"5–9","desc":"Demo partially works, key features missing"},{"level":"Unsatisfactory","min":0,"max":4,"range":"0–4","desc":"System not demonstrable"}]},{"key":"paper_quality","color":"#EF4444","label":"Paper Quality","shortLabel":"Paper","blurb":"Assess paper structure, evaluation completeness, related work positioning, and writing clarity.","max":20,"mudek":["9.2","10"],"mudek_outcomes":["po_9_2","po_10"],"rubric":[{"level":"Outstanding","min":17,"max":20,"range":"17–20","desc":"Conference-ready paper with complete evaluation"},{"level":"Strong","min":13,"max":16,"range":"13–16","desc":"Well-organized paper with thorough evaluation and clear writing"},{"level":"Acceptable","min":8,"max":12,"range":"8–12","desc":"Well-structured paper covering all sections"},{"level":"Below Expectations","min":4,"max":7,"range":"4–7","desc":"Paper present but missing key analysis"},{"level":"Unsatisfactory","min":0,"max":3,"range":"0–3","desc":"Paper incomplete or poorly organized"}]}]'::jsonb;
  -- Boğaziçi CMPE Summer: Research internship style
  v_template_cmpe_summer jsonb := '[{"key":"research_novelty","color":"#F59E0B","label":"Research Novelty","shortLabel":"Novelty","blurb":"Evaluate originality of contribution, positioning relative to state of the art, and research significance.","max":40,"mudek":["1.2","2","5","10"],"mudek_outcomes":["po_1_2","po_2","po_5","po_10"],"rubric":[{"level":"Exceptional","min":28,"max":40,"range":"28–40","desc":"Original contribution advancing state of the art"},{"level":"Satisfactory","min":12,"max":27,"range":"12–27","desc":"Meaningful extension of existing research Reproduces known results with minor additions"},{"level":"Needs Improvement","min":0,"max":11,"range":"0–11","desc":"No novel contribution identified"}]},{"key":"implementation","color":"#22C55E","label":"Implementation","shortLabel":"Impl","blurb":"Assess code quality, test coverage, reproducibility, and documentation for replication.","max":30,"mudek":["3.1","3.2","4"],"mudek_outcomes":["po_3_1","po_3_2","po_4"],"rubric":[{"level":"Exceptional","min":21,"max":30,"range":"21–30","desc":"Clean, tested code with reproducible results"},{"level":"Satisfactory","min":9,"max":20,"range":"9–20","desc":"Working implementation with adequate testing Code runs but lacks tests or documentation"},{"level":"Needs Improvement","min":0,"max":8,"range":"0–8","desc":"Implementation incomplete or non-functional"}]},{"key":"tech_writing","color":"#3B82F6","label":"Technical Writing","shortLabel":"Writing","blurb":"Evaluate narrative clarity, figure quality, citation practices, and overall academic writing standard.","max":30,"mudek":["9.2","3.2"],"mudek_outcomes":["po_9_2","po_3_2"],"rubric":[{"level":"Exceptional","min":21,"max":30,"range":"21–30","desc":"Publication-quality writing with clear narrative"},{"level":"Satisfactory","min":9,"max":20,"range":"9–20","desc":"Well-organized report with proper citations Readable but lacks structure or references"},{"level":"Needs Improvement","min":0,"max":8,"range":"0–8","desc":"Writing quality below academic standards"}]}]'::jsonb;
  -- METU ME Fall: 3-criteria analysis-heavy evaluation
  v_template_me_fall jsonb := '[
    {"key":"engineering_merit","color":"#F59E0B","label":"Engineering Merit","shortLabel":"Eng","blurb":"Evaluate depth of engineering analysis, proper tool usage (FEA/CFD), and design validation.","max":40,"mudek":["1.2","2","3.1","4"],"mudek_outcomes":["po_1_2","po_2","po_3_1","po_4"],"rubric":[{"level":"Excellent","min":33,"max":40,"range":"33–40","desc":"Outstanding engineering analysis and tool usage"},{"level":"Good","min":24,"max":32,"range":"24–32","desc":"Solid engineering work with proper methods"},{"level":"Developing","min":14,"max":23,"range":"14–23","desc":"Basic engineering approach with notable gaps"},{"level":"Insufficient","min":0,"max":13,"range":"0–13","desc":"Engineering fundamentals not demonstrated"}]},
    {"key":"comm_effectiveness","color":"#22C55E","label":"Communication Effectiveness","shortLabel":"Comm","blurb":"Assess poster visual quality, oral delivery confidence, and audience-appropriate communication.","max":35,"mudek":["9.1","9.2","3.2"],"mudek_outcomes":["po_9_1","po_9_2","po_3_2"],"rubric":[{"level":"Excellent","min":29,"max":35,"range":"29–35","desc":"Compelling presentation and polished poster"},{"level":"Good","min":21,"max":28,"range":"21–28","desc":"Clear communication meeting expectations"},{"level":"Developing","min":12,"max":20,"range":"12–20","desc":"Message conveyed but presentation is rough"},{"level":"Insufficient","min":0,"max":11,"range":"0–11","desc":"Fails to communicate project effectively"}]},
    {"key":"professionalism","color":"#3B82F6","label":"Professionalism","shortLabel":"Prof","blurb":"Evaluate professional conduct, ethical awareness, and consideration of safety/environmental impact.","max":25,"mudek":["6","7","10"],"mudek_outcomes":["po_6","po_7","po_10"],"rubric":[{"level":"Excellent","min":21,"max":25,"range":"21–25","desc":"Exemplary professional conduct and ethics"},{"level":"Good","min":15,"max":20,"range":"15–20","desc":"Professional demeanor with ethical awareness"},{"level":"Developing","min":8,"max":14,"range":"8–14","desc":"Some professional behavior but inconsistent"},{"level":"Insufficient","min":0,"max":7,"range":"0–7","desc":"Unprofessional conduct or ethical lapses"}]}
  ]'::jsonb;
  -- METU ME Spring: Manufacturing-focused capstone
  v_template_me_spring jsonb := '[{"key":"cad_cam_design","color":"#F59E0B","label":"CAD/CAM Design","shortLabel":"CAD","blurb":"Evaluate 3D model completeness, tolerancing, manufacturing feasibility, and CAD standards.","max":30,"mudek":["1.2","3.1","4"],"mudek_outcomes":["po_1_2","po_3_1","po_4"],"rubric":[{"level":"Mastery","min":25,"max":30,"range":"25–30","desc":"Production-ready CAD with proper tolerancing"},{"level":"Proficiency","min":19,"max":24,"range":"19–24","desc":"Detailed 3D model with appropriate tolerances and manufacturing notes"},{"level":"Developing","min":12,"max":18,"range":"12–18","desc":"Complete 3D model with adequate detail"},{"level":"Emerging","min":6,"max":11,"range":"6–11","desc":"Basic CAD model missing critical features"},{"level":"Not Demonstrated","min":0,"max":5,"range":"0–5","desc":"CAD work incomplete or unusable"}]},{"key":"prototyping","color":"#22C55E","label":"Prototyping","shortLabel":"Proto","blurb":"Assess prototype functionality, testing methodology, and alignment with simulation predictions.","max":25,"mudek":["2","3.2","5"],"mudek_outcomes":["po_2","po_3_2","po_5"],"rubric":[{"level":"Mastery","min":21,"max":25,"range":"21–25","desc":"Functional prototype validated through testing"},{"level":"Proficiency","min":16,"max":20,"range":"16–20","desc":"Working prototype demonstrating core functionality through systematic testing"},{"level":"Developing","min":10,"max":15,"range":"10–15","desc":"Prototype built and partially tested"},{"level":"Emerging","min":5,"max":9,"range":"5–9","desc":"Prototype attempted but not fully functional"},{"level":"Not Demonstrated","min":0,"max":4,"range":"0–4","desc":"No working prototype produced"}]},{"key":"poster_oral","color":"#3B82F6","label":"Poster & Oral Presentation","shortLabel":"Present","blurb":"Evaluate poster visual hierarchy and oral presentation structure, clarity, and engagement.","max":25,"mudek":["9.1","9.2"],"mudek_outcomes":["po_9_1","po_9_2"],"rubric":[{"level":"Mastery","min":21,"max":25,"range":"21–25","desc":"Engaging presentation with professional poster"},{"level":"Proficiency","min":16,"max":20,"range":"16–20","desc":"Clear and well-paced presentation with an organized, informative poster"},{"level":"Developing","min":10,"max":15,"range":"10–15","desc":"Clear presentation with informative poster"},{"level":"Emerging","min":5,"max":9,"range":"5–9","desc":"Adequate but lacks visual or oral polish"},{"level":"Not Demonstrated","min":0,"max":4,"range":"0–4","desc":"Poor presentation or missing poster"}]},{"key":"safety_ethics","color":"#EF4444","label":"Safety & Ethics","shortLabel":"Safety","blurb":"Assess safety protocol awareness, risk mitigation measures, and ethical reasoning in design.","max":20,"mudek":["6","7","8.2"],"mudek_outcomes":["po_6","po_7","po_8_2"],"rubric":[{"level":"Mastery","min":17,"max":20,"range":"17–20","desc":"Proactive safety measures and ethical reasoning"},{"level":"Proficiency","min":13,"max":16,"range":"13–16","desc":"Demonstrates consistent safety awareness and sound ethical judgment"},{"level":"Developing","min":8,"max":12,"range":"8–12","desc":"Safety protocols followed appropriately"},{"level":"Emerging","min":4,"max":7,"range":"4–7","desc":"Safety awareness present but incomplete"},{"level":"Not Demonstrated","min":0,"max":3,"range":"0–3","desc":"Safety and ethics not addressed"}]}]'::jsonb;
  -- METU ME Summer: Individual theoretical project
  v_template_me_summer jsonb := '[{"key":"analytical_modeling","color":"#F59E0B","label":"Analytical Modeling","shortLabel":"Model","blurb":"Evaluate mathematical model formulation, assumption justification, and validation methodology.","max":40,"mudek":["1.2","2","3.1","5"],"mudek_outcomes":["po_1_2","po_2","po_3_1","po_5"],"rubric":[{"level":"Commendable","min":28,"max":40,"range":"28–40","desc":"Rigorous mathematical model with validation"},{"level":"Acceptable","min":12,"max":27,"range":"12–27","desc":"Sound model with adequate assumptions stated Model attempted but oversimplified"},{"level":"Insufficient","min":0,"max":11,"range":"0–11","desc":"No viable analytical model developed"}]},{"key":"tech_report","color":"#22C55E","label":"Technical Report","shortLabel":"Report","blurb":"Assess report structure, methodology documentation, results clarity, and conclusions quality.","max":35,"mudek":["9.2","3.2","10"],"mudek_outcomes":["po_9_2","po_3_2","po_10"],"rubric":[{"level":"Commendable","min":24,"max":35,"range":"24–35","desc":"Comprehensive report with clear methodology"},{"level":"Acceptable","min":10,"max":23,"range":"10–23","desc":"Well-written report covering key aspects Report present but lacks depth or clarity"},{"level":"Insufficient","min":0,"max":9,"range":"0–9","desc":"Report missing or fundamentally inadequate"}]},{"key":"ethical_awareness","color":"#3B82F6","label":"Ethical Awareness","shortLabel":"Ethics","blurb":"Evaluate consideration of engineering impact on society, environment, and professional responsibility.","max":25,"mudek":["6","7"],"mudek_outcomes":["po_6","po_7"],"rubric":[{"level":"Commendable","min":17,"max":25,"range":"17–25","desc":"Thoughtful ethical analysis of engineering impact"},{"level":"Acceptable","min":7,"max":16,"range":"7–16","desc":"Acknowledges ethical dimensions appropriately Minimal ethical reflection in the work"},{"level":"Insufficient","min":0,"max":6,"range":"0–6","desc":"No consideration of ethical implications"}]}]'::jsonb;
  -- METU IE Fall: Granular 5-criteria IE evaluation
  v_template_ie_fall jsonb := '[
    {"key":"methodology","color":"#F59E0B","label":"Methodology","shortLabel":"Method","blurb":"Evaluate appropriateness of chosen OR/statistical method, formulation rigor, and justification.","max":25,"mudek":["1.2","2","5"],"mudek_outcomes":["po_1_2","po_2","po_5"],"rubric":[{"level":"Excellent","min":21,"max":25,"range":"21–25","desc":"Rigorous methodology with clear justification"},{"level":"Good","min":15,"max":20,"range":"15–20","desc":"Sound approach appropriately applied"},{"level":"Developing","min":8,"max":14,"range":"8–14","desc":"Method chosen but weakly justified"},{"level":"Insufficient","min":0,"max":7,"range":"0–7","desc":"No clear methodology identified"}]},
    {"key":"quantitative_modeling","color":"#22C55E","label":"Quantitative Modeling","shortLabel":"Model","blurb":"Assess model structure, decision variables, constraint formulation, and solution validation.","max":20,"mudek":["1.2","3.1","4"],"mudek_outcomes":["po_1_2","po_3_1","po_4"],"rubric":[{"level":"Excellent","min":17,"max":20,"range":"17–20","desc":"Validated model with sensitivity analysis"},{"level":"Good","min":12,"max":16,"range":"12–16","desc":"Working model producing reasonable outputs"},{"level":"Developing","min":7,"max":11,"range":"7–11","desc":"Model runs but lacks validation"},{"level":"Insufficient","min":0,"max":6,"range":"0–6","desc":"Model absent or non-functional"}]},
    {"key":"defense","color":"#3B82F6","label":"Oral Defense","shortLabel":"Defense","blurb":"Evaluate oral articulation of methodology, Q&A handling, and depth of technical understanding.","max":20,"mudek":["9.1","3.2"],"mudek_outcomes":["po_9_1","po_3_2"],"rubric":[{"level":"Excellent","min":17,"max":20,"range":"17–20","desc":"Articulate defense with strong Q&A handling"},{"level":"Good","min":12,"max":16,"range":"12–16","desc":"Clear presentation, answers most questions"},{"level":"Developing","min":7,"max":11,"range":"7–11","desc":"Basic presentation with weak responses"},{"level":"Insufficient","min":0,"max":6,"range":"0–6","desc":"Unable to present or defend the work"}]},
    {"key":"documentation","color":"#EF4444","label":"Documentation","shortLabel":"Docs","blurb":"Assess report completeness, formatting standards, and traceability of analysis steps.","max":20,"mudek":["9.2","10"],"mudek_outcomes":["po_9_2","po_10"],"rubric":[{"level":"Excellent","min":17,"max":20,"range":"17–20","desc":"Complete documentation with proper formatting"},{"level":"Good","min":12,"max":16,"range":"12–16","desc":"Adequate documentation covering key points"},{"level":"Developing","min":7,"max":11,"range":"7–11","desc":"Partial documentation with gaps"},{"level":"Insufficient","min":0,"max":6,"range":"0–6","desc":"Documentation missing or unusable"}]},
    {"key":"project_mgmt","color":"#8B5CF6","label":"Project Management","shortLabel":"PM","blurb":"Evaluate project planning evidence, milestone tracking, and task allocation effectiveness.","max":15,"mudek":["8.1","11"],"mudek_outcomes":["po_8_1","po_11"],"rubric":[{"level":"Excellent","min":13,"max":15,"range":"13–15","desc":"On-time delivery with effective task tracking"},{"level":"Good","min":9,"max":12,"range":"9–12","desc":"Reasonable planning and milestone adherence"},{"level":"Developing","min":5,"max":8,"range":"5–8","desc":"Some planning but missed key milestones"},{"level":"Insufficient","min":0,"max":4,"range":"0–4","desc":"No project management evident"}]}
  ]'::jsonb;
  -- METU IE Spring: Data-driven capstone
  v_template_ie_spring jsonb := '[{"key":"optimization_model","color":"#F59E0B","label":"Optimization Model","shortLabel":"OptModel","blurb":"Assess objective function formulation, constraint completeness, and solution optimality.","max":30,"mudek":["1.2","2","3.1","4"],"mudek_outcomes":["po_1_2","po_2","po_3_1","po_4"],"rubric":[{"level":"Exemplary","min":25,"max":30,"range":"25–30","desc":"Well-formulated model with optimal solution found"},{"level":"Accomplished","min":19,"max":24,"range":"19–24","desc":"Correct formulation producing near-optimal solutions with clear constraints"},{"level":"Competent","min":12,"max":18,"range":"12–18","desc":"Correct formulation with feasible solution"},{"level":"Developing","min":6,"max":11,"range":"6–11","desc":"Model defined but solution quality uncertain"},{"level":"Inadequate","min":0,"max":5,"range":"0–5","desc":"No valid optimization model presented"}]},{"key":"data_analytics","color":"#22C55E","label":"Data Analytics","shortLabel":"Analytics","blurb":"Evaluate data collection methodology, statistical analysis rigor, and visualization quality.","max":25,"mudek":["2","5","3.2"],"mudek_outcomes":["po_2","po_5","po_3_2"],"rubric":[{"level":"Exemplary","min":21,"max":25,"range":"21–25","desc":"Insightful analysis with appropriate statistics"},{"level":"Accomplished","min":16,"max":20,"range":"16–20","desc":"Thorough data analysis with appropriate visualizations and statistics"},{"level":"Competent","min":10,"max":15,"range":"10–15","desc":"Competent data handling and visualization"},{"level":"Developing","min":5,"max":9,"range":"5–9","desc":"Data collected but analysis is shallow"},{"level":"Inadequate","min":0,"max":4,"range":"0–4","desc":"No meaningful data analysis performed"}]},{"key":"oral_defense","color":"#3B82F6","label":"Oral Defense","shortLabel":"Defense","blurb":"Assess persuasiveness of defense, depth of knowledge demonstrated, and Q&A responsiveness.","max":25,"mudek":["9.1","8.1"],"mudek_outcomes":["po_9_1","po_8_1"],"rubric":[{"level":"Exemplary","min":21,"max":25,"range":"21–25","desc":"Persuasive defense demonstrating deep knowledge"},{"level":"Accomplished","min":16,"max":20,"range":"16–20","desc":"Confident presentation with well-prepared responses to technical probing"},{"level":"Competent","min":10,"max":15,"range":"10–15","desc":"Solid presentation answering questions well"},{"level":"Developing","min":5,"max":9,"range":"5–9","desc":"Presents adequately but depth lacking"},{"level":"Inadequate","min":0,"max":4,"range":"0–4","desc":"Cannot defend methodology or results"}]},{"key":"final_report","color":"#EF4444","label":"Final Report","shortLabel":"Report","blurb":"Evaluate report professionalism, actionable recommendations, and managerial implications.","max":20,"mudek":["9.2","10","11"],"mudek_outcomes":["po_9_2","po_10","po_11"],"rubric":[{"level":"Exemplary","min":17,"max":20,"range":"17–20","desc":"Professional report with actionable recommendations"},{"level":"Accomplished","min":13,"max":16,"range":"13–16","desc":"Complete report with clear structure and well-supported recommendations"},{"level":"Competent","min":8,"max":12,"range":"8–12","desc":"Complete report covering all required sections"},{"level":"Developing","min":4,"max":7,"range":"4–7","desc":"Report submitted but lacks conclusions"},{"level":"Inadequate","min":0,"max":3,"range":"0–3","desc":"Report missing or incomplete"}]}]'::jsonb;
  -- METU IE Summer: Research report style
  v_template_ie_summer jsonb := '[{"key":"lit_and_method","color":"#F59E0B","label":"Literature & Methodology","shortLabel":"LitMethod","blurb":"Evaluate literature coverage, research gap identification, and methodology justification.","max":35,"mudek":["2","5","10"],"mudek_outcomes":["po_2","po_5","po_10"],"rubric":[{"level":"Distinguished","min":24,"max":35,"range":"24–35","desc":"Thorough review with well-justified methodology"},{"level":"Satisfactory","min":10,"max":23,"range":"10–23","desc":"Good literature base with sound approach Some review done but method weakly justified"},{"level":"Unsatisfactory","min":0,"max":9,"range":"0–9","desc":"Inadequate literature review or methodology"}]},{"key":"quant_analysis","color":"#22C55E","label":"Quantitative Analysis","shortLabel":"QuantAnal","blurb":"Assess analytical sophistication, result validation, and interpretation of quantitative outputs.","max":35,"mudek":["1.2","3.1","4"],"mudek_outcomes":["po_1_2","po_3_1","po_4"],"rubric":[{"level":"Distinguished","min":24,"max":35,"range":"24–35","desc":"Sophisticated analysis with validated results"},{"level":"Satisfactory","min":10,"max":23,"range":"10–23","desc":"Competent quantitative work with clear outputs Analysis attempted but results questionable"},{"level":"Unsatisfactory","min":0,"max":9,"range":"0–9","desc":"No quantitative analysis conducted"}]},{"key":"tech_memo","color":"#3B82F6","label":"Technical Memo","shortLabel":"Memo","blurb":"Evaluate memo conciseness, actionability of conclusions, and clarity of findings presentation.","max":30,"mudek":["9.2","3.2","6"],"mudek_outcomes":["po_9_2","po_3_2","po_6"],"rubric":[{"level":"Distinguished","min":21,"max":30,"range":"21–30","desc":"Concise memo with actionable conclusions"},{"level":"Satisfactory","min":9,"max":20,"range":"9–20","desc":"Clear memo covering findings and implications Memo present but lacks focus or structure"},{"level":"Unsatisfactory","min":0,"max":8,"range":"0–8","desc":"Memo missing or fails to convey findings"}]}]'::jsonb;
  v_template jsonb;
  -- Master MÜDEK outcome dictionary (all POs — subset auto-derived per template)
  v_all_mudek jsonb := '[
    {"id":"po_1_2","code":"1.2","desc_en":"Ability to apply knowledge of mathematics, natural sciences, fundamental engineering, computation, and discipline-specific topics to solve complex engineering problems.","desc_tr":"Matematik, fen bilimleri, temel mühendislik, bilgisayarla hesaplama ve ilgili mühendislik disiplinine özgü konulardaki bilgileri, karmaşık mühendislik problemlerinin çözümünde kullanabilme becerisi."},
    {"id":"po_2","code":"2","desc_en":"Ability to identify, formulate, and analyse complex engineering problems using fundamental science, mathematics, and engineering knowledge.","desc_tr":"Karmaşık mühendislik problemlerini, temel bilim, matematik ve mühendislik bilgilerini kullanarak tanımlama, formüle etme ve analiz becerisi."},
    {"id":"po_3_1","code":"3.1","desc_en":"Ability to design creative solutions to complex engineering problems.","desc_tr":"Karmaşık mühendislik problemlerine yaratıcı çözümler tasarlama becerisi."},
    {"id":"po_3_2","code":"3.2","desc_en":"Ability to design complex systems, processes, devices, or products under realistic constraints and conditions.","desc_tr":"Karmaşık sistemleri, süreçleri, cihazları veya ürünleri gerçekçi kısıtları ve koşulları gözetarak tasarlama becerisi."},
    {"id":"po_4","code":"4","desc_en":"Ability to select and use appropriate techniques, resources, and modern engineering and IT tools for complex engineering problems.","desc_tr":"Karmaşık mühendislik problemlerinin analizi ve çözümüne yönelik uygun teknikleri, kaynakları ve modern araçları seçme ve kullanma becerisi."},
    {"id":"po_5","code":"5","desc_en":"Ability to use research methods including literature review, experiment design, data collection, and analysis.","desc_tr":"Literatür araştırması, deney tasarlama, veri toplama, sonuçları analiz etme ve yorumlama dahil araştırma yöntemlerini kullanma becerisi."},
    {"id":"po_6","code":"6","desc_en":"Awareness of professional and ethical responsibility in engineering practice.","desc_tr":"Mühendislik uygulamalarında mesleki ve etik sorumluluk bilinci."},
    {"id":"po_7","code":"7","desc_en":"Awareness of the impact of engineering solutions on health, safety, and the environment.","desc_tr":"Mühendislik çözümlerinin sağlık, güvenlik ve çevre üzerindeki etkilerinin farkında olma."},
    {"id":"po_8_1","code":"8.1","desc_en":"Ability to work effectively in intra-disciplinary teams.","desc_tr":"Disiplin içi takımlarda etkin biçimde çalışabilme becerisi."},
    {"id":"po_8_2","code":"8.2","desc_en":"Ability to work effectively in multidisciplinary teams.","desc_tr":"Çok disiplinli takımlarda etkin biçimde çalışabilme becerisi."},
    {"id":"po_9_1","code":"9.1","desc_en":"Ability to communicate effectively on technical topics orally.","desc_tr":"Teknik konularda sözlü etkin iletişim kurma becerisi."},
    {"id":"po_9_2","code":"9.2","desc_en":"Ability to communicate effectively on technical topics in writing.","desc_tr":"Teknik konularda yazılı etkin iletişim kurma becerisi."},
    {"id":"po_10","code":"10","desc_en":"Recognition of the need for lifelong learning and ability to access information and follow developments.","desc_tr":"Yaşam boyu öğrenmenin gerekliliğinin bilincinde olma; bilgiye erişebilme ve gelişmeleri izleyebilme becerisi."},
    {"id":"po_11","code":"11","desc_en":"Awareness of project management, entrepreneurship, innovation, and sustainable development practices.","desc_tr":"Proje yönetimi, girişimcilik, yenilikçilik ve sürdürülebilir kalkınma uygulamalarının farkında olma."}
  ]'::jsonb;
  v_mudek jsonb;
  v_semesters text[] := ARRAY['Fall 2025', 'Spring 2026', 'Summer 2026'];
  v_dates date[];
  v_idx int;
BEGIN
  FOR v_t IN SELECT id, code FROM tenants ORDER BY code LOOP
    IF v_t.code IN ('tedu-ee', 'tedu-ce') THEN
      v_dates := ARRAY['2025-12-18'::date, '2026-05-22'::date, '2026-08-12'::date];
    ELSIF v_t.code IN ('boun-chem', 'boun-cmpe') THEN
      v_dates := ARRAY['2025-12-15'::date, '2026-05-20'::date, '2026-08-10'::date];
    ELSE
      v_dates := ARRAY['2025-12-20'::date, '2026-05-25'::date, '2026-08-15'::date];
    END IF;

    FOR v_idx IN 1..3 LOOP
      -- Select per-tenant per-semester template (18 unique templates)
      IF v_t.code = 'tedu-ee' THEN
        v_template := CASE v_idx WHEN 1 THEN v_template_ee_fall WHEN 2 THEN v_template_ee_spring ELSE v_template_ee_summer END;
      ELSIF v_t.code = 'tedu-ce' THEN
        v_template := CASE v_idx WHEN 1 THEN v_template_ce_fall WHEN 2 THEN v_template_ce_spring ELSE v_template_ce_summer END;
      ELSIF v_t.code = 'boun-chem' THEN
        v_template := CASE v_idx WHEN 1 THEN v_template_chem_fall WHEN 2 THEN v_template_chem_spring ELSE v_template_chem_summer END;
      ELSIF v_t.code = 'boun-cmpe' THEN
        v_template := CASE v_idx WHEN 1 THEN v_template_cmpe_fall WHEN 2 THEN v_template_cmpe_spring ELSE v_template_cmpe_summer END;
      ELSIF v_t.code = 'metu-me' THEN
        v_template := CASE v_idx WHEN 1 THEN v_template_me_fall WHEN 2 THEN v_template_me_spring ELSE v_template_me_summer END;
      ELSIF v_t.code = 'metu-ie' THEN
        v_template := CASE v_idx WHEN 1 THEN v_template_ie_fall WHEN 2 THEN v_template_ie_spring ELSE v_template_ie_summer END;
      END IF;

      -- Auto-derive MÜDEK dictionary from template's mudek_outcomes
      v_used_pos := ARRAY[]::text[];
      FOR v_mi IN 0..(jsonb_array_length(v_template) - 1) LOOP
        FOR v_mj IN 0..(jsonb_array_length(v_template->v_mi->'mudek_outcomes') - 1) LOOP
          v_used_pos := array_append(v_used_pos, v_template->v_mi->'mudek_outcomes'->>v_mj);
        END LOOP;
      END LOOP;
      v_used_pos := ARRAY(SELECT DISTINCT unnest(v_used_pos));
      SELECT COALESCE(jsonb_agg(po ORDER BY po->>'code'), '[]'::jsonb) INTO v_mudek
      FROM jsonb_array_elements(v_all_mudek) AS po
      WHERE po->>'id' = ANY(v_used_pos);

      INSERT INTO semesters (tenant_id, semester_name, poster_date, is_current, criteria_template, mudek_template)
      SELECT
        v_t.id,
        v_semesters[v_idx],
        v_dates[v_idx],
        CASE WHEN v_t.code = 'tedu-ee' THEN (v_idx = 3) ELSE (v_idx = 2) END,
        v_template,
        v_mudek
      WHERE NOT EXISTS (
        SELECT 1 FROM semesters
        WHERE tenant_id = v_t.id
          AND lower(trim(semester_name)) = lower(trim(v_semesters[v_idx]))
      );

      -- Sync on re-seed (per semester, not per tenant)
      UPDATE semesters
      SET criteria_template = v_template,
          mudek_template    = v_mudek
      WHERE tenant_id = v_t.id
        AND lower(trim(semester_name)) = lower(trim(v_semesters[v_idx]));
    END LOOP;
  END LOOP;
END;
$$;

-- Normalize semester timestamps relative to poster_date
UPDATE semesters s SET
  created_at = s.poster_date::timestamptz - interval '30 days' + (random() * interval '6 hours'),
  updated_at = s.poster_date::timestamptz - interval '10 days' + (random() * interval '6 hours')
WHERE s.tenant_id IN (SELECT id FROM tenants);

-- 4a: Semester state diversity
UPDATE semesters SET is_locked = true
WHERE tenant_id = (SELECT id FROM tenants WHERE code = 'tedu-ce')
  AND lower(trim(semester_name)) = 'spring 2026';

UPDATE semesters SET is_locked = true
WHERE tenant_id = (SELECT id FROM tenants WHERE code = 'boun-chem')
  AND lower(trim(semester_name)) = 'fall 2025';

-- 4b: Entry tokens for active semesters (plain SQL for extensions.digest access)
UPDATE semesters SET
  entry_token_hash = encode(extensions.digest('demo-tedu-ee', 'sha256'), 'hex'),
  entry_token_enabled = true,
  entry_token_created_at = poster_date::timestamptz - interval '5 days'
WHERE tenant_id = '4b9adf8f-d234-4c46-a93d-d7010616b42a'
  AND is_current = true;

UPDATE semesters SET
  entry_token_hash = encode(extensions.digest('demo-boun-cmpe', 'sha256'), 'hex'),
  entry_token_enabled = true,
  entry_token_created_at = poster_date::timestamptz - interval '3 days'
WHERE tenant_id = (SELECT id FROM tenants WHERE code = 'boun-cmpe')
  AND is_current = true;

UPDATE semesters SET
  entry_token_hash = encode(extensions.digest('demo-metu-me', 'sha256'), 'hex'),
  entry_token_enabled = true,
  entry_token_created_at = poster_date::timestamptz - interval '7 days'
WHERE tenant_id = (SELECT id FROM tenants WHERE code = 'metu-me')
  AND is_current = true;

-- metu-ie: token exists but DISABLED (tests revoked state in UI)
UPDATE semesters SET
  entry_token_hash = encode(extensions.digest('demo-metu-ie', 'sha256'), 'hex'),
  entry_token_enabled = false,
  entry_token_created_at = poster_date::timestamptz - interval '6 days'
WHERE tenant_id = (SELECT id FROM tenants WHERE code = 'metu-ie')
  AND is_current = true;

-- ── Section 5: Settings seed data ───────────────────────────
INSERT INTO settings (key, value, tenant_id) VALUES
  ('timezone', 'Europe/Istanbul', '4b9adf8f-d234-4c46-a93d-d7010616b42a'::uuid),
  ('timezone', 'Europe/Istanbul', 'ec880532-9b44-4757-ab48-326b7faa2136'::uuid),
  ('notification_email', 'ie-capstone@metu.edu.tr', '6566d9e3-14a1-4cf7-8d23-82195beb03fd'::uuid),
  ('timezone', 'UTC', NULL)
ON CONFLICT DO NOTHING;

-- ── Section 6: Jurors (107 total) ───────────────────────────
-- Three categories per tenant:
--   • Core faculty (5-7): same department, assigned every semester (35 total)
--   • External academics (7 per discipline): same field, other university, rotating (42 total)
--   • Industry (5 per discipline): sector professionals, rotating (30 total)
--
-- Assignment logic in Section 8 uses juror_inst to categorize:
--   core     = juror_inst contains tenant's university AND discipline keyword
--   external = juror_inst contains discipline keyword AND 'University' BUT NOT tenant's university
--   industry = juror_inst does NOT contain 'University'

INSERT INTO jurors (juror_name, juror_inst) VALUES
  -- TEDU EE core faculty (6)
  ('Prof. Dr. Hasan Göktaş',        'TED University / Electrical & Electronics Eng.'),
  ('Prof. Dr. Ayşe Karaman',        'TED University / Electrical & Electronics Eng.'),
  ('Doç. Dr. Mehmet Çelik',         'TED University / Electrical & Electronics Eng.'),
  ('Doç. Dr. Elif Sönmez',          'TED University / Electrical & Electronics Eng.'),
  ('Dr. Öğr. Üyesi Burak Aydın',   'TED University / Electrical & Electronics Eng.'),
  ('Dr. Öğr. Üyesi Zeynep Ertürk', 'TED University / Electrical & Electronics Eng.'),
  -- TEDU CE core faculty (5)
  ('Prof. Dr. Kemal Özdemir',        'TED University / Civil Engineering'),
  ('Prof. Dr. Fatma Aksoy',          'TED University / Civil Engineering'),
  ('Doç. Dr. Serkan Yılmaz',        'TED University / Civil Engineering'),
  ('Dr. Öğr. Üyesi Deniz Koçak',    'TED University / Civil Engineering'),
  ('Dr. Öğr. Üyesi Pınar Taşkın',   'TED University / Civil Engineering'),
  -- Boğaziçi CHEM core faculty (6)
  ('Prof. Dr. Oğuz Bahadır',         'Boğaziçi University / Chemical Engineering'),
  ('Prof. Dr. Selin Türkoğlu',       'Boğaziçi University / Chemical Engineering'),
  ('Doç. Dr. Emre Kavak',            'Boğaziçi University / Chemical Engineering'),
  ('Doç. Dr. Gülşen Arslan',         'Boğaziçi University / Chemical Engineering'),
  ('Dr. Öğr. Üyesi Cem Durmuş',     'Boğaziçi University / Chemical Engineering'),
  ('Dr. Öğr. Üyesi Berna Şahin',    'Boğaziçi University / Chemical Engineering'),
  -- Boğaziçi CMPE core faculty (7)
  ('Prof. Dr. Tolga Kurtuluş',       'Boğaziçi University / Computer Engineering'),
  ('Prof. Dr. Neslihan Demir',        'Boğaziçi University / Computer Engineering'),
  ('Doç. Dr. Barış Karagöz',         'Boğaziçi University / Computer Engineering'),
  ('Doç. Dr. Merve Ünal',            'Boğaziçi University / Computer Engineering'),
  ('Dr. Öğr. Üyesi Onur Başaran',   'Boğaziçi University / Computer Engineering'),
  ('Dr. Öğr. Üyesi Canan Erdem',    'Boğaziçi University / Computer Engineering'),
  ('Dr. Öğr. Üyesi Volkan Sezer',   'Boğaziçi University / Computer Engineering'),
  -- METU ME core faculty (6)
  ('Prof. Dr. İlker Tanrıverdi',     'Middle East Technical University / Mechanical Eng.'),
  ('Prof. Dr. Şebnem Polat',         'Middle East Technical University / Mechanical Eng.'),
  ('Doç. Dr. Mustafa Gündüz',       'Middle East Technical University / Mechanical Eng.'),
  ('Doç. Dr. Hülya Kaplan',          'Middle East Technical University / Mechanical Eng.'),
  ('Dr. Öğr. Üyesi Tuncay Bayram', 'Middle East Technical University / Mechanical Eng.'),
  ('Dr. Öğr. Üyesi Aslı Çetin',    'Middle East Technical University / Mechanical Eng.'),
  -- METU IE core faculty (5)
  ('Prof. Dr. Murat Eroğlu',         'Middle East Technical University / Industrial Eng.'),
  ('Prof. Dr. Dilek Yıldırım',       'Middle East Technical University / Industrial Eng.'),
  ('Doç. Dr. Alper Tunga',           'Middle East Technical University / Industrial Eng.'),
  ('Dr. Öğr. Üyesi Sibel Korkmaz',  'Middle East Technical University / Industrial Eng.'),
  ('Dr. Öğr. Üyesi Ufuk Sarıca',    'Middle East Technical University / Industrial Eng.'),
  -- External academics: Electrical (7)
  ('Prof. Dr. Orhan Kılıç',          'Bilkent University / Electrical & Electronics Eng.'),
  ('Doç. Dr. Sevgi Demirtaş',       'İstanbul Technical University / Electrical & Electronics Eng.'),
  ('Prof. Dr. Levent Akdoğan',      'Hacettepe University / Electrical & Electronics Eng.'),
  ('Doç. Dr. Nurcan Bayer',          'Gazi University / Electrical & Electronics Eng.'),
  ('Prof. Dr. Cengiz Toraman',       'TOBB ETU University / Electrical & Electronics Eng.'),
  ('Dr. Öğr. Üyesi Derya Öztürk',  'Çankaya University / Electrical & Electronics Eng.'),
  ('Doç. Dr. Tamer Uysal',           'Başkent University / Electrical & Electronics Eng.'),
  -- External academics: Civil (7)
  ('Prof. Dr. Hikmet Dağlı',         'İstanbul Technical University / Civil Engineering'),
  ('Doç. Dr. Ebru Güneş',           'Bilkent University / Civil Engineering'),
  ('Prof. Dr. Nihat Aktaş',          'Ankara University / Civil Engineering'),
  ('Dr. Öğr. Üyesi Selma Toprak',   'Yıldız Technical University / Civil Engineering'),
  ('Prof. Dr. Harun Kaya',           'Dokuz Eylül University / Civil Engineering'),
  ('Doç. Dr. Füsun Ergül',          'Atılım University / Civil Engineering'),
  ('Dr. Öğr. Üyesi Gökhan Tuncer',  'Ege University / Civil Engineering'),
  -- External academics: Chemical (7)
  ('Prof. Dr. Yavuz Keskiner',       'Hacettepe University / Chemical Engineering'),
  ('Doç. Dr. Aysun Coşkun',         'İstanbul Technical University / Chemical Engineering'),
  ('Prof. Dr. Halil Erdoğan',        'Ankara University / Chemical Engineering'),
  ('Dr. Öğr. Üyesi Burcu Albayrak', 'Ege University / Chemical Engineering'),
  ('Prof. Dr. Zafer Genç',           'Gazi University / Chemical Engineering'),
  ('Doç. Dr. Meltem Işık',           'Koç University / Chemical Engineering'),
  ('Dr. Öğr. Üyesi Ferhat Kılınç',  'Yıldız Technical University / Chemical Engineering'),
  -- External academics: Computer (7)
  ('Prof. Dr. Uğur Çevik',           'Sabancı University / Computer Engineering'),
  ('Doç. Dr. İrem Aydınlık',        'Bilkent University / Computer Engineering'),
  ('Prof. Dr. Altan Koçyiğit',      'Koç University / Computer Engineering'),
  ('Dr. Öğr. Üyesi Gizem Vatansever', 'İstanbul Technical University / Computer Engineering'),
  ('Prof. Dr. Necati Boran',          'TOBB ETU University / Computer Engineering'),
  ('Doç. Dr. Esra Dinçer',           'Özyeğin University / Computer Engineering'),
  ('Dr. Öğr. Üyesi Ahmet Soydan',   'Hacettepe University / Computer Engineering'),
  -- External academics: Mechanical (7)
  ('Prof. Dr. Erdem Karaçay',        'Bilkent University / Mechanical Engineering'),
  ('Doç. Dr. Hatice Nur Yılmaz',    'İstanbul Technical University / Mechanical Engineering'),
  ('Prof. Dr. Kürşat Başak',        'Gazi University / Mechanical Engineering'),
  ('Dr. Öğr. Üyesi Zehra Avcı',     'Sabancı University / Mechanical Engineering'),
  ('Prof. Dr. Bülent Özer',          'Dokuz Eylül University / Mechanical Engineering'),
  ('Doç. Dr. Tuğçe Bektaş',        'Atılım University / Mechanical Engineering'),
  ('Dr. Öğr. Üyesi Sinan Doğru',    'Çankaya University / Mechanical Engineering'),
  -- External academics: Industrial (7)
  ('Prof. Dr. Rıza Gürbüz',         'Bilkent University / Industrial Engineering'),
  ('Doç. Dr. Cemile Özkaya',         'İstanbul Technical University / Industrial Engineering'),
  ('Prof. Dr. Tarık Sancar',          'Gazi University / Industrial Engineering'),
  ('Dr. Öğr. Üyesi Elif Metin',     'Hacettepe University / Industrial Engineering'),
  ('Prof. Dr. Bayram Altıntaş',     'Koç University / Industrial Engineering'),
  ('Doç. Dr. Nazan Çakır',           'Sabancı University / Industrial Engineering'),
  ('Dr. Öğr. Üyesi Okan Yurdakul',  'TOBB ETU University / Industrial Engineering'),
  -- Industry: Electrical & Electronics (5)
  ('Kadir Tekin',                     'ASELSAN — Radar & Electronic Warfare Division'),
  ('Müh. Seda Yalçın',              'Arçelik — R&D Center'),
  ('M.Sc. Ercan Bilgiç',             'Vestel — Electronics R&D'),
  ('Müh. Gökçe Şimşek',            'STM — Defense Technologies'),
  ('M.Sc. Furkan Arslan',            'Netaş — Telecom Solutions'),
  -- Industry: Civil (5)
  ('Müh. Oğuzhan Kırcı',            'Limak — Infrastructure Projects'),
  ('M.Sc. Ayça Duman',               'Kalyon — Construction Group'),
  ('Müh. Hakan Savaş',              'Tekfen — Engineering Division'),
  ('Müh. Pelin Sarı',                'İGA — Airport Construction'),
  ('M.Sc. Mert Aktürk',              'MESA — Housing & Urban Development'),
  -- Industry: Chemical (5)
  ('Müh. Caner Yüksel',             'Tüpraş — Refinery Technology Center'),
  ('M.Sc. Özlem Karagöl',           'Petkim — Petrochemical Complex'),
  ('Müh. Volkan Çınar',             'SOCAR Türkiye — Process Engineering'),
  ('M.Sc. İlknur Temel',             'Eczacıbaşı — Pharmaceutical Division'),
  ('Müh. Serhat Ergün',             'Aksa — Acrylic Fiber R&D'),
  -- Industry: Computer (5)
  ('M.Sc. Baran Öztop',              'Turkcell Technology — Software Development'),
  ('Müh. Dilara Akın',               'BGA Security — Cyber Security'),
  ('Arda Yılmazer',                   'Getir Tech — Engineering'),
  ('M.Sc. Cansu Topçu',             'Trendyol — Engineering Group'),
  ('Müh. Umut Korkmaz',             'Peak Games — Game Development'),
  -- Industry: Mechanical (5)
  ('Müh. Batuhan Özdil',            'Ford Otosan — R&D Center'),
  ('M.Sc. Elif Karakuş',            'TUSAŞ — Aerospace Engineering'),
  ('Müh. Koray Çetin',              'Roketsan — Propulsion Systems'),
  ('M.Sc. Tuğba Erdal',             'BMC — Armored Vehicles Division'),
  ('Müh. Selçuk Arat',              'Otokar — Defense Industry'),
  -- Industry: Industrial (5)
  ('M.Sc. Güneş Balcı',             'HAVELSAN — Systems Engineering'),
  ('Burcu Akbaş',                     'McKinsey Türkiye — Operations Consulting'),
  ('Müh. Tayfun Önal',              'Migros A.Ş. — Supply Chain Management'),
  ('M.Sc. Damla Şen',               'Turkish Cargo — Logistics Operations'),
  ('Müh. Yiğit Soylu',              'Arkas Logistics — Planning & Analytics')
ON CONFLICT DO NOTHING;

-- Normalize juror timestamps
WITH base AS (
  SELECT MIN(poster_date) AS base_date FROM semesters
)
UPDATE jurors j SET
  created_at = base.base_date::timestamptz - interval '40 days' + (random() * interval '20 days'),
  updated_at = base.base_date::timestamptz - interval '35 days' + (random() * interval '15 days')
FROM base;

-- ── Section 7: Projects (domain-specific curated titles) ────
-- 36 curated titles per domain. Project counts vary by tenant.
-- Student names: 50 Turkish + 80 international, discipline-weighted.

DO $$
DECLARE
  v_sem record;
  v_tenant_code text;
  v_project_count int;
  v_group_no int;
  v_is_summer boolean;
  v_is_spring boolean;

  v_titles text[];
  v_title text;

  v_turkish_names text[];
  v_intl_names text[];
  v_students text;
  v_student_count int;
  v_picked text[];
  v_used_sem_names text[];
  v_candidate text;
  v_i int;
  v_sem_offset int;
  v_title_idx int;
  v_pool_size int;
BEGIN
  v_turkish_names := ARRAY[
    'Ahmet Yılmaz','Ayşe Demir','Mehmet Koç','Zeynep Arslan','Kerem Öztürk',
    'Selin Polat','Emre Şahin','Buse Kaya','Onur Eren','Derya Kurt',
    'Büşra Yıldız','Mert Çelik','Seda Kara','Tarık Güneş','Yasemin Aktaş',
    'Cem Yıldırım','Elif Aksoy','Barış Aydın','Nazlı Tunç','Oğuz Kaplan',
    'Gökçe Aras','Yiğit Başaran','Defne Korucu','Kaan Deniz','İrem Turan',
    'Alp Güler','Duygu Sezer','Batuhan Ateş','Eylül Yalçın','Berk Sönmez',
    'Aslı Demirtaş','Efe Karaca','Cansu Özer','Murat Başak','Pelin Yüksel',
    'Serhat Koçak','Dilara Aslan','Umut Erdem','Nihan Toprak','Arda Keskin',
    'Gizem Bayrak','Tolga Sevim','Merve Çakır','Hüseyin Aktürk','Simge Doğan',
    'Caner Avcı','Ebru Gürbüz','Burak Karadeniz','Zehra Yalın','Koray Duman'
  ];

  v_intl_names := ARRAY[
    'James Miller','Emily Johnson','Noah Williams','Olivia Brown','Ethan Davis',
    'Charlotte Wilson','Henry Taylor','Amelia Anderson','Jack Moore','Grace Thomas',
    'Sophia Clark','Mason Lewis',
    'Camille Dupont','Théo Bernard','Manon Leroy','Hugo Moreau','Léa Petit',
    'Antoine Lefebvre',
    'Lukas Müller','Hannah Schmidt','Felix Wagner','Anna Becker','Jonas Weber',
    'Lena Hoffmann',
    'Marco Rossi','Giulia Ferrari','Luca Esposito','Sofia Ricci','Matteo Romano',
    'Chiara Marino',
    'Carlos García','Sofía Martínez','Alejandro López','Valentina Sánchez','Diego Hernández',
    'Wei Zhang','Li Huang','Fang Liu','Jing Chen','Hao Wang',
    'Min-jun Kim','Seo-yeon Park','Ji-ho Lee','Ye-jin Choi','Do-yun Jung',
    'Haruto Tanaka','Yui Sato','Ren Suzuki','Hana Yamamoto','Sota Nakamura',
    'Omar Hassan','Fatima Al-Rashid','Youssef Khalil','Layla Mansour','Karim Nasser',
    'Priya Sharma','Ravi Patel','Aisha Mohammed','Dmitri Volkov','Anastasia Petrova',
    'Pedro Almeida','Ingrid Larsson','Tobias Andersen','Chantal Dubois','Rafael Mendez',
    'Yuki Watanabe','Nao Kimura','Sven Eriksson','Elena Kowalski','Viktor Horváth',
    'Aiden O''Brien','Chloe Fitzgerald','Mateo Vargas','Lucia Fernandez','Erik Johansson',
    'Thiago Costa','Mei-Ling Wu','Arjun Nair','Zara Khan','Ibrahim Diallo'
  ];

  FOR v_sem IN
    SELECT s.id, s.semester_name, s.poster_date, s.tenant_id, t.code AS tenant_code
    FROM semesters s
    JOIN tenants t ON t.id = s.tenant_id
    ORDER BY t.code, s.poster_date
  LOOP
    v_tenant_code := v_sem.tenant_code;
    v_is_summer := lower(v_sem.semester_name) LIKE '%summer%';
    v_is_spring := lower(v_sem.semester_name) LIKE '%spring%';

    -- Curated domain-specific title pools (25 per domain)
    IF v_tenant_code = 'tedu-ee' THEN
      v_titles := ARRAY[
        'FPGA-Based Real-Time Motor Controller Using Kalman Filtering',
        'Low-Power Wireless Sensor Network for Smart Agriculture',
        'Embedded Signal Processor with LoRa Mesh Communication',
        'Adaptive Power Converter for Residential Solar Panels',
        'High-Speed ADC Interface Design for Radar Applications',
        'Real-Time Fault Detection in Three-Phase Inverters',
        'LoRa-Based Environmental Monitoring Station',
        'Digital Control Unit for Brushless DC Motor Drives',
        'Modular Battery Management System for E-Scooters',
        'Edge Computing Platform for Industrial Vibration Analysis',
        'Wearable ECG Monitor with BLE Data Transmission',
        'Programmable LED Driver with Adaptive Dimming',
        'Capacitive Touch Sensor Array for Interactive Displays',
        'SoC-Based Acoustic Emission Classifier for Structural Health',
        'Open-Source Oscilloscope Shield for Arduino Platforms',
        'Current-Sensing Relay Module with IoT Dashboard',
        'Visible-Light Communication Prototype for Indoor Positioning',
        'EMC-Compliant Switch-Mode Power Supply Design',
        'RISC-V Soft-Core Implementation on Xilinx FPGA',
        'Precision Temperature Logger with NIST-Traceable Calibration',
        'Automated PCB Inspection System Using Computer Vision',
        'Dual-Band Antenna Design for ISM and Sub-GHz Bands',
        'Smart Plug with Energy Monitoring and Usage Analytics',
        'PID Controller Tuning Platform for Educational Labs',
        'Ultrasonic Rangefinder with Kalman-Filtered Measurements',
        'Gesture Recognition System Using Radar Micro-Doppler Signatures',
        'GaN-Based Class-E Power Amplifier for Wireless Charging',
        'MEMS Accelerometer Signal Conditioning with Digital Filtering',
        'Autonomous Drone Navigation Using Optical Flow Sensors',
        'Multi-Channel EEG Acquisition Board with Active Electrodes',
        'Synchronous Buck Converter with Predictive Dead-Time Control',
        'Software-Defined Radio Receiver for FM Broadcast Band',
        'Inductive Position Sensor for Linear Motor Applications',
        'Thermal Camera Module with Embedded Object Detector',
        'Resonant Wireless Power Transfer for Implantable Devices',
        'LVDS-Based High-Speed Data Link for Camera Modules'
      ];
    ELSIF v_tenant_code = 'tedu-ce' THEN
      v_titles := ARRAY[
        'Seismic Performance Assessment of Base-Isolated RC Frames',
        'Finite Element Analysis of Steel Truss Bridge Under Dynamic Loads',
        'Sustainable Concrete Mix Design Using Recycled Aggregates',
        'Slope Stability Analysis of Clay Embankments with GeoStudio',
        'Structural Health Monitoring Using Fiber-Optic Sensors',
        'Optimal Design of Reinforced Concrete Shear Walls for High-Rise Buildings',
        'Flood Risk Mapping of Ankara Streams Using HEC-RAS',
        'Performance-Based Earthquake Engineering of a Hospital Building',
        'Experimental Study on Self-Compacting Concrete with Fly Ash',
        'Wind Load Analysis of Tall Buildings Using CFD Simulation',
        'Geotechnical Investigation and Foundation Design for Soft Soils',
        'Life Cycle Assessment of Green Building Materials',
        'Nonlinear Pushover Analysis of Existing Masonry Structures',
        'Design of a Pedestrian Cable-Stayed Bridge with AASHTO Standards',
        'Evaluation of Pavement Distress Using Machine Learning on UAV Images',
        'Retrofitting Strategies for Pre-1998 RC Buildings in Turkey',
        'Stormwater Management System Design for Urban Campus Areas',
        'Comparative Study of Shallow vs Deep Foundations in Alluvial Deposits',
        'Buckling Analysis of Thin-Walled Steel Members Under Compression',
        'Traffic Flow Simulation and Signal Optimization for Campus Intersection',
        'Durability Assessment of Fiber-Reinforced Polymer Rebars in Concrete',
        'Soil Liquefaction Potential Mapping for Central Ankara Region',
        'Thermal Performance of Double-Skin Facades in Continental Climates',
        'Dynamic Response Analysis of a Multi-Story Building with TMD',
        'Water Distribution Network Optimization Using EPANET Modeling',
        'Concrete Carbonation Depth Prediction Using Machine Learning',
        'Seismic Isolation Bearing Design for a Cable-Stayed Bridge',
        'Groundwater Flow Modeling for Dewatering of Deep Excavations',
        'Fiber-Reinforced Polymer Strengthening of Deficient RC Columns',
        'Modal Analysis and Health Assessment of a Historical Masonry Arch',
        'Urban Heat Island Mitigation Through Permeable Pavement Systems',
        'Scour Risk Assessment Around Bridge Piers Using 2D Hydraulic Modeling',
        'Prefabricated Modular Housing Design for Post-Disaster Deployment',
        'Creep and Shrinkage Effects on Post-Tensioned Concrete Box Girders',
        'Rainwater Harvesting System Design for University Campus Buildings',
        'Probabilistic Seismic Hazard Analysis for Central Anatolia Region'
      ];
    ELSIF v_tenant_code = 'boun-chem' THEN
      v_titles := ARRAY[
        'Optimization of Biodiesel Production from Waste Cooking Oil',
        'Design of a Continuous Distillation Column for Ethanol-Water Separation',
        'CFD Simulation of Fluidized Bed Reactor for Catalytic Cracking',
        'Kinetic Modeling of Fischer-Tropsch Synthesis over Cobalt Catalysts',
        'Membrane Separation Process Design for CO₂ Capture',
        'Heat Exchanger Network Optimization Using Pinch Analysis',
        'Adsorption-Based Water Treatment Using Activated Carbon from Hazelnut Shells',
        'Process Simulation of Ammonia Plant Using Aspen HYSYS',
        'Synthesis of TiO₂ Nanoparticles for Photocatalytic Dye Degradation',
        'PID Controller Design for CSTR Temperature Regulation',
        'Techno-Economic Analysis of Green Hydrogen Production via Electrolysis',
        'Polymer Electrolyte Membrane Fuel Cell Performance Optimization',
        'Packed Bed Reactor Modeling for Methanol Synthesis',
        'Extraction of Essential Oils Using Supercritical CO₂',
        'Design of Wastewater Treatment Plant for Textile Industry Effluent',
        'Rheological Characterization of Polymer Solutions for Enhanced Oil Recovery',
        'Life Cycle Assessment of PET Recycling Processes',
        'Microfluidic Reactor Design for Nanoparticle Synthesis',
        'Batch Reactor Optimization for Polymerization of Styrene',
        'Corrosion Inhibition Study Using Green Inhibitors in Acidic Media',
        'HAZOP Analysis and Safety Review of LPG Storage Facility',
        'Electrochemical Impedance Spectroscopy of Li-Ion Battery Electrodes',
        'Dynamic Simulation of Absorption Column for Natural Gas Sweetening',
        'Sol-Gel Synthesis of Silica Aerogels for Thermal Insulation',
        'Process Intensification of Reactive Distillation for Ester Production',
        'Scale-Up Study of Enzymatic Biodiesel Production in a Packed Bed',
        'Graphene Oxide Membrane Fabrication for Desalination Applications',
        'Aspen Plus Simulation of Dimethyl Ether Synthesis from Methanol',
        'Electrocatalytic CO₂ Reduction on Cu-Zn Bimetallic Electrodes',
        'Freeze-Drying Process Optimization for Pharmaceutical Formulations',
        'Computational Fluid Dynamics of Gas-Liquid Flow in Bubble Columns',
        'Lignin Valorization Pathways for Bio-Based Aromatic Chemicals',
        'Design of a Pilot-Scale Biogas Upgrading Unit Using Amine Scrubbing',
        'Nanocellulose Reinforced Bioplastic Film Characterization',
        'Pinch Analysis and Utility Optimization for a Refinery Crude Unit',
        'Photocatalytic Hydrogen Production Using CdS/TiO₂ Heterojunctions'
      ];
    ELSIF v_tenant_code = 'boun-cmpe' THEN
      v_titles := ARRAY[
        'Self-Supervised Contrastive Learning for Medical Image Segmentation',
        'Multi-Modal Transformer for Visual Question Answering',
        'Zero-Shot Text Classification with Prompt Engineering',
        'Explainable Anomaly Detection in Time-Series Sensor Data',
        'Few-Shot Named Entity Recognition for Turkish Clinical Notes',
        'Vision Transformer Fine-Tuning for Satellite Image Classification',
        'Diffusion Model for Architectural Floor Plan Generation',
        'Causal Inference Framework for A/B Test Analysis',
        'Attention-Based Scene Graph Generation from Video Streams',
        'Contrastive Pre-Training for Low-Resource Speech Recognition',
        'Generative Adversarial Network for Data Augmentation in Pathology',
        'Knowledge Distillation Pipeline for On-Device NLP',
        'Reinforcement Learning Agent for Dynamic Traffic Routing',
        'Multi-Task Learning Framework for Document Understanding',
        'Neural Architecture Search for Efficient Object Detectors',
        'Graph Attention Network for Protein Interaction Prediction',
        'Retrieval-Augmented Generation for Legal Document Summarization',
        'Self-Supervised Depth Estimation from Monocular Video',
        'Federated Multi-Task Learning for IoT Anomaly Detection',
        'Hyperparameter Optimization Framework Using Bayesian Methods',
        'Cross-Lingual Sentiment Transfer for Under-Resourced Languages',
        'Active Learning Pipeline for Image Annotation at Scale',
        'Temporal Action Localization in Untrimmed Lecture Videos',
        'Continual Learning Benchmark for Vision Classification Tasks',
        'Sparse Mixture-of-Experts Model for Multilingual Translation',
        'Real-Time Object Tracking with Transformer-Based Architectures',
        'Privacy-Preserving Machine Learning via Differential Privacy Mechanisms',
        'Code Generation from Natural Language Using Large Language Models',
        'Adversarial Robustness Evaluation Framework for Image Classifiers',
        'Multi-Agent Reinforcement Learning for Cooperative Robotics Tasks',
        'Efficient Fine-Tuning of Vision-Language Models with LoRA Adapters',
        'Automated Bug Localization Using Graph Neural Networks on ASTs',
        'Speech Emotion Recognition with Multi-Modal Fusion Networks',
        'Unsupervised Domain Adaptation for Autonomous Driving Perception',
        'Scalable Recommendation System with Approximate Nearest Neighbors',
        'Byzantine Fault-Tolerant Consensus for Blockchain Sharding'
      ];
    ELSIF v_tenant_code = 'metu-me' THEN
      v_titles := ARRAY[
        'Topology-Optimized Bracket for UAV Landing Gear Assembly',
        'CFD-Validated Heat Exchanger for Data Center Cooling',
        'Lightweight Robotic Gripper Using Compliant Mechanisms',
        'Additive Manufacturing of Lattice Structures for Bone Implants',
        'Vibration Analysis of Composite Wind Turbine Blades',
        'Thermal Management System for Electric Vehicle Battery Packs',
        'Bio-Inspired Robotic Fish for Underwater Survey',
        'Finite Element Analysis of Crash-Resistant Vehicle Frames',
        'Shape Memory Alloy Actuator for Deployable Solar Panels',
        'Ergonomic Hand Tool Design with Force Distribution Analysis',
        'Micro-Channel Cooling System for High-Power LED Modules',
        'Gear Tooth Profile Optimization for Low-Noise Gearboxes',
        'Wind Tunnel Testing Platform for Aerodynamics Courses',
        'Pneumatic Soft Gripper for Delicate Produce Handling',
        'Thermo-Mechanical Fatigue Life Prediction for Turbine Discs',
        'Desktop 3D Printer Calibration and Quality Control Suite',
        'Regenerative Shock Absorber for Energy Harvesting Vehicles',
        'Centrifugal Pump Impeller Redesign with CFD Optimization',
        'Compliant Mechanism Forceps for Minimally Invasive Surgery',
        'Suspension Kinematics Simulator for Formula Student Car',
        'Laser Cutter Fume Extraction and Filtration System Design',
        'Planetary Gear Reducer for Compact Servo Actuators',
        'Thermal Runaway Containment Chamber for Li-Ion Cells',
        'Injection Mold Flow Analysis for Thin-Wall Plastic Parts',
        'Modular Prosthetic Hand with Tendon-Driven Fingers',
        'Design and Testing of a Small-Scale Horizontal Axis Wind Turbine',
        'Friction Stir Welding Parameter Optimization for Aluminum Alloys',
        'Hydraulic Press Frame Topology Optimization with Stress Constraints',
        'Autonomous Mobile Robot Navigation in Warehouse Environments',
        'Heat Pipe Performance Characterization for Satellite Thermal Control',
        'Acoustic Emission Monitoring of Fatigue Crack Growth in Steel',
        'Variable Geometry Turbocharger Nozzle Ring Design for Diesel Engines',
        'Biomimetic Surface Texturing for Drag Reduction in Pipe Flow',
        'Origami-Inspired Deployable Shelter Structure for Field Hospitals',
        'Flexure-Based Precision Positioning Stage for Micro-Assembly',
        'Thermoelectric Generator Module for Waste Heat Recovery from Exhaust'
      ];
    ELSE -- metu-ie
      v_titles := ARRAY[
        'Multi-Objective Warehouse Layout Using Genetic Algorithms',
        'Stochastic Demand Forecasting for Perishable Goods Supply Chains',
        'Simulation-Based Scheduling for Mixed-Model Assembly Lines',
        'Data-Driven Quality Control Dashboard for Automotive Parts',
        'Digital Twin of a Hospital Emergency Department',
        'Lean Six Sigma Improvement Plan for Campus Dining Operations',
        'Robust Vehicle Routing Under Travel Time Uncertainty',
        'Machine Learning Pipeline for Predictive Maintenance',
        'E-Commerce Last-Mile Delivery Network Optimization',
        'Risk Assessment Matrix Tool for Construction Projects',
        'Ergonomic Workstation Design Using REBA and RULA Analysis',
        'Inventory Policy Comparison Under Non-Stationary Demand',
        'Monte Carlo Simulation of Airport Check-In Queue Dynamics',
        'Integer Programming Model for University Course Timetabling',
        'Sustainable Supplier Selection with Fuzzy AHP Framework',
        'Healthcare Staff Scheduling with Fairness Constraints',
        'Discrete-Event Simulation of a Parcel Sorting Hub',
        'Production Lot Sizing with Setup Time Dependent Costs',
        'Analytical Hierarchy Process for Technology Vendor Evaluation',
        'Capacity Planning Model for Semiconductor Fabrication Line',
        'Kanban System Design for Small-Batch Electronics Assembly',
        'Network Flow Model for Inter-City Cargo Distribution',
        'Statistical Process Control Dashboard with Real-Time Alerts',
        'Workforce Planning Optimization for Seasonal Retail Operations',
        'Revenue Management Model for Boutique Hotel Booking',
        'Appointment Scheduling System for Outpatient Clinics Using Simulation',
        'Multi-Criteria Decision Analysis for Renewable Energy Site Selection',
        'Automated Guided Vehicle Fleet Sizing and Routing Optimization',
        'Reliability-Centered Maintenance Planning for Manufacturing Lines',
        'Dynamic Pricing Strategy for Ride-Sharing Platforms',
        'Assembly Line Balancing with Worker Skill Heterogeneity',
        'Supply Chain Resilience Assessment Under Disruption Scenarios',
        'Warehouse Slotting Optimization Using Genetic Algorithms',
        'Service Quality Benchmarking Framework for Public Transportation',
        'Job Shop Scheduling with Sequence-Dependent Setup Times',
        'Portfolio Optimization with Conditional Value-at-Risk Constraints'
      ];
    END IF;

    -- Project count varies by tenant size
    IF v_is_summer THEN
      v_project_count := 3 + floor(random() * 3)::int;
    ELSIF v_is_spring THEN
      IF v_tenant_code IN ('boun-chem', 'boun-cmpe') THEN
        v_project_count := 13 + floor(random() * 4)::int;
      ELSIF v_tenant_code IN ('metu-me', 'metu-ie') THEN
        v_project_count := 10 + floor(random() * 4)::int;
      ELSE
        v_project_count := 12 + floor(random() * 4)::int;
      END IF;
    ELSE -- fall
      IF v_tenant_code IN ('boun-chem', 'boun-cmpe') THEN
        v_project_count := 11 + floor(random() * 3)::int;
      ELSIF v_tenant_code IN ('metu-me', 'metu-ie') THEN
        v_project_count := 9 + floor(random() * 3)::int;
      ELSE
        v_project_count := 10 + floor(random() * 3)::int;
      END IF;
    END IF;

    v_used_sem_names := ARRAY[]::text[];

    -- Non-overlapping slices of the 36-title pool per semester.
    -- Fall [1..13], Spring [14..29], Summer [30..34] — zero overlap.
    v_pool_size := array_length(v_titles, 1);  -- 36
    IF lower(v_sem.semester_name) LIKE '%fall%' THEN
      v_sem_offset := 0;
    ELSIF lower(v_sem.semester_name) LIKE '%spring%' THEN
      v_sem_offset := 13;
    ELSE -- summer
      v_sem_offset := 29;
    END IF;

    FOR v_group_no IN 1..v_project_count LOOP
      -- Each semester draws from its own non-overlapping slice of the pool.
      v_title_idx := v_sem_offset + v_group_no;
      v_title := v_titles[v_title_idx];

      -- Generate student group (2-4 students, discipline-weighted draw)
      v_student_count := 2 + floor(random() * 3)::int;
      v_picked := ARRAY[]::text[];
      v_students := '';
      v_i := 0;
      WHILE v_i < v_student_count LOOP
        LOOP
          -- 70% Turkish / 30% international for Turkish universities
          IF random() < 0.70 THEN
            v_candidate := v_turkish_names[1 + floor(random() * array_length(v_turkish_names, 1))::int];
          ELSE
            v_candidate := v_intl_names[1 + floor(random() * array_length(v_intl_names, 1))::int];
          END IF;
          EXIT WHEN NOT (v_candidate = ANY(v_picked))
                AND NOT (v_candidate = ANY(v_used_sem_names));
        END LOOP;
        v_picked := array_append(v_picked, v_candidate);
        v_used_sem_names := array_append(v_used_sem_names, v_candidate);
        IF v_i > 0 THEN v_students := v_students || '; '; END IF;
        v_students := v_students || v_candidate;
        v_i := v_i + 1;
      END LOOP;

      INSERT INTO projects (semester_id, tenant_id, group_no, project_title, group_students)
      VALUES (v_sem.id, v_sem.tenant_id, v_group_no, v_title, v_students)
      ON CONFLICT (semester_id, group_no) DO UPDATE
        SET project_title = EXCLUDED.project_title;
    END LOOP;
  END LOOP;
END;
$$;

-- Normalize project timestamps
UPDATE projects p SET
  created_at = s.poster_date::timestamptz - interval '14 days' + (random() * interval '10 days'),
  updated_at = s.poster_date::timestamptz - interval '7 days' + (random() * interval '5 days')
FROM semesters s
WHERE s.id = p.semester_id;

-- ── Section 8: Juror-semester assignments ───────────────────
-- Role-based assignment per tenant-semester:
--   • Core faculty (same dept): ALL assigned every semester (stable cadre)
--   • External academics (same discipline, other uni): 4 per semester, rotating from 7
--   • Industry pool: 3 per semester, rotating from 30
--   Summer semesters: core + 2 external + 1 industry (smaller panel)
--
-- Categorization uses juror_inst pattern matching:
--   core     = inst LIKE '%{university}%' AND inst LIKE '%{discipline}%'
--   external = inst LIKE '%{discipline}%' AND inst NOT LIKE '%{university}%'
--              AND inst LIKE '%University%'
--   industry = inst NOT LIKE '%University%'

DO $$
DECLARE
  v_tenant record;
  v_sem record;
  v_juror record;
  v_juror_idx int;
  v_is_summer boolean;
  v_uni text;
  v_dept_key text;
  v_ext_pick int;
  v_ind_pick int;
  v_pin text;
  v_hash text;
BEGIN
  FOR v_tenant IN SELECT id, code FROM tenants ORDER BY code LOOP
    -- Map tenant to university name and discipline keyword for inst matching
    v_uni := CASE v_tenant.code
      WHEN 'tedu-ee'   THEN 'TED University'
      WHEN 'tedu-ce'   THEN 'TED University'
      WHEN 'boun-chem' THEN 'Boğaziçi University'
      WHEN 'boun-cmpe' THEN 'Boğaziçi University'
      WHEN 'metu-me'   THEN 'Middle East Technical University'
      WHEN 'metu-ie'   THEN 'Middle East Technical University'
    END;
    v_dept_key := CASE v_tenant.code
      WHEN 'tedu-ee'   THEN 'Electrical'
      WHEN 'tedu-ce'   THEN 'Civil'
      WHEN 'boun-chem' THEN 'Chemical'
      WHEN 'boun-cmpe' THEN 'Computer'
      WHEN 'metu-me'   THEN 'Mechanical'
      WHEN 'metu-ie'   THEN 'Industrial'
    END;

    FOR v_sem IN
      SELECT id, semester_name, poster_date, tenant_id FROM semesters
      WHERE tenant_id = v_tenant.id ORDER BY poster_date
    LOOP
      v_is_summer := lower(v_sem.semester_name) LIKE '%summer%';
      v_ext_pick := CASE WHEN v_is_summer THEN 2 ELSE 4 END;
      v_ind_pick := CASE WHEN v_is_summer THEN 1 ELSE 3 END;

      -- 1) Core faculty: ALL assigned every semester (stable cadre)
      FOR v_juror IN
        SELECT id FROM jurors
        WHERE juror_inst LIKE '%' || v_uni || '%'
          AND juror_inst LIKE '%' || v_dept_key || '%'
        ORDER BY id
      LOOP
        v_pin := lpad(abs(hashtext(v_juror.id::text || v_sem.id::text) % 10000)::text, 4, '0');
        BEGIN
          v_hash := crypt(v_pin, gen_salt('bf'));
          INSERT INTO juror_semester_auth (juror_id, semester_id, tenant_id, pin_hash)
          VALUES (v_juror.id, v_sem.id, v_tenant.id, v_hash)
          ON CONFLICT (juror_id, semester_id) DO NOTHING;
          INSERT INTO scores (semester_id, project_id, juror_id, tenant_id)
          SELECT v_sem.id, p.id, v_juror.id, v_tenant.id
          FROM projects p WHERE p.semester_id = v_sem.id
          ON CONFLICT ON CONSTRAINT scores_unique_eval DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END LOOP;

      -- 2) External academics: same discipline, different university, rotating
      v_juror_idx := 0;
      FOR v_juror IN
        SELECT id FROM jurors
        WHERE juror_inst LIKE '%' || v_dept_key || '%'
          AND juror_inst NOT LIKE '%' || v_uni || '%'
          AND juror_inst LIKE '%University%'
        ORDER BY hashtext(id::text || v_sem.id::text), id
      LOOP
        v_juror_idx := v_juror_idx + 1;
        EXIT WHEN v_juror_idx > v_ext_pick;
        v_pin := lpad(abs(hashtext(v_juror.id::text || v_sem.id::text) % 10000)::text, 4, '0');
        BEGIN
          v_hash := crypt(v_pin, gen_salt('bf'));
          INSERT INTO juror_semester_auth (juror_id, semester_id, tenant_id, pin_hash)
          VALUES (v_juror.id, v_sem.id, v_tenant.id, v_hash)
          ON CONFLICT (juror_id, semester_id) DO NOTHING;
          INSERT INTO scores (semester_id, project_id, juror_id, tenant_id)
          SELECT v_sem.id, p.id, v_juror.id, v_tenant.id
          FROM projects p WHERE p.semester_id = v_sem.id
          ON CONFLICT ON CONSTRAINT scores_unique_eval DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END LOOP;

      -- 3) Industry jurors: rotating from shared pool
      v_juror_idx := 0;
      FOR v_juror IN
        SELECT id FROM jurors
        WHERE juror_inst NOT LIKE '%University%'
          AND juror_inst NOT LIKE '%Üniversitesi%'
        ORDER BY hashtext(id::text || v_sem.id::text), id
      LOOP
        v_juror_idx := v_juror_idx + 1;
        EXIT WHEN v_juror_idx > v_ind_pick;
        v_pin := lpad(abs(hashtext(v_juror.id::text || v_sem.id::text) % 10000)::text, 4, '0');
        BEGIN
          v_hash := crypt(v_pin, gen_salt('bf'));
          INSERT INTO juror_semester_auth (juror_id, semester_id, tenant_id, pin_hash)
          VALUES (v_juror.id, v_sem.id, v_tenant.id, v_hash)
          ON CONFLICT (juror_id, semester_id) DO NOTHING;
          INSERT INTO scores (semester_id, project_id, juror_id, tenant_id)
          SELECT v_sem.id, p.id, v_juror.id, v_tenant.id
          FROM projects p WHERE p.semester_id = v_sem.id
          ON CONFLICT ON CONSTRAINT scores_unique_eval DO NOTHING;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END LOOP;

    END LOOP;
  END LOOP;
END;
$$;

-- ── Section 9: Score generation (workflow-first realism) ─────
-- Priority: workflow state → row shape → numeric scores.
-- Uses temp table for effective-state tracking across generation
-- and sanity checks.

CREATE TEMP TABLE IF NOT EXISTS _seed_effective_state (
  juror_id uuid,
  semester_id uuid,
  effective_status text,
  PRIMARY KEY (juror_id, semester_id)
);

DO $$
DECLARE
  v_sem record;
  v_juror record;
  v_proj record;

  -- Status
  v_bucket int;
  v_status text;
  v_has_editing boolean;
  v_has_in_progress boolean;
  v_first_submitted_juror uuid;
  v_juror_idx int;

  -- Score generation
  v_template jsonb;
  v_max_total int;
  v_target_min int;
  v_target_max int;
  v_floor float;
  v_eff_floor float;
  v_crit_floor float;
  v_bias float;
  v_juror_offset float;
  v_cs jsonb;
  v_cs_temp jsonb;
  v_sum int;
  v_sum_temp int;
  v_rescale_target int;
  v_val int;
  v_key text;
  v_max int;
  v_crit jsonb;
  v_attempt int;

  -- Partial/untouched scoring
  v_incomplete_proj uuid;
  v_untouched_proj uuid;
  v_coin float;
  v_all_keys text[];
  v_remove_idx1 int;
  v_remove_idx2 int;

  -- Comments
  v_positive_comments text[];
  v_neutral_comments text[];
  v_constructive_comments text[];
  v_domain_comments text[];
  v_comment text;
  v_score_pct float;
  v_comment_roll float;

  -- Timestamps
  v_poster_ts timestamptz;
  v_start_min int;
  v_per_proj_min int;
  v_cumulative_min int;
  v_updated_at timestamptz;
  v_created_at timestamptz;
  v_max_updated_at timestamptz;
  v_final_at timestamptz;
  v_offset_sec int;

  -- Project counting
  v_proj_count int;
BEGIN
  -- Step 1: Disable updated_at trigger
  ALTER TABLE scores DISABLE TRIGGER trg_scores_updated_at;

  -- Step 2: Reset score data for re-runs
  UPDATE scores SET
    criteria_scores = NULL,
    comment = NULL,
    final_submitted_at = NULL
  WHERE semester_id IN (
    SELECT id FROM semesters WHERE tenant_id IN (SELECT id FROM tenants)
  );

  -- Comment pools (tiered by score)
  v_positive_comments := ARRAY[
    'Strong technical foundation, well-structured presentation.',
    'Solid methodology, results clearly presented.',
    'Well-organized poster, excellent Q&A responses.',
    'Outstanding integration of hardware and software components.',
    'Balanced contribution from all team members.',
    'Ambitious scope, well executed within the timeline.'
  ];

  v_neutral_comments := ARRAY[
    'Clear problem definition, practical relevance is evident.',
    'Professional presentation quality, minor formatting issues.',
    'Good effort overall, implementation could be more robust.',
    'Would benefit from deeper literature review.',
    'Interesting approach, some aspects need further development.',
    'Reasonable scope but limited novelty in the solution.'
  ];

  v_constructive_comments := ARRAY[
    'Good teamwork but written communication needs improvement.',
    'Creative approach but needs more rigorous testing.',
    'Impressive demo, some gaps in theoretical justification.',
    'Scope is overly ambitious for the given timeline.',
    'Testing methodology needs more structure and coverage.',
    'Results section is weak; needs more quantitative evidence.'
  ];

  FOR v_sem IN
    SELECT s.id, s.semester_name, s.poster_date, s.criteria_template, s.is_current,
           t.code AS tenant_code, t.id AS tenant_id
    FROM semesters s
    JOIN tenants t ON t.id = s.tenant_id
    ORDER BY t.code, s.poster_date
  LOOP
    v_template := v_sem.criteria_template;
    IF v_template IS NULL OR jsonb_array_length(v_template) = 0 THEN
      CONTINUE;
    END IF;

    -- Compute max total from template
    v_max_total := 0;
    FOR v_crit IN SELECT * FROM jsonb_array_elements(v_template) LOOP
      v_max_total := v_max_total + (v_crit->>'max')::int;
    END LOOP;
    v_target_min := floor(0.70 * v_max_total)::int;
    v_target_max := v_max_total;

    -- Tenant-specific scoring floor
    v_floor := CASE v_sem.tenant_code
      WHEN 'tedu-ee' THEN 0.60
      WHEN 'tedu-ce' THEN 0.65
      WHEN 'boun-chem' THEN 0.68
      WHEN 'boun-cmpe' THEN 0.66
      WHEN 'metu-me' THEN 0.58
      WHEN 'metu-ie' THEN 0.55
      ELSE 0.60
    END;

    -- Domain-specific comments
    IF v_sem.tenant_code IN ('tedu-ee', 'boun-chem') THEN
      v_domain_comments := ARRAY[
        'PCB layout is clean; decoupling could be improved.',
        'Signal integrity looks solid, good use of differential pairs.',
        'Measurement setup was well calibrated, repeatable results.',
        'Power budget analysis is thorough and realistic.',
        'Oscilloscope captures support the claimed performance well.'
      ];
    ELSIF v_sem.tenant_code IN ('tedu-ce', 'boun-cmpe') THEN
      v_domain_comments := ARRAY[
        'Code architecture is modular and well-documented.',
        'Dataset split and evaluation metrics are appropriate.',
        'Latency benchmarks are convincing for the target platform.',
        'Good use of version control and CI/CD pipeline.',
        'Security considerations are addressed but could go deeper.'
      ];
    ELSIF v_sem.tenant_code = 'metu-me' THEN
      v_domain_comments := ARRAY[
        'FEA mesh convergence study adds credibility to results.',
        'Material selection is well justified for the load case.',
        'Manufacturing tolerance analysis shows practical thinking.',
        'Prototype demonstrates good alignment with simulation.',
        'Thermal boundary conditions are realistic and documented.'
      ];
    ELSE -- metu-ie
      v_domain_comments := ARRAY[
        'Sensitivity analysis covers the key decision variables.',
        'Simulation run length and warm-up are statistically justified.',
        'Constraint formulation captures real-world limitations well.',
        'Dashboard visualization makes the model output accessible.',
        'Comparison with baseline heuristic shows clear improvement.'
      ];
    END IF;

    v_poster_ts := v_sem.poster_date::timestamptz;
    v_has_editing := false;
    v_has_in_progress := false;
    v_first_submitted_juror := NULL;
    v_juror_idx := 0;

    -- Step 3: Iterate jurors — determine workflow state
    FOR v_juror IN
      SELECT jsa.juror_id
      FROM juror_semester_auth jsa
      WHERE jsa.semester_id = v_sem.id
      ORDER BY jsa.juror_id
    LOOP
      v_juror_idx := v_juror_idx + 1;

      v_bucket := abs(hashtext(v_juror.juror_id::text || v_sem.id::text)) % 100;
      IF v_bucket <= 2 THEN
        v_status := 'not_started';
      ELSIF v_bucket <= 6 THEN
        v_status := 'in_progress';
        v_has_in_progress := true;
      ELSIF v_bucket = 7 THEN
        v_status := 'editing';
        v_has_editing := true;
      ELSIF v_bucket <= 12 THEN
        v_status := 'submitted';
        IF v_first_submitted_juror IS NULL THEN
          v_first_submitted_juror := v_juror.juror_id;
        END IF;
      ELSE
        v_status := 'completed';
      END IF;

      -- Record raw state in effective-state table
      INSERT INTO _seed_effective_state (juror_id, semester_id, effective_status)
      VALUES (v_juror.juror_id, v_sem.id, v_status)
      ON CONFLICT (juror_id, semester_id) DO UPDATE SET effective_status = EXCLUDED.effective_status;

      -- not_started: leave all score rows untouched
      IF v_status = 'not_started' THEN
        CONTINUE;
      END IF;

      -- Step 4: Determine row completeness pattern
      v_incomplete_proj := NULL;
      v_untouched_proj := NULL;
      IF v_status = 'in_progress' THEN
        -- 50/50 coin flip: partial row vs untouched row
        v_coin := random();
        IF v_coin < 0.50 THEN
          -- Leave one project partial (some keys omitted)
          SELECT id INTO v_incomplete_proj
          FROM projects WHERE semester_id = v_sem.id
          ORDER BY random() LIMIT 1;
        ELSE
          -- Leave one project untouched (NULL criteria_scores)
          SELECT id INTO v_untouched_proj
          FROM projects WHERE semester_id = v_sem.id
          ORDER BY random() LIMIT 1;
        END IF;
        -- Optionally leave a second project untouched if many projects
        SELECT count(*) INTO v_proj_count FROM projects WHERE semester_id = v_sem.id;
        IF v_proj_count > 8 AND random() < 0.40 THEN
          SELECT id INTO v_untouched_proj
          FROM projects WHERE semester_id = v_sem.id
            AND id IS DISTINCT FROM v_incomplete_proj
            AND id IS DISTINCT FROM v_untouched_proj
          ORDER BY random() LIMIT 1;
        END IF;
      END IF;

      -- Juror-level strictness variance
      v_juror_offset := (hashtext(v_juror.juror_id::text) % 9 - 4) * 0.01;

      -- Timestamp distribution
      v_start_min      := floor(random() * 90)::int;
      v_per_proj_min   := 8 + floor(random() * 7)::int;
      v_cumulative_min := 0;
      v_max_updated_at := NULL;

      -- Step 5: Generate scores per project
      FOR v_proj IN
        SELECT id, group_no
        FROM projects
        WHERE semester_id = v_sem.id
        ORDER BY group_no
      LOOP
        -- Skip untouched projects for in_progress jurors
        IF v_status = 'in_progress' AND v_proj.id = v_untouched_proj THEN
          CONTINUE;
        END IF;

        -- Effective floor with outlier adjustments
        v_eff_floor := v_floor + v_juror_offset;
        IF v_sem.is_current AND v_proj.group_no = 1 THEN
          v_eff_floor := LEAST(v_eff_floor + 0.15, 0.90);
        ELSIF v_sem.is_current AND v_proj.group_no = 2 THEN
          IF v_juror_idx % 2 = 0 THEN
            v_eff_floor := GREATEST(v_eff_floor - 0.10, 0.40);
          ELSE
            v_eff_floor := LEAST(v_eff_floor + 0.10, 0.90);
          END IF;
        END IF;

        -- Score generation with retry loop (fully scored rows only target [70%, 100%])
        FOR v_attempt IN 1..15 LOOP
          v_cs := '{}'::jsonb;
          v_sum := 0;
          FOR v_crit IN SELECT * FROM jsonb_array_elements(v_template) LOOP
            v_key := v_crit->>'key';
            v_max := (v_crit->>'max')::int;

            -- Per-tenant criterion-level bias
            v_bias := CASE
              -- Bias keys match across semester template variants
              WHEN v_sem.tenant_code = 'tedu-ee' AND v_key IN ('written','poster_quality')  THEN -0.06
              WHEN v_sem.tenant_code = 'tedu-ee' AND v_key IN ('technical','circuit_design','research_depth') THEN 0.05
              WHEN v_sem.tenant_code = 'tedu-ce' AND v_key IN ('code_compliance','standards_knowledge') THEN -0.05
              WHEN v_sem.tenant_code = 'tedu-ce' AND v_key IN ('fieldwork','site_work')     THEN  0.04
              WHEN v_sem.tenant_code = 'boun-chem' AND v_key IN ('hseq','safety_review')    THEN -0.07
              WHEN v_sem.tenant_code = 'boun-chem' AND v_key IN ('technical_comm','comm_skills') THEN -0.05
              WHEN v_sem.tenant_code = 'boun-chem' AND v_key IN ('process_design','reaction_engineering') THEN 0.06
              WHEN v_sem.tenant_code = 'boun-cmpe' AND v_key IN ('collab','collaboration')  THEN  0.03
              WHEN v_sem.tenant_code = 'metu-me' AND v_key IN ('engineering_merit','cad_cam_design','analytical_modeling') THEN 0.06
              WHEN v_sem.tenant_code = 'metu-me' AND v_key IN ('comm_effectiveness','poster_oral') THEN -0.05
              WHEN v_sem.tenant_code = 'metu-ie' AND v_key IN ('documentation','final_report','tech_memo') THEN 0.05
              WHEN v_sem.tenant_code = 'metu-ie' AND v_key IN ('methodology','optimization_model','lit_and_method') THEN -0.04
              ELSE 0.0
            END;

            v_crit_floor := GREATEST(0.30, LEAST(0.95, v_eff_floor + v_bias));
            v_val := floor(v_crit_floor * v_max + random() * ((1.0 - v_crit_floor) * v_max))::int;
            IF v_val > v_max THEN v_val := v_max; END IF;
            IF v_val < 0 THEN v_val := 0; END IF;
            v_cs := v_cs || jsonb_build_object(v_key, v_val);
            v_sum := v_sum + v_val;
          END LOOP;

          -- For partial rows, no retry constraint needed
          IF v_status = 'in_progress' AND v_proj.id = v_incomplete_proj THEN
            EXIT;
          END IF;
          EXIT WHEN v_sum >= v_target_min AND v_sum <= v_target_max;
        END LOOP;

        -- Fallback rescaling for fully scored rows still out of range
        IF NOT (v_status = 'in_progress' AND v_proj.id = v_incomplete_proj)
           AND (v_sum < v_target_min OR v_sum > v_target_max)
        THEN
          v_cs_temp := v_cs;
          v_sum_temp := v_sum;
          v_rescale_target := floor(0.85 * v_max_total)::int;
          v_cs := '{}'::jsonb;
          v_sum := 0;
          FOR v_crit IN SELECT * FROM jsonb_array_elements(v_template) LOOP
            v_key := v_crit->>'key';
            v_max := (v_crit->>'max')::int;
            v_val := LEAST(
              round((v_cs_temp->>v_key)::int::float * v_rescale_target::float
                    / GREATEST(v_sum_temp, 1)::float)::int,
              v_max);
            IF v_val < 0 THEN v_val := 0; END IF;
            v_cs := v_cs || jsonb_build_object(v_key, v_val);
            v_sum := v_sum + v_val;
          END LOOP;
        END IF;

        -- Handle partial scoring for in_progress juror's incomplete project
        IF v_status = 'in_progress' AND v_proj.id = v_incomplete_proj THEN
          v_all_keys := ARRAY(SELECT jsonb_object_keys(v_cs));
          IF array_length(v_all_keys, 1) > 2 THEN
            v_remove_idx1 := 1 + floor(random() * array_length(v_all_keys, 1))::int;
            LOOP
              v_remove_idx2 := 1 + floor(random() * array_length(v_all_keys, 1))::int;
              EXIT WHEN v_remove_idx2 <> v_remove_idx1;
            END LOOP;
            v_cs := v_cs - v_all_keys[v_remove_idx1] - v_all_keys[v_remove_idx2];
          ELSIF array_length(v_all_keys, 1) = 2 THEN
            v_remove_idx1 := 1 + floor(random() * 2)::int;
            v_cs := v_cs - v_all_keys[v_remove_idx1];
          END IF;
        END IF;

        -- Step 6: Comment with score consistency
        v_comment := NULL;
        IF random() < 0.30 THEN
          v_score_pct := v_sum::float / GREATEST(v_max_total, 1)::float;
          v_comment_roll := random();
          IF v_score_pct > 0.85 THEN
            -- High score: positive or neutral or domain
            IF v_comment_roll < 0.50 THEN
              v_comment := v_positive_comments[1 + floor(random() * array_length(v_positive_comments, 1))::int];
            ELSIF v_comment_roll < 0.80 THEN
              v_comment := v_neutral_comments[1 + floor(random() * array_length(v_neutral_comments, 1))::int];
            ELSE
              v_comment := v_domain_comments[1 + floor(random() * array_length(v_domain_comments, 1))::int];
            END IF;
          ELSIF v_score_pct < 0.65 THEN
            -- Low score: constructive or neutral or domain
            IF v_comment_roll < 0.50 THEN
              v_comment := v_constructive_comments[1 + floor(random() * array_length(v_constructive_comments, 1))::int];
            ELSIF v_comment_roll < 0.80 THEN
              v_comment := v_neutral_comments[1 + floor(random() * array_length(v_neutral_comments, 1))::int];
            ELSE
              v_comment := v_domain_comments[1 + floor(random() * array_length(v_domain_comments, 1))::int];
            END IF;
          ELSE
            -- Mid score: neutral or domain or positive or constructive
            IF v_comment_roll < 0.40 THEN
              v_comment := v_neutral_comments[1 + floor(random() * array_length(v_neutral_comments, 1))::int];
            ELSIF v_comment_roll < 0.70 THEN
              v_comment := v_domain_comments[1 + floor(random() * array_length(v_domain_comments, 1))::int];
            ELSIF v_comment_roll < 0.85 THEN
              v_comment := v_positive_comments[1 + floor(random() * array_length(v_positive_comments, 1))::int];
            ELSE
              v_comment := v_constructive_comments[1 + floor(random() * array_length(v_constructive_comments, 1))::int];
            END IF;
          END IF;
        END IF;

        -- Step 7: Timestamps (poster-day timeline)
        v_cumulative_min := v_cumulative_min + v_per_proj_min + floor(random() * 6)::int;
        v_offset_sec := floor(random() * 60)::int;
        v_updated_at := v_poster_ts
          + interval '13 hours'
          + make_interval(mins => v_start_min + v_cumulative_min, secs => v_offset_sec);

        IF v_updated_at > v_poster_ts + interval '17 hours 30 minutes' THEN
          v_updated_at := v_poster_ts + interval '17 hours'
            + make_interval(secs => floor(random() * 1800)::int);
        END IF;

        v_created_at := v_updated_at - make_interval(mins => 1 + floor(random() * 10)::int);
        IF v_created_at < v_poster_ts + interval '13 hours' THEN
          v_created_at := v_poster_ts + interval '13 hours';
        END IF;

        IF v_max_updated_at IS NULL OR v_updated_at > v_max_updated_at THEN
          v_max_updated_at := v_updated_at;
        END IF;

        -- Update the pre-created score row
        UPDATE scores SET
          criteria_scores = v_cs,
          comment = v_comment,
          created_at = v_created_at,
          updated_at = v_updated_at,
          final_submitted_at = NULL
        WHERE semester_id = v_sem.id
          AND project_id = v_proj.id
          AND juror_id = v_juror.juror_id;

      END LOOP; -- projects

      -- Step 8: Set workflow markers
      IF v_status = 'completed' AND v_max_updated_at IS NOT NULL THEN
        v_final_at := v_max_updated_at + make_interval(mins => 20 + floor(random() * 21)::int);
        UPDATE scores SET final_submitted_at = v_final_at
        WHERE semester_id = v_sem.id AND juror_id = v_juror.juror_id;
      END IF;

      IF v_max_updated_at IS NOT NULL THEN
        UPDATE juror_semester_auth SET
          last_seen_at = v_max_updated_at + make_interval(mins => 3 + floor(random() * 21)::int)
        WHERE semester_id = v_sem.id AND juror_id = v_juror.juror_id;
      END IF;

      IF v_status = 'editing' THEN
        UPDATE juror_semester_auth SET edit_enabled = true
        WHERE semester_id = v_sem.id AND juror_id = v_juror.juror_id;
      END IF;

    END LOOP; -- jurors

    -- Step 9: Active-semester guarantees
    -- Editing guarantee
    IF v_sem.is_current AND NOT v_has_editing AND v_first_submitted_juror IS NOT NULL THEN
      UPDATE juror_semester_auth SET edit_enabled = true
      WHERE semester_id = v_sem.id AND juror_id = v_first_submitted_juror;
      UPDATE _seed_effective_state SET effective_status = 'editing'
      WHERE semester_id = v_sem.id AND juror_id = v_first_submitted_juror;
      v_has_editing := true;
    END IF;

    -- In-progress guarantee (best-effort)
    IF v_sem.is_current AND NOT v_has_in_progress THEN
      DECLARE
        v_ip_juror uuid;
        v_ip_proj uuid;
        v_ip_keys text[];
      BEGIN
        -- Find a submitted juror to force-promote
        SELECT jsa.juror_id INTO v_ip_juror
        FROM juror_semester_auth jsa
        JOIN _seed_effective_state es ON es.juror_id = jsa.juror_id AND es.semester_id = jsa.semester_id
        WHERE jsa.semester_id = v_sem.id
          AND es.effective_status = 'submitted'
          AND jsa.juror_id IS DISTINCT FROM v_first_submitted_juror
        ORDER BY jsa.juror_id LIMIT 1;

        IF v_ip_juror IS NOT NULL THEN
          -- Pick one of their scored projects and null out 2 keys
          SELECT sc.project_id INTO v_ip_proj
          FROM scores sc
          WHERE sc.semester_id = v_sem.id AND sc.juror_id = v_ip_juror
            AND sc.criteria_scores IS NOT NULL
          ORDER BY random() LIMIT 1;

          IF v_ip_proj IS NOT NULL THEN
            v_ip_keys := ARRAY(
              SELECT jsonb_object_keys(sc.criteria_scores)
              FROM scores sc
              WHERE sc.semester_id = v_sem.id AND sc.juror_id = v_ip_juror AND sc.project_id = v_ip_proj
            );
            IF array_length(v_ip_keys, 1) > 2 THEN
              v_remove_idx1 := 1 + floor(random() * array_length(v_ip_keys, 1))::int;
              LOOP
                v_remove_idx2 := 1 + floor(random() * array_length(v_ip_keys, 1))::int;
                EXIT WHEN v_remove_idx2 <> v_remove_idx1;
              END LOOP;
              UPDATE scores SET
                criteria_scores = criteria_scores - v_ip_keys[v_remove_idx1] - v_ip_keys[v_remove_idx2],
                final_submitted_at = NULL
              WHERE semester_id = v_sem.id AND juror_id = v_ip_juror AND project_id = v_ip_proj;
            END IF;

            -- Clear any final_submitted_at on all their rows
            UPDATE scores SET final_submitted_at = NULL
            WHERE semester_id = v_sem.id AND juror_id = v_ip_juror;

            UPDATE _seed_effective_state SET effective_status = 'in_progress'
            WHERE semester_id = v_sem.id AND juror_id = v_ip_juror;
          END IF;
        END IF;
      END;
    END IF;

  END LOOP; -- semesters

  -- Step 10: Defensive cleanup
  WITH completed_jurors AS (
    SELECT sc.semester_id, sc.juror_id
    FROM scores sc
    WHERE sc.final_submitted_at IS NOT NULL
    GROUP BY sc.semester_id, sc.juror_id
  )
  UPDATE juror_semester_auth a SET edit_enabled = false
  FROM completed_jurors cj
  WHERE a.semester_id = cj.semester_id
    AND a.juror_id = cj.juror_id
    AND a.edit_enabled = true;

  -- Step 11: Re-enable trigger
  ALTER TABLE scores ENABLE TRIGGER trg_scores_updated_at;
END;
$$;

-- ── Section 10: Audit logs (tenant-aware, 4 phases) ─────────

-- Phase 1 — Preparation

-- juror_create: global, use super-admin as actor
INSERT INTO audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata, tenant_id)
SELECT
  (SELECT MIN(poster_date)::timestamptz FROM semesters)
    - interval '30 days'
    + (random() * interval '10 days')
    + (row_number() OVER (ORDER BY j.id) * interval '2 seconds'),
  'admin', '88265507-a25d-4cc0-ba22-d57151802bfc'::uuid,
  'juror_create', 'juror', j.id,
  format('Admin created juror %s.', j.juror_name),
  NULL,
  NULL
FROM jurors j;

-- semester_create: tenant-scoped, use tenant admin as actor
INSERT INTO audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata, tenant_id)
SELECT
  s.poster_date::timestamptz - interval '45 days' + (random() * interval '6 hours')
    + (row_number() OVER (ORDER BY s.poster_date) * interval '1 second'),
  'admin',
  CASE t.code
    WHEN 'tedu-ee' THEN 'ba34acd9-678b-4a40-bf86-cdf96b773cc7'::uuid
    WHEN 'tedu-ce' THEN '0ad71a4f-a424-4d68-8f37-d72df1f176a1'::uuid
    WHEN 'boun-chem' THEN '97741fa5-430e-4421-85c1-8582e299ce97'::uuid
    WHEN 'boun-cmpe' THEN '73d0a0bd-c1c1-4ba8-9e6c-bacc119b20da'::uuid
    WHEN 'metu-me' THEN 'bba141f5-49df-486c-b42a-dc7f7dc51263'::uuid
    WHEN 'metu-ie' THEN 'f688fc98-c5a7-4888-b47d-3e4cafc5b5ba'::uuid
  END,
  'semester_create', 'semester', s.id,
  format('Admin created semester %s.', s.semester_name),
  jsonb_build_object('poster_date', s.poster_date),
  s.tenant_id
FROM semesters s
JOIN tenants t ON t.id = s.tenant_id;

-- project_create: per project, tenant-scoped
INSERT INTO audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata, tenant_id)
SELECT
  s.poster_date::timestamptz - interval '14 days' + (random() * interval '4 days')
    + (row_number() OVER (PARTITION BY p.semester_id ORDER BY p.group_no) * interval '3 seconds'),
  'admin',
  CASE t.code
    WHEN 'tedu-ee' THEN 'ba34acd9-678b-4a40-bf86-cdf96b773cc7'::uuid
    WHEN 'tedu-ce' THEN '0ad71a4f-a424-4d68-8f37-d72df1f176a1'::uuid
    WHEN 'boun-chem' THEN '97741fa5-430e-4421-85c1-8582e299ce97'::uuid
    WHEN 'boun-cmpe' THEN '73d0a0bd-c1c1-4ba8-9e6c-bacc119b20da'::uuid
    WHEN 'metu-me' THEN 'bba141f5-49df-486c-b42a-dc7f7dc51263'::uuid
    WHEN 'metu-ie' THEN 'f688fc98-c5a7-4888-b47d-3e4cafc5b5ba'::uuid
  END,
  'project_create', 'project', p.id,
  format('Admin created project Group %s — %s.', p.group_no, p.project_title),
  jsonb_build_object('semester_id', p.semester_id, 'group_no', p.group_no),
  s.tenant_id
FROM projects p
JOIN semesters s ON s.id = p.semester_id
JOIN tenants t ON t.id = s.tenant_id;

-- set_active_semester: active semesters only
INSERT INTO audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata, tenant_id)
SELECT
  s.poster_date::timestamptz - interval '10 days' + (random() * interval '3 hours'),
  'admin',
  CASE t.code
    WHEN 'tedu-ee' THEN 'ba34acd9-678b-4a40-bf86-cdf96b773cc7'::uuid
    WHEN 'tedu-ce' THEN '0ad71a4f-a424-4d68-8f37-d72df1f176a1'::uuid
    WHEN 'boun-chem' THEN '97741fa5-430e-4421-85c1-8582e299ce97'::uuid
    WHEN 'boun-cmpe' THEN '73d0a0bd-c1c1-4ba8-9e6c-bacc119b20da'::uuid
    WHEN 'metu-me' THEN 'bba141f5-49df-486c-b42a-dc7f7dc51263'::uuid
    WHEN 'metu-ie' THEN 'f688fc98-c5a7-4888-b47d-3e4cafc5b5ba'::uuid
  END,
  'set_active_semester', 'semester', s.id,
  format('Admin set active semester to %s.', s.semester_name),
  jsonb_build_object('semester_id', s.id, 'semester_name', s.semester_name),
  s.tenant_id
FROM semesters s
JOIN tenants t ON t.id = s.tenant_id
WHERE s.is_current = true;

-- eval_lock_toggle: active semesters
INSERT INTO audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata, tenant_id)
SELECT
  s.poster_date::timestamptz - interval '8 days' + (random() * interval '3 hours'),
  'admin',
  CASE t.code
    WHEN 'tedu-ee' THEN 'ba34acd9-678b-4a40-bf86-cdf96b773cc7'::uuid
    WHEN 'tedu-ce' THEN '0ad71a4f-a424-4d68-8f37-d72df1f176a1'::uuid
    WHEN 'boun-chem' THEN '97741fa5-430e-4421-85c1-8582e299ce97'::uuid
    WHEN 'boun-cmpe' THEN '73d0a0bd-c1c1-4ba8-9e6c-bacc119b20da'::uuid
    WHEN 'metu-me' THEN 'bba141f5-49df-486c-b42a-dc7f7dc51263'::uuid
    WHEN 'metu-ie' THEN 'f688fc98-c5a7-4888-b47d-3e4cafc5b5ba'::uuid
  END,
  'eval_lock_toggle', 'semester', s.id,
  format('Admin turned evaluation lock ON (%s).', s.semester_name),
  jsonb_build_object('semester_id', s.id, 'enabled', true),
  s.tenant_id
FROM semesters s
JOIN tenants t ON t.id = s.tenant_id
WHERE s.is_current = true;

-- entry_token_generate: semesters with tokens
INSERT INTO audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata, tenant_id)
SELECT
  s.entry_token_created_at + interval '1 second',
  'admin',
  CASE t.code
    WHEN 'tedu-ee' THEN 'ba34acd9-678b-4a40-bf86-cdf96b773cc7'::uuid
    WHEN 'tedu-ce' THEN '0ad71a4f-a424-4d68-8f37-d72df1f176a1'::uuid
    WHEN 'boun-chem' THEN '97741fa5-430e-4421-85c1-8582e299ce97'::uuid
    WHEN 'boun-cmpe' THEN '73d0a0bd-c1c1-4ba8-9e6c-bacc119b20da'::uuid
    WHEN 'metu-me' THEN 'bba141f5-49df-486c-b42a-dc7f7dc51263'::uuid
    WHEN 'metu-ie' THEN 'f688fc98-c5a7-4888-b47d-3e4cafc5b5ba'::uuid
  END,
  'entry_token_generate', 'semester', s.id,
  format('Jury entry token generated (%s).', s.semester_name),
  jsonb_build_object('semester_id', s.id),
  s.tenant_id
FROM semesters s
JOIN tenants t ON t.id = s.tenant_id
WHERE s.entry_token_hash IS NOT NULL;

-- Phase 2 — Evaluation (poster day 13:00-17:30)

-- juror_group_started: per scored project
INSERT INTO audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata, tenant_id)
SELECT
  GREATEST(
    sc.created_at - interval '2 minutes' - (random() * interval '3 minutes'),
    sc.poster_date::timestamptz + interval '13 hours'
  ) + (row_number() OVER (ORDER BY sc.created_at) * interval '1 second'),
  'juror', sc.juror_id, 'juror_group_started', 'project', sc.project_id,
  format('Juror %s started evaluating Group %s.', j.juror_name, p.group_no),
  jsonb_build_object('semester_id', sc.semester_id, 'group_no', p.group_no,
                     'project_title', p.project_title),
  s.tenant_id
FROM scores sc
JOIN jurors j ON j.id = sc.juror_id
JOIN projects p ON p.id = sc.project_id
JOIN semesters s ON s.id = sc.semester_id
WHERE sc.criteria_scores IS NOT NULL
  AND sc.criteria_scores <> '{}'::jsonb;

-- juror_group_completed: fully-scored projects only
INSERT INTO audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata, tenant_id)
SELECT
  sc.updated_at - (random() * interval '1 minute')
    + (row_number() OVER (ORDER BY sc.updated_at) * interval '1 second'),
  'juror', sc.juror_id, 'juror_group_completed', 'project', sc.project_id,
  format('Juror %s completed evaluation for Group %s.', j.juror_name, p.group_no),
  jsonb_build_object('semester_id', sc.semester_id, 'group_no', p.group_no,
                     'project_title', p.project_title),
  s.tenant_id
FROM scores sc
JOIN jurors j ON j.id = sc.juror_id
JOIN projects p ON p.id = sc.project_id
JOIN semesters s ON s.id = sc.semester_id
WHERE sc.criteria_scores IS NOT NULL
  AND sc.criteria_scores <> '{}'::jsonb
  AND (SELECT count(*)::int FROM jsonb_object_keys(sc.criteria_scores))
      = jsonb_array_length(s.criteria_template);

-- Phase 3 — Completion

INSERT INTO audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata, tenant_id)
SELECT
  MAX(sc.updated_at) + interval '1 minute'
    + (row_number() OVER (ORDER BY sc.semester_id, sc.juror_id) * interval '1 second'),
  'juror', sc.juror_id, 'juror_all_completed', 'semester', sc.semester_id,
  format('Juror %s completed all project evaluations.', j.juror_name),
  jsonb_build_object('semester_id', sc.semester_id),
  s.tenant_id
FROM scores sc
JOIN jurors j ON j.id = sc.juror_id
JOIN semesters s ON s.id = sc.semester_id
WHERE sc.criteria_scores IS NOT NULL
  AND sc.criteria_scores <> '{}'::jsonb
  AND (SELECT count(*)::int FROM jsonb_object_keys(sc.criteria_scores))
      = jsonb_array_length(s.criteria_template)
GROUP BY sc.semester_id, sc.juror_id, j.juror_name, s.tenant_id
HAVING COUNT(*) = (SELECT COUNT(*) FROM projects WHERE semester_id = sc.semester_id);

-- Phase 4 — Submission

INSERT INTO audit_logs
  (created_at, actor_type, actor_id, action, entity_type, entity_id, message, metadata, tenant_id)
SELECT
  MAX(sc.final_submitted_at) + interval '1 minute'
    + (row_number() OVER (ORDER BY sc.semester_id, sc.juror_id) * interval '1 second'),
  'juror', sc.juror_id, 'juror_finalize_submission', 'semester', sc.semester_id,
  format('Juror %s finalized submission.', j.juror_name),
  jsonb_build_object('semester_id', sc.semester_id),
  s.tenant_id
FROM scores sc
JOIN jurors j ON j.id = sc.juror_id
JOIN semesters s ON s.id = sc.semester_id
WHERE sc.final_submitted_at IS NOT NULL
GROUP BY sc.semester_id, sc.juror_id, j.juror_name, s.tenant_id
HAVING COUNT(*) = (SELECT COUNT(*) FROM projects WHERE semester_id = sc.semester_id);

-- ── Section 11: Sanity checks ───────────────────────────────

DO $$
DECLARE
  v_count int;
BEGIN
  -- 1. No duplicate semester names within a tenant
  SELECT count(*) INTO v_count FROM (
    SELECT tenant_id, lower(trim(semester_name)), count(*)
    FROM semesters GROUP BY 1, 2 HAVING count(*) > 1
  ) x;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 1 failed: % duplicate semester names within tenants', v_count;
  END IF;

  -- 2. No impossible timestamps (updated_at < created_at)
  SELECT count(*) INTO v_count FROM scores
  WHERE criteria_scores IS NOT NULL AND updated_at < created_at;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 2 failed: % score rows with updated_at < created_at', v_count;
  END IF;

  -- 3. No impossible submission timestamps
  SELECT count(*) INTO v_count FROM (
    SELECT semester_id, juror_id
    FROM scores
    WHERE final_submitted_at IS NOT NULL
    GROUP BY semester_id, juror_id
    HAVING MAX(final_submitted_at) < MAX(updated_at)
  ) x;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 3 failed: % juror-semesters with final_submitted_at before last scoring', v_count;
  END IF;

  -- 4. Poster-day clustering (scored activity 13:00-17:30)
  SELECT count(*) INTO v_count FROM scores s
  JOIN semesters sem ON sem.id = s.semester_id
  WHERE s.criteria_scores IS NOT NULL
    AND (s.updated_at < sem.poster_date::timestamptz + interval '13 hours'
      OR s.updated_at > sem.poster_date::timestamptz + interval '17 hours 30 minutes');
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 4 failed: % score rows outside poster-day 13:00-17:30 window', v_count;
  END IF;

  -- 5a. No over-keyed scored rows
  SELECT count(*) INTO v_count FROM scores s
  JOIN semesters sem ON sem.id = s.semester_id
  WHERE s.criteria_scores IS NOT NULL
    AND s.criteria_scores <> '{}'::jsonb
    AND (SELECT count(*)::int FROM jsonb_object_keys(s.criteria_scores))
        > jsonb_array_length(sem.criteria_template);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 5a failed: % score rows with more keys than template', v_count;
  END IF;

  -- 5b. Under-keyed rows valid only for true in_progress jurors
  SELECT count(*) INTO v_count FROM scores s
  JOIN semesters sem ON sem.id = s.semester_id
  LEFT JOIN juror_semester_auth jsa
    ON jsa.semester_id = s.semester_id AND jsa.juror_id = s.juror_id
  WHERE s.criteria_scores IS NOT NULL
    AND s.criteria_scores <> '{}'::jsonb
    AND (SELECT count(*)::int FROM jsonb_object_keys(s.criteria_scores))
        < jsonb_array_length(sem.criteria_template)
    AND NOT (
      COALESCE(jsa.edit_enabled, false) = false
      AND NOT EXISTS (
        SELECT 1 FROM scores s2
        WHERE s2.semester_id = s.semester_id AND s2.juror_id = s.juror_id
          AND s2.final_submitted_at IS NOT NULL
      )
    );
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 5b failed: % under-keyed rows on non-in_progress jurors', v_count;
  END IF;

  -- 6. Entry token consistency
  SELECT count(*) INTO v_count FROM semesters
  WHERE entry_token_enabled = true
    AND (entry_token_hash IS NULL OR entry_token_created_at IS NULL);
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 6 failed: % enabled tokens missing hash or created_at', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM semesters
  WHERE entry_token_hash IS NOT NULL AND entry_token_created_at IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 6b failed: % tokens with hash but no created_at', v_count;
  END IF;

  -- 7. No negative scores
  SELECT count(*) INTO v_count FROM (
    SELECT s.id
    FROM scores s, jsonb_each_text(s.criteria_scores) AS kv
    WHERE s.criteria_scores IS NOT NULL
      AND s.criteria_scores <> '{}'::jsonb
      AND kv.value::int < 0
  ) x;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 7 failed: % score rows with negative criterion values', v_count;
  END IF;

  -- 8. Workflow-state consistency (reads from _seed_effective_state temp table)

  -- 8a. not_started must have no filled score data
  SELECT count(*) INTO v_count
  FROM _seed_effective_state es
  JOIN scores sc ON sc.juror_id = es.juror_id AND sc.semester_id = es.semester_id
  WHERE es.effective_status = 'not_started'
    AND sc.criteria_scores IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 8a failed: % not_started rows with non-NULL criteria_scores', v_count;
  END IF;

  -- 8b. in_progress must NOT have all rows fully complete
  SELECT count(*) INTO v_count FROM (
    SELECT es.juror_id, es.semester_id
    FROM _seed_effective_state es
    WHERE es.effective_status = 'in_progress'
      AND NOT EXISTS (
        -- Must have at least one row that is partial or untouched
        SELECT 1 FROM scores sc
        JOIN semesters sem ON sem.id = sc.semester_id
        WHERE sc.juror_id = es.juror_id AND sc.semester_id = es.semester_id
          AND (sc.criteria_scores IS NULL
            OR (SELECT count(*)::int FROM jsonb_object_keys(sc.criteria_scores))
               < jsonb_array_length(sem.criteria_template))
      )
  ) x;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 8b failed: % in_progress jurors with all rows fully complete', v_count;
  END IF;

  -- 8c. in_progress must not have final_submitted_at
  SELECT count(*) INTO v_count
  FROM _seed_effective_state es
  JOIN scores sc ON sc.juror_id = es.juror_id AND sc.semester_id = es.semester_id
  WHERE es.effective_status = 'in_progress'
    AND sc.final_submitted_at IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 8c failed: % in_progress rows with final_submitted_at', v_count;
  END IF;

  -- 8d. editing must not have final_submitted_at
  SELECT count(*) INTO v_count
  FROM _seed_effective_state es
  JOIN scores sc ON sc.juror_id = es.juror_id AND sc.semester_id = es.semester_id
  WHERE es.effective_status = 'editing'
    AND sc.final_submitted_at IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 8d failed: % editing rows with final_submitted_at', v_count;
  END IF;

  -- 8e. editing must have edit_enabled = true
  SELECT count(*) INTO v_count
  FROM _seed_effective_state es
  JOIN juror_semester_auth jsa ON jsa.juror_id = es.juror_id AND jsa.semester_id = es.semester_id
  WHERE es.effective_status = 'editing'
    AND COALESCE(jsa.edit_enabled, false) = false;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 8e failed: % editing jurors with edit_enabled = false', v_count;
  END IF;

  -- 8f. submitted must have no incomplete or untouched rows
  SELECT count(*) INTO v_count
  FROM _seed_effective_state es
  JOIN scores sc ON sc.juror_id = es.juror_id AND sc.semester_id = es.semester_id
  JOIN semesters sem ON sem.id = sc.semester_id
  WHERE es.effective_status = 'submitted'
    AND (sc.criteria_scores IS NULL
      OR (SELECT count(*)::int FROM jsonb_object_keys(sc.criteria_scores))
         < jsonb_array_length(sem.criteria_template));
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 8f failed: % submitted rows with incomplete criteria', v_count;
  END IF;

  -- 8g. submitted must not have final_submitted_at
  SELECT count(*) INTO v_count
  FROM _seed_effective_state es
  JOIN scores sc ON sc.juror_id = es.juror_id AND sc.semester_id = es.semester_id
  WHERE es.effective_status = 'submitted'
    AND sc.final_submitted_at IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 8g failed: % submitted rows with final_submitted_at', v_count;
  END IF;

  -- 8h. completed must have no incomplete or untouched rows
  SELECT count(*) INTO v_count
  FROM _seed_effective_state es
  JOIN scores sc ON sc.juror_id = es.juror_id AND sc.semester_id = es.semester_id
  JOIN semesters sem ON sem.id = sc.semester_id
  WHERE es.effective_status = 'completed'
    AND (sc.criteria_scores IS NULL
      OR (SELECT count(*)::int FROM jsonb_object_keys(sc.criteria_scores))
         < jsonb_array_length(sem.criteria_template));
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 8h failed: % completed rows with incomplete criteria', v_count;
  END IF;

  -- 8i. completed must have final_submitted_at on all rows
  SELECT count(*) INTO v_count
  FROM _seed_effective_state es
  JOIN scores sc ON sc.juror_id = es.juror_id AND sc.semester_id = es.semester_id
  WHERE es.effective_status = 'completed'
    AND sc.final_submitted_at IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Sanity check 8i failed: % completed rows missing final_submitted_at', v_count;
  END IF;

  RAISE NOTICE 'All sanity checks passed.';
END;
$$;

-- Clean up temp table
DROP TABLE IF EXISTS _seed_effective_state;

COMMIT;
