// src/admin/OverviewPage.jsx — Phase 2
// Prototype source: #page-overview (docs/design/reference/vera-premium-prototype.html ~lines 11758–11982)
// Single-file overview page: KPIs, juror table, right stack, live feed, completion, charts, top projects.
import "./OverviewPage.css";
import { useMemo, useState, useEffect } from "react";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import useCardSelection from "@/shared/hooks/useCardSelection";
import JurorBadge from "@/admin/shared/JurorBadge";
import JurorStatusPill from "@/admin/shared/JurorStatusPill";
import { SubmissionTimelineChart } from "@/charts/SubmissionTimelineChart";
import { ScoreDistributionChart } from "@/charts/ScoreDistributionChart";
import { getProjectHighlight } from "@/admin/utils/scoreHelpers";
import {
  UsersLucideIcon,
  TriangleAlertIcon,
  CalendarRangeIcon,
  ActivityIcon,
  ClockIcon,
  ChartIcon,
  BarChart2Icon,
  TrophyIcon,
  CircleCheckIcon,
  SendIcon,
  PencilLineIcon,
  CircleSlashIcon,
  LockIcon,
  PlayIcon,
  ChevronUpIcon,
  ChevronDownIcon,

} from "@/shared/ui/Icons";
import { Users, Trophy, Activity, CheckCircle2, ShieldCheck, Info } from "lucide-react";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import { TeamMemberNames } from "@/shared/ui/EntityMeta";
import AvgDonut from "@/admin/shared/AvgDonut";

// ── Helpers ───────────────────────────────────────────────────

function relativeTime(ms) {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  const remMonths = Math.floor((days % 365) / 30);
  if (remMonths === 0) return `${years}y ago`;
  return `${years}y ${remMonths}mo ago`;
}

