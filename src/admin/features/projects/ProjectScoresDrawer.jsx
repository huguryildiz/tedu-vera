// src/admin/drawers/ProjectScoresDrawer.jsx
// Read-only drawer showing a single project's jury scores:
// KPI strip, per-criterion averages, juror breakdown, feedback.
//
// KPI numbers come from server-side aggregation (rpc_admin_project_summary,
// rpc_admin_period_summary), surfaced via useAdminContext as `summaryData`
// (per-project) and `periodSummary` (period-wide reference). The drawer
// performs zero client-side aggregation for averages — it only iterates
// `rawScores` for the per-juror breakdown rows.
//
// Props:
//   open          — boolean
//   onClose       — () => void
//   project       — { id, title, advisor, members[], group_no }
//   periodId      — string
//   periodLabel   — string
//   rawScores     — all score_sheets for the period (from useAdminContext)
//   summaryData   — per-project server-aggregated rows (id, totalAvg, totalPct, stdDevPct, rank, perCriterion, …)
//   periodSummary — period-wide reference summary { avgTotalPct, rankedCount, … }
//   allJurors     — period juror summaries (from useAdminContext)
//   onOpenReviews — () => void (navigate to Reviews page scoped to this project)

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, X, ArrowRight, FileText, AlertTriangle } from "lucide-react";
import Drawer from "@/shared/ui/Drawer";
import { TeamMembersInline } from "@/shared/ui/EntityMeta";
import JurorBadge from "@/admin/shared/JurorBadge";
import JurorStatusPill from "@/admin/shared/JurorStatusPill";
import { listPeriodCriteria } from "@/shared/api";
import { CRITERION_COLORS } from "@/admin/features/criteria/criteriaFormHelpers";
import { jurorInitials, jurorAvatarBg, jurorAvatarFg } from "@/admin/utils/jurorIdentity";

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

