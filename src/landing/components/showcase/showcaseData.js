// Product showcase slide metadata.
// Each slide pairs a real demo-environment screenshot (light + dark) with
// landing-page copy. Replace screenshots by re-running the Playwright capture
// flow against /demo (see plan: real-screenshot ProductShowcase refactor).

import overviewLight from "@/assets/landing/showcase/overview-light.png";
import overviewDark from "@/assets/landing/showcase/overview-dark.png";
import rankingsLight from "@/assets/landing/showcase/rankings-light.png";
import rankingsDark from "@/assets/landing/showcase/rankings-dark.png";
import analyticsLight from "@/assets/landing/showcase/analytics-light.png";
import analyticsDark from "@/assets/landing/showcase/analytics-dark.png";
import juryflowLight from "@/assets/landing/showcase/juryflow-light.png";
import juryflowDark from "@/assets/landing/showcase/juryflow-dark.png";
import periodsLight from "@/assets/landing/showcase/periods-light.png";
import periodsDark from "@/assets/landing/showcase/periods-dark.png";
import auditlogLight from "@/assets/landing/showcase/auditlog-light.png";
import auditlogDark from "@/assets/landing/showcase/auditlog-dark.png";

export const SLIDES = [
  {
    theme: "overview",
    color: "#60a5fa",
    eyebrow: "Overview",
    title: "Real-Time Evaluation Cockpit",
    desc: "Active periods, juror progress, and live activity — every evaluation surface lives in one cockpit view tuned for the day of scoring.",
    features: [
      { label: "Live juror activity feed", color: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
      { label: "Period snapshot at a glance", color: "#4ade80", bg: "rgba(34,197,94,0.12)" },
      { label: "Needs-attention alerts", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
    ],
    image: { light: overviewLight, dark: overviewDark },
  },
  {
    theme: "rankings",
    color: "#4ade80",
    eyebrow: "Rankings",
    title: "Live Project Rankings",
    desc: "Project rankings update the instant scores arrive — average, score range, and per-criterion totals reflect every juror submission in real time.",
    features: [
      { label: "Real-time score aggregation", color: "#4ade80", bg: "rgba(34,197,94,0.12)" },
      { label: "Per-criterion column totals", color: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
      { label: "Min · Med · Top score range", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
    ],
    image: { light: rankingsLight, dark: rankingsDark },
  },
  {
    theme: "analytics",
    color: "#a78bfa",
    eyebrow: "Analytics",
    title: "Programme Outcome Attainment",
    desc: "Every score maps to programme outcomes. Generate attainment reports for MÜDEK, ABET, and EUR-ACE — accreditation-ready the moment scoring ends.",
    features: [
      { label: "Per-outcome attainment %", color: "#a78bfa", bg: "rgba(139,92,246,0.12)" },
      { label: "Above-threshold deltas", color: "#4ade80", bg: "rgba(34,197,94,0.12)" },
      { label: "MÜDEK / ABET ready", color: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
    ],
    image: { light: analyticsLight, dark: analyticsDark },
  },
  {
    theme: "juryflow",
    color: "#fbbf24",
    eyebrow: "Jury Flow",
    title: "The Juror Experience",
    desc: "Step-by-step scoring on any device. Identity → PIN → score cards with rubric guidance. Auto-save on every input — no app install, no training required.",
    features: [
      { label: "QR + PIN authentication", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
      { label: "Auto-save on every input", color: "#4ade80", bg: "rgba(34,197,94,0.12)" },
      { label: "Mobile-first scoring grid", color: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
    ],
    image: { light: juryflowLight, dark: juryflowDark },
  },
  {
    theme: "periods",
    color: "#f472b6",
    eyebrow: "Periods",
    title: "Period Lifecycle Control",
    desc: "Draft → Published → Live → Closed. Each transition is an explicit admin action; closed periods are immutable, locked snapshots for accreditation review.",
    features: [
      { label: "Four-stage lifecycle", color: "#f472b6", bg: "rgba(236,72,153,0.12)" },
      { label: "Snapshot-frozen on close", color: "#4ade80", bg: "rgba(34,197,94,0.12)" },
      { label: "Per-period criteria & outcomes", color: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
    ],
    image: { light: periodsLight, dark: periodsDark },
  },
  {
    theme: "auditlog",
    color: "#34d399",
    eyebrow: "Audit Log",
    title: "Tamper-Proof Audit Trail",
    desc: "Every admin action, score change, and access event is logged with cryptographic chain integrity — the trail accreditation reviewers expect.",
    features: [
      { label: "Append-only event log", color: "#34d399", bg: "rgba(52,211,153,0.12)" },
      { label: "Hash-chain integrity check", color: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
      { label: "Filter by actor / type / risk", color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
    ],
    image: { light: auditlogLight, dark: auditlogDark },
  },
];
