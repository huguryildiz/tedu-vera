// src/admin/GridExportPrompt.jsx
// ── Inline export prompt for ScoreGrid ───────────────────────

export default function GridExportPrompt({
  open,
  visibleCount,
  totalCount,
  onExportFiltered,
  onExportAll,
  onDismiss,
}) {
  if (!open) return null;
  return (
    <div className="matrix-export-warning" role="alert">
      <span className="matrix-export-warning-msg">
        Filter active: showing <strong>{visibleCount}</strong> of <strong>{totalCount}</strong> jurors.
      </span>
      <div className="matrix-export-warning-actions">
        <button
          className="matrix-export-warning-btn"
          onClick={onExportFiltered}
        >
          Export filtered ({visibleCount})
        </button>
        <button
          className="matrix-export-warning-btn matrix-export-warning-btn--all"
          onClick={onExportAll}
        >
          Export all ({totalCount})
        </button>
        <button
          className="matrix-export-warning-dismiss"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
