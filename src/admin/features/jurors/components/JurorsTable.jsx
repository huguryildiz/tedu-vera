import {
  SquarePen,
  RotateCcw,
  Lock,
  KeyRound,
  ClipboardList,
  Trash2,
  MoreVertical,
  Pencil,
  Users,
  Upload,
  Search,
  Plus,
  Info,
  XCircle,
  Bell,
  Clock,
} from "lucide-react";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import FloatingMenu from "@/shared/ui/FloatingMenu";
import { formatDateTime as formatFull } from "@/shared/lib/dateUtils";
import JurorBadge from "@/admin/shared/JurorBadge";
import JurorStatusPill from "@/admin/shared/JurorStatusPill";
import { jurorInitials, jurorAvatarBg, jurorAvatarFg } from "@/admin/utils/jurorIdentity";
import SortIcon from "./SortIcon";
import {
  formatRelative,
  getLiveOverviewStatus,
  groupBarColor,
  groupTextClass,
} from "./jurorHelpers";

function scoreBandColor(score, maxScore) {
  if (score == null || !Number.isFinite(Number(score))) return "var(--text-tertiary)";
  const pct = (Number(score) / (maxScore || 100)) * 100;
  if (pct >= 85) return "var(--success)";
  if (pct >= 70) return "var(--warning)";
  return "var(--danger)";
}

