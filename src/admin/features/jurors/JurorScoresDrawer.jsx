// src/admin/drawers/JurorScoresDrawer.jsx
//
// KPI numbers (Avg Score, Std Dev, Completion, "vs avg" delta) come from
// server-side aggregation — `jurorSummary[i]` (rpc_admin_juror_summary) and
// `periodSummary` (rpc_admin_period_summary). The drawer iterates rawScores
// only for the per-project breakdown rows.
//
// The per-criterion strip is still computed in JS because the per-juror
// summary RPC returns aggregations across all of the juror's projects, not
// per-juror × per-criterion. Cost is small (one juror × ~5 criteria ×
// ~5–10 projects) so a dedicated RPC is unjustified.

import { useEffect, useMemo, useState } from "react";
import { Users, X, ArrowRight, FileText } from "lucide-react";
import Drawer from "@/shared/ui/Drawer";
import JurorStatusPill from "@/admin/shared/JurorStatusPill";
import ScoreStatusPill from "@/admin/shared/ScoreStatusPill";
import { listPeriodCriteria } from "@/shared/api";
import { CRITERION_COLORS } from "@/admin/features/criteria/criteriaFormHelpers";

function bandFor(pct) {
  if (pct >= 85) return { key: "excel", label: "Excellent" };
  if (pct >= 70) return { key: "good", label: "Good" };
  if (pct >= 55) return { key: "fair", label: "Fair" };
  return { key: "poor", label: "Poor" };
}

function CritBar({ label, color, val, maxScore }) {
  const pct = val != null && maxScore > 0 ? Math.min(100, (val / maxScore) * 100) : 0;
  return (
    <div className="jsd-crit-bar-row">
      <div className="jsd-crit-bar-label">{label}</div>
      <div className="jsd-bar-track">
        {val != null && (
          <div className="jsd-bar-fill" style={{ width: `${pct}%`, backgroundColor: color }} />
        )}
      </div>
      <div className="jsd-crit-bar-score">
        {val != null ? (
          <>
            <span className="jsd-score-val" style={{ color }}>{val}</span>
            <span className="jsd-score-max">/{maxScore}</span>
          </>
        ) : (
          <span className="jsd-score-empty">—</span>
        )}
      </div>
    </div>
  );
}

