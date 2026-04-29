import { useState } from "react";
import { BadgeCheck, ChevronDown, Copy, LockKeyhole, Lock, MoreVertical, Pencil, Trash2 } from "lucide-react";
import FloatingMenu from "@/shared/ui/FloatingMenu";
import Pagination from "@/shared/ui/Pagination";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import useCardSelection from "@/shared/hooks/useCardSelection";
import OutcomeRow from "./OutcomeRow";
import { COVERAGE_LEGEND, coverageBadgeClass, coverageLabel } from "./outcomeHelpers";

export default function OutcomesTable({
  isLocked,
  frameworkId,
  frameworkName,
  totalOutcomes,
  directCount,
  savedFrameworkThreshold,
  fw,
  pageRows,
  filteredOutcomes,
  safePage,
  totalPages,
  pageSize,
  currentPage,
  onPageChange,
  onPageSizeChange,
  sortOrder,
  setSortOrder,
  setCurrentPage,
  openMenuId,
  setOpenMenuId,
  rowsScopeRef,
  fwRenaming,
  fwRenameVal,
  setFwRenameVal,
  fwRenameInputRef,
  saveFwRename,
  handleFwRenameKeyDown,
  fwRenameSaving,
  startFwRename,
  onOpenUnassign,
  thresholdEditing,
  thresholdVal,
  setThresholdVal,
  thresholdInputRef,
  saveThreshold,
  handleThresholdKeyDown,
  thresholdSaving,
  startThresholdEdit,
  onEditOutcome,
  onDeleteOutcome,
  onDuplicate,
  onRemoveChip,
  onCycleCoverage,
  setCoverageFilter,
  setCriterionFilter,
}) {
  const mobileScopeRef = useCardSelection();
  const lockedTooltip = isLocked ? "Evaluation period is locked. Unlock the period to make changes." : null;

  const [expandedCards, setExpandedCards] = useState(new Set());
  const toggleExpand = (id) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {/* Lock banner */}
      {isLocked && (
        <div className="lock-notice">
          <div className="lock-notice-left">
            <div className="lock-notice-icon-wrap">
              <LockKeyhole size={20} strokeWidth={1.8} />
            </div>
            <div className="lock-notice-badge">locked</div>
          </div>
          <div className="lock-notice-body">
            <div className="lock-notice-title">Evaluation in progress — structural fields locked</div>
            <div className="lock-notice-desc">
              Criterion mappings and coverage types are locked while scores exist. Labels and descriptions can still be edited.
            </div>
            <div className="lock-notice-chips">
              <span className="lock-notice-chip editable"><Pencil size={11} strokeWidth={2} /> Labels &amp; Descriptions</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Criterion Mappings</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Coverage Types</span>
            </div>
          </div>
        </div>
      )}

      <div className={`acc-table-card${isLocked ? " locked-card" : ""}`}>
        <div className="acc-table-card-header">
          <div className="acc-card-title-group">
            <div className="crt-title-row">
              {!isLocked && (
                <FloatingMenu
                  trigger={
                    <button
                      type="button"
                      aria-label="Outcomes actions"
                      className="crt-kebab-inline"
                      onClick={() => setOpenMenuId(openMenuId === "acc-header" ? null : "acc-header")}
                    >
                      <MoreVertical size={14} />
                    </button>
                  }
                  isOpen={openMenuId === "acc-header"}
                  onClose={() => setOpenMenuId(null)}
                  placement="bottom-start"
                >
                  <button
                    className="floating-menu-item"
                    onMouseDown={(e) => { e.preventDefault(); setOpenMenuId(null); startFwRename(); }}
                  >
                    <Pencil size={13} strokeWidth={2} />Rename Outcome
                  </button>
                  <div className="floating-menu-divider" />
                  <button
                    className="floating-menu-item danger"
                    onMouseDown={() => { setOpenMenuId(null); onOpenUnassign(); }}
                  >
                    <Trash2 size={13} strokeWidth={2} />Delete Outcome
                  </button>
                </FloatingMenu>
              )}
              {fwRenaming ? (
                <div className="acc-title-rename-wrap">
                  <input
                    ref={fwRenameInputRef}
                    className="acc-title-rename-input"
                    value={fwRenameVal}
                    onChange={(e) => setFwRenameVal(e.target.value)}
                    onBlur={saveFwRename}
                    onKeyDown={handleFwRenameKeyDown}
                    disabled={fwRenameSaving}
                    autoFocus
                  />
                </div>
              ) : (
                <div
                  className={`acc-card-editable-title${isLocked ? " no-rename" : ""}`}
                  onClick={isLocked ? undefined : startFwRename}
                  role={isLocked ? undefined : "button"}
                  tabIndex={isLocked ? undefined : 0}
                  onKeyDown={isLocked ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") startFwRename(); }}
                >
                  {frameworkName}
                  {!isLocked && <Pencil size={13} strokeWidth={2} className="acc-title-edit-icon" />}
                </div>
              )}
            </div>
            <div className="acc-card-subtitle">
              <span>{totalOutcomes} outcome{totalOutcomes !== 1 ? "s" : ""} · {directCount} direct</span>
              {frameworkId && (
                thresholdEditing ? (
                  <span className="acc-threshold-edit-wrap">
                    <input
                      ref={thresholdInputRef}
                      type="number"
                      min={0}
                      max={100}
                      className="acc-threshold-input"
                      value={thresholdVal}
                      onChange={(e) => setThresholdVal(e.target.value)}
                      onBlur={saveThreshold}
                      onKeyDown={handleThresholdKeyDown}
                      disabled={thresholdSaving}
                    />
                    <span className="acc-threshold-unit">% attainment threshold</span>
                  </span>
                ) : (
                  <span
                    className={`acc-threshold-pill${isLocked ? "" : " editable"}`}
                    onClick={isLocked ? undefined : startThresholdEdit}
                    role={isLocked ? undefined : "button"}
                    tabIndex={isLocked ? undefined : 0}
                    onKeyDown={isLocked ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") startThresholdEdit(); }}
                  >
                    {savedFrameworkThreshold}% threshold
                    {!isLocked && <Pencil size={10} strokeWidth={2} className="acc-threshold-edit-icon" />}
                  </span>
                )
              )}
            </div>
          </div>
        </div>
          {fw.loading && fw.outcomes.length === 0 ? (
            <div className="acc-empty-state" style={{ padding: "32px 24px" }}>
              <div className="acc-empty-desc">Loading outcomes…</div>
            </div>
          ) : fw.outcomes.length === 0 ? (
            <div className="acc-empty-state" style={{ padding: "32px 24px" }}>
              <div className="acc-empty-icon">
                <BadgeCheck size={28} strokeWidth={1.5} />
              </div>
              <div className="acc-empty-title">No outcomes defined</div>
              <div className="acc-empty-desc">Click "+ Add Outcome" to define your first programme outcome.</div>
            </div>
          ) : (
            <table className="acc-table table-standard table-pill-balance" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ width: 80 }} className="sortable sorted" onClick={() => { setSortOrder((prev) => prev === "asc" ? "desc" : "asc"); setCurrentPage(1); }}>
                    Code <span className="sort-icon sort-icon-active">{sortOrder === "asc" ? "▲" : "▼"}</span>
                  </th>
                  <th>Outcome</th>
                  <th>Mapped Criteria</th>
                  <th style={{ width: 110 }} className="text-center">Coverage</th>
                  <th style={{ width: 44 }} className="text-center">Actions</th>
                </tr>
              </thead>
              <tbody ref={rowsScopeRef}>
                {pageRows.length === 0 && fw.outcomes.length > 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-tertiary)" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                        <BadgeCheck size={28} strokeWidth={1.4} style={{ opacity: 0.35 }} />
                        <span style={{ fontSize: 13, fontWeight: 500 }}>No outcomes match the current filter</span>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ marginTop: 6 }}
                          onClick={() => { setCoverageFilter("all"); setCriterionFilter("all"); }}
                        >
                          Clear filters
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {pageRows.map((outcome) => (
                  <OutcomeRow
                    key={outcome.id}
                    outcome={outcome}
                    mappedCriteria={fw.getMappedCriteria(outcome.id)}
                    coverage={fw.getCoverage(outcome.id)}
                    onEdit={onEditOutcome}
                    onDelete={onDeleteOutcome}
                    onDuplicate={onDuplicate}
                    onRemoveChip={onRemoveChip}
                    onAddMapping={onEditOutcome}
                    onCycleCoverage={onCycleCoverage}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                    isLocked={isLocked}
                  />
                ))}
              </tbody>
            </table>
          )}

        {/* Mobile portrait accordion card list */}
        {fw.outcomes.length > 0 && pageRows.length > 0 && (
          <div className="acc-mobile-list" ref={mobileScopeRef}>
            {pageRows.map((outcome) => {
              const mappedCriteria = fw.getMappedCriteria(outcome.id);
              const coverage = fw.getCoverage(outcome.id);
              const isExpanded = expandedCards.has(outcome.id);
              const prefixMatch = outcome.code.match(/^([A-Za-z]+)\s+(.+)$/);
              const codePrefix = prefixMatch ? prefixMatch[1] : "";
              const codeNum = prefixMatch ? prefixMatch[2] : outcome.code;
              const coverageClass = coverage === "direct" ? "direct" : coverage === "indirect" ? "indirect" : "unmapped";
              const menuKey = `acc-mobile-${outcome.id}`;
              const isMenuOpen = openMenuId === menuKey;
              return (
                <div
                  key={outcome.id}
                  data-card-selectable=""
                  className={`acc-mobile-card${isExpanded ? " acc-mobile-card--expanded" : ""}`}
                >
                  <div className="acc-mobile-card-header">
                    <button
                      className="acc-mobile-card-header-tap row-inline-control"
                      onClick={() => toggleExpand(outcome.id)}
                      aria-expanded={isExpanded}
                      aria-label={`${outcome.code} — ${isExpanded ? "collapse" : "expand"}`}
                    >
                      <span className={`acc-code-badge ${coverageClass}`}>
                        {codePrefix && <span className="acc-code-prefix">{codePrefix}</span>}
                        {codeNum}
                      </span>
                      <span className="acc-mobile-card-spacer" />
                      <span className={coverageBadgeClass(coverage)}>
                        <span className="acc-cov-dot" />
                        {coverageLabel(coverage)}
                      </span>
                      <ChevronDown
                        size={16}
                        strokeWidth={2}
                        className={`acc-mobile-card-chevron${isExpanded ? " expanded" : ""}`}
                      />
                    </button>
                    <FloatingMenu
                      trigger={
                        <button
                          className="row-action-btn"
                          aria-label="Actions"
                          onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : menuKey); }}
                        >
                          <MoreVertical size={18} strokeWidth={2} />
                        </button>
                      }
                      isOpen={isMenuOpen}
                      onClose={() => setOpenMenuId(null)}
                      placement="bottom-end"
                    >
                      <button
                        className="floating-menu-item"
                        onMouseDown={() => { setOpenMenuId(null); onEditOutcome(outcome); }}
                      >
                        <Pencil size={13} strokeWidth={2} />
                        Edit Outcome
                      </button>
                      <PremiumTooltip text={lockedTooltip} position="left">
                        <button
                          className={`floating-menu-item${isLocked ? " disabled" : ""}`}
                          onMouseDown={() => { setOpenMenuId(null); if (!isLocked) onDuplicate(outcome); }}
                          disabled={isLocked}
                        >
                          <Copy size={13} strokeWidth={2} />
                          Duplicate
                        </button>
                      </PremiumTooltip>
                      <div className="floating-menu-divider" />
                      <PremiumTooltip text={lockedTooltip} position="left">
                        <button
                          className={`floating-menu-item danger${isLocked ? " disabled" : ""}`}
                          onMouseDown={() => { setOpenMenuId(null); if (!isLocked) onDeleteOutcome(outcome); }}
                          disabled={isLocked}
                        >
                          <Trash2 size={13} strokeWidth={2} />
                          Delete Outcome
                        </button>
                      </PremiumTooltip>
                    </FloatingMenu>
                  </div>
                  {isExpanded && (
                    <div className="acc-mobile-card-body">
                      <div className="acc-mobile-outcome-content">
                        <div className="acc-mobile-outcome-label">{outcome.label}</div>
                        {outcome.description && (
                          <div className="acc-mobile-outcome-desc">{outcome.description}</div>
                        )}
                      </div>
                      {mappedCriteria.length > 0 && (
                        <div className="acc-mobile-criteria-section">
                          <div className="acc-mobile-section-label">Mapped Criteria</div>
                          <div className="acc-mobile-criteria-chips">
                            {mappedCriteria.map((c) => (
                              <span key={c.id} className="acc-chip">
                                <span className="acc-crit-dot" style={{ background: c.color || "var(--accent)" }} />
                                {c.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {fw.outcomes.length > 0 && (
          <div className="acc-legend-strip">
            {COVERAGE_LEGEND.map((item) => (
              <div key={item.key} className={`acc-legend-item ${item.cls}`}>
                <div className={`acc-legend-icon-wrap ${item.cls}`}>
                  <item.icon size={13} strokeWidth={2} />
                </div>
                <div>
                  <div className={`acc-legend-label ${item.cls}`}>{item.label}</div>
                  <div className="acc-legend-desc">{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredOutcomes.length}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          itemLabel="outcomes"
        />
      </div>
    </>
  );
}
