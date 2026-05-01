// src/shared/constants.js
// ============================================================
// Static evaluation constants — single source of truth for
// criteria definitions, MÜDEK outcomes, and UI config.
//
// Moved from src/config.js (Phase 4b — config.js elimination).
// APP_CONFIG, TOTAL_MAX, and getCriterionById are intentionally
// NOT exported here; they were derived helpers with no remaining
// consumers after Phase 4b.
// ============================================================

// ── Criteria / Rubric editor UI text ──────────────────────────
export const RUBRIC_EDITOR_TEXT = {
  criterionBlurbPlaceholder: "Brief description of the criterion.",
  rubricBandNamePlaceholder: "Band name",
  rubricBandMinPlaceholder: "Min",
  rubricBandMaxPlaceholder: "Max",
  rubricBandDescriptionPlaceholder: "Exemplary performance across all areas…",
  outcomeFilterPlaceholder: "Filter outcomes…",
};

// Default band labels used when creating fallback rubric bands for
// custom criteria that do not have a config-backed rubric template.
export const RUBRIC_DEFAULT_LEVELS = ["Excellent", "Good", "Developing", "Insufficient"];

// ── Evaluation Criteria ───────────────────────────────────────
// Order here controls display order in jury form AND admin panel.
// Sheet column order (G–J): Technical / Written / Oral / Teamwork
//
// id:         React key + data field name in rows (matches GAS export)
// color:      Chart color token used consistently across all dashboard charts
// outcomes:   Array of MÜDEK outcome codes this criterion maps to
// rubric[].min/max: Numeric bounds for band classification logic
export const CRITERIA = [
  {
    id: "technical",
    label: "Technical Content",
    shortLabel: "Technical",
    color: "#F59E0B",
    outcomes: ["1.2", "2", "3.1", "3.2"],
    max: 30,
    blurb: "Evaluate the engineering depth of the project, clarity of the problem definition, and justification of technical decisions.",
    rubric: [
      { range: "27–30", level: "Excellent", min: 27, max: 30, desc: "Problem is clearly defined with strong motivation. Design decisions are well-justified with engineering depth. Originality and mastery of relevant tools or methods are evident." },
      { range: "21–26", level: "Good", min: 21, max: 26, desc: "Design is mostly clear and technically justified. Engineering decisions are largely supported." },
      { range: "13–20", level: "Developing", min: 13, max: 20, desc: "Problem is stated but motivation or technical justification is insufficient." },
      { range: "0–12", level: "Insufficient", min: 0, max: 12, desc: "Vague problem definition and unjustified decisions. Superficial technical content." },
    ],
  },
  {
    id: "design",
    label: "Written Communication",
    shortLabel: "Written",
    color: "#22C55E",
    outcomes: ["9.2"],
    max: 30,
    blurb: "Evaluate the clarity, structure, and visual effectiveness of the poster and written materials.",
    rubric: [
      { range: "27–30", level: "Excellent", min: 27, max: 30, desc: "Poster layout is intuitive with clear information flow. Visuals are fully labelled and high quality. Technical content is presented in a way that is accessible to both technical and non-technical readers." },
      { range: "21–26", level: "Good", min: 21, max: 26, desc: "Layout is mostly logical. Visuals are readable with minor gaps. Technical content is largely clear with small areas for improvement." },
      { range: "13–20", level: "Developing", min: 13, max: 20, desc: "Occasional gaps in information flow. Some visuals are missing labels or captions. Technical content is only partially communicated." },
      { range: "0–12", level: "Insufficient", min: 0, max: 12, desc: "Confusing layout. Low-quality or unlabelled visuals. Technical content is unclear or missing." },
    ],
  },
  {
    id: "delivery",
    label: "Oral Communication",
    shortLabel: "Oral",
    color: "#3B82F6",
    outcomes: ["9.1"],
    max: 30,
    blurb: "Evaluate the clarity of the presentation, pacing, and the quality of answers during the Q&A.",
    rubric: [
      { range: "27–30", level: "Excellent", min: 27, max: 30, desc: "Presentation is consciously adapted for both technical and non-technical jury members. Q&A responses are accurate, clear, and audience-appropriate." },
      { range: "21–26", level: "Good", min: 21, max: 26, desc: "Presentation is mostly clear and well-paced. Most questions answered correctly. Audience adaptation is generally evident." },
      { range: "13–20", level: "Developing", min: 13, max: 20, desc: "Understandable but inconsistent. Limited audience adaptation. Time management or Q&A depth needs improvement." },
      { range: "0–12", level: "Insufficient", min: 0, max: 12, desc: "Unclear or disorganised presentation. Most questions answered incorrectly or not at all." },
    ],
  },
  {
    id: "teamwork",
    label: "Teamwork",
    shortLabel: "Teamwork",
    color: "#EF4444",
    outcomes: ["8.1", "8.2"],
    max: 10,
    blurb: "Evaluate how effectively team members collaborate and contribute to the project.",
    rubric: [
      { range: "9–10", level: "Excellent", min: 9, max: 10, desc: "All members participate actively and equally. Professional and ethical conduct observed throughout." },
      { range: "7–8", level: "Good", min: 7, max: 8, desc: "Most members contribute. Minor knowledge gaps. Professionalism mostly observed." },
      { range: "4–6", level: "Developing", min: 4, max: 6, desc: "Uneven participation. Some members are passive or unprepared." },
      { range: "0–3", level: "Insufficient", min: 0, max: 3, desc: "Very low participation or dominated by one person. Lack of professionalism observed." },
    ],
  },
];

