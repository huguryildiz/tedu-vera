import { Copy, MoreVertical, Pencil, Trash2, XCircle } from "lucide-react";
import FloatingMenu from "@/shared/ui/FloatingMenu";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";

import { coverageBadgeClass, coverageLabel } from "./outcomeHelpers";

export default function OutcomeRow({
  outcome,
  mappedCriteria,
  coverage,
  onEdit,
  onDelete,
  onDuplicate,
  onRemoveChip,
  onAddMapping,
  onCycleCoverage,
  openMenuId,
  setOpenMenuId,
  isLocked,
}) {
  const menuKey = `acc-row-${outcome.id}`;
  const isMenuOpen = openMenuId === menuKey;
  const hasMappings = mappedCriteria.length > 0;
  const lockedTooltip = isLocked ? "Evaluation period is locked. Unlock the period to make changes." : null;
  const prefixMatch = outcome.code.match(/^([A-Za-z]+)\s+(.+)$/);
  const codePrefix = prefixMatch ? prefixMatch[1] : "";
  const codeNum = prefixMatch ? prefixMatch[2] : outcome.code;

  const coverageClass = coverage === "direct" ? "direct" : coverage === "indirect" ? "indirect" : "unmapped";

  return (
    <tr
      data-testid="outcome-row"
      data-card-selectable=""
      className="acc-row"
      onClick={() => onEdit(outcome)}
      style={{ cursor: "pointer" }}
    >
      <td data-label="Code">
        <span className={`acc-code-badge ${coverageClass}`}>
          {codePrefix && <span className="acc-code-prefix">{codePrefix}</span>}
          {codeNum || outcome.code}
        </span>
      </td>

      <td data-label="Outcome">
        <div className="acc-outcome-cell">
          <span className="acc-outcome-label">{outcome.label}</span>
          {outcome.description && (
            <span className="acc-outcome-desc">{outcome.description}</span>
          )}
        </div>
      </td>

      <td data-label="Criteria">
        <div className="acc-chip-wrap">
          {mappedCriteria.map((c) => (
            <span key={c.id} className="acc-chip">
              <span className="acc-crit-dot" style={{ background: c.color || "var(--accent)" }} />
              {c.label}
              {!isLocked && (
                <span
                  className="acc-chip-x"
                  onClick={(e) => { e.stopPropagation(); onRemoveChip(c.id, outcome.id); }}
                >
                  <XCircle size={12} strokeWidth={2.5} />
                </span>
              )}
            </span>
          ))}
          {coverage === "indirect" && !hasMappings && (
            <span style={{ fontSize: 10.5, color: "var(--text-quaternary)", fontWeight: 500 }}>Indirect coverage</span>
          )}
          {!isLocked && (
            <button
              className="acc-chip-add"
              onClick={(e) => { e.stopPropagation(); onAddMapping(outcome); }}
            >
              +{!hasMappings && coverage !== "indirect" ? " Map criterion" : ""}
            </button>
          )}
        </div>
      </td>

      <td className="text-center" data-label="Coverage">
        <span
          className={coverageBadgeClass(coverage)}
          onClick={(e) => {
            e.stopPropagation();
            if (!isLocked && coverage !== "direct") onCycleCoverage(outcome.id);
          }}
          style={isLocked ? { cursor: "default", opacity: 0.75 } : {}}
        >
          <span className="acc-cov-dot" />
          {coverageLabel(coverage)}
        </span>
      </td>

      <td className="col-acc-actions">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <FloatingMenu
            trigger={
              <button
                className="row-action-btn"
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
              onMouseDown={(e) => { e.stopPropagation(); setOpenMenuId(null); onEdit(outcome); }}
            >
              <Pencil size={13} strokeWidth={2} />
              Edit Outcome
            </button>
            <PremiumTooltip text={lockedTooltip} position="left">
              <button
                className={`floating-menu-item${isLocked ? " disabled" : ""}`}
                onMouseDown={(e) => { e.stopPropagation(); setOpenMenuId(null); if (!isLocked) onDuplicate(outcome); }}
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
                onMouseDown={(e) => { e.stopPropagation(); setOpenMenuId(null); if (!isLocked) onDelete(outcome); }}
                disabled={isLocked}
              >
                <Trash2 size={13} strokeWidth={2} />
                Delete Outcome
              </button>
            </PremiumTooltip>
          </FloatingMenu>
        </div>
      </td>
    </tr>
  );
}
