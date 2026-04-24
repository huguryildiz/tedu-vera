import { useMemo } from "react";
import {
  Lock,
  LockOpen,
  Trash2,
  MoreVertical,
  Pencil,
  CalendarRange,
  Plus,
  BadgeCheck,
  Info,
  ListChecks,
  Copy,
  Send,
  Archive,
  QrCode,
  Link as LinkIcon,
  XCircle,
  Search,
} from "lucide-react";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import FloatingMenu from "@/shared/ui/FloatingMenu";
import { formatDateTime as formatFull } from "@/shared/lib/dateUtils";
import StatusPill from "./StatusPill";
import ReadinessPopover from "./ReadinessPopover";
import SortIcon from "./SortIcon";
import ProgressCell from "./ProgressCell";
import { formatRelative, computeRingModel } from "./periodHelpers";

function PeriodRow({
  period,
  state,
  stats,
  readiness,
  frameworks,
  pendingRequests,
  openMenuId,
  setOpenMenuId,
  onCurrentPeriodChange,
  onNavigate,
  onEdit,
  onDuplicate,
  onCopyEntryLink,
  onClose,
  onRevert,
  onPublish,
  onDelete,
}) {
  const isDraft = state === "draft_ready" || state === "draft_incomplete";
  const periodStats = stats[period.id] || {};
  const periodReadiness = readiness[period.id];

  return (
    <tr
      data-card-selectable=""
      data-testid="period-row"
      data-period-id={period.id}
      data-period-name={period.name}
      className={[
        "mcard",
        "sem-row-" + (isDraft ? "draft" : state),
      ].filter(Boolean).join(" ")}
    >
      {/* Mobile ring (portrait only — hidden on desktop via CSS) */}
      <td className="periods-mobile-ring">
        {(() => {
          const ring = computeRingModel({
            state,
            readiness: periodReadiness,
            stats: periodStats,
          });
          const pct = ring.percent;
          const deg = pct == null ? 0 : Math.round((pct / 100) * 360);
          return (
            <div
              className={`periods-mring ${ring.stateClass}`}
              style={{ "--pct": `${deg}deg` }}
              aria-label={`${period.name} — ${pct == null ? "loading" : pct + "%"} ${ring.label.toLowerCase()}`}
            >
              <div className="periods-mring-fill">
                <div className="periods-mring-inner">
                  <span className="periods-mring-num">{pct == null ? "—" : `${pct}%`}</span>
                  <span className="periods-mring-lbl">{ring.label}</span>
                </div>
              </div>
            </div>
          );
        })()}
      </td>

      {/* Period name */}
      <td data-label="Evaluation Period">
        <div className="sem-name" style={period.is_locked ? { color: "var(--text-secondary)" } : undefined}>
          {period.name}
        </div>
        {(state === "live" || isDraft) && (
          <div className="sem-name-sub">
            {state === "live" ? "Evaluation in progress" : "Setup in progress"}
          </div>
        )}
      </td>

      {/* Status */}
      <td data-label="Status">
        <div className="periods-status-cell" data-testid="period-status-pill">
          <StatusPill status={state} />
          {isDraft && (
            <ReadinessPopover
              readiness={periodReadiness}
              onFix={(target) => {
                onCurrentPeriodChange?.(period.id);
                onNavigate?.(target);
              }}
            />
          )}
        </div>
      </td>

      {/* Date Range */}
      <td data-label="Date Range">
        {period.start_date || period.end_date ? (
          <span className="periods-date-range">
            {period.start_date ? new Date(period.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
            <span className="periods-date-sep">→</span>
            {period.end_date ? new Date(period.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—"}
          </span>
        ) : (
          <span style={{ color: "var(--text-quaternary)", fontSize: 11 }}>—</span>
        )}
      </td>

      {/* Progress */}
      <td data-label="Progress" style={{ textAlign: "center" }}>
        <ProgressCell period={period} stats={stats} />
      </td>

      {/* Projects */}
      <td data-label="Projects" className="col-projects" style={{ textAlign: "center" }}>
        <span className={`periods-stat-val${(periodStats.projectCount || 0) === 0 ? " zero" : ""}`}>
          {periodStats.projectCount ?? "—"}
        </span>
      </td>

      {/* Jurors */}
      <td data-label="Jurors" className="col-jurors" style={{ textAlign: "center" }}>
        <span className={`periods-stat-val${(periodStats.jurorCount || 0) === 0 ? " zero" : ""}`}>
          {periodStats.jurorCount ?? "—"}
        </span>
      </td>

      {/* Mobile footer (stats + updated) */}
      <td className="periods-mobile-footer">
        <div className="periods-mobile-footer-stats">
          <span className="periods-m-stat"><span className={`val${(periodStats.projectCount || 0) === 0 ? " zero" : ""}`}>{periodStats.projectCount ?? "—"}</span> projects</span>
          <span className="periods-m-stat"><span className={`val${(periodStats.jurorCount || 0) === 0 ? " zero" : ""}`}>{periodStats.jurorCount ?? "—"}</span> jurors</span>
        </div>
        <span className="periods-mobile-footer-updated">{formatRelative(period.updated_at)}</span>
      </td>

      {/* Criteria Set */}
      <td data-label="Criteria Set">
        {(() => {
          const count = periodStats.criteriaCount ?? 0;
          const cname = period.criteria_name;
          const hasData = count > 0 || !!cname;
          return (
            <div className="periods-cset-cell">
              {hasData ? (
                <PremiumTooltip text="Go to Criteria page">
                  <button
                    className="periods-cset-badge row-inline-control"
                    onClick={() => {
                      onCurrentPeriodChange?.(period.id);
                      onNavigate?.("criteria");
                    }}
                  >
                    <ListChecks size={12} strokeWidth={1.75} />
                    {cname || `${count} criteria`}
                  </button>
                </PremiumTooltip>
              ) : (
                <div className="periods-notset-row">
                  <span className="periods-notset-label">Not set</span>
                  <PremiumTooltip text="Configure criteria">
                    <button
                      className="periods-notset-add-btn row-inline-control"
                      onClick={() => {
                        onCurrentPeriodChange?.(period.id);
                        onNavigate?.("criteria");
                      }}
                    >
                      <Plus size={11} strokeWidth={2.5} />
                    </button>
                  </PremiumTooltip>
                </div>
              )}
            </div>
          );
        })()}
      </td>

      {/* Outcome */}
      <td data-label="Outcome Set">
        {(() => {
          const fw = frameworks.find((f) => f.id === period.framework_id);
          return (
            <div className="periods-fw-cell">
              {fw ? (
                <PremiumTooltip text="Go to Outcomes page">
                  <button
                    className="periods-fw-badge clickable row-inline-control"
                    onClick={() => {
                      onCurrentPeriodChange?.(period.id);
                      onNavigate?.("outcomes");
                    }}
                  >
                    <BadgeCheck size={11} strokeWidth={2} /> {fw.name}
                  </button>
                </PremiumTooltip>
              ) : (
                <div className="periods-notset-row">
                  <span className="periods-notset-label">Not set</span>
                  <PremiumTooltip text="Configure framework">
                    <button
                      className="periods-notset-add-btn row-inline-control"
                      onClick={() => {
                        onCurrentPeriodChange?.(period.id);
                        onNavigate?.("outcomes");
                      }}
                    >
                      <Plus size={11} strokeWidth={2.5} />
                    </button>
                  </PremiumTooltip>
                </div>
              )}
            </div>
          );
        })()}
      </td>

      {/* Updated */}
      <td data-label="Last Updated">
        <PremiumTooltip text={formatFull(period.updated_at)}>
          <span className="vera-datetime-text">{formatRelative(period.updated_at)}</span>
        </PremiumTooltip>
      </td>

      {/* Actions */}
      <td className="col-actions">
        <FloatingMenu
          isOpen={openMenuId === period.id}
          onClose={() => setOpenMenuId(null)}
          placement="bottom-end"
          trigger={
            <button
              className="row-action-btn"
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId((prev) => (prev === period.id ? null : period.id));
              }}
              title="Actions"
              data-testid="period-row-kebab"
            >
              <MoreVertical size={18} strokeWidth={2} />
            </button>
          }
        >
          <button className="floating-menu-item" onMouseDown={() => { setOpenMenuId(null); onEdit(period); }} data-testid="period-menu-edit">
            <Pencil size={13} />
            Edit Period
          </button>

          <button
            className="floating-menu-item"
            onMouseDown={() => { setOpenMenuId(null); onDuplicate(period.id); }}
          >
            <Copy size={13} />
            Duplicate Period
          </button>

          {period.is_locked && !period.closed_at && (
            <>
              <div className="floating-menu-divider" />
              <button
                className="floating-menu-item"
                onMouseDown={() => { setOpenMenuId(null); onCopyEntryLink(period); }}
              >
                <LinkIcon size={13} />
                Copy Entry Link
              </button>
              <button
                className="floating-menu-item"
                onMouseDown={() => {
                  setOpenMenuId(null);
                  onCurrentPeriodChange?.(period.id);
                  onNavigate?.("entry-control");
                }}
              >
                <QrCode size={13} />
                View QR Code
              </button>
            </>
          )}

          {period.is_locked && !period.closed_at && (
            <button
              className="floating-menu-item"
              onMouseDown={() => { setOpenMenuId(null); onClose(period); }}
              data-testid="period-menu-close"
            >
              <Archive size={13} />
              Close Period
            </button>
          )}

          <div className="floating-menu-divider" />
          {period.is_locked && pendingRequests[period.id] ? (
            <button className="floating-menu-item" disabled>
              <LockOpen size={13} />
              Revert Requested — awaiting super admin
            </button>
          ) : period.is_locked ? (
            <button
              className="floating-menu-item"
              onMouseDown={() => { setOpenMenuId(null); onRevert(period); }}
            >
              <LockOpen size={13} />
              Revert to Draft
            </button>
          ) : (
            (() => {
              const isReady = periodReadiness?.ok === true;
              const blockerCount = (periodReadiness?.issues || []).filter((i) => i.severity === "required").length;
              return (
                <button
                  className={`floating-menu-item${isReady ? " publish-ready" : ""}`}
                  disabled={!isReady}
                  onMouseDown={() => {
                    if (!isReady) return;
                    setOpenMenuId(null);
                    onPublish(period);
                  }}
                  title={isReady ? undefined : `Fix ${blockerCount} issue${blockerCount === 1 ? "" : "s"} first`}
                  data-testid="period-menu-publish"
                >
                  <Send size={13} />
                  {isReady ? "Publish Period" : `Publish Period (${blockerCount} issue${blockerCount === 1 ? "" : "s"})`}
                </button>
              );
            })()
          )}
          {period.is_locked ? (
            <button className="floating-menu-item danger" disabled data-testid="period-menu-delete">
              <Trash2 size={13} />
              Delete Period
            </button>
          ) : (
            <button
              className="floating-menu-item danger"
              onMouseDown={() => { setOpenMenuId(null); onDelete(period); }}
              data-testid="period-menu-delete"
            >
              <Trash2 size={13} />
              Delete Period
            </button>
          )}
        </FloatingMenu>
      </td>
    </tr>
  );
}

export default function PeriodsTable({
  rows,
  pagedRows,
  loadingCount,
  sortKey,
  sortDir,
  onSort,
  rowsScopeRef,
  activeFilterCount,
  search,
  onClearSearch,
  onClearFilters,
  onAddPeriod,
  onOpenSetup,
  stats,
  readiness,
  frameworks,
  pendingRequests,
  openMenuId,
  setOpenMenuId,
  getState,
  onCurrentPeriodChange,
  onNavigate,
  rowHandlers,
}) {
  const isEmpty = rows.length === 0;
  const isLoading = loadingCount > 0 && isEmpty;

  const renderedRows = useMemo(() => pagedRows.map((period) => {
    const state = getState(period);
    return (
      <PeriodRow
        key={period.id}
        period={period}
        state={state}
        stats={stats}
        readiness={readiness}
        frameworks={frameworks}
        pendingRequests={pendingRequests}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        onCurrentPeriodChange={onCurrentPeriodChange}
        onNavigate={onNavigate}
        onEdit={rowHandlers.onEdit}
        onDuplicate={rowHandlers.onDuplicate}
        onCopyEntryLink={rowHandlers.onCopyEntryLink}
        onClose={rowHandlers.onClose}
        onRevert={rowHandlers.onRevert}
        onPublish={rowHandlers.onPublish}
        onDelete={rowHandlers.onDelete}
      />
    );
  }), [pagedRows, stats, readiness, frameworks, pendingRequests, openMenuId, setOpenMenuId, getState, onCurrentPeriodChange, onNavigate, rowHandlers]);

  return (
    <div className="periods-table-scroll">
      <div className="sem-table-wrap">
        <table className="sem-table table-standard table-pill-balance" style={{ tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            <col />{/* Period — flexible, absorbs remaining space */}
            <col style={{ width: 78 }} />{/* Status */}
            <col style={{ width: 96 }} />{/* Date Range */}
            <col style={{ width: 52 }} />{/* Progress */}
            <col style={{ width: 44 }} />{/* Projects */}
            <col style={{ width: 42 }} />{/* Jurors */}
            <col style={{ width: 88 }} />{/* Criteria Set */}
            <col style={{ width: 70 }} />{/* Outcome */}
            <col style={{ width: 62 }} />{/* Updated At */}
            <col style={{ width: 32 }} />{/* Actions */}
          </colgroup>
          <thead>
            <tr>
              <th className={`sortable${sortKey === "name" ? " sorted" : ""}`} onClick={() => onSort("name")}>
                Period <SortIcon colKey="name" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={`sortable${sortKey === "status" ? " sorted" : ""}`} onClick={() => onSort("status")}>
                Status <SortIcon colKey="status" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className={`sortable${sortKey === "start_date" ? " sorted" : ""}`} onClick={() => onSort("start_date")}>
                Date Range <SortIcon colKey="start_date" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th style={{ textAlign: "center" }}>Progress</th>
              <th className="col-projects" style={{ textAlign: "center" }}>Projects</th>
              <th className="col-jurors" style={{ textAlign: "center" }}>Jurors</th>
              <th>Criteria Set</th>
              <th>Outcome Set</th>
              <th className={`sortable${sortKey === "updated_at" ? " sorted" : ""}`} onClick={() => onSort("updated_at")}>
                Updated At <SortIcon colKey="updated_at" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody ref={rowsScopeRef}>
            {isLoading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: "center", color: "var(--text-tertiary)", padding: "32px" }}>
                  Loading periods…
                </td>
              </tr>
            ) : isEmpty ? (
              <tr className="es-row">
                <td colSpan={10} style={{ textAlign: "center", padding: "48px 24px" }}>
                  {activeFilterCount > 0 || search.trim() ? (
                    <div className="vera-es-no-data">
                      <div className="vera-es-icon">
                        <Search size={20} strokeWidth={1.8} />
                      </div>
                      <div className="vera-es-no-data-title">No periods match your filters</div>
                      <div className="vera-es-no-data-desc">
                        {search.trim() && activeFilterCount === 0
                          ? "No periods match your current search. Try a different keyword."
                          : search.trim() && activeFilterCount > 0
                            ? "Try adjusting your search or clearing active filters to see more periods."
                            : "Try adjusting or clearing the active filters to see more periods."}
                      </div>
                      <div className="vera-es-no-data-actions">
                        {search.trim() && (
                          <button className="btn btn-outline btn-sm" onClick={onClearSearch}>
                            <XCircle size={13} strokeWidth={2} /> Clear search
                          </button>
                        )}
                        {activeFilterCount > 0 && (
                          <button className="btn btn-outline btn-sm" onClick={onClearFilters}>
                            <XCircle size={13} strokeWidth={2} /> Clear filters
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div className="vera-es-card">
                        <div className="vera-es-hero vera-es-hero--period">
                          <div className="vera-es-icon">
                            <CalendarRange size={24} strokeWidth={1.65} />
                          </div>
                          <div>
                            <div className="vera-es-title">No evaluation periods yet</div>
                            <div className="vera-es-desc">
                              An evaluation period defines the timeframe, criteria, and scope for jury evaluations. It is the foundation of your setup.
                            </div>
                          </div>
                        </div>
                        <div className="vera-es-actions">
                          <button
                            className="vera-es-action vera-es-action--primary-period"
                            onClick={onOpenSetup}
                          >
                            <div className="vera-es-num vera-es-num--period">1</div>
                            <div className="vera-es-action-text">
                              <div className="vera-es-action-label">Use Setup Wizard</div>
                              <div className="vera-es-action-sub">Guided 7-step configuration from scratch</div>
                            </div>
                            <span className="vera-es-badge vera-es-badge--period">Step 1</span>
                          </button>
                          <div className="vera-es-divider">or</div>
                          <button
                            className="vera-es-action vera-es-action--secondary"
                            onClick={onAddPeriod}
                          >
                            <div className="vera-es-num vera-es-num--secondary">2</div>
                            <div className="vera-es-action-text">
                              <div className="vera-es-action-label">Create manually</div>
                              <div className="vera-es-action-sub">Set name, dates, and options yourself</div>
                            </div>
                            <span className="vera-es-badge vera-es-badge--secondary">Manual</span>
                          </button>
                        </div>
                        <div className="vera-es-footer">
                          <Info size={12} strokeWidth={2} />
                          Required · Step 1 of 7 in minimum setup
                        </div>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ) : renderedRows}
          </tbody>
        </table>
      </div>
    </div>
  );
}
