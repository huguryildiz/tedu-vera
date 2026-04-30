import { useState } from "react";
import {
  ClipboardList,
  ChevronDown,
  Pencil,
  MoreVertical,
  Copy,
  MoveUp,
  MoveDown,
  Trash2,
} from "lucide-react";
import FloatingMenu from "@/shared/ui/FloatingMenu";
import Pagination from "@/shared/ui/Pagination";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import useCardSelection from "@/shared/hooks/useCardSelection";
import InlineWeightEdit from "../InlineWeightEdit";
import { CRITERION_COLORS } from "../criteriaFormHelpers";
import { rubricBandClass, bandRangeText } from "./criteriaHelpers";

export default function CriteriaTable({
  draftCriteria,
  filteredCriteria,
  pageRows,
  activeFilterCount,
  effectiveCriteriaName,
  viewPeriodLabel,
  draftTotal,
  isLocked,
  periodRenaming,
  periodRenameVal,
  periodRenameInputRef,
  periodRenameSaving,
  onPeriodRenameChange,
  onPeriodRenameBlur,
  onPeriodRenameKeyDown,
  onStartPeriodRename,
  openMenuId,
  setOpenMenuId,
  onOpenEditor,
  onEditIndex,
  onDuplicate,
  onMove,
  onDelete,
  onClearAll,
  onWeightChange,
  onClearFilters,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  const desktopScopeRef = useCardSelection();
  const mobileScopeRef = useCardSelection();
  const lockedTooltip = isLocked ? "Evaluation period is locked. Unlock the period to make changes." : null;

  const [expandedCards, setExpandedCards] = useState(new Set());
  const toggleExpand = (key) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="crt-table-card">
      <div className="crt-table-card-header">
        <div className="crt-card-title-group">
          <div className="crt-title-row">
            {!isLocked && (
              <FloatingMenu
                trigger={
                  <button
                    type="button"
                    aria-label="Criteria actions"
                    className="crt-kebab-inline"
                    onClick={() => setOpenMenuId(openMenuId === "crt-header" ? null : "crt-header")}
                  >
                    <MoreVertical size={14} />
                  </button>
                }
                isOpen={openMenuId === "crt-header"}
                onClose={() => setOpenMenuId(null)}
                placement="bottom-start"
              >
                <button
                  className="floating-menu-item"
                  onMouseDown={(e) => { e.preventDefault(); setOpenMenuId(null); onStartPeriodRename(); }}
                >
                  <Pencil size={13} strokeWidth={2} />Rename
                </button>
                <div className="floating-menu-divider" />
                <button
                  className="floating-menu-item danger"
                  onMouseDown={() => { setOpenMenuId(null); onClearAll(); }}
                >
                  <Trash2 size={13} strokeWidth={2} />Delete All Criteria
                </button>
              </FloatingMenu>
            )}
            {periodRenaming ? (
              <div className="crt-title-rename-wrap">
                <input
                  ref={periodRenameInputRef}
                  className="crt-title-rename-input"
                  value={periodRenameVal}
                  onChange={(e) => onPeriodRenameChange(e.target.value)}
                  onBlur={onPeriodRenameBlur}
                  onKeyDown={onPeriodRenameKeyDown}
                  disabled={periodRenameSaving}
                  autoFocus
                />
              </div>
            ) : (
              <div
                className={`crt-card-editable-title${isLocked ? " no-rename" : ""}`}
                onClick={isLocked ? undefined : onStartPeriodRename}
                role={isLocked ? undefined : "button"}
                tabIndex={isLocked ? undefined : 0}
                onKeyDown={isLocked ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") onStartPeriodRename(); }}
              >
                {effectiveCriteriaName || viewPeriodLabel || "Active Criteria"}
                {!isLocked && <Pencil size={13} strokeWidth={2} className="crt-title-edit-icon" />}
              </div>
            )}
          </div>
          <div className="crt-card-subtitle">
            {draftCriteria.length} {draftCriteria.length === 1 ? "criterion" : "criteria"} · {draftTotal ?? 0} pts
          </div>
        </div>
      </div>

      <table className="crt-table table-standard table-pill-balance">
        <thead>
          <tr>
            <th style={{ width: "3%" }}>#</th>
            <th className="col-criterion" style={{ width: "42%" }}>Criterion</th>
            <th className="col-weight" style={{ width: "7%" }}>Weight</th>
            <th className="col-rubric" style={{ width: "16%" }}>Rubric Bands</th>
            <th className="col-mapping" style={{ width: "13%" }}>Mapping</th>
            <th className="col-action" style={{ width: "6%" }}>Actions</th>
          </tr>
        </thead>
        <tbody ref={desktopScopeRef}>
          {pageRows.length === 0 && (
            <tr className="crt-empty-row">
              <td colSpan={6} style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-tertiary)" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <ClipboardList size={28} strokeWidth={1.4} style={{ opacity: 0.35 }} />
                  <span style={{ fontSize: 13, fontWeight: 500 }}>
                    {activeFilterCount > 0 ? "No criteria match the current filter" : "No criteria yet"}
                  </span>
                  <span style={{ fontSize: 12, opacity: 0.6 }}>
                    {activeFilterCount > 0
                      ? (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ marginTop: 6 }}
                          onClick={onClearFilters}
                        >
                          Clear filters
                        </button>
                      )
                      : "Click \"+​ Add Criterion\" above to add your first criterion."}
                  </span>
                </div>
              </td>
            </tr>
          )}
          {pageRows.map((criterion) => {
            const i = draftCriteria.findIndex((c) => c.key === criterion.key);
            const rubric = Array.isArray(criterion.rubric) ? criterion.rubric : [];
            const menuKey = `crt-row-${i}`;
            const isMenuOpen = openMenuId === menuKey;
            return (
              <tr key={criterion.key || i} data-testid="criteria-row" data-card-selectable="" className="mcard" style={{ "--row-color": criterion.color || CRITERION_COLORS[i % CRITERION_COLORS.length] }}>
                <td data-label="#"><span className="crt-row-num">{i + 1}</span></td>
                <td data-label="Criterion">
                  <div className="crt-name">
                    <span className="crt-color-dot" style={{ background: criterion.color || CRITERION_COLORS[i % CRITERION_COLORS.length] }} />
                    {criterion.label || criterion.shortLabel || `Criterion ${i + 1}`}
                  </div>
                  {criterion.blurb && (
                    <div className="crt-desc">{criterion.blurb}</div>
                  )}
                </td>
                <td className="col-weight" data-label="Weight">
                  <InlineWeightEdit
                    value={criterion.max || 0}
                    color={criterion.color || CRITERION_COLORS[i % CRITERION_COLORS.length]}
                    otherTotal={draftCriteria.reduce((s, c, j) => j === i ? s : s + (c.max || 0), 0)}
                    onChange={(v) => onWeightChange(i, v)}
                    disabled={isLocked}
                  />
                </td>
                <td className="col-rubric" data-label="Rubric Bands">
                  {rubric.length > 0 ? (
                    <div className="crt-rubric-bands">
                      {rubric.map((band, bi) => (
                        <span
                          key={bi}
                          className={`crt-band-pill row-inline-control ${rubricBandClass(band.level || band.label)}`}
                          onClick={isLocked ? undefined : () => onOpenEditor(i, "rubric")}
                          style={{ cursor: isLocked ? "default" : "pointer", opacity: isLocked ? 0.65 : 1 }}
                        >
                          {bandRangeText(band) && (
                            <span className="crt-band-range">{bandRangeText(band)}</span>
                          )}
                          {band.level || band.label}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 11.5, color: "var(--text-quaternary)" }}>No rubric defined</span>
                  )}
                </td>
                <td className="col-mapping" data-label="Mapping">
                  <div className="crt-mapping-pills">
                    {(criterion.outcomes || []).map((code) => {
                      const isIndirect = criterion.outcomeTypes?.[code] === "indirect";
                      return (
                        <span
                          key={code}
                          className={`crt-mapping-pill row-inline-control${isIndirect ? " indirect" : ""}${isLocked ? " disabled" : ""}`}
                          onClick={isLocked ? undefined : () => onOpenEditor(i, "mapping")}
                          aria-label={`${code} ${isIndirect ? "indirect" : "direct"} mapping`}
                          aria-disabled={isLocked || undefined}
                        >
                          {code}
                        </span>
                      );
                    })}
                    {!isLocked && (
                      <span
                        className="crt-mapping-add row-inline-control"
                        onClick={() => onOpenEditor(i, "mapping")}
                      >
                        +
                      </span>
                    )}
                  </div>
                </td>
                <td className="col-crt-actions">
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <FloatingMenu
                      trigger={<button className="row-action-btn" aria-label="Actions" onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : menuKey); }}><MoreVertical size={18} strokeWidth={2} /></button>}
                      isOpen={isMenuOpen}
                      onClose={() => setOpenMenuId(null)}
                      placement="bottom-end"
                    >
                      <PremiumTooltip text={lockedTooltip} position="left">
                        <button
                          className={`floating-menu-item${isLocked ? " disabled" : ""}`}
                          onMouseDown={() => { setOpenMenuId(null); onEditIndex(i); }}
                          disabled={isLocked}
                        >
                          <Pencil size={13} strokeWidth={2} />
                          Edit Criterion
                        </button>
                      </PremiumTooltip>
                      <PremiumTooltip text={lockedTooltip} position="left">
                        <button
                          className={`floating-menu-item${isLocked ? " disabled" : ""}`}
                          onMouseDown={() => { setOpenMenuId(null); onDuplicate(i); }}
                          disabled={isLocked}
                        >
                          <Copy size={13} strokeWidth={2} />
                          Duplicate
                        </button>
                      </PremiumTooltip>
                      <div className="floating-menu-divider" />
                      <PremiumTooltip text={lockedTooltip} position="left">
                        <button
                          className={`floating-menu-item${(i === 0 || isLocked) ? " disabled" : ""}`}
                          onMouseDown={() => { setOpenMenuId(null); onMove(i, -1); }}
                          disabled={i === 0 || isLocked}
                        >
                          <MoveUp size={13} strokeWidth={2} />
                          Move Up
                        </button>
                      </PremiumTooltip>
                      <PremiumTooltip text={lockedTooltip} position="left">
                        <button
                          className={`floating-menu-item${(i === draftCriteria.length - 1 || isLocked) ? " disabled" : ""}`}
                          onMouseDown={() => { setOpenMenuId(null); onMove(i, 1); }}
                          disabled={i === draftCriteria.length - 1 || isLocked}
                        >
                          <MoveDown size={13} strokeWidth={2} />
                          Move Down
                        </button>
                      </PremiumTooltip>
                      <div className="floating-menu-divider" />
                      <PremiumTooltip text={lockedTooltip} position="left">
                        <button
                          className={`floating-menu-item danger${isLocked ? " disabled" : ""}`}
                          onMouseDown={() => { setOpenMenuId(null); onDelete(i); }}
                          disabled={isLocked}
                        >
                          <Trash2 size={13} strokeWidth={2} />
                          Delete Criterion
                        </button>
                      </PremiumTooltip>
                    </FloatingMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {draftCriteria.length > 0 && (
        <div className="crt-mobile-list" ref={mobileScopeRef}>
          {pageRows.map((criterion) => {
            const i = draftCriteria.findIndex((c) => c.key === criterion.key);
            const rubric = Array.isArray(criterion.rubric) ? criterion.rubric : [];
            const outcomes = criterion.outcomes || [];
            const cardKey = criterion.key || `crt-card-${i}`;
            const isExpanded = expandedCards.has(cardKey);
            const collapsedOutcomes = outcomes.slice(0, 3);
            const collapsedOverflow = outcomes.length - collapsedOutcomes.length;
            const menuKey = `crt-mobile-${i}`;
            const isMenuOpen = openMenuId === menuKey;
            const color = criterion.color || CRITERION_COLORS[i % CRITERION_COLORS.length];
            return (
              <div
                key={cardKey}
                data-card-selectable=""
                className={`crt-mobile-card${isLocked ? " crt-mobile-card--locked" : ""}${isExpanded ? " crt-mobile-card--expanded" : ""}`}
              >
                <div className="crt-mobile-card-header">
                  <button
                    className="crt-mobile-card-header-tap row-inline-control"
                    onClick={() => toggleExpand(cardKey)}
                    style={{ cursor: "pointer" }}
                    aria-expanded={isExpanded}
                    aria-label={`${criterion.label || `Criterion ${i + 1}`} — ${isExpanded ? "collapse" : "expand"}`}
                  >
                    <span
                      className="crt-mobile-card-color-dot"
                      style={{ backgroundColor: color }}
                    />
                    <span className="crt-mobile-card-name">
                      {criterion.label || criterion.shortLabel || `Criterion ${i + 1}`}
                    </span>
                  </button>
                  <InlineWeightEdit
                    value={criterion.max || 0}
                    color={color}
                    otherTotal={draftCriteria.reduce((s, c, j) => j === i ? s : s + (Number(c.max) || 0), 0)}
                    onChange={(v) => onWeightChange(i, v)}
                    disabled={isLocked}
                  />
                  <button
                    className="crt-mobile-card-chevron-btn row-inline-control"
                    onClick={() => toggleExpand(cardKey)}
                    aria-label={isExpanded ? "Collapse" : "Expand"}
                  >
                    <ChevronDown
                      size={16}
                      strokeWidth={2}
                      className={`crt-mobile-card-chevron${isExpanded ? " expanded" : ""}`}
                    />
                  </button>
                  <FloatingMenu
                    trigger={
                      <button
                        className="row-action-btn"
                        aria-label="Actions"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(isMenuOpen ? null : menuKey);
                        }}
                      >
                        <MoreVertical size={18} strokeWidth={2} />
                      </button>
                    }
                    isOpen={isMenuOpen}
                    onClose={() => setOpenMenuId(null)}
                    placement="bottom-end"
                  >
                    <PremiumTooltip text={lockedTooltip} position="left">
                      <button
                        className={`floating-menu-item${isLocked ? " disabled" : ""}`}
                        onMouseDown={() => { setOpenMenuId(null); onEditIndex(i); }}
                        disabled={isLocked}
                      >
                        <Pencil size={13} strokeWidth={2} />
                        Edit Criterion
                      </button>
                    </PremiumTooltip>
                    <PremiumTooltip text={lockedTooltip} position="left">
                      <button
                        className={`floating-menu-item${isLocked ? " disabled" : ""}`}
                        onMouseDown={() => { setOpenMenuId(null); if (!isLocked) onDuplicate(i); }}
                        disabled={isLocked}
                      >
                        <Copy size={13} strokeWidth={2} />
                        Duplicate
                      </button>
                    </PremiumTooltip>
                    <div className="floating-menu-divider" />
                    <button
                      className={`floating-menu-item${(i === 0) ? " disabled" : ""}`}
                      onMouseDown={() => { setOpenMenuId(null); onMove(i, -1); }}
                      disabled={i === 0}
                    >
                      <MoveUp size={13} strokeWidth={2} />
                      Move Up
                    </button>
                    <button
                      className={`floating-menu-item${(i === draftCriteria.length - 1) ? " disabled" : ""}`}
                      onMouseDown={() => { setOpenMenuId(null); onMove(i, 1); }}
                      disabled={i === draftCriteria.length - 1}
                    >
                      <MoveDown size={13} strokeWidth={2} />
                      Move Down
                    </button>
                    <div className="floating-menu-divider" />
                    <PremiumTooltip text={lockedTooltip} position="left">
                      <button
                        className={`floating-menu-item danger${isLocked ? " disabled" : ""}`}
                        onMouseDown={() => { setOpenMenuId(null); if (!isLocked) onDelete(i); }}
                        disabled={isLocked}
                      >
                        <Trash2 size={13} strokeWidth={2} />
                        Delete Criterion
                      </button>
                    </PremiumTooltip>
                  </FloatingMenu>
                </div>
                {!isExpanded && outcomes.length > 0 && (
                  <div className="crt-mobile-card-collapsed-outcomes">
                    {collapsedOutcomes.map((code) => {
                      const isIndirect = criterion.outcomeTypes?.[code] === "indirect";
                      return (
                        <span
                          key={code}
                          className={`crt-mobile-outcome-pill${isIndirect ? " indirect" : ""}`}
                        >
                          {code}
                        </span>
                      );
                    })}
                    {collapsedOverflow > 0 && (
                      <span className="crt-mobile-outcome-overflow">+{collapsedOverflow}</span>
                    )}
                  </div>
                )}
                {isExpanded && (
                  <div className="crt-mobile-card-body">
                    {criterion.blurb && (
                      <div className="crt-mobile-card-blurb">
                        {criterion.blurb}
                      </div>
                    )}
                    {rubric.length > 0 && (
                      <div className="crt-mobile-bands">
                        <div className="crt-mobile-section-label">Rubric Bands</div>
                        {rubric.map((band, bi) => (
                          <div
                            key={bi}
                            className={`crt-mobile-band-row ${rubricBandClass(band.level || band.label)}`}
                          >
                            <span className="crt-mobile-band-name">
                              {band.level || band.label}
                            </span>
                            {bandRangeText(band) && (
                              <span className="crt-mobile-band-range">
                                {bandRangeText(band)} pts
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {outcomes.length > 0 && (
                      <div className="crt-mobile-outcomes">
                        <div className="crt-mobile-section-label">Outcomes</div>
                        <div className="crt-mobile-outcomes-pills">
                          {outcomes.map((code) => {
                            const isIndirect = criterion.outcomeTypes?.[code] === "indirect";
                            return (
                              <span
                                key={code}
                                className={`crt-mobile-outcome-pill${isIndirect ? " indirect" : ""}`}
                              >
                                {code}
                              </span>
                            );
                          })}
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

      {draftCriteria.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredCriteria.length}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          itemLabel="criteria"
        />
      )}
    </div>
  );
}
