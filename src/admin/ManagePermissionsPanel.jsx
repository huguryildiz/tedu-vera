// src/admin/ManagePermissionsPanel.jsx

import { useEffect, useState } from "react";
import { ChevronDownIcon, FolderLockIcon } from "../shared/Icons";

export default function ManagePermissionsPanel({
  settings,
  jurors,
  isMobile,
  isOpen,
  onToggle,
  onSave,
  onToggleEdit,
}) {
  const [local, setLocal] = useState(settings);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  const syncField = (patch) => setLocal((prev) => ({ ...prev, ...patch }));
  const toBool = (v) => v === true || v === "true" || v === "t" || v === 1;
  const asDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const orderedJurors = Array.isArray(jurors)
    ? [...jurors].sort((a, b) => {
        const aName = (a.juryName || a.juror_name || "").toLowerCase();
        const bName = (b.juryName || b.juror_name || "").toLowerCase();
        return aName.localeCompare(bName);
      })
    : [];

  return (
    <div className={`manage-card${isMobile ? " is-collapsible" : ""}`}>
      <button
        type="button"
        className="manage-card-header"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className="manage-card-title">
          <span className="manage-card-icon" aria-hidden="true"><FolderLockIcon /></span>
          Evaluation Permissions
        </div>
        {isMobile && <ChevronDownIcon className={`manage-chevron${isOpen ? " open" : ""}`} />}
      </button>

      {(!isMobile || isOpen) && (
        <div className="manage-card-body">
          <div className="manage-field">
            <label className="manage-label">Edit window (minutes)</label>
            <input
              type="number"
              min="0"
              className="manage-input"
              value={local.editWindowMinutes}
              onChange={(e) => syncField({ editWindowMinutes: Number(e.target.value) })}
            />
            <div className="manage-hint">Set to 0 for no expiry.</div>
          </div>

          <div className="manage-field">
            <label className="manage-toggle">
              <input
                type="checkbox"
                checked={local.evalLockActive}
                onChange={(e) => syncField({ evalLockActive: e.target.checked })}
              />
              Lock evaluations for the active semester
            </label>
          </div>

          <div className="manage-list-header">Edit Mode by Juror</div>
          <div className="manage-list">
            {(showAll ? orderedJurors : orderedJurors.slice(0, 4)).map((j) => {
              const totalProjects = Number(j.totalProjects ?? j.total_projects ?? 0);
              const completedProjects = Number(j.completedProjects ?? j.completed_projects ?? 0);
              const isCompleted = totalProjects > 0 && completedProjects >= totalProjects;
              const completionHint = `Finish evaluations first (${completedProjects}/${totalProjects})`;
              const editEnabled = toBool(j.editEnabled ?? j.edit_enabled);
              const expiresAt = asDate(j.editExpiresAt ?? j.edit_expires_at);
              const isExpired = Boolean(expiresAt && expiresAt <= new Date());
              const editActive = editEnabled && !isExpired;
              return (
                <div key={j.jurorId || j.juror_id} className="manage-item">
                  <div>
                    <div className="manage-item-title">{j.juryName || j.juror_name}</div>
                    <div className="manage-item-sub">{j.juryDept || j.juror_inst}</div>
                    <div className="manage-item-meta">
                      <span className="manage-item-completion">
                        Completed {completedProjects}/{totalProjects}
                      </span>
                      {!isCompleted && (
                        <span className="manage-item-helper">
                          {completionHint}
                        </span>
                      )}
                      {isCompleted && editActive && expiresAt && (
                        <span className="manage-item-helper">
                          Expires {expiresAt.toLocaleString()}
                        </span>
                      )}
                      {isCompleted && editEnabled && isExpired && (
                        <span className="manage-item-helper">
                          Edit window expired
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="manage-item-actions">
                    <div className="manage-toggle-wrap">
                      <span className="manage-toggle-label">Edit Mode</span>
                      <label className="manage-switch">
                        <input
                          type="checkbox"
                          checked={editActive}
                          disabled={!isCompleted}
                          title={!isCompleted ? completionHint : ""}
                          onChange={(e) => {
                            if (!isCompleted) return;
                            onToggleEdit?.({
                              jurorId: j.jurorId || j.juror_id,
                              enabled: e.target.checked,
                            });
                          }}
                        />
                        <span className="manage-switch-slider" />
                      </label>
                    </div>
                  </div>
                </div>
              );
            })}
            {orderedJurors.length === 0 && (
              <div className="manage-empty">No jurors found.</div>
            )}
          </div>

          {orderedJurors.length > 4 && (
            <button
              className="manage-btn ghost"
              type="button"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Show fewer jurors" : `Show all jurors (${orderedJurors.length})`}
            </button>
          )}

          <div className="manage-card-actions">
            <button className="manage-btn primary" type="button" onClick={() => onSave(local)}>
              Save Permissions
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