// ── Outcome Dashboard constants ──────────────────────────────────

// Reference threshold line shown on Charts 1 and 2.
export const OUTCOME_THRESHOLD = 70;

// Achievement band colours — used by Chart 6 and the MÜDEK dropdown rubric tab.
export const BAND_COLORS = {
  Excellent: { bg: "#DCFCE7", text: "#16A34A" },
  Good: { bg: "#F7FEE7", text: "#65A30D" },
  Developing: { bg: "#FEF9C3", text: "#CA8A04" },
  Insufficient: { bg: "#FEE2E2", text: "#DC2626" },
};

// All 18 MÜDEK outcome codes with short label, English description, and Turkish text.
// Each CRITERIA entry's outcomes[] array references codes from this object.
// label: short display name used as the DB framework_outcomes.label
// en: full English description stored as framework_outcomes.description
export const OUTCOME_DEFINITIONS = {
  "1.1": {
    label: "Foundational Knowledge",
    en: "Knowledge in mathematics, natural sciences, basic engineering, computational methods, and discipline-specific topics",
    tr: "Matematik, fen bilimleri, temel mühendislik, bilgisayarla hesaplama ve ilgili mühendislik disiplinine özgü konularda bilgi.",
  },
  "1.2": {
    label: "Knowledge Application",
    en: "Ability to apply knowledge in mathematics, natural sciences, basic engineering, computational methods, and discipline-specific topics to solve complex engineering problems",
    tr: "Matematik, fen bilimleri, temel mühendislik, bilgisayarla hesaplama ve ilgili mühendislik disiplinine özgü konulardaki bilgileri, karmaşık mühendislik problemlerinin çözümünde kullanabilme becerisi.",
  },
  "2": {
    label: "Problem Identification & Analysis",
    en: "Ability to identify, formulate, and analyze complex engineering problems using basic science, mathematics, and engineering knowledge while considering relevant UN Sustainable Development Goals",
    tr: "Karmaşık mühendislik problemlerini, temel bilim, matematik ve mühendislik bilgilerini kullanarak ve ele alınan problemle ilgili BM Sürdürülebilir Kalkınma Amaçlarını gözetarak tanımlama, formüle etme ve analiz becerisi.",
  },
  "3.1": {
    label: "Creative Solution Design",
    en: "Ability to design creative solutions to complex engineering problems",
    tr: "Karmaşık mühendislik problemlerine yaratıcı çözümler tasarlama becerisi.",
  },
  "3.2": {
    label: "Complex System Design",
    en: "Ability to design complex systems, processes, devices, or products that meet current and future requirements while considering realistic constraints and conditions",
    tr: "Karmaşık sistemleri, süreçleri, cihazları veya ürünleri gerçekçi kısıtları ve koşulları gözetarak, mevcut ve gelecekteki gereksinimleri karşılayacak biçimde tasarlama becerisi.",
  },
  "4": {
    label: "Modern Tools & Techniques",
    en: "Ability to select and use appropriate techniques, resources, and modern engineering and IT tools, including estimation and modeling, for analysis and solution of complex engineering problems, with awareness of their limitations",
    tr: "Karmaşık mühendislik problemlerinin analizi ve çözümüne yönelik, tahmin ve modelleme de dahil olmak üzere, uygun teknikleri, kaynakları ve modern mühendislik ve bilişim araçlarını, sınırlamalarının da farkında olarak seçme ve kullanma becerisi.",
  },
  "5": {
    label: "Research Methods",
    en: "Ability to use research methods including literature review, experiment design, data collection, result analysis, and interpretation for investigation of complex engineering problems",
    tr: "Karmaşık mühendislik problemlerinin incelenmesi için literatür araştırması, deney tasarlama, deney yapma, veri toplama, sonuçları analiz etme ve yorumlama dahil, araştırma yöntemlerini kullanma becerisi.",
  },
  "6.1": {
    label: "Societal & Environmental Impact",
    en: "Knowledge of the impacts of engineering applications on society, health and safety, economy, sustainability, and environment within the scope of UN Sustainable Development Goals",
    tr: "Mühendislik uygulamalarının BM Sürdürülebilir Kalkınma Amaçları kapsamında, topluma, sağlık ve güvenliğe, ekonomiye, sürdürülebilirlik ve çevreye etkileri hakkında bilgi.",
  },
  "6.2": {
    label: "Legal Awareness",
    en: "Awareness of the legal consequences of engineering solutions",
    tr: "Mühendislik çözümlerinin hukuksal sonuçları konusunda farkındalık.",
  },
  "7.1": {
    label: "Ethics & Professional Conduct",
    en: "Knowledge of acting in accordance with engineering professional principles and ethical responsibility",
    tr: "Mühendislik meslek ilkelerine uygun davranma, etik sorumluluk hakkında bilgi.",
  },
  "7.2": {
    label: "Impartiality & Diversity",
    en: "Awareness of acting without discrimination and being inclusive of diversity",
    tr: "Hiçbir konuda ayrımcılık yapmadan, tarafsız davranma ve çeşitliliği kapsayıcı olma konularında farkındalık.",
  },
  "8.1": {
    label: "Intra-disciplinary Teamwork",
    en: "Ability to work effectively as a team member or leader in intra-disciplinary teams (face-to-face, remote, or hybrid)",
    tr: "Bireysel olarak disiplin içi takım çalışmalarında (yüz yüze, uzaktan veya karma) takım üyesi veya lideri olarak etkin biçimde çalışabilme becerisi.",
  },
  "8.2": {
    label: "Multidisciplinary Teamwork",
    en: "Ability to work effectively as a team member or leader in multidisciplinary teams (face-to-face, remote, or hybrid)",
    tr: "Bireysel olarak çok disiplinli takımlarda (yüz yüze, uzaktan veya karma) takım üyesi veya lideri olarak etkin biçimde çalışabilme becerisi.",
  },
  "9.1": {
    label: "Oral Communication",
    en: "Ability to communicate effectively orally on technical subjects, taking into account the diverse characteristics of the target audience (education, language, profession, etc.)",
    tr: "Hedef kitlenin çeşitli farklılıklarını (eğitim, dil, meslek gibi) dikkate alarak, teknik konularda sözlü etkin iletişim kurma becerisi.",
  },
  "9.2": {
    label: "Written Communication",
    en: "Ability to communicate effectively in writing on technical subjects, taking into account the diverse characteristics of the target audience (education, language, profession, etc.)",
    tr: "Hedef kitlenin çeşitli farklılıklarını (eğitim, dil, meslek gibi) dikkate alarak, teknik konularda yazılı etkin iletişim kurma becerisi.",
  },
  "10.1": {
    label: "Business & Project Management",
    en: "Knowledge of business practices such as project management and economic feasibility analysis",
    tr: "Proje yönetimi ve ekonomik yapılabilirlik analizi gibi iş hayatındaki uygulamalar hakkında bilgi.",
  },
  "10.2": {
    label: "Entrepreneurship & Innovation",
    en: "Awareness of entrepreneurship and innovation",
    tr: "Girişimcilik ve yenilikçilik hakkında farkındalık.",
  },
  "11": {
    label: "Lifelong Learning",
    en: "Ability to learn independently and continuously, adapt to new and emerging technologies, and think critically about technological changes",
    tr: "Bağımsız ve sürekli öğrenebilme, yeni ve gelişmekte olan teknolojilere uyum sağlayabilme ve teknolojik değişimlerle ilgili sorgulayıcı düşünebilmeyi kapsayan yaşam boyu öğrenme becerisi.",
  },
};