function JurorRow({
  juror,
  editWindowNowMs,
  periodMaxScore,
  jurorAvgMap,
  openMenuId,
  setOpenMenuId,
  shouldUseCardLayout,
  isGraceLocked,
  graceLockTooltip,
  isPeriodLocked,
  onEdit,
  onPinReset,
  onRemove,
  onEnableEdit,
  onViewScores,
  onNotify,
}) {
  const jid = juror.juror_id || juror.jurorId;
  const name = juror.juryName || juror.juror_name || "";
  const scored = juror.overviewScoredProjects || 0;
  const total = juror.overviewTotalProjects || 0;
  const pct = total > 0 ? Math.round((scored / total) * 100) : 0;
  const status = getLiveOverviewStatus(juror, editWindowNowMs);
  const lastActive = juror.lastSeenAt || juror.last_activity_at || juror.finalSubmittedAt || juror.final_submitted_at;

  const periodLockedTooltip = isPeriodLocked
    ? "Evaluation period is locked. Unlock the period to make changes."
    : null;

  const menuItems = (isMobile) => (
    <>
      <PremiumTooltip text={periodLockedTooltip} position="left">
        <button
          className={`floating-menu-item${isPeriodLocked ? " disabled" : ""}`}
          onMouseDown={() => { if (isPeriodLocked) return; setOpenMenuId(null); onEdit(juror); }}
          disabled={isPeriodLocked}
          data-testid={`jurors-row-edit-${jid}`}
        >
          {isMobile ? <SquarePen size={13} /> : <Pencil size={13} />}
          Edit Juror
        </button>
      </PremiumTooltip>
      <button className="floating-menu-item" onMouseDown={() => { setOpenMenuId(null); onPinReset(juror); }}>
        <KeyRound size={13} />
        Reset PIN
      </button>
      {status !== "editing" && (
        status === "completed" ? (
          <button className="floating-menu-item" onMouseDown={() => { setOpenMenuId(null); onEnableEdit(juror); }} data-testid={`jurors-row-reopen-${jid}`}>
            <RotateCcw size={13} />
            Reopen Evaluation
          </button>
        ) : isMobile ? (
          <button className="floating-menu-item disabled" disabled>
            <Lock size={13} />
            Reopen Evaluation
          </button>
        ) : (
          <PremiumTooltip text="Juror must complete their submission before evaluation can be reopened.">
            <button className="floating-menu-item disabled" disabled>
              <Lock size={13} />
              Reopen Evaluation
            </button>
          </PremiumTooltip>
        )
      )}
      <button className="floating-menu-item floating-menu-item--highlight" onMouseDown={() => { setOpenMenuId(null); onViewScores(juror); }}>
        <ClipboardList size={13} />
        View Scores
      </button>
      {juror.email && (
        <PremiumTooltip text={graceLockTooltip} position="left">
          <button
            className={`floating-menu-item${isGraceLocked ? " disabled" : ""}`}
            onMouseDown={() => { if (isGraceLocked) return; setOpenMenuId(null); onNotify(juror); }}
            disabled={isGraceLocked}
          >
            <Bell size={13} />
            Notify Juror
          </button>
        </PremiumTooltip>
      )}
      <div className="floating-menu-divider" />
      <PremiumTooltip text={periodLockedTooltip} position="left">
        <button
          className={`floating-menu-item danger${isPeriodLocked ? " disabled" : ""}`}
          onMouseDown={() => { if (isPeriodLocked) return; setOpenMenuId(null); onRemove(juror); }}
          disabled={isPeriodLocked}
          data-testid={`jurors-row-delete-${jid}`}
        >
          <Trash2 size={13} />
          Delete Juror
        </button>
      </PremiumTooltip>
    </>
  );

  return (
    <tr key={jid} className="mcard" data-card-selectable="">
      <td className="col-juror">
        <JurorBadge name={name} affiliation={juror.affiliation} size="sm" />
      </td>
      <td className="col-projects text-center">
        <span className={groupTextClass(scored, total)}>
          {scored} / {total}
          <span className="jurors-group-bar">
            <span className="jurors-group-bar-fill" style={{ width: `${pct}%`, background: groupBarColor(scored, total) }} />
          </span>
        </span>
      </td>
      <td className="col-avg text-center avg-score-cell">
        {jurorAvgMap.get(String(jid)) ? (
          <>
            <span className="vera-score-num">{jurorAvgMap.get(String(jid))}</span>
            <span className="vera-score-denom">/100</span>
          </>
        ) : (
          <span className="avg-score-empty">—</span>
        )}
      </td>
      <td className="col-status">
        <JurorStatusPill status={status} />
      </td>
      <td className="col-active jurors-table-active">
        <PremiumTooltip text={formatFull(lastActive)}>
          <span className="vera-datetime-text">{formatRelative(lastActive)}</span>
        </PremiumTooltip>
      </td>
      <td className="col-actions" style={{ textAlign: "right" }}>
        <FloatingMenu
          isOpen={openMenuId === jid && !shouldUseCardLayout}
          onClose={() => setOpenMenuId(null)}
          placement="bottom-end"
          trigger={
            <button
              className="row-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId((prev) => (prev === jid ? null : jid));
              }}
              title="Actions"
              data-testid={`jurors-row-kebab-${jid}`}
            >
              <MoreVertical size={18} strokeWidth={2} />
            </button>
          }
        >
          {menuItems(false)}
        </FloatingMenu>
      </td>
      {/* Mobile card — hidden on desktop, shown at ≤768px portrait */}
      <td className="col-mobile-card">
        <div className="jc">
          <div className="jc-row1">
            {(() => {
              const avgRaw = jurorAvgMap.get(String(jid));
              const avgNum = avgRaw != null ? Number(avgRaw) : null;
              const maxScore = periodMaxScore || 100;
              const hasAvg = avgNum != null && Number.isFinite(avgNum);
              const ringColor = scoreBandColor(avgNum, maxScore);
              const ringDeg = hasAvg ? Math.min(360, (avgNum / maxScore) * 360) : 0;
              return (
                <div className="jc-ring-wrap">
                  <span
                    className="jc-ring-fill"
                    style={{ "--pct": `${ringDeg}deg`, "--ring": ringColor }}
                  >
                    <span className="jc-ring-inner">
                      <span className="jc-ring-num" style={{ color: ringColor }}>
                        {hasAvg ? Number(avgNum).toFixed(1) : "—"}
                      </span>
                    </span>
                  </span>
                </div>
              );
            })()}
            <div className="jc-meta">
              <div className="jc-name-row">
                <span className="jc-name">{name}</span>
                <JurorStatusPill status={status} />
              </div>
              {juror.affiliation && (
                <span className="jc-org">{juror.affiliation}</span>
              )}
            </div>
            <FloatingMenu
              isOpen={openMenuId === jid && shouldUseCardLayout}
              onClose={() => setOpenMenuId(null)}
              placement="bottom-end"
              trigger={
                <button
                  className="row-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId((prev) => (prev === jid ? null : jid));
                  }}
                >
                  <MoreVertical size={18} strokeWidth={2} />
                </button>
              }
            >
              {menuItems(true)}
            </FloatingMenu>
          </div>

          <div className="jc-row2">
            <span className="jc-prog-label">PROG</span>
            <div className="jc-bar">
              {total > 0 && (
                <div
                  className={`jc-bar-fill${scored >= total ? " fill-complete" : " fill-partial"}`}
                  style={{ width: `${Math.min(100, Math.round((scored / total) * 100))}%` }}
                />
              )}
            </div>
            <span className={`jc-frac${total === 0 ? " frac-none" : scored >= total ? " frac-done" : " frac-partial"}`}>
              {scored}/{total}
            </span>
            <span className="jc-last-divider" aria-hidden="true" />
            <span className="jc-last">
              <Clock size={10} strokeWidth={2} className="jc-last-clock" />
              {lastActive ? formatRelative(lastActive) : "—"}
            </span>
          </div>
        </div>
      </td>
    </tr>
  );
}