export default function JurorScoresDrawer({
  open,
  onClose,
  juror,
  periodId,
  periodLabel,
  scoreRows = [],
  projects = [],
  jurorSummary = [],
  periodSummary = null,
  onOpenReviews,
}) {
  const jurorId = juror?.jurorId || juror?.juror_id;
  const jurorName = juror?.juryName || juror?.juror_name || "Unknown Juror";
  const affiliation = juror?.affiliation || "";

  const [criteria, setCriteria] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!open || !periodId) return undefined;
    listPeriodCriteria(periodId)
      .then((rows) => { if (!cancelled) setCriteria(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setCriteria([]); });
    return () => { cancelled = true; };
  }, [open, periodId]);

  const criteriaWithColor = useMemo(() =>
    criteria.map((c, i) => ({
      ...c,
      resolvedColor: c.color || CRITERION_COLORS[i % CRITERION_COLORS.length],
    })),
    [criteria]
  );

  // Latest sheet per project for this juror
  const sheetByProject = useMemo(() => {
    const map = new Map();
    if (!jurorId) return map;
    for (const r of scoreRows) {
      if (String(r.jurorId || r.juror_id || "") !== String(jurorId)) continue;
      const pid = String(r.projectId || r.project_id || "");
      if (!pid) continue;
      const prev = map.get(pid);
      const prevTs = new Date(prev?.updatedAt || prev?.createdAt || 0).getTime();
      const curTs = new Date(r.updatedAt || r.createdAt || 0).getTime();
      if (!prev || curTs >= prevTs) map.set(pid, r);
    }
    return map;
  }, [scoreRows, jurorId]);

  const projectRows = useMemo(() => {
    const rows = (projects || []).map((p) => {
      const pid = String(p.id || p.project_id || "");
      const sheet = sheetByProject.get(pid);
      const total = typeof sheet?.total === "number" ? sheet.total : null;
      let statusPill = "empty";
      if (sheet?.status === "submitted") statusPill = "scored";
      else if (total != null && total > 0) statusPill = "partial";

      return {
        pid,
        groupNo: p.project_no ?? p.group_no ?? null,
        projectName: p.title || "Untitled Project",
        total,
        statusPill,
        submitted: sheet?.status === "submitted",
        hasSheet: !!sheet,
        sheet,
      };
    });

    return rows.sort((a, b) => {
      const ag = Number(a.groupNo);
      const bg = Number(b.groupNo);
      if (Number.isFinite(ag) && Number.isFinite(bg) && ag !== bg) return ag - bg;
      if (Number.isFinite(ag)) return -1;
      if (Number.isFinite(bg)) return 1;
      return String(a.projectName).localeCompare(String(b.projectName), "tr");
    });
  }, [projects, sheetByProject]);

  const submittedRows = useMemo(() => projectRows.filter((r) => r.submitted), [projectRows]);

  // Server-aggregated row for this juror (single source of truth for the
  // KPI strip). `jurorSummary` is one row per juror in juror_period_auth.
  const jurorRow = useMemo(() => {
    if (!Array.isArray(jurorSummary) || !jurorId) return null;
    return jurorSummary.find((r) => String(r.jurorId) === String(jurorId)) || null;
  }, [jurorSummary, jurorId]);

  const avgScorePct  = jurorRow?.avgTotalPct ?? null;
  const stdDevPct    = jurorRow?.stdDevPct ?? null;
  const completionPct =
    jurorRow?.completionPct != null
      ? Math.round(jurorRow.completionPct)
      : (projectRows.length > 0
          ? Math.round((submittedRows.length / projectRows.length) * 100)
          : null);
  const periodAvgPct = periodSummary?.avgJurorPct ?? null;
  const deltaVsAvg =
    avgScorePct != null && periodAvgPct != null ? avgScorePct - periodAvgPct : null;

  const criteriaRows = useMemo(() => {
    if (!criteriaWithColor.length || !submittedRows.length) return [];
    return criteriaWithColor.map((c) => {
      const maxScore = Number(c.max_score) || 20;
      const vals = submittedRows
        .map((r) => Number(r.sheet?.[c.key]))
        .filter(Number.isFinite);
      const mean = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      const pct = mean != null ? (mean / maxScore) * 100 : null;
      const band = pct != null ? bandFor(pct) : null;
      return { key: c.key, label: c.label, group: c.group || null, maxScore, mean, pct, band };
    });
  }, [criteriaWithColor, submittedRows]);

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
            <div className="fs-icon identity">
              <Users size={17} strokeWidth={2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="fs-title-eyebrow">Juror Scores</div>
              <div className="fs-title" style={{ lineHeight: 1.25 }}>{jurorName}</div>
              {(affiliation || periodLabel) && (
                <div className="psd-submeta">
                  {affiliation && <span className="psd-members">{affiliation}</span>}
                  {affiliation && periodLabel && <span className="psd-sep">·</span>}
                  {periodLabel && <span className="psd-period-pill">{periodLabel}</span>}
                </div>
              )}
            </div>
          </div>
          <button className="fs-close" type="button" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="fs-drawer-body psd-body">
        {/* KPI strip */}
        <div className="psd-kpi-row">
          <div className="psd-kpi">
            <div className="psd-kpi-label">Avg Score</div>
            <div className="psd-kpi-value psd-kpi-value--accent">
              {avgScorePct != null ? Number(avgScorePct).toFixed(1) : "—"}
            </div>
            <div className={`psd-kpi-delta ${deltaVsAvg != null && deltaVsAvg >= 0 ? "up" : deltaVsAvg != null ? "down" : ""}`}>
              {deltaVsAvg != null
                ? `${deltaVsAvg >= 0 ? "▲" : "▼"} ${Math.abs(deltaVsAvg).toFixed(1)} vs avg`
                : "no data"}
            </div>
          </div>
          <div className="psd-kpi">
            <div className="psd-kpi-label">Projects Scored</div>
            <div className="psd-kpi-value">
              {submittedRows.length}
              <span className="psd-kpi-denom">/{projectRows.length || "—"}</span>
            </div>
            <div className="psd-kpi-delta">
              {projectRows.length - submittedRows.length > 0
                ? `${projectRows.length - submittedRows.length} remaining`
                : submittedRows.length > 0 ? "complete" : "no submissions"}
            </div>
          </div>
          <div className="psd-kpi">
            <div className="psd-kpi-label">Std Dev</div>
            <div className="psd-kpi-value">{stdDevPct != null ? Number(stdDevPct).toFixed(1) : "—"}</div>
            <div className="psd-kpi-delta">
              {stdDevPct == null
                ? "—"
                : stdDevPct < 3 ? "Low variance"
                : stdDevPct < 6 ? "Moderate"
                : "High variance"}
            </div>
          </div>
          <div className="psd-kpi">
            <div className="psd-kpi-label">Completion</div>
            <div className="psd-kpi-value">
              {completionPct != null ? `${completionPct}` : "—"}
              {completionPct != null && <span className="psd-kpi-denom">%</span>}
            </div>
            <div className={`psd-kpi-delta ${completionPct === 100 ? "up" : ""}`}>
              {completionPct === 100 ? "all done"
                : completionPct != null ? `${100 - completionPct}% remaining` : "—"}
            </div>
          </div>
        </div>

        {/* Criterion averages */}
        <div className="psd-sec">
          <div className="psd-sec-head">
            <div className="psd-sec-title">Criterion Averages</div>
            <div className="psd-sec-hint">
              across {submittedRows.length} submitted review{submittedRows.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="psd-crit-card">
            {criteriaRows.length === 0 && (
              <div className="psd-empty">No submitted scores yet.</div>
            )}
            {criteriaRows.map((c) => (
              <div key={c.key} className="psd-crit-row">
                <div className="psd-crit-name-wrap">
                  <div className="psd-crit-name">{c.label}</div>
                  {c.group && <div className="psd-crit-group">{c.group}</div>}
                </div>
                <div className="psd-bar-track">
                  <div
                    className={`psd-bar-fill ${(c.band?.key === "excel" || c.band?.key === "good") ? "good" : (c.band?.key === "fair" || c.band?.key === "poor") ? "warn" : ""}`}
                    style={{ width: `${Math.max(0, Math.min(100, c.pct ?? 0))}%` }}
                  />
                </div>
                <div className="psd-crit-score">
                  {c.mean != null ? c.mean.toFixed(1) : "—"}
                </div>
                {c.band ? (
                  <div className={`psd-crit-band ${c.band.key}`}>{c.band.label}</div>
                ) : (
                  <div className="psd-crit-band muted">—</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Project breakdown */}
        <div className="psd-sec">
          <div className="psd-sec-head">
            <div className="psd-sec-title">Project Breakdown</div>
            <div className="psd-sec-hint">
              {projectRows.length} project{projectRows.length !== 1 ? "s" : ""}
            </div>
          </div>
          {projectRows.length === 0 ? (
            <div className="psd-empty psd-empty-card">No projects assigned yet.</div>
          ) : (
            projectRows.map((row) => (
              <div key={row.pid} className="psd-juror-row jsd-proj-row">
                <div className="jsd-group">
                  {row.groupNo != null
                    ? <span className="project-no-badge">P{row.groupNo}</span>
                    : <span className="jsd-no-group">—</span>}
                </div>
                <div className="jsd-proj-content">
                  <div className="jsd-proj-header">
                    <div className="jsd-proj-name">{row.projectName}</div>
                    <div className="jsd-proj-right">
                      <ScoreStatusPill status={row.statusPill} />
                      <span className={`jsd-total-score ${row.total == null ? "muted" : ""}`}>
                        {row.total != null ? row.total.toFixed(1) : "—"}
                      </span>
                    </div>
                  </div>
                  {row.hasSheet && criteriaWithColor.length > 0 && (
                    <div className="jsd-crit-bars">
                      {criteriaWithColor.map((c) => (
                        <CritBar
                          key={c.key}
                          label={c.label}
                          color={c.resolvedColor}
                          val={row.sheet?.[c.key] ?? null}
                          maxScore={Number(c.max_score) || 20}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="fs-drawer-footer">
        <button className="fs-btn fs-btn-secondary" type="button" onClick={onClose}>
          Close
        </button>
        <button
          className="fs-btn fs-btn-primary"
          type="button"
          onClick={() => { onClose?.(); onOpenReviews?.(); }}
          disabled={!onOpenReviews}
        >
          <FileText size={13} strokeWidth={2} />
          Open in Reviews
          <ArrowRight size={13} strokeWidth={2} />
        </button>
      </div>
    </Drawer>
  );
}
