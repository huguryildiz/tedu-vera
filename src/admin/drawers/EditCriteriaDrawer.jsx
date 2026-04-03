// src/admin/drawers/EditCriteriaDrawer.jsx
// Drawer: edit evaluation criteria for a period.
// Wraps the existing CriteriaManager component in a Drawer shell.
// Uses id="drawer-edit-criteria" for the 540px width override in drawers.css.
//
// Props:
//   open          — boolean
//   onClose       — () => void
//   period        — { id, name } — used for subtitle tag
//   template      — current criteria array
//   outcomeConfig — period's MÜDEK outcomes [{ id, code, ... }]
//   onSave        — (newTemplate) => Promise<{ ok, error? }>
//   disabled      — boolean
//   isLocked      — boolean

import Drawer from "@/shared/ui/Drawer";
import CriteriaManager from "../criteria/CriteriaManager";

export default function EditCriteriaDrawer({
  open,
  onClose,
  period,
  template = [],
  outcomeConfig = [],
  onSave,
  onDirtyChange,
  disabled = false,
  isLocked = false,
}) {
  const handleSave = async (newTemplate) => {
    const result = await onSave?.(newTemplate);
    if (result?.ok) onClose();
    return result;
  };

  return (
    <Drawer open={open} onClose={onClose} id="drawer-edit-criteria">
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div className="crt-drawer-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
              </svg>
            </div>
            <div>
              <div className="crt-drawer-title">Evaluation Criteria</div>
              <div className="crt-drawer-subtitle">
                Scoring weights and rubric configuration
                {period?.name && (
                  <span className="crt-semester-tag">{period.name}</span>
                )}
              </div>
            </div>
          </div>
          <button
            className="fs-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 30, height: 30, borderRadius: 7 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="fs-drawer-body">
        <CriteriaManager
          template={template}
          outcomeConfig={outcomeConfig}
          onSave={handleSave}
          onDirtyChange={onDirtyChange}
          disabled={disabled}
          isLocked={isLocked}
        />
      </div>
    </Drawer>
  );
}
