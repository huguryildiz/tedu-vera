-- ── Criterion descriptions (blurbs) ─────────────────────────────────────────
-- Added post-insert: period_criteria.description was null for all rows.
-- Keyed by criterion key so updates apply across all periods uniformly.

-- EE / general academic
UPDATE period_criteria SET description = 'Assess how well the team defines the engineering problem, justifies design decisions with engineering reasoning, and demonstrates mastery of relevant tools and methods.'
  WHERE key = 'technical';

UPDATE period_criteria SET description = 'Evaluate the clarity, structure, and visual effectiveness of the poster and supporting materials.'
  WHERE key = 'design';

UPDATE period_criteria SET description = 'Evaluate how clearly the team presents the project and responds to jury questions, adapting their communication for both technical and non-technical audiences.'
  WHERE key = 'delivery';

UPDATE period_criteria SET description = 'Observe the level of active participation, knowledge distribution across team members, and professional conduct throughout the presentation.'
  WHERE key = 'teamwork';

-- CS-specific
UPDATE period_criteria SET description = 'Assess the team''s ability to identify, decompose, and solve computational or software engineering problems with clear reasoning and an appropriate methodology.'
  WHERE key = 'problem_solving';

UPDATE period_criteria SET description = 'Evaluate the quality of architectural decisions, component design, and the overall logical structure of the system.'
  WHERE key = 'system_design';

UPDATE period_criteria SET description = 'Judge the correctness, reliability, and craftsmanship of the implemented solution, including testing approach and code organisation.'
  WHERE key = 'implementation_quality';

UPDATE period_criteria SET description = 'Assess the clarity and completeness of technical documentation, diagrams, and written reports accompanying the project.'
  WHERE key = 'communication';

-- IEEE AP-S / RF engineering
UPDATE period_criteria SET description = 'Evaluate the technical depth, correctness, and engineering rigour of the antenna or RF system design.'
  WHERE key = 'technical_merit';

UPDATE period_criteria SET description = 'Assess the novelty and creative approach of the design concept relative to established methods in the field.'
  WHERE key = 'originality';

UPDATE period_criteria SET description = 'Evaluate how well the team demonstrates a practical use case and communicates the project''s real-world relevance and applicability.'
  WHERE key = 'application_and_presentation';

-- Technology competitions
UPDATE period_criteria SET description = 'Assess the originality of the concept and how inventively the team addresses the challenge constraints.'
  WHERE key = 'creativity';

UPDATE period_criteria SET description = 'Evaluate the rigour and reproducibility of the experimental methodology, data collection, and analysis.'
  WHERE key = 'scientific_method';

UPDATE period_criteria SET description = 'Evaluate the team''s ability to articulate the broader societal or technological impact of their work and present it convincingly.'
  WHERE key = 'impact_and_presentation';

UPDATE period_criteria SET description = 'Assess how effectively the team collaborates, divides responsibilities, and executes the project under competition conditions.'
  WHERE key = 'team_execution';

-- Aerospace / rocketry
UPDATE period_criteria SET description = 'Evaluate the quality and completeness of the preliminary design report, including requirements capture and early design choices.'
  WHERE key = 'preliminary_report';

UPDATE period_criteria SET description = 'Assess how thoroughly the critical design review documents design maturity, resolved risks, and the verification and validation approach.'
  WHERE key = 'critical_design';

UPDATE period_criteria SET description = 'Evaluate how well the final design meets competition requirements, dimensional constraints, and applicable safety standards.'
  WHERE key = 'design_compliance';

UPDATE period_criteria SET description = 'Assess the actual flight or test performance against the team''s declared objectives and design targets.'
  WHERE key = 'technical_performance';

UPDATE period_criteria SET description = 'Evaluate the quality of collected flight data, post-flight analysis depth, and completeness of supporting documentation.'
  WHERE key = 'data_and_documentation';

UPDATE period_criteria SET description = 'Assess the adequacy of safety measures, recovery system design, and the team''s demonstrated safety culture during operations.'
  WHERE key = 'safety_and_recovery';

UPDATE period_criteria SET description = 'Evaluate the execution of the mission profile including telemetry quality, real-time ground operations, and anomaly handling.'
  WHERE key = 'mission_execution';

-- ── Outcome descriptions ──────────────────────────────────────────────────────
-- Update framework_outcomes descriptions, then mirror to period_outcomes.

-- MÜDEK outcomes
UPDATE framework_outcomes SET description = 'Demonstrates sufficient depth in mathematics, physical sciences, and engineering fundamentals necessary to analyse and solve problems in the discipline.'
  WHERE code = '1.2';
UPDATE framework_outcomes SET description = 'Identifies, formulates, and solves complex engineering problems by applying principles of mathematics, science, and engineering with sound reasoning.'
  WHERE code = '2';
UPDATE framework_outcomes SET description = 'Designs systems, components, or processes that meet specified performance requirements under realistic constraints such as cost, safety, reliability, and sustainability.'
  WHERE code = '3.1';
UPDATE framework_outcomes SET description = 'Applies modern engineering design methods and tools, including computational techniques and simulation, to address design challenges effectively.'
  WHERE code = '3.2';
UPDATE framework_outcomes SET description = 'Contributes effectively as a member of a team, fulfils assigned responsibilities, and collaborates towards shared project goals.'
  WHERE code = '8.1';
UPDATE framework_outcomes SET description = 'Works productively in teams that span multiple disciplines, adapting communication and technical language to diverse backgrounds.'
  WHERE code = '8.2';
