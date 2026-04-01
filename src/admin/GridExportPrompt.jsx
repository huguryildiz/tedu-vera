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
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 mb-2.5 bg-amber-50 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 rounded-lg text-xs text-amber-900 dark:text-amber-200" role="alert">
      <span className="flex-1">
        Filter active: showing <strong>{visibleCount}</strong> of <strong>{totalCount}</strong> jurors.
      </span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          className="px-2.5 py-0.5 rounded-full border border-amber-400 dark:border-amber-600 bg-white dark:bg-amber-900 text-amber-900 dark:text-amber-100 text-xs font-semibold hover:bg-amber-100 dark:hover:bg-amber-800 cursor-pointer whitespace-nowrap"
          onClick={onExportFiltered}
        >
          Export filtered ({visibleCount})
        </button>
        <button
          type="button"
          className="px-2.5 py-0.5 rounded-full bg-amber-500 dark:bg-amber-600 text-white text-xs font-semibold hover:bg-amber-600 dark:hover:bg-amber-700 cursor-pointer whitespace-nowrap"
          onClick={onExportAll}
        >
          Export all ({totalCount})
        </button>
        <button
          type="button"
          className="px-1 py-0.5 rounded text-amber-700 dark:text-amber-300 cursor-pointer text-sm hover:bg-amber-200 dark:hover:bg-amber-700 flex-shrink-0"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
