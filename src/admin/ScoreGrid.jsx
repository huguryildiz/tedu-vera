// src/admin/ScoreGrid.jsx
// ── Juror × group evaluation grid ────────────────────────────
// - Column-based sorting (click group header: desc → asc → reset)
// - Sticky header + frozen first column
// - Juror column text filter with Escape-to-close
// - Scored-only averages (fully scored cells only)

import { useState, useRef, useCallback, memo, Component } from "react";
import { FilterPopoverPortal } from "./components";
import {
  getCellState,
  getPartialTotal,
  jurorStatusMeta,
} from "./scoreHelpers";
import {
  FilterIcon,
  ArrowUpDownIcon,
  ArrowDown01Icon,
  ArrowDown10Icon,
  InfoIcon,
  DownloadIcon,
} from "../shared/Icons";
import { CRITERIA } from "../config";
import { useGridSort } from "./useGridSort";
import { useScoreGridData } from "./useScoreGridData";
import { useScrollSync } from "./useScrollSync";
import { useGridExport } from "./useGridExport";
import GridExportPrompt from "./GridExportPrompt";

// ── Module-level constants ─────────────────────────────────────
// Inline scroll props: focus/touch activates horizontal scroll on long juror names
const INLINE_SCROLL_PROPS = {
  onTouchStart: (e) => { const el = e.currentTarget; if (el?.classList) el.classList.add("is-scrollable"); },
  onTouchMove:  (e) => { const el = e.currentTarget; if (el?.classList) el.classList.add("is-scrollable"); },
};

const LEGEND_JUROR_STATES = ["completed", "ready_to_submit", "in_progress", "editing", "not_started"];

// ── Cell helpers ───────────────────────────────────────────────
const cellClassName = (state, isFinal = false) => {
  if (state === "scored") return isFinal ? "matrix-cell matrix-cell-scored-final" : "matrix-cell matrix-cell-scored";
  if (state === "partial") return "matrix-cell matrix-cell-partial";
  return "matrix-cell matrix-cell-empty";
};

const cellText = (state, entry) => {
  if (state === "scored")  return entry.total;
  if (state === "partial") return getPartialTotal(entry);
  return "—";
};

// Hover tooltip: per-criteria breakdown, driven by CRITERIA from config.js
const cellTooltip = (state, entry) => {
  if (!entry || state === "empty") return undefined;
  const parts = CRITERIA
    .map((c) => `${c.shortLabel}: ${entry[c.id] != null ? entry[c.id] : "—"}`)
    .join(" | ");
  return state === "partial" ? `${parts} (partial)` : parts;
};

// ── Error boundary ─────────────────────────────────────────────
class GridErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error("[ScoreGrid] Render error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="matrix-wrap">
          <div className="admin-section-header">
            <div className="section-label">Evaluation Grid</div>
          </div>
          <div className="empty-msg" style={{ color: "#dc2626" }}>
            Grid could not be displayed. Try refreshing the page.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Sub-components ─────────────────────────────────────────────

const JurorCell = memo(function JurorCell({ juror, workflowState }) {
  const wfState  = workflowState ?? "not_started";
  const meta     = jurorStatusMeta[wfState] ?? jurorStatusMeta.not_started;
  const Icon     = meta.icon;
  const fullName = juror.dept ? `${juror.name} (${juror.dept})` : juror.name;
  return (
    <>
      <span
        className={`matrix-status-icon ${meta.colorClass}`}
        title={meta.label}
        aria-hidden="true"
      >
        <Icon />
      </span>
      <span className="matrix-juror-name" title={fullName} {...INLINE_SCROLL_PROPS}>
        <span className="matrix-juror-name-text">{juror.name}</span>
        {juror.dept && <span className="matrix-juror-dept"> ({juror.dept})</span>}
      </span>
    </>
  );
});

function MatrixLegend({ visibleCount, totalCount, sortMode, sortGroupId, sortGroupDir, sortJurorDir, groups }) {
  const sortLabel = (() => {
    if (sortMode === "group" && sortGroupId !== null) {
      const g   = groups.find((g) => g.id === sortGroupId);
      const dir = sortGroupDir === "desc" ? "high → low" : "low → high";
      return `Sorted by: ${g?.label ?? "Group"} (${dir})`;
    }
    if (sortMode === "juror") {
      return `Sorted by: Name (${sortJurorDir === "asc" ? "A → Z" : "Z → A"})`;
    }
    return null;
  })();

  return (
    <div className="matrix-subtitle">
      {/* Cell state legend */}
      <div className="matrix-legend-row legend-scroll-row">
        <div className="matrix-legend-scroll" aria-label="Cell state legend">
          <span className="matrix-legend-label">Cells</span>
          <span className="matrix-legend-item"><span className="matrix-legend-dot scored-dot" />Scored</span>
          <span className="matrix-legend-item"><span className="matrix-legend-dot partial-dot" />Partial</span>
          <span className="matrix-legend-item"><span className="matrix-legend-dot empty-dot" />Empty</span>
        </div>
      </div>
      {/* Juror workflow state legend */}
      <div className="matrix-legend-row matrix-icon-legend legend-scroll-row">
        <div className="matrix-legend-scroll" aria-label="Juror status legend">
          <span className="matrix-legend-label">Juror</span>
          {LEGEND_JUROR_STATES.map((key) => {
            const meta = jurorStatusMeta[key];
            const Icon = meta.icon;
            return (
              <span key={key} className="matrix-icon-legend-item">
                <span className={`matrix-status-icon ${meta.colorClass}`}><Icon /></span>
                {meta.label}
              </span>
            );
          })}
        </div>
      </div>
      {/* Toolbar: filter count + active sort indicator */}
      <div className="matrix-legend-row matrix-toolbar-row">
        {visibleCount < totalCount && (
          <span className="matrix-legend-count">
            Showing {visibleCount}/{totalCount} jurors
          </span>
        )}
        {sortLabel && (
          <span className="matrix-sort-indicator">{sortLabel}</span>
        )}
      </div>
      <div className="matrix-scroll-hint">
        Tip: scroll horizontally to view all groups. Long names can be swiped on touch.
      </div>
    </div>
  );
}

// AverageRow: CSS tooltip on desktop hover/focus, click-toggled on mobile/touch
const AverageRow = memo(function AverageRow({ groups, averages }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  return (
    <tfoot>
      <tr className="matrix-avg-row">
        <td className="matrix-juror matrix-avg-label">
          <span>Average</span>
          <span
            className={`matrix-avg-tooltip${tooltipOpen ? " is-open" : ""}`}
            data-tooltip="Averages include only completed jurors."
            aria-label="Averages include only completed jurors."
            tabIndex={0}
            onClick={() => setTooltipOpen((v) => !v)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setTooltipOpen((v) => !v); }}
            onBlur={() => setTooltipOpen(false)}
          >
            <InfoIcon />
          </span>
        </td>
        {averages.map((avg, i) => (
          <td key={groups[i].id} className="matrix-avg-cell">
            {avg !== null ? avg : "—"}
          </td>
        ))}
      </tr>
    </tfoot>
  );
});