UPDATE framework_outcomes SET description = 'Presents technical content clearly and confidently in oral form, responds to questions accurately, and engages the audience appropriately.'
  WHERE code = '9.1';
UPDATE framework_outcomes SET description = 'Produces well-structured written documents — reports, proposals, or documentation — that communicate technical content clearly and concisely.'
  WHERE code = '9.2';

-- ABET Student Outcomes
UPDATE framework_outcomes SET description = 'Demonstrates the ability to identify and analyse complex engineering problems, apply mathematical and scientific principles, and develop appropriate solutions.'
  WHERE code = 'SO-1';
UPDATE framework_outcomes SET description = 'Applies the engineering design process to produce solutions that meet specified needs while accounting for public health, safety, welfare, and global, cultural, social, environmental, and economic factors.'
  WHERE code = 'SO-2';
UPDATE framework_outcomes SET description = 'Communicates effectively with a range of audiences through written reports, oral presentations, and visual aids tailored to the context.'
  WHERE code = 'SO-3';
UPDATE framework_outcomes SET description = 'Recognises ethical and professional responsibilities in engineering situations, makes informed judgements, and considers the impact of decisions.'
  WHERE code = 'SO-4';
UPDATE framework_outcomes SET description = 'Functions effectively as a team member, contributes fairly to group work, and demonstrates interpersonal skills that support collaboration.'
  WHERE code = 'SO-5';
UPDATE framework_outcomes SET description = 'Conducts experiments, analyses and interprets data, and uses engineering judgement to draw valid conclusions.'
  WHERE code = 'SO-6';
UPDATE framework_outcomes SET description = 'Acquires new knowledge independently, adapts to changing technical contexts, and applies self-directed learning strategies throughout the project lifecycle.'
  WHERE code = 'SO-7';

-- CanSat / Aerospace competition outcomes (TC series)
UPDATE framework_outcomes SET description = 'Evaluates the completeness, clarity, and technical accuracy of the preliminary design and evaluation report submitted prior to the competition.'
  WHERE code = 'TC-1';
UPDATE framework_outcomes SET description = 'Assesses the maturity and soundness of the critical design review, including resolved risks, verification plan, and readiness for fabrication.'
  WHERE code = 'TC-2';
UPDATE framework_outcomes SET description = 'Evaluates the quality of the live demonstration or flight performance alongside the team''s ability to present and justify their design decisions to the jury.'
  WHERE code = 'TC-3';
UPDATE framework_outcomes SET description = 'Assesses the overall technical competency, problem-solving capability, and collaborative effectiveness demonstrated by the team throughout the competition.'
  WHERE code = 'TC-4';

-- TUBITAK 2204-A research outcomes (RC series)
UPDATE framework_outcomes SET description = 'Evaluates the degree of novelty, inventiveness, and creative thinking demonstrated in the research question and approach.'
  WHERE code = 'RC-1';
UPDATE framework_outcomes SET description = 'Assesses the rigour, reproducibility, and appropriateness of the experimental or analytical methodology employed in the research.'
  WHERE code = 'RC-2';
UPDATE framework_outcomes SET description = 'Evaluates the validity of conclusions drawn, quality of result interpretation, and soundness of recommendations for future work.'
  WHERE code = 'RC-3';
UPDATE framework_outcomes SET description = 'Assesses the practical relevance of the research output and the feasibility of applying the findings in a real-world context.'
  WHERE code = 'RC-4';
UPDATE framework_outcomes SET description = 'Evaluates the potential societal, scientific, or technological impact of the research and the team''s awareness of that impact.'
  WHERE code = 'RC-5';

-- TEKNOFEST / Design competition outcomes (DC series)
UPDATE framework_outcomes SET description = 'Evaluates the originality of the concept and the inventiveness with which the team addresses the competition challenge.'
  WHERE code = 'DC-1';
UPDATE framework_outcomes SET description = 'Assesses the technical depth, engineering soundness, and implementation quality of the submitted design or prototype.'
  WHERE code = 'DC-2';
UPDATE framework_outcomes SET description = 'Evaluates how well the design demonstrates a concrete, working application that solves a real or representative problem.'
  WHERE code = 'DC-3';
UPDATE framework_outcomes SET description = 'Assesses the learning outcomes achieved and the knowledge transfer value the project delivers to its target audience or domain.'
  WHERE code = 'DC-4';

-- CanSat competition mission outcomes (CS series)
UPDATE framework_outcomes SET description = 'Evaluates compliance with all physical and functional design constraints specified in the competition requirements.'
  WHERE code = 'CS-1';
UPDATE framework_outcomes SET description = 'Assesses the successful execution of the primary mission objective during the actual flight or field demonstration.'
  WHERE code = 'CS-2';
UPDATE framework_outcomes SET description = 'Evaluates the effectiveness and reliability of the descent control system and the completeness of the recovery procedure.'
  WHERE code = 'CS-3';
UPDATE framework_outcomes SET description = 'Assesses adherence to all competition safety rules and operational restrictions during launch preparation and flight operations.'
  WHERE code = 'CS-4';
UPDATE framework_outcomes SET description = 'Evaluates the creativity and technical ambition of the secondary mission concept and its execution relative to the primary mission.'
  WHERE code = 'CS-5';
UPDATE framework_outcomes SET description = 'Assesses the quality of telemetry data collected, depth of post-flight analysis, and completeness of competition documentation.'
  WHERE code = 'CS-6';

-- Mirror descriptions from framework_outcomes to period_outcomes
UPDATE period_outcomes po
SET description = fo.description
FROM framework_outcomes fo
WHERE po.code = fo.code AND fo.description IS NOT NULL;

COMMIT;