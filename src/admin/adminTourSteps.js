// src/admin/adminTourSteps.js
// Global spotlight tour — follows sidebar menu order exactly.
// Steps whose selector resolves to nothing are skipped automatically
// (e.g. Platform Control is hidden for non-super admins).

export const ADMIN_TOUR_STEPS = [
  {
    selector: "#sidebar-nav",
    title: "Welcome to VERA Admin",
    body: "This panel gives you full control over your evaluation process — from managing jury members to publishing results.",
    placement: "below",
  },
  {
    selector: "[data-tour='overview']",
    title: "Overview",
    body: "Your live dashboard. See real-time scoring progress, completion rates, and key metrics at a glance.",
    placement: "below",
  },
  {
    selector: "[data-tour='rankings']",
    title: "Rankings",
    body: "Ranked project results for the active period. Export to CSV or PDF for committee reports.",
    placement: "below",
  },
  {
    selector: "[data-tour='analytics']",
    title: "Analytics",
    body: "Competency-level radar charts and accreditation-ready outcome breakdowns (MÜDEK, ABET, custom frameworks).",
    placement: "below",
  },
  {
    selector: "[data-tour='heatmap']",
    title: "Heatmap",
    body: "Score distribution heatmap across all jurors and projects — quickly spot coverage gaps or outliers.",
    placement: "below",
  },
  {
    selector: "[data-tour='reviews']",
    title: "Reviews",
    body: "Written juror feedback for each project, organized by criterion. Useful for student debriefs.",
    placement: "below",
  },
  {
    selector: "[data-tour='jurors']",
    title: "Jurors",
    body: "Invite evaluators by email, manage their PINs, and monitor individual scoring activity.",
    placement: "below",
  },
  {
    selector: "[data-tour='projects']",
    title: "Projects",
    body: "Add and manage capstone projects, assign jury members, and track evaluation coverage per project.",
    placement: "below",
  },
  {
    selector: "[data-tour='periods']",
    title: "Periods",
    body: "Open or close evaluation windows. Each period scopes all scoring, rankings, and analytics independently.",
    placement: "below",
  },
  {
    selector: "[data-tour='criteria']",
    title: "Evaluation Criteria",
    body: "Define rubric bands, criterion weights, and score ranges. Locked automatically once scoring begins.",
    placement: "below",
  },
  {
    selector: "[data-tour='outcomes']",
    title: "Outcomes & Mapping",
    body: "Map evaluation criteria to program outcomes for accreditation reporting.",
    placement: "below",
  },
  {
    selector: "[data-tour='entry-control']",
    title: "Entry Control",
    body: "Publish the QR / entry token that grants jurors access to the evaluation interface.",
    placement: "above",
  },
  {
    selector: "[data-tour='pin-blocking']",
    title: "PIN Blocking",
    body: "Block or unblock individual juror PINs to control access during a live evaluation session.",
    placement: "above",
  },
  {
    selector: "[data-tour='audit-log']",
    title: "Audit Log",
    body: "Full record of all admin actions — who changed what and when. Useful for compliance and debugging.",
    placement: "above",
  },
  {
    selector: "[data-tour='organizations']",
    title: "Platform Control",
    body: "Manage all tenant organizations, onboard new institutions, and monitor platform-wide activity.",
    placement: "above",
  },
  {
    selector: "[data-tour='settings']",
    title: "Settings",
    body: "Configure your organization profile, notification preferences, and platform-level options.",
    placement: "above",
  },
];