export default function JurorsTable({
  pagedList,
  loadingCount,
  filteredList,
  jurorList,
  periodMaxScore,
  jurorAvgMap,
  editWindowNowMs,
  sortKey,
  sortDir,
  openMenuId,
  setOpenMenuId,
  rowsScopeRef,
  shouldUseCardLayout,
  isGraceLocked,
  graceLockTooltip,
  isPeriodLocked,
  activeFilterCount,
  search,
  onSort,
  onEdit,
  onPinReset,
  onRemove,
  onEnableEdit,
  onViewScores,
  onNotify,
  onClearSearch,
  onClearFilters,
  onAddJuror,
  onImport,
  onNavigatePeriods,
  viewPeriodId,
  periodList,
}) {
  return (
    <div className="table-wrap table-wrap--split">
      <table id="jurors-main-table" className="table-standard table-pill-balance" style={{ tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          <col />{/* Juror Name — flexible */}
          <col style={{ width: 92 }} />{/* Projects Evaluated */}
          <col style={{ width: 92 }} />{/* Average Score */}
          <col style={{ width: 96 }} />{/* Status */}
          <col style={{ width: 100 }} />{/* Last Active */}
          <col style={{ width: 44 }} />{/* Actions */}
        </colgroup>
        <thead>
          <tr>
            <th className={`sortable${sortKey === "name" ? " sorted" : ""}`} onClick={() => onSort("name")}>
              Juror Name <SortIcon colKey="name" sortKey={sortKey} sortDir={sortDir} />
            </th>
            <th className={`text-center sortable${sortKey === "progress" ? " sorted" : ""}`} onClick={() => onSort("progress")}>
              Projects Evaluated <SortIcon colKey="progress" sortKey={sortKey} sortDir={sortDir} />
            </th>
            <th className={`text-center sortable${sortKey === "avgScore" ? " sorted" : ""}`} onClick={() => onSort("avgScore")}>
              Average Score{periodMaxScore != null ? ` (${periodMaxScore})` : ""} <SortIcon colKey="avgScore" sortKey={sortKey} sortDir={sortDir} />
            </th>
            <th className={`sortable${sortKey === "status" ? " sorted" : ""}`} onClick={() => onSort("status")}>
              Juror Progress <SortIcon colKey="status" sortKey={sortKey} sortDir={sortDir} />
            </th>
            <th className={`sortable${sortKey === "lastActive" ? " sorted" : ""}`} onClick={() => onSort("lastActive")}>
              Last Active <SortIcon colKey="lastActive" sortKey={sortKey} sortDir={sortDir} />
            </th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody ref={rowsScopeRef} className={openMenuId ? "has-open-menu" : ""}>
          {loadingCount > 0 && filteredList.length === 0 ? (
            <tr>
              <td colSpan={6} style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "32px" }}>
                Loading jurors…
              </td>
            </tr>
          ) : filteredList.length === 0 ? (
            <tr className="es-row">
              <td colSpan={6} style={{ padding: 0 }}>
                {!viewPeriodId && !periodList?.length ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "40px 24px" }}>
                    <div className="vera-es-card">
                      <div className="vera-es-hero vera-es-hero--fw">
                        <div className="vera-es-icon">
                          <Users size={22} strokeWidth={1.65} />
                        </div>
                        <div>
                          <div className="vera-es-title">No evaluation periods yet</div>
                          <div className="vera-es-desc">
                            Jurors are tied to an evaluation period. Create a period first to define the timeline and framework, then assign jurors to it.
                          </div>
                        </div>
                      </div>
                      <div className="vera-es-actions">
                        <button
                          className="vera-es-action vera-es-action--primary-fw"
                          onClick={onNavigatePeriods}
                        >
                          <div className="vera-es-num vera-es-num--fw">1</div>
                          <div className="vera-es-action-text">
                            <div className="vera-es-action-label">Go to Evaluation Periods</div>
                            <div className="vera-es-action-sub">Create a period to unlock juror management</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : !viewPeriodId ? (
                  <div style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-tertiary)", fontSize: 13 }}>
                    Select an evaluation period above to manage jurors.
                  </div>
                ) : jurorList.length > 0 ? (
                  <div className="vera-es-no-data">
                    <div className="vera-es-icon">
                      <Search size={20} strokeWidth={1.8} />
                    </div>
                    <div className="vera-es-no-data-title">No jurors match your filters</div>
                    <div className="vera-es-no-data-desc">
                      {activeFilterCount > 0 && search.trim()
                        ? "Try adjusting your search or clearing active filters to see more jurors."
                        : activeFilterCount > 0
                          ? "Try adjusting or clearing the active filters to see more jurors."
                          : "No jurors match your current search. Try a different keyword."}
                    </div>
                    <div className="vera-es-no-data-actions">
                      {search.trim() && (
                        <button className="btn btn-outline btn-sm" onClick={onClearSearch}>
                          <XCircle size={13} strokeWidth={2} /> Clear search
                        </button>
                      )}
                      {activeFilterCount > 0 && (
                        <button className="btn btn-primary btn-sm" onClick={onClearFilters}>
                          <XCircle size={13} strokeWidth={2.2} /> Clear filters
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="vera-es-no-data">
                    <div className="vera-es-ghost-rows" aria-hidden="true">
                      <div className="vera-es-ghost-row">
                        <div className="vera-es-ghost-avatar" />
                        <div className="vera-es-ghost-bar" style={{ width: 118 }} />
                        <div className="vera-es-ghost-spacer" />
                        <div className="vera-es-ghost-bar" style={{ width: 60 }} />
                        <div className="vera-es-ghost-bar" style={{ width: 44 }} />
                      </div>
                      <div className="vera-es-ghost-row">
                        <div className="vera-es-ghost-avatar" />
                        <div className="vera-es-ghost-bar" style={{ width: 94 }} />
                        <div className="vera-es-ghost-spacer" />
                        <div className="vera-es-ghost-bar" style={{ width: 52 }} />
                        <div className="vera-es-ghost-bar" style={{ width: 44 }} />
                      </div>
                      <div className="vera-es-ghost-row">
                        <div className="vera-es-ghost-avatar" />
                        <div className="vera-es-ghost-bar" style={{ width: 138 }} />
                        <div className="vera-es-ghost-spacer" />
                        <div className="vera-es-ghost-bar" style={{ width: 68 }} />
                        <div className="vera-es-ghost-bar" style={{ width: 44 }} />
                      </div>
                    </div>
                    <div className="vera-es-icon">
                      <Users size={22} strokeWidth={1.65} />
                    </div>
                    <div className="vera-es-no-data-title">No jurors assigned yet</div>
                    <div className="vera-es-no-data-desc">
                      Add jurors individually or import a CSV file. Each juror receives a secure PIN to access the evaluation interface for this period.
                    </div>
                    <div className="vera-es-no-data-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ width: "auto", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}
                        onClick={onImport}
                      >
                        <Upload size={13} strokeWidth={2} /> Import CSV
                      </button>
                      <PremiumTooltip text={graceLockTooltip}>
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ width: "auto", display: "inline-flex", alignItems: "center", gap: 5 }}
                          onClick={onAddJuror}
                          disabled={isGraceLocked}
                        >
                          <Plus size={13} strokeWidth={2.2} /> Add Juror
                        </button>
                      </PremiumTooltip>
                    </div>
                    <div className="vera-es-no-data-hint">
                      <Info size={12} strokeWidth={2} />
                      Tip: Use <strong>Import CSV</strong> to onboard multiple jurors at once — columns: name, email, affiliation.
                    </div>
                  </div>
                )}
              </td>
            </tr>
          ) : pagedList.map((juror) => (
            <JurorRow
              key={juror.juror_id || juror.jurorId}
              juror={juror}
              editWindowNowMs={editWindowNowMs}
              periodMaxScore={periodMaxScore}
              jurorAvgMap={jurorAvgMap}
              openMenuId={openMenuId}
              setOpenMenuId={setOpenMenuId}
              shouldUseCardLayout={shouldUseCardLayout}
              isGraceLocked={isGraceLocked}
              graceLockTooltip={graceLockTooltip}
              isPeriodLocked={isPeriodLocked}
              onEdit={onEdit}
              onPinReset={onPinReset}
              onRemove={onRemove}
              onEnableEdit={onEnableEdit}
              onViewScores={onViewScores}
              onNotify={onNotify}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