export default function ProjectScoresDrawer({
  open,
  onClose,
  project,
  periodId,
  periodLabel,
  rawScores = [],
  summaryData = [],
  periodSummary = null,
  allJurors = [],
  onOpenReviews,
}) {
  const [criteria, setCriteria] = useState([]);
  const [loadingCriteria, setLoadingCriteria] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!open || !periodId) return undefined;
    setLoadingCriteria(true);
    listPeriodCriteria(periodId)
      .then((rows) => { if (!cancelled) setCriteria(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setCriteria([]); })
      .finally(() => { if (!cancelled) setLoadingCriteria(false); });
    return () => { cancelled = true; };
  }, [open, periodId]);

  const projectId = project?.id || null;

  const criteriaWithColor = useMemo(() =>
    criteria.map((c, i) => ({
      ...c,
      resolvedColor: c.color || CRITERION_COLORS[i % CRITERION_COLORS.length],
    })),
    [criteria]
  );

  const memberList = useMemo(() => {
    const m = project?.members;
    if (!m) return [];
    if (Array.isArray(m)) {
      return m
        .map((x) => (typeof x === "string" ? x : x?.name || ""))
        .map((s) => String(s).trim())
        .filter(Boolean);
    }
    if (typeof m === "string") return m.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    return [];
  }, [project]);

  // Score sheets for this project (used only for the per-juror breakdown).
  // Aggregations come from `summaryData[i]`, not from re-iterating these.
  const sheets = useMemo(() => {
    if (!projectId) return [];
    return rawScores.filter((r) => (r.projectId || r.project_id) === projectId);
  }, [rawScores, projectId]);

  // Server-aggregated row for this project (single source of truth for the
  // KPI strip and criterion averages). Falls back to {} so drawer renders
  // an empty-state strip while data loads.
  const projectRow = useMemo(() => {
    if (!Array.isArray(summaryData) || !projectId) return null;
    return summaryData.find((r) => r.id === projectId) || null;
  }, [summaryData, projectId]);

  const finalScorePct  = projectRow?.totalPct ?? null;          // 0–100 normalized
  const stdDevPct      = projectRow?.stdDevPct ?? null;
  const rank           = projectRow?.rank ?? null;
  const rankedCount    = periodSummary?.rankedCount ?? null;
  const overallAvgPct  = periodSummary?.avgTotalPct ?? null;
  const submittedCount = projectRow?.submittedCount ?? 0;
  const assignedCount  = projectRow?.assignedCount ?? (Array.isArray(allJurors) ? allJurors.length : 0);

  // Per-criterion strip from the RPC's `per_criterion` JSONB, joined with
  // the criteria metadata (label, color, group). Display uses the
  // server-computed `pct` directly.
  const criteriaRows = useMemo(() => {
    if (!criteria.length) return [];
    const perCrit = projectRow?.perCriterion || {};
    return criteria
      .map((c) => {
        const info = perCrit[c.key];
        if (!info) return null;
        const mean = info.avg ?? null;
        const maxScore = Number(info.max ?? c.max_score) || 20;
        const pct = info.pct ?? null;
        const band = pct != null ? bandFor(pct) : null;
        return {
          key: c.key,
          label: c.label || c.key,
          group: c.group || null,
          maxScore,
          mean,
          pct,
          band,
        };
      })
      .filter(Boolean);
  }, [criteria, projectRow]);

  // Per-juror breakdown rows. This is NOT an aggregation — it's the per-
  // juror sheet display. Outlier detection uses the server-supplied total
  // mean (totalAvg) and stdDevPct (rescaled to raw via totalMax).
  const jurorRows = useMemo(() => {
    const byJuror = new Map();
    for (const s of sheets) {
      const jid = s.jurorId || s.juror_id;
      if (!jid) continue;
      byJuror.set(jid, s);
    }
    const mean = projectRow?.totalAvg ?? 0;
    // Rescale stdDevPct (0..100) back to the raw total-score scale using
    // the period's total_max so the 1.5σ outlier threshold compares like
    // for like.
    const totalMax = periodSummary?.totalMax ?? 100;
    const sd = stdDevPct != null ? (stdDevPct * totalMax) / 100 : 0;
    const rows = [];
    for (const [jid, s] of byJuror) {
      const total = Number(s.total);
      const isOutlier =
        s.status === "submitted" &&
        sd > 0 &&
        Number.isFinite(total) &&
        Math.abs(total - mean) > 1.5 * sd;
      rows.push({
        jurorId: jid,
        name: s.juryName || s.jury_name || "Unknown juror",
        affiliation: s.affiliation || "",
        status: s.status || "draft",
        total: Number.isFinite(total) ? total : null,
        comments: (s.comments || "").trim(),
        outlier: isOutlier,
        updatedAt: s.updatedAt || s.updated_at || null,
        sheet: s,
      });
    }
    rows.sort((a, b) => {
      if (a.status !== b.status) return a.status === "submitted" ? -1 : 1;
      return (b.total ?? -1) - (a.total ?? -1);
    });
    return rows;
  }, [sheets, projectRow, stdDevPct, periodSummary]);

  const feedbackRows = jurorRows.filter((j) => j.comments);

  const deltaVsAvg =
    finalScorePct != null && overallAvgPct != null
      ? finalScorePct - overallAvgPct
      : null;

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
            <div className="fs-icon identity">
              <ClipboardList size={17} strokeWidth={2} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="fs-title-eyebrow">Project Scores</div>
              <div className="fs-title" style={{ lineHeight: 1.25 }}>
                {project?.title || "Untitled project"}
              </div>
              {periodLabel && (
                <div className="psd-submeta">
                  <span className="psd-period-pill">{periodLabel}</span>
                </div>
              )}
              {memberList.length > 0 && (
                <div className="psd-members-row">
                  <TeamMembersInline names={memberList} />
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
            <div className="psd-kpi-label">Final Score</div>
            <div className="psd-kpi-value psd-kpi-value--accent">
              {finalScorePct != null ? Number(finalScorePct).toFixed(1) : "—"}
            </div>
            <div className={`psd-kpi-delta ${deltaVsAvg != null && deltaVsAvg >= 0 ? "up" : deltaVsAvg != null ? "down" : ""}`}>
              {deltaVsAvg != null
                ? `${deltaVsAvg >= 0 ? "▲" : "▼"} ${Math.abs(deltaVsAvg).toFixed(1)} vs avg`
                : "no data"}
            </div>
          </div>
          <div className="psd-kpi">
            <div className="psd-kpi-label">Submitted</div>
            <div className="psd-kpi-value">
              {submittedCount}
              <span className="psd-kpi-denom">/{assignedCount || "—"}</span>
            </div>
            <div className="psd-kpi-delta">
              {assignedCount - submittedCount > 0
                ? `${assignedCount - submittedCount} in progress`
                : "complete"}
            </div>
          </div>
          <div className="psd-kpi">
            <div className="psd-kpi-label">Std Dev</div>
            <div className="psd-kpi-value">
              {stdDevPct != null ? Number(stdDevPct).toFixed(1) : "—"}
            </div>
            <div className="psd-kpi-delta">
              {stdDevPct == null
                ? "—"
                : stdDevPct < 3 ? "Low variance"
                : stdDevPct < 6 ? "Moderate"
                : "High variance"}
            </div>
          </div>
          <div className="psd-kpi">
            <div className="psd-kpi-label">Rank</div>
            <div className="psd-kpi-value">
              {rank ? `#${rank}` : "—"}
              {rank && rankedCount ? <span className="psd-kpi-denom">/{rankedCount}</span> : null}
            </div>
            <div className={`psd-kpi-delta ${rank && rankedCount && rank / rankedCount <= 0.25 ? "up" : ""}`}>
              {rank && rankedCount
                ? `Top ${Math.max(1, Math.round((rank / rankedCount) * 100))}%`
                : "—"}
            </div>
          </div>
        </div>

        {/* Criterion averages */}
        <div className="psd-sec">
          <div className="psd-sec-head">
            <div className="psd-sec-title">Criterion Averages</div>
            <div className="psd-sec-hint">
              across {submittedCount} submitted review{submittedCount !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="psd-crit-card">
            {loadingCriteria && (
              <div className="psd-empty">Loading criteria…</div>
            )}
            {!loadingCriteria && criteriaRows.length === 0 && (
              <div className="psd-empty">No submitted scores yet.</div>
            )}
            {!loadingCriteria && criteriaRows.map((c) => (
              <div key={c.key} className="psd-crit-row">
                <div className="psd-crit-name-wrap">
                  <div className="psd-crit-name">{c.label}</div>
                  {c.group && <div className="psd-crit-group">{c.group}</div>}
                </div>
                <div className="psd-bar-track">
                  <div
                    className={`psd-bar-fill ${c.band?.key === "excel" ? "good" : c.band?.key === "fair" || c.band?.key === "poor" ? "warn" : ""}`}
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

        {/* Juror breakdown */}
        <div className="psd-sec">
          <div className="psd-sec-head">
            <div className="psd-sec-title">Juror Breakdown</div>
            <div className="psd-sec-hint">
              {jurorRows.length} juror{jurorRows.length !== 1 ? "s" : ""}
            </div>
          </div>
          {jurorRows.length === 0 ? (
            <div className="psd-empty psd-empty-card">No juror activity yet.</div>
          ) : (
            jurorRows.map((j) => (
              <div key={j.jurorId} className="psd-juror-row jsd-proj-row">
                <div className="jsd-group">
                  <div
                    style={{
                      width: 22, height: 22, borderRadius: "50%",
                      background: jurorAvatarBg(j.name), color: jurorAvatarFg(j.name),
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: 8, fontWeight: 700, letterSpacing: "-0.3px", flexShrink: 0, lineHeight: 1,
                    }}
                  >
                    {jurorInitials(j.name)}
                  </div>
                </div>
                <div className="jsd-proj-content">
                  <div className="jsd-proj-header">
                    <div className="jsd-proj-name">
                      <span>{j.name}</span>
                      {j.affiliation && (
                        <span className="jsd-proj-affiliation">{j.affiliation}</span>
                      )}
                    </div>
                    <div className="jsd-proj-right">
                      <JurorStatusPill status={j.status === "submitted" ? "completed" : "in_progress"} />
                      {j.outlier && (
                        <span className="psd-tag outlier">
                          <AlertTriangle size={10} strokeWidth={2.4} />
                          Outlier
                        </span>
                      )}
                      <span className={`jsd-total-score ${j.total == null ? "muted" : ""}`}>
                        {j.total != null ? j.total.toFixed(1) : "—"}
                      </span>
                    </div>
                  </div>
                  {j.sheet && criteriaWithColor.length > 0 && (
                    <div className="jsd-crit-bars">
                      {criteriaWithColor.map((c) => (
                        <CritBar
                          key={c.key}
                          label={c.label}
                          color={c.resolvedColor}
                          val={j.sheet?.[c.key] ?? null}
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

        {/* Feedback */}
        {feedbackRows.length > 0 && (
          <div className="psd-sec">
            <div className="psd-sec-head">
              <div className="psd-sec-title">Juror Feedback</div>
              <div className="psd-sec-hint">
                {feedbackRows.length} comment{feedbackRows.length !== 1 ? "s" : ""}
              </div>
            </div>
            {feedbackRows.map((j) => (
              <div key={j.jurorId} className="psd-fb">
                <div className="psd-fb-head">
                  <JurorBadge name={j.name} affiliation={j.affiliation} size="sm" nameOnly />
                </div>
                <p className="psd-fb-text">{j.comments}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="fs-drawer-footer">
        <button className="fs-btn fs-btn-secondary" type="button" onClick={onClose}>
          Close
        </button>
        <button
          className="fs-btn fs-btn-primary"
          type="button"
          onClick={() => {
            onClose?.();
            onOpenReviews?.(project);
          }}
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
