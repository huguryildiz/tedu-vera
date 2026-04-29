import { formatDateTime as formatFull } from "@/shared/lib/dateUtils";

export const COLUMNS = [
  { key: "group_no",   label: "No",            colWidth: "4%",  exportWidth: 8  },
  { key: "title",      label: "Project Title",  colWidth: "38%", exportWidth: 36 },
  { key: "members",    label: "Team Members",   colWidth: "28%", exportWidth: 42, colClass: "col-members" },
  { key: "avg_score",  label: "Avg Score",      colWidth: "9%",  exportWidth: 10 },
  { key: "updated_at", label: "Last Updated",   colWidth: "13%", exportWidth: 18, colClass: "col-updated" },
];

const ADVISOR_COLUMN = { key: "advisor", label: "Advisor", exportWidth: 30 };

export function buildExportColumns(projects) {
  const hasAdvisor = projects.some((p) => p.advisor && p.advisor.trim());
  const base = COLUMNS.filter((c) => c.key !== "group_no");
  if (!hasAdvisor) return base;
  const membersIdx = base.findIndex((c) => c.key === "members");
  return [...base.slice(0, membersIdx + 1), ADVISOR_COLUMN, ...base.slice(membersIdx + 1)];
}

export function getProjectCell(p, key, avgMap) {
  if (key === "group_no")   return p.group_no ?? "";
  if (key === "title")      return p.group_no != null ? `P${p.group_no} — ${p.title ?? ""}` : (p.title ?? "");
  if (key === "members")    return membersToString(p.members);
  if (key === "advisor")    return (p.advisor || "").trim();
  if (key === "avg_score")  return avgMap?.get(p.id) ?? "—";
  if (key === "updated_at") return formatFull(p.updated_at) || "—";
  return "";
}

export function membersToArray(m) {
  if (!m) return [];
  if (Array.isArray(m)) return m.map((s) => (s?.name || s || "").toString().trim()).filter(Boolean);
  if (typeof m === "string") return m.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  return [];
}

export function membersToString(m) {
  return membersToArray(m).join(", ");
}

export function formatRelative(ts) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  if (diff < 31_536_000_000) return `${Math.floor(diff / 2_592_000_000)}mo ago`;
  const yrs = Math.round(diff / 31_536_000_000 * 10) / 10;
  return `${yrs % 1 === 0 ? yrs : yrs.toFixed(1)}yr ago`;
}

export function scoreBandToken(score, max) {
  if (score == null || !Number.isFinite(Number(score))) return "var(--text-tertiary)";
  const pct = (Number(score) / (max || 100)) * 100;
  if (pct >= 85) return "var(--success)";
  if (pct >= 70) return "var(--warning)";
  return "var(--danger)";
}