// ── Inner component ────────────────────────────────────────────
// Props:
//   data    – raw rows
//   jurors  – { key, name, dept }[]  (from AdminPanel uniqueJurors)
//   groups  – { id, label }[]
function ScoreGridInner({ data, jurors, groups, semesterName = "" }) {
  // Scroll refs (declared before the scroll-sync useEffect)
  const topScrollRef   = useRef(null);
  const tableScrollRef = useRef(null);

  // Filter popover state
  const [activeFilterCol,  setActiveFilterCol]  = useState(null);
  const [anchorRect,       setAnchorRect]        = useState(null);
  const [anchorEl,         setAnchorEl]          = useState(null);

  const {
    lookup,
    jurorFinalMap,
    jurorWorkflowMap,
    groupAverages,
    buildExportRows,
  } = useScoreGridData({ data, jurors, groups });

  // All sort + filter logic extracted to custom hook
  const {
    sortGroupId, sortGroupDir, sortJurorDir, sortMode, jurorFilter,
    visibleJurors, toggleGroupSort, toggleJurorSort, setJurorFilter,
  } = useGridSort(jurors, lookup);

  const {
    showExportPrompt,
    requestExport,
    exportFiltered,
    exportAll,
    dismissExportPrompt,
  } = useGridExport({
    buildExportRows,
    groups,
    semesterName,
    jurors,
    visibleJurors,
  });

  // ── Scroll sync: top phantom bar ↔ table horizontal scroll ──
  useScrollSync(topScrollRef, tableScrollRef);

  // ── Escape key closes filter popover ───────────────────────
  const closePopover = useCallback(() => {
    setActiveFilterCol(null);
    setAnchorRect(null);
    setAnchorEl(null);
  }, []);

  // ── Popover helpers ─────────────────────────────────────────
  const toggleFilterCol = useCallback((colId, evt) => {
    const rect = evt?.currentTarget?.getBoundingClientRect?.();
    const el   = evt?.currentTarget ?? null;
    setActiveFilterCol((prev) => {
      const next = prev === colId ? null : colId;
      if (next && rect) { setAnchorRect(rect); setAnchorEl(el); }
      if (!next)        { setAnchorRect(null); setAnchorEl(null); }
      return next;
    });
  }, []);

  // ── Sort icon helper ────────────────────────────────────────
  const groupSortIcon = (gId) => {
    if (sortMode !== "group" || sortGroupId !== gId) return <ArrowUpDownIcon />;
    return sortGroupDir === "desc" ? <ArrowDown10Icon /> : <ArrowDown01Icon />;
  };

  const isJurorFilterActive = !!jurorFilter || activeFilterCol === "juror";

  if (!jurors.length) {
    return (
      <div className="matrix-wrap">
        <div className="admin-section-header">
          <div className="section-label">Evaluation Grid</div>
        </div>
        <div className="empty-msg">No data yet.</div>
      </div>
    );
  }

  return (
    <div className="matrix-wrap">
      <div className="admin-section-header">
        <div className="section-label">Evaluation Grid</div>
        <div className="admin-section-actions">
          <button className="xlsx-export-btn matrix-export-btn" onClick={requestExport}>
            <DownloadIcon />
            <span>Excel</span>
          </button>
        </div>
      </div>

      <GridExportPrompt
        open={showExportPrompt}
        visibleCount={visibleJurors.length}
        totalCount={jurors.length}
        onExportFiltered={exportFiltered}
        onExportAll={exportAll}
        onDismiss={dismissExportPrompt}
      />

      <MatrixLegend
        visibleCount={visibleJurors.length}
        totalCount={jurors.length}
        sortMode={sortMode}
        sortGroupId={sortGroupId}
        sortGroupDir={sortGroupDir}
        sortJurorDir={sortJurorDir}
        groups={groups}
      />

      <div className="matrix-scroll-top" ref={topScrollRef} aria-hidden="true">
        <div className="matrix-scroll-top-inner" />
      </div>
      <div className="matrix-scroll-wrap">
        <div className="matrix-scroll" ref={tableScrollRef}>
          <table className="matrix-table">
            <thead>
              <tr>
                {/* Juror column — sort + text filter */}
                <th
                  className="matrix-corner"
                  aria-sort={
                    sortMode === "juror"
                      ? (sortJurorDir === "asc" ? "ascending" : "descending")
                      : "none"
                  }
                >
                  <div className="matrix-corner-head">
                    <button
                      type="button"
                      className={`matrix-col-sort matrix-col-sort--juror${sortMode === "juror" ? " active" : ""}`}
                      onClick={toggleJurorSort}
                      title="Sort by juror name"
                    >
                      <span className={`col-sort-label${isJurorFilterActive ? " filtered" : ""}`}>
                        Juror / Group
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`col-filter-hotspot${isJurorFilterActive ? " active filter-icon-active" : ""}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFilterCol("juror", e); }}
                      title="Filter jurors"
                      aria-label="Filter jurors"
                    >
                      <FilterIcon />
                    </button>
                  </div>
                </th>

                {/* Group columns — click-to-sort only */}
                {groups.map((g) => {
                  const isActive = sortMode === "group" && sortGroupId === g.id;
                  return (
                    <th key={g.id}>
                      <button
                        className={`matrix-col-sort${isActive ? " active" : ""}`}
                        onClick={() => toggleGroupSort(g.id)}
                        title={`Sort by ${g.label} — click again to reverse, third click to reset`}
                      >
                        <span>{g.groupNo ?? g.label}</span>
                        <span className="sort-icon">{groupSortIcon(g.id)}</span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {visibleJurors.map((juror) => {
                const isFinal = jurorFinalMap.get(juror.key) && !juror.editEnabled;
                return (
                  <tr key={juror.key}>
                    <td className="matrix-juror">
                      <JurorCell juror={juror} workflowState={jurorWorkflowMap.get(juror.key)} />
                    </td>
                    {groups.map((g) => {
                      const entry = lookup[juror.key]?.[g.id] ?? null;
                      const state = getCellState(entry);
                      const tooltip = cellTooltip(state, entry);
                      return (
                        <td
                          key={g.id}
                          className={cellClassName(state, isFinal)}
                          data-tooltip={tooltip || undefined}
                          data-tooltip-active={tooltip ? "true" : undefined}
                          aria-label={tooltip}
                          tabIndex={tooltip ? 0 : undefined}
                        >
                          {cellText(state, entry)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            <AverageRow groups={groups} averages={groupAverages} />
          </table>
        </div>
      </div>

      <FilterPopoverPortal
        open={activeFilterCol === "juror"}
        anchorRect={anchorRect}
        anchorEl={anchorEl}
        onClose={closePopover}
        className="col-filter-popover col-filter-popover-portal"
        contentKey={jurorFilter}
        trapFocus
      >
        <div className="col-filter-label">Filter jurors</div>
        <label htmlFor="juror-filter-input" className="sr-only">
          Filter jurors by name or department
        </label>
        <input
          id="juror-filter-input"
          autoFocus
          placeholder="Filter juror name or department…"
          aria-label="Filter jurors by name or department"
          value={jurorFilter}
          onChange={(e) => setJurorFilter(e.target.value)}
          className={isJurorFilterActive ? "filter-input-active" : ""}
        />
        {jurorFilter && (
          <button className="col-filter-clear" onClick={() => { setJurorFilter(""); closePopover(); }}>
            Clear
          </button>
        )}
      </FilterPopoverPortal>
    </div>
  );
}

// ── Default export wrapped in error boundary ───────────────────
export default function ScoreGrid(props) {
  return (
    <GridErrorBoundary>
      <ScoreGridInner {...props} />
    </GridErrorBoundary>
  );
}