function formatAbsoluteTime(ms) {
  if (!ms) return null;
  return new Date(ms).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function jurorStatus(j) {
  if (j.finalSubmitted && !j.editEnabled) return "completed";
  if (j.editEnabled) return "editing";
  const done = j.completedProjects || 0;
  const total = j.totalProjects || 0;
  if (total > 0 && done >= total) return "ready_to_submit";
  if (done > 0) return "in_progress";
  return "not_started";
}

function barColor(pct, status) {
  if (status === "completed") return "var(--success)";
  if (status === "ready_to_submit") return "var(--accent)";
  if (pct > 0) return "var(--warning)";
  return "var(--surface-2)";
}

function donutColor(status) {
  if (status === "completed")       return "var(--success)";
  if (status === "ready_to_submit") return "var(--accent)";
  if (status === "in_progress")     return "var(--warning)";
  if (status === "editing")         return "#8b5cf6";
  return "var(--border)";
}

function completionFillColor(pct) {
  const hue = Math.round((Math.min(100, Math.max(0, pct)) / 100) * 120);
  return `hsl(${hue}, 72%, 38%)`;
}

function SortIcon({ colKey, sortKey, sortDir }) {
  if (sortKey !== colKey) {
    return <span className="sort-icon sort-icon-inactive">▲</span>;
  }
  return (
    <span className="sort-icon sort-icon-active">
      {sortDir === "asc" ? "▲" : "▼"}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────

export default function OverviewPage() {
  const {
    rawScores = [],
    summaryData = [],
    allJurors = [],
    selectedPeriod = null,
    criteriaConfig = [],
    outcomeConfig = [],
    frameworks = [],
    loading = false,
    onNavigate,
  } = useAdminContext();
  const topProjectsScopeRef = useCardSelection();
  const [jurorTableExpanded, setJurorTableExpanded] = useState(false);

  // ── KPIs ──────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const totalJ = allJurors.length;
    const completed = allJurors.filter((j) => j.finalSubmitted && !j.editEnabled).length;
    const editing = allJurors.filter((j) => j.editEnabled).length;
    const readyToSubmit = allJurors.filter((j) => {
      if (j.finalSubmitted || j.editEnabled) return false;
      const done = j.completedProjects || 0;
      const total = j.totalProjects || 0;
      return total > 0 && done >= total;
    }).length;
    const inProg = allJurors.filter((j) => {
      if (j.finalSubmitted || j.editEnabled) return false;
      const done = j.completedProjects || 0;
      const total = j.totalProjects || 0;
      return done > 0 && done < total;
    }).length;
    const notStarted = allJurors.filter((j) => !j.finalSubmitted && !j.editEnabled && !(j.completedProjects > 0)).length;
    const pinBlocked = allJurors.filter((j) => j.isLocked).length;
    const neverSeen  = allJurors.filter((j) => !j.lastSeenMs).length;
    const pct = totalJ > 0 ? Math.round((completed / totalJ) * 100) : 0;
    const completedJurorIds = new Set(
      allJurors.filter((j) => j.finalSubmitted && !j.editEnabled).map((j) => j.jurorId)
    );
    const completedScores = rawScores.filter(
      (r) => r.total != null && completedJurorIds.has(r.jurorId)
    );
    const avg =
      completedScores.length > 0
        ? (completedScores.reduce((s, r) => s + r.total, 0) / completedScores.length).toFixed(1)
        : null;
    return { totalJ, completed, editing, readyToSubmit, inProg, notStarted, pinBlocked, neverSeen, pct, avg };
  }, [allJurors, rawScores]);

  // ── Per-juror max map ─────────────────────────────────────────
  const jurorMaxMap = useMemo(() => {
    const byJuror = new Map();
    for (const r of rawScores) {
      if (r.total == null || !r.jurorId) continue;
      if (!byJuror.has(r.jurorId)) byJuror.set(r.jurorId, []);
      byJuror.get(r.jurorId).push(r.total);
    }
    const result = new Map();
    for (const [id, totals] of byJuror) {
      result.set(id, Math.max(...totals).toFixed(1));
    }
    return result;
  }, [rawScores]);

  // ── Juror table sort ──────────────────────────────────────────
  const [tableSort, setTableSort] = useState({ col: "active", dir: "desc" });

  const STATUS_ORDER = { completed: 0, editing: 1, ready_to_submit: 2, in_progress: 3, not_started: 4 };

  function toggleSort(col) {
    setTableSort((prev) =>
      prev.col === col ? { col, dir: prev.dir === "desc" ? "asc" : "desc" } : { col, dir: "desc" }
    );
  }

  // ── Juror table rows ──────────────────────────────────────────
  const sortedJurors = useMemo(() => {
    const { col, dir } = tableSort;
    const mult = dir === "asc" ? 1 : -1;
    return [...allJurors].sort((a, b) => {
      if (col === "name")     return mult * (a.juryName || "").localeCompare(b.juryName || "");
      if (col === "status")   return mult * ((STATUS_ORDER[jurorStatus(a)] ?? 9) - (STATUS_ORDER[jurorStatus(b)] ?? 9));
      if (col === "progress") return mult * ((a.completedProjects || 0) - (b.completedProjects || 0));
      if (col === "avg")      return mult * ((parseFloat(jurorMaxMap.get(a.jurorId)) || 0) - (parseFloat(jurorMaxMap.get(b.jurorId)) || 0));
      if (col === "active")   return mult * ((a.lastSeenMs || 0) - (b.lastSeenMs || 0));
      return 0;
    });
  }, [allJurors, tableSort, jurorMaxMap]);

  const displayedJurors = jurorTableExpanded ? sortedJurors : sortedJurors.slice(0, 8);

  // ── Group completion bars ─────────────────────────────────────
  const groupCompletion = useMemo(() => {
    return summaryData
      .map((p) => {
        const scored = rawScores.filter((r) => r.projectId === p.id && r.total != null).length;
        const pct = kpi.totalJ > 0 ? Math.round((scored / kpi.totalJ) * 100) : 0;
        return { id: p.id, title: p.title, pct };
      })
      .sort((a, b) => b.pct - a.pct)
      .map((g, i) => ({ ...g, rank: i + 1 }));
  }, [summaryData, rawScores, kpi.totalJ]);

  // ── Live feed (most recently active first) ────────────────────
  const recentActivity = useMemo(
    () =>
      [...allJurors]
        .sort((a, b) => (b.lastSeenMs || 0) - (a.lastSeenMs || 0))
        .slice(0, 7),
    [allJurors]
  );

  // ── Top projects ──────────────────────────────────────────────
  const topProjects = useMemo(
    () =>
      [...summaryData]
        .filter((p) => p.totalAvg != null)
        .sort((a, b) => (b.totalAvg || 0) - (a.totalAvg || 0))
        .slice(0, 5),
    [summaryData]
  );

// Conditionally render mobile-only cells in portrait narrow viewports only.
  const [isPortraitMobile, setIsPortraitMobile] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 768px) and (orientation: portrait)").matches;
  });
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia("(max-width: 768px) and (orientation: portrait)");
    const onChange = (e) => setIsPortraitMobile(e.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  // ── Period snapshot ───────────────────────────────────────────
  const totalMax = useMemo(
    () => criteriaConfig.reduce((s, c) => s + (c.max || 0), 0),
    [criteriaConfig]
  );

  const criteriaLabel = useMemo(() => {
    if (!criteriaConfig || criteriaConfig.length === 0) return "No criteria configured";
    const names = criteriaConfig.map((c) => c.shortLabel || c.label || c.id).join(", ");
    return `${criteriaConfig.length} (${names})`;
  }, [criteriaConfig]);

  const outcomeCount = useMemo(
    () => outcomeConfig?.length || 0,
    [outcomeConfig]
  );

  // ── Needs attention items ─────────────────────────────────────
  // types: "critical" (red) | "warn" (yellow) | "ready" (blue) | "editing" (purple) | "ok" (green)
  const attentionItems = useMemo(() => {
    const items = [];
    if (kpi.pinBlocked > 0) {
      const n = kpi.pinBlocked;
      items.push({ type: "blocked", text: `${n} juror${n > 1 ? "s are" : " is"} PIN-blocked and cannot evaluate` });
    }
    if (kpi.neverSeen > 0) {
      const n = kpi.neverSeen;
      items.push({ type: "unseen", text: `${n} juror${n > 1 ? "s have" : " has"} never connected` });
    }
    if (kpi.notStarted > 0) {
      const n = kpi.notStarted;
      items.push({ type: "critical", text: `${n} juror${n > 1 ? "s haven't" : " hasn't"} started scoring yet` });
    }
    if (kpi.editing > 0) {
      const n = kpi.editing;
      items.push({ type: "editing", text: `${n} juror${n > 1 ? "s are" : " is"} editing a submitted evaluation` });
    }
    if (kpi.readyToSubmit > 0) {
      const n = kpi.readyToSubmit;
      items.push({ type: "ready", text: `${n} juror${n > 1 ? "s have" : " has"} scored all projects but haven't submitted yet` });
    }
    if (kpi.inProg > 0) {
      const n = kpi.inProg;
      items.push({ type: "warn", text: `${n} juror${n > 1 ? "s are" : " is"} in progress` });
    }
    if (kpi.completed > 0) {
      items.push({ type: "ok", text: `${kpi.completed} of ${kpi.totalJ} jurors completed all evaluations` });
    }
    return items;
  }, [kpi]);

  return (
    <>
    <div className="admin-page" id="page-overview">

      {/* Page title */}
      <div className="overview-heading-row" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div className="page-title">Overview</div>
          <div className="page-desc">Real-time evaluation progress and jury activity</div>
        </div>
      </div>

      {/* KPI grid */}
      <div className="kpi-grid" id="overview-kpis">
        <div
          className="card kpi"
          data-testid="overview-kpi-active-jurors"
          data-value={kpi.totalJ}
          data-completed={kpi.completed}
          data-editing={kpi.editing}
          data-ready={kpi.readyToSubmit}
          data-inprogress={kpi.inProg}
          data-notstarted={kpi.notStarted}
        >
          <div className="kpi-label">Active Jurors</div>
          <div className="kpi-value">{kpi.totalJ || "—"}</div>
          <div className="kpi-sub" style={{ display: "flex", flexWrap: "wrap", gap: "4px 8px" }}>
            <span style={{ color: "var(--success)" }}>{kpi.completed} completed</span>
            {kpi.editing > 0 && <span style={{ color: "#8b5cf6" }}>{kpi.editing} editing</span>}
            {kpi.readyToSubmit > 0 && <span style={{ color: "var(--accent)" }}>{kpi.readyToSubmit} ready to submit</span>}
            {kpi.inProg > 0 && <span style={{ color: "var(--warning)" }}>{kpi.inProg} in progress</span>}
            {kpi.notStarted > 0 && <span style={{ color: "var(--text-secondary)" }}>{kpi.notStarted} not started</span>}
          </div>
        </div>
        <div className="card kpi" data-testid="overview-kpi-projects" data-value={summaryData.length}>
          <div className="kpi-label">Projects</div>
          <div className="kpi-value">{summaryData.length || "—"}</div>
          <div className="kpi-sub">{selectedPeriod?.name || selectedPeriod?.semester_name || "—"}</div>
        </div>
        <div className="card kpi" data-testid="overview-kpi-completion" data-value={kpi.pct} data-total={kpi.totalJ} data-completed={kpi.completed}>
          <div className="kpi-label">Completion</div>
          <div className="kpi-value">{kpi.totalJ > 0 ? `${kpi.pct}%` : "—"}</div>
          <div className="kpi-sub">{kpi.completed} of {kpi.totalJ} completed</div>
        </div>
        <div className="card kpi" data-testid="overview-kpi-average-score" data-value={kpi.avg ?? ""}>
          <div className="kpi-label">Average Score</div>
          <div className="kpi-value kpi-value--accent">
            {kpi.avg != null ? (
              <>{kpi.avg}<span className="vera-score-denom">/100</span></>
            ) : "—"}
          </div>
          <div className="kpi-sub">completed jurors only</div>
        </div>
      </div>

      {/* Jury Activity + Needs Attention */}
      <div className="grid-2" style={{ marginBottom: 20 }}>

        {/* Juror table */}
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="card-title">
              <UsersLucideIcon size={14} style={{ verticalAlign: "-1px", marginRight: 6, color: "var(--accent)" }} />
              Live Jury Activity
            </div>
            <span className="text-xs text-muted">
              {jurorTableExpanded ? kpi.totalJ : Math.min(8, kpi.totalJ)} of {kpi.totalJ} jurors shown
            </span>
          </div>

          <div className="table-wrap" style={{ border: "none", borderRadius: 0 }}>
            <table id="overview-juror-table" className={`table-standard table-pill-balance${jurorTableExpanded ? " expanded" : ""}`}>
              <thead>
                <tr>
                  {[
                    { col: "name",     label: "Juror",    cls: "" },
                    { col: "status",   label: "Status",   cls: "" },
                    { col: "progress", label: "Progress", cls: "text-center" },
                    { col: "avg",      label: totalMax > 0 ? `Avg (${totalMax})` : "Avg", cls: "text-right" },
                    { col: "active",   label: "Last Active",   cls: "text-right" },
                  ].map(({ col, label, cls }) => (
                    <th
                      key={col}
                      className={`${cls ? `${cls} ` : ""}sortable${tableSort.col === col ? " sorted" : ""}`}
                      onClick={() => toggleSort(col)}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                        {label} <SortIcon colKey={col} sortKey={tableSort.col} sortDir={tableSort.dir} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedJurors.map((j) => {
                  const status = jurorStatus(j);
                  const avg = jurorMaxMap.get(j.jurorId);
                  const done = j.completedProjects || 0;
                  const total = j.totalProjects || 0;
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                  const dColor = donutColor(status);
                  return (
                    <tr key={j.jurorId || j.juryName}>
                      <td>
                        <JurorBadge name={j.juryName} affiliation={j.affiliation} size="sm" />

                        <div className="oja-pill-mobile">
                          <div className="oja-pill-col">
                            <span className="oja-field-label">Juror Progress</span>
                            <JurorStatusPill status={status} />
                          </div>
                          <div className="oja-pill-col">
                            <span className="oja-field-label oja-eval-label">Eval. Progress</span>
                            <div className="oja-prog-frac">{done} / {total}</div>
                          </div>
                          <div className="oja-pill-col">
                            <span className="oja-field-label">Last Active</span>
                            <span className="oja-last-time vera-datetime-text">
                              {j.lastSeenMs && formatAbsoluteTime(j.lastSeenMs) ? (
                                <PremiumTooltip text={formatAbsoluteTime(j.lastSeenMs)} position="top">
                                  <span style={{ cursor: "default" }}>{relativeTime(j.lastSeenMs)}</span>
                                </PremiumTooltip>
                              ) : (j.lastSeenMs ? relativeTime(j.lastSeenMs) : "Never seen")}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td><JurorStatusPill status={status} /></td>
                      <td className="text-center">
                        <div className="oja-bar-desktop" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
                            <div style={{ width: `${pct}%`, height: "100%", background: barColor(pct, status), borderRadius: 99 }} />
                          </div>
                          <span className="mono text-xs">{done}/{total}</span>
                        </div>
                        <div className="oja-donut-col">
                          <AvgDonut value={avg != null ? parseFloat(avg) : null} max={totalMax || 100} />
                        </div>
                      </td>
                      <td className="mono text-right">
                        {avg != null ? <span className="vera-score-num">{avg}</span> : <span className="text-muted">—</span>}
                      </td>
                      <td className="text-right vera-datetime-text">
                        {formatAbsoluteTime(j.lastSeenMs) ? (
                          <PremiumTooltip text={formatAbsoluteTime(j.lastSeenMs)} position="top">
                            <span style={{ cursor: "default" }}>{relativeTime(j.lastSeenMs)}</span>
                          </PremiumTooltip>
                        ) : relativeTime(j.lastSeenMs)}
                      </td>
                    </tr>
                  );
                })}
                {kpi.totalJ === 0 && !loading && (
                  <tr>
                    <td colSpan={5} style={{ padding: 0 }}>
                      <div className="vera-es-no-data">
                        <div className="vera-es-ghost-rows" aria-hidden="true">
                          <div className="vera-es-ghost-row">
                            <div className="vera-es-ghost-avatar"/><div className="vera-es-ghost-bar" style={{width:"22%"}}/><div className="vera-es-ghost-spacer"/><div className="vera-es-ghost-bar" style={{width:"10%"}}/>
                          </div>
                          <div className="vera-es-ghost-row">
                            <div className="vera-es-ghost-avatar"/><div className="vera-es-ghost-bar" style={{width:"28%"}}/><div className="vera-es-ghost-spacer"/><div className="vera-es-ghost-bar" style={{width:"10%"}}/>
                          </div>
                        </div>
                        <div className="vera-es-icon">
                          <Users size={22} strokeWidth={1.8}/>
                        </div>
                        <p className="vera-es-no-data-title">No Jurors Assigned</p>
                        <p className="vera-es-no-data-desc">Jurors will appear here once they are assigned to this evaluation period.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {kpi.totalJ > 8 && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
              <button
                type="button"
                className="overview-juror-toggle"
                onClick={() => setJurorTableExpanded((v) => !v)}
              >
                {jurorTableExpanded ? (
                  <>View fewer jurors <ChevronUpIcon size={10} style={{ verticalAlign: "-1px", marginLeft: 2 }} /></>
                ) : (
                  <>View all {kpi.totalJ} jurors <ChevronDownIcon size={10} style={{ verticalAlign: "-1px", marginLeft: 2 }} /></>
                )}
              </button>
            </div>
          )}

        </div>

        {/* Right stack */}
        <div className="overview-right-stack">

          {/* Needs Attention */}
          <div className="card" id="needs-attention">
            <div className="card-header">
              <div className="card-title">
                <TriangleAlertIcon size={14} style={{ verticalAlign: "-1px", marginRight: 6, color: "var(--accent)" }} />
                Needs Attention
              </div>
            </div>
            {attentionItems.length === 0 ? (
              <div className="vera-es-no-data" style={{ padding: "24px 20px" }}>
                <div className="vera-es-ghost-rows" aria-hidden="true" style={{ marginBottom: 20 }}>
                  <div className="vera-es-ghost-row">
                    <div className="vera-es-ghost-avatar" /><div className="vera-es-ghost-bar" style={{ flex: 1 }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "16%" }} />
                  </div>
                  <div className="vera-es-ghost-row">
                    <div className="vera-es-ghost-avatar" /><div className="vera-es-ghost-bar" style={{ flex: 1 }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "22%" }} />
                  </div>
                </div>
                <div className="vera-es-icon">
                  <ShieldCheck size={22} strokeWidth={1.8} />
                </div>
                <p className="vera-es-no-data-title">Nothing to Flag</p>
                <p className="vera-es-no-data-desc">When something needs your attention it will appear here.</p>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }} data-testid="overview-needs-attention-list" data-count={attentionItems.length}>
                  {attentionItems.map((item, i) => {
                    const bulletColor =
                      item.type === "ok"       ? "var(--success)" :
                      item.type === "editing"  ? "#8b5cf6" :
                      item.type === "ready"    ? "var(--accent)" :
                      item.type === "warn"     ? "var(--warning)" :
                      item.type === "critical" ? "#eab308" :
                      item.type === "unseen"   ? "#f97316" :
                                                 "var(--danger, #ef4444)";
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12 }} data-testid={`overview-needs-attention-item-${item.type}`}>
                        <span style={{ color: bulletColor, fontSize: 14, lineHeight: 1, flexShrink: 0 }}>●</span>
                        <span>{item.text}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => onNavigate?.("jurors")}>Review jurors</button>
                  <button className="btn btn-sm btn-outline" onClick={() => onNavigate?.("scores")}>Open scores</button>
                </div>
              </>
            )}
          </div>

          {/* Period Snapshot */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <CalendarRangeIcon size={14} style={{ verticalAlign: "-1px", marginRight: 6, color: "var(--accent)" }} />
                Period Snapshot
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 12 }}>
              <div className="text-muted">Period</div>
              <div style={{ fontWeight: 500 }}>{selectedPeriod?.name || selectedPeriod?.semester_name || "—"}</div>
              <div className="text-muted">Criteria</div>
              <div style={{ fontWeight: 500 }}>{criteriaLabel}</div>
              {outcomeCount > 0 && <>
                <div className="text-muted">Outcomes</div>
                <div style={{ fontWeight: 500 }}>{outcomeCount} assigned</div>
              </>}
              <div className="text-muted">Jurors</div>
              <div style={{ fontWeight: 500 }}>{kpi.totalJ} assigned</div>
              <div className="text-muted">Projects</div>
              <div style={{ fontWeight: 500 }}>{summaryData.length} projects</div>
              <div className="text-muted">Status</div>
              <div>
                {!selectedPeriod ? (
                  <span className="text-muted">—</span>
                ) : selectedPeriod.closed_at ? (
                  <span className="sem-status sem-status-closed" style={{ fontSize: 10, padding: "2px 8px" }}>
                    <LockIcon size={10} />
                    Closed
                  </span>
                ) : selectedPeriod.is_locked && rawScores.length > 0 ? (
                  <span className="sem-status sem-status-live" style={{ fontSize: 10, padding: "2px 8px" }}>
                    <PlayIcon size={10} />
                    Live
                  </span>
                ) : selectedPeriod.is_locked ? (
                  <span className="sem-status sem-status-published" style={{ fontSize: 10, padding: "2px 8px" }}>
                    <SendIcon size={10} />
                    Published
                  </span>
                ) : (
                  <span className="sem-status sem-status-draft" style={{ fontSize: 10, padding: "2px 8px" }}>
                    <PencilLineIcon size={10} />
                    Draft
                  </span>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Live Feed + Completion */}
      <div className="grid-2" style={{ marginBottom: 20 }}>

        <div className="card live-feed-card">
          <div className="live-feed-head">
            <div className="card-title">
              <ActivityIcon size={14} style={{ verticalAlign: "-1px", marginRight: 6, color: "var(--accent)" }} />
              Live Feed
            </div>
            <span className="live-feed-dot" aria-hidden="true" />
          </div>
          <div className="live-feed-list" data-testid="overview-live-feed" data-count={recentActivity.length}>
            {recentActivity.length === 0 ? (
              loading ? (
                <div className="live-feed-item">
                  <div className="live-feed-main">
                    <div className="live-feed-text text-muted">Loading…</div>
                  </div>
                </div>
              ) : (
                <div className="vera-es-no-data" style={{ padding: "28px 20px" }}>
                  <div className="vera-es-ghost-rows" aria-hidden="true" style={{ marginBottom: 20 }}>
                    <div className="vera-es-ghost-row">
                      <div className="vera-es-ghost-avatar" /><div className="vera-es-ghost-bar" style={{ flex: 1 }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "18%" }} />
                    </div>
                    <div className="vera-es-ghost-row">
                      <div className="vera-es-ghost-avatar" /><div className="vera-es-ghost-bar" style={{ flex: 1 }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "12%" }} />
                    </div>
                  </div>
                  <div className="vera-es-icon">
                    <Activity size={22} strokeWidth={1.8} />
                  </div>
                  <p className="vera-es-no-data-title">No Recent Activity</p>
                  <p className="vera-es-no-data-desc">Juror actions will stream here once evaluations are in progress.</p>
                </div>
              )
            ) : (
              recentActivity.map((j, idx) => {
                const status = jurorStatus(j);
                const lastProject = j.lastScoredProject;
                const feedText =
                  status === "completed"       ? "completed all evaluations" :
                  status === "editing"         ? "is editing a submitted evaluation" :
                  status === "ready_to_submit" ? `scored all projects${lastProject ? ` · last: ${lastProject}` : ""} — ready to submit` :
                  status === "in_progress"     ? `scored ${j.completedProjects} of ${j.totalProjects} projects${lastProject ? ` · last: ${lastProject}` : ""}` :
                                                 "hasn't started scoring yet";
                const iconClass =
                  status === "completed"       ? "completed"   :
                  status === "ready_to_submit" ? "ready"       :
                  status === "in_progress"     ? "in-progress" :
                  status === "editing"         ? "editing"     :
                                                 "not-started";
                const FeedIcon =
                  status === "completed"       ? CircleCheckIcon  :
                  status === "ready_to_submit" ? SendIcon         :
                  status === "in_progress"     ? ClockIcon        :
                  status === "editing"         ? PencilLineIcon   :
                                                 CircleSlashIcon;
                return (
                  <div className="live-feed-item" key={j.jurorId || j.juryName} data-testid={`overview-live-feed-item-${idx}`} data-juror-id={j.jurorId || ""} data-status={status}>
                    <div className={`live-feed-icon ${iconClass}`} aria-hidden="true">
                      <FeedIcon size={14} />
                    </div>
                    <div className="live-feed-main">
                      <div className="live-feed-text">
                        <strong>{j.juryName}</strong>{" "}{feedText}
                      </div>
                      <div className="live-feed-time vera-datetime-text">
                        {j.lastSeenMs && formatAbsoluteTime(j.lastSeenMs) ? (
                          <PremiumTooltip text={formatAbsoluteTime(j.lastSeenMs)} position="top">
                            <span style={{ cursor: "default" }}>{relativeTime(j.lastSeenMs)}</span>
                          </PremiumTooltip>
                        ) : (j.lastSeenMs ? relativeTime(j.lastSeenMs) : "Never seen")}
                        {j.failedAttempts > 0 && (
                          <span style={{ marginLeft: 8, color: "var(--danger)", fontWeight: 600 }}>
                            · failed PIN {j.failedAttempts}×
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card completion-card">
          <div className="completion-head">
            <div className="card-title">
              <ClockIcon size={14} style={{ verticalAlign: "-1px", marginRight: 6, color: "var(--accent)" }} />
              Completion
            </div>
          </div>
          <div className="completion-list" data-testid="overview-completion-list" data-count={groupCompletion.length}>
            {groupCompletion.length === 0 ? (
              loading ? (
                <div className="text-muted text-xs" style={{ padding: "16px 0" }}>Loading…</div>
              ) : (
                <div className="vera-es-no-data" style={{ padding: "28px 20px" }}>
                  <div className="vera-es-ghost-rows" aria-hidden="true" style={{ marginBottom: 20 }}>
                    <div className="vera-es-ghost-row">
                      <div className="vera-es-ghost-num" /><div className="vera-es-ghost-bar" style={{ flex: 1 }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "14%" }} />
                    </div>
                    <div className="vera-es-ghost-row">
                      <div className="vera-es-ghost-num" /><div className="vera-es-ghost-bar" style={{ flex: 1 }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "20%" }} />
                    </div>
                  </div>
                  <div className="vera-es-icon">
                    <CheckCircle2 size={22} strokeWidth={1.8} />
                  </div>
                  <p className="vera-es-no-data-title">No Projects Yet</p>
                  <p className="vera-es-no-data-desc">Completion progress will appear once projects are added to this period.</p>
                </div>
              )
            ) : (
              groupCompletion.map((g) => (
                <div className="completion-row" key={g.id} data-testid={`overview-completion-row-${g.rank}`} data-project-id={g.id} data-pct={g.pct}>
                  <div className="completion-row-top">
                    <span className="completion-name">
                      <span style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", color: "var(--accent)", fontSize: "0.85em", fontWeight: 700, marginRight: 6, flexShrink: 0 }}>P{g.rank}</span>
                      {g.title}
                    </span>
                    <span className="completion-val" style={{ fontFamily: "var(--font-mono, ui-monospace, monospace)", fontVariantNumeric: "tabular-nums" }}>{g.pct}%</span>
                  </div>
                  <div className="completion-bar">
                    <div className="completion-fill" style={{ width: `${g.pct}%`, background: completionFillColor(g.pct) }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Charts — Phase 15: SubmissionTimelineChart + ScoreDistributionChart */}
      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title">
              <ChartIcon size={14} style={{ verticalAlign: "-1px", marginRight: 6, color: "var(--accent)" }} />
              Submission Timeline
            </div>
          </div>
          <SubmissionTimelineChart allJurors={allJurors} />
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>Final submissions by hour</div>
        </div>
        <div className="card chart-card">
          <div className="card-header">
            <div className="card-title">
              <BarChart2Icon size={14} style={{ verticalAlign: "-1px", marginRight: 6, color: "var(--accent)" }} />
              Score Distribution
            </div>
          </div>
          <ScoreDistributionChart rawScores={rawScores} />
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>Score range distribution — one data point per juror × project pair</div>
        </div>
      </div>

      {/* Top Projects */}
      <div className="card overview-top-projects-card">
        <div className="card-header">
          <div className="card-title">
            <TrophyIcon size={14} style={{ verticalAlign: "-1px", marginRight: 6, color: "var(--accent)" }} />
            Top Projects
          </div>
          <a className="form-link text-xs" style={{ cursor: "pointer" }} onClick={() => onNavigate?.("rankings")}>
            Open rankings →
          </a>
        </div>
        <div className="table-wrap overview-top-projects-wrap" style={{ border: "none" }}>
          <table className="overview-top-projects-table table-standard table-pill-balance">
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th>Project</th>
                <th>Team Members</th>
                <th style={{ textAlign: "right" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    Avg Score{totalMax > 0 ? ` (${totalMax})` : ""}
                    <PremiumTooltip
                      position="bottom"
                      text={
                        <span className="kpi-tip-wrap">
                          <span className="kpi-tip-title">Average Score</span>
                          <span className="kpi-tip-body">
                            Calculated from <strong>completed jurors only</strong> — jurors who have submitted their final evaluation. In-progress and editing evaluations are excluded to ensure score integrity.
                          </span>
                        </span>
                      }
                    >
                      <Info size={11} strokeWidth={2.5} className="kpi-label-info-icon" style={{ cursor: "default", flexShrink: 0 }} />
                    </PremiumTooltip>
                  </span>
                </th>
                <th>Highlight</th>
              </tr>
            </thead>
            <tbody ref={topProjectsScopeRef} data-testid="overview-top-projects-tbody" data-count={topProjects.length}>
              {topProjects.length === 0 && !loading ? (
                <tr className="es-row">
                  <td colSpan={5} style={{ padding: 0 }}>
                    <div className="vera-es-no-data">
                      <div className="vera-es-ghost-rows" aria-hidden="true">
                        <div className="vera-es-ghost-row">
                          <div className="vera-es-ghost-num"/><div className="vera-es-ghost-bar" style={{flex:1}}/><div className="vera-es-ghost-spacer"/><div className="vera-es-ghost-bar" style={{width:"10%"}}/>
                        </div>
                        <div className="vera-es-ghost-row">
                          <div className="vera-es-ghost-num"/><div className="vera-es-ghost-bar" style={{flex:1}}/><div className="vera-es-ghost-spacer"/><div className="vera-es-ghost-bar" style={{width:"10%"}}/>
                        </div>
                      </div>
                      <div className="vera-es-icon">
                        <Trophy size={22} strokeWidth={1.8}/>
                      </div>
                      <p className="vera-es-no-data-title">No Score Data Yet</p>
                      <p className="vera-es-no-data-desc">Top projects will appear here once jurors begin submitting scores.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                topProjects.map((p, i) => {
                  return (
                    <tr key={p.id} data-card-selectable="" className="mcard" data-testid={`overview-top-projects-row-${i + 1}`} data-project-id={p.id} data-total-avg={p.totalAvg ?? ""}>
                      <td className="col-rank text-center" data-label="Rank">
                        <span className="overview-top-rank">{i + 1}</span>
                      </td>
                      <td className="col-project" data-label="Project Title">
                        <div className="proj-title-row">
                          <span className="ranking-proj-no">{p.group_no != null ? `P${p.group_no}` : ""}</span>
                          <span className="proj-title-text">{p.title}</span>
                        </div>
                        {p.advisor && (() => {
                          const advisors = p.advisor.split(",").map((s) => s.trim()).filter(Boolean);
                          if (!advisors.length) return null;
                          return (
                            <div className="meta-chips-row overview-top-advisors">
                              <span className="meta-chips-eyebrow">Advised by</span>
                              {advisors.map((name, idx) => (
                                <JurorBadge key={`${name}-${idx}`} name={name} size="sm" nameOnly variant="advisor" />
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="col-students" data-label="Team Members">
                        <div className="meta-chips-row">
                          <span className="meta-chips-eyebrow">Team Members</span>
                          <TeamMemberNames names={p.members} />
                        </div>
                      </td>
                      {isPortraitMobile && p.advisor && (() => {
                        const advisors = p.advisor.split(",").map((s) => s.trim()).filter(Boolean);
                        if (!advisors.length) return null;
                        return (
                          <td className="col-advisors" aria-hidden="true">
                            <div className="meta-chips-row">
                              <span className="meta-chips-eyebrow">Advised by</span>
                              {advisors.map((name, idx) => (
                                <JurorBadge key={`${name}-${idx}`} name={name} size="sm" nameOnly variant="advisor" />
                              ))}
                            </div>
                          </td>
                        );
                      })()}
                      <td className="col-avg text-right" data-label="Avg Score">
                        <span className="overview-top-avg vera-score-num">{typeof p.totalAvg === "number" ? p.totalAvg.toFixed(1) : "—"}</span>
                        <AvgDonut value={p.totalAvg} max={100} />
                      </td>
                      <td className="col-highlight text-xs text-muted overview-top-highlight" data-label="Highlight">
                        {getProjectHighlight(p, criteriaConfig) ?? (p.count != null ? `Scored by ${p.count} juror${p.count !== 1 ? "s" : ""}` : "—")}
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>

    </>
  );
}
