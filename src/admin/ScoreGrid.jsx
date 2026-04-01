// src/admin/ScoreGrid.jsx
// ── Juror × group evaluation grid ────────────────────────────
// - Column-based sorting (click group header: desc → asc → reset)
// - Sticky header + frozen first column
// - Juror column text filter with Escape-to-close
// - Group score column numeric range filters (0–TOTAL_MAX, auto-apply)
// - Scored-only averages (fully scored cells only)

import { useState, useRef, useCallback, memo, Component, useEffect } from "react";
import { FilterPanelActions, FilterPopoverPortal, useResponsiveFilterPresentation } from "./components";
import {
  getCellState,
  getPartialTotal,
  jurorStatusMeta,
} from "./scoreHelpers";
import {
  FilterIcon,
  InfoIcon,
  DownloadIcon,
  SearchIcon,
  XIcon,
} from "../shared/Icons";
import { CRITERIA, TOTAL_MAX } from "../config";
import { useGridSort } from "./useGridSort";
import { useScoreGridData } from "./useScoreGridData";
import { useScrollSync } from "./useScrollSync";
import { useGridExport } from "./useGridExport";

// ── Module-level constants ─────────────────────────────────────
// Enable horizontal text scrolling only after an intentional horizontal drag.
// Uses translateX on the inner wrapper so iOS recognises the gesture correctly —
// overflow-based scroll doesn't work because iOS evaluates scrollability at
// touchstart, before the JS has a chance to add overflow-x: auto.
const SWIPE_ACTIVATION_PX = 6;
function handleInlineTouchStart(e) {
  const el = e.currentTarget;
  const t = e.touches?.[0];
  if (!el || !el.classList || !t) return;
  // Cancel any running momentum animation before starting a new gesture.
  const inner = el.firstElementChild;
  if (inner) inner.style.transition = "";
  el.dataset.touchStartX   = String(t.clientX);
  el.dataset.touchStartY   = String(t.clientY);
  el.dataset.baseTranslate = el.dataset.currentTranslate ?? "0";
  delete el.dataset.maxScroll;
  delete el.dataset.lastMoveX;
  delete el.dataset.lastMoveTime;
  delete el.dataset.pastMoveX;
  delete el.dataset.pastMoveTime;
}
function handleInlineTouchMove(e) {
  const el = e.currentTarget;
  const t = e.touches?.[0];
  if (!el || !el.classList || !t) return;
  const startX = Number(el.dataset.touchStartX);
  const startY = Number(el.dataset.touchStartY);
  if (!Number.isFinite(startX) || !Number.isFinite(startY)) return;
  const rawDx = t.clientX - startX;
  const dy    = Math.abs(t.clientY - startY);
  if (Math.abs(rawDx) < SWIPE_ACTIVATION_PX || Math.abs(rawDx) <= dy) return;

  const inner = el.firstElementChild;
  if (!inner) return;

  if (!el.classList.contains("is-scrollable")) {
    el.classList.add("is-scrollable");
    void el.offsetWidth;
  }
  if (!el.dataset.maxScroll) {
    const overflow = inner.scrollWidth - el.clientWidth;
    el.dataset.maxScroll = String(overflow > 0 ? overflow : 0);
  }

  // Velocity tracking: keep a reference point ~80 ms in the past.
  const now = Date.now();
  if (now - Number(el.dataset.pastMoveTime ?? 0) > 80) {
    el.dataset.pastMoveX    = el.dataset.lastMoveX    ?? String(t.clientX);
    el.dataset.pastMoveTime = el.dataset.lastMoveTime ?? String(now);
  }
  el.dataset.lastMoveX    = String(t.clientX);
  el.dataset.lastMoveTime = String(now);

  const maxScroll    = Number(el.dataset.maxScroll ?? "0");
  const baseTranslate = Number(el.dataset.baseTranslate ?? "0");
  const newTranslate  = Math.min(0, Math.max(-maxScroll, baseTranslate + rawDx));
  inner.style.transform = `translateX(${newTranslate}px)`;
  el.dataset.currentTranslate = String(newTranslate);
}
function handleInlineTouchEnd(e) {
  const el = e.currentTarget;
  if (!el || !el.classList) return;
  const pos       = Number(el.dataset.currentTranslate ?? "0");
  const maxScroll = Number(el.dataset.maxScroll ?? "0");
  const inner     = el.firstElementChild;

  // Compute flick velocity (px/ms) from the rolling 80 ms window.
  const lastX    = Number(el.dataset.lastMoveX    ?? "0");
  const lastTime = Number(el.dataset.lastMoveTime ?? "0");
  const pastX    = Number(el.dataset.pastMoveX    ?? lastX);
  const pastTime = Number(el.dataset.pastMoveTime ?? lastTime);
  const dt       = lastTime - pastTime;
  const velocity = dt > 10 ? (lastX - pastX) / dt : 0; // px/ms

  delete el.dataset.touchStartX;
  delete el.dataset.touchStartY;
  delete el.dataset.baseTranslate;
  delete el.dataset.maxScroll;
  delete el.dataset.lastMoveX;
  delete el.dataset.lastMoveTime;
  delete el.dataset.pastMoveX;
  delete el.dataset.pastMoveTime;

  // Apply momentum if the flick was fast enough.
  if (inner && maxScroll > 0 && Math.abs(velocity) > 0.15) {
    const target = Math.min(0, Math.max(-maxScroll, pos + velocity * 280));
    if (Math.abs(target - pos) > 3) {
      inner.style.transition = "transform 450ms cubic-bezier(0.22, 1, 0.36, 1)";
      inner.style.transform  = `translateX(${target}px)`;
      el.dataset.currentTranslate = String(target);
      inner.addEventListener("transitionend", function onEnd() {
        // Guard: if the component unmounted while the transition was running,
        // el is detached. Bail early to avoid stale-closure DOM access.
        if (!el.isConnected) return;
        inner.style.transition = "";
        inner.removeEventListener("transitionend", onEnd);
        if (Number(el.dataset.currentTranslate ?? "0") >= 0) {
          el.classList.remove("is-scrollable");
          inner.style.transform = "";
          delete el.dataset.currentTranslate;
        }
      });
      return;
    }
  }

  if (pos >= 0) {
    el.classList.remove("is-scrollable");
    if (inner) inner.style.transform = "";
    delete el.dataset.currentTranslate;
  }
}
const INLINE_SCROLL_PROPS = {
  onTouchStart: handleInlineTouchStart,
  onTouchMove: handleInlineTouchMove,
  onTouchEnd: handleInlineTouchEnd,
  onTouchCancel: handleInlineTouchEnd,
};
function updateNativeInlineScrollState(el) {
  if (!el || !el.classList) return;
  const isOverflowing = el.scrollWidth > el.clientWidth + 1;
  el.classList.toggle("is-overflowing", isOverflowing);
  el.classList.toggle("is-scrolled", el.scrollLeft > 0);
}
function handleNativeInlineScroll(e) {
  updateNativeInlineScrollState(e.currentTarget);
}

const LEGEND_JUROR_STATES = ["completed", "ready_to_submit", "in_progress", "editing", "not_started"];

// ── Local utility ──────────────────────────────────────────────
function toFiniteNumber(v) {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function clampRangeInput(raw, min = 0, max = TOTAL_MAX) {
  if (raw === "") return "";
  const n = toFiniteNumber(raw);
  if (n === null) return raw;
  return String(Math.min(max, Math.max(min, n)));
}

function isInvalidRange(minRaw, maxRaw) {
  const minNum = toFiniteNumber(minRaw);
  const maxNum = toFiniteNumber(maxRaw);
  if (minRaw !== "" && minNum === null) return true;
  if (maxRaw !== "" && maxNum === null) return true;
  return minNum !== null && maxNum !== null && minNum > maxNum;
}

function hasActiveValidRange(range) {
  const minRaw = range?.min ?? "";
  const maxRaw = range?.max ?? "";
  if (!minRaw && !maxRaw) return false;
  return !isInvalidRange(minRaw, maxRaw);
}

// ── Cell helpers ───────────────────────────────────────────────
const cellClassName = (state, isFinal = false) => {
  if (state === "scored") {
    return isFinal
      ? "relative px-2 py-1.5 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-green-100 dark:bg-green-900 text-green-900 dark:text-green-50 font-bold"
      : "relative px-2 py-1.5 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-300 font-semibold";
  }
  if (state === "partial") {
    return "relative px-2 py-1.5 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-amber-50 dark:bg-amber-950 text-amber-900 dark:text-amber-200 font-bold";
  }
  return "relative px-2 py-1.5 border-b border-r border-slate-200 dark:border-slate-700 text-center bg-slate-50 dark:bg-slate-950 text-slate-400 dark:text-slate-500";
};

const cellText = (state, entry) => {
  if (state === "scored")  return entry.total;
  if (state === "partial") return getPartialTotal(entry);
  return "—";
};

// Hover tooltip: per-criteria breakdown, driven by criteria array.
function cellTooltip(state, entry, criteria = CRITERIA) {
  if (!entry || state === "empty") return undefined;
  const parts = criteria.map((c) => `${c.shortLabel || c.label}: ${entry[c.id] != null ? entry[c.id] : "—"}`);
  const line1 = parts.slice(0, 2).join(" · ");
  const line2Base = parts.slice(2).join(" · ");
  const line2 = state === "partial" ? `${line2Base} (partial)` : line2Base;
  return `${line1}\n${line2}`;
}

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
        <div className="py-1">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">Evaluation Grid</div>
          </div>
          <div className="text-sm text-red-600">
            Grid could not be displayed. Try refreshing the page.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Sub-components ─────────────────────────────────────────────

const JurorCell = memo(function JurorCell({ juror, workflowState, isTouchInput = false }) {
  const wfState  = workflowState ?? "not_started";
  const meta     = jurorStatusMeta[wfState] ?? jurorStatusMeta.not_started;
  const Icon     = meta.icon;
  const fullName = juror.dept ? `${juror.name} (${juror.dept})` : juror.name;
  const nativeNameRef = useRef(null);
  useEffect(() => {
    updateNativeInlineScrollState(nativeNameRef.current);
  }, [isTouchInput, fullName]);
  return (
    <div className="flex items-center gap-1.5 w-full h-full overflow-hidden -webkit-tap-highlight-color-transparent">
      <span
        className={`inline-flex items-center flex-shrink-0 w-3.5 h-3.5 ${meta.colorClass}`}
        title={meta.label}
        aria-hidden="true"
      >
        <Icon />
      </span>
      <span
        className={`flex items-baseline w-full min-w-0 max-w-full flex-1 gap-0.5 overflow-hidden touch-pan-y -webkit-tap-highlight-color-transparent${isTouchInput ? " is-native-scroll" : ""}`}
        title={fullName}
        {...(isTouchInput ? {} : INLINE_SCROLL_PROPS)}
        ref={nativeNameRef}
        onScroll={handleNativeInlineScroll}
      >
        <span className="flex items-baseline gap-0.5 flex-1 min-w-0">
          <span className="flex-shrink-0 max-w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-slate-900 dark:text-slate-100">{juror.name}</span>
          {juror.dept && <span className="flex-grow min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-slate-400 dark:text-slate-500 font-medium">({juror.dept})</span>}
        </span>
      </span>
    </div>
  );
});

function MatrixLegend({
  sortMode,
  sortGroupId,
  sortGroupDir,
  sortJurorDir,
  groups,
  hasAnyFilter,
  filterLabel,
  onClearAllFilters,
  onClearFilter,
  onClearSort,
  groupFilterChips,
  onClearGroupFilter,
}) {
  const sortValueLabel = (() => {
    if (sortMode === "group" && sortGroupId !== null) {
      const g   = groups.find((g) => g.id === sortGroupId);
      const dir = sortGroupDir === "desc" ? "high → low" : "low → high";
      return `${g?.label ?? "Group"} (${dir})`;
    }
    if (sortMode === "juror") {
      return `Name (${sortJurorDir === "asc" ? "A → Z" : "Z → A"})`;
    }
    return null;
  })();

  return (
    <div className="flex flex-col gap-3.5 items-start text-xs text-slate-500 mb-3">
      {/* Cell state legend */}
      <div className="flex items-center gap-3 flex-wrap w-full relative">
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto overflow-y-hidden -webkit-overflow-scrolling-touch touch-pan-x overscroll-x-contain whitespace-nowrap scrollbar-none w-full" aria-label="Cell state legend">
          <span className="text-10px uppercase tracking-widest text-slate-500 font-bold mr-1 flex-shrink-0 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-full bg-slate-100 dark:bg-slate-800">Cells</span>
          <span className="inline-flex items-center gap-1.5 flex-shrink-0 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"><span className="inline-block w-2.5 h-2.5 rounded-full bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-500" />Scored</span>
          <span className="inline-flex items-center gap-1.5 flex-shrink-0 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-700" />Partial</span>
          <span className="inline-flex items-center gap-1.5 flex-shrink-0 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400"><span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700" />Empty</span>
        </div>
      </div>
      {/* Juror workflow state legend */}
      <div className="flex items-center gap-3 flex-wrap w-full relative">
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto overflow-y-hidden -webkit-overflow-scrolling-touch touch-pan-x overscroll-x-contain whitespace-nowrap scrollbar-none w-full" aria-label="Juror status legend">
          <span className="text-10px uppercase tracking-widest text-slate-500 font-bold mr-1 flex-shrink-0 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-full bg-slate-100 dark:bg-slate-800">Juror</span>
          {LEGEND_JUROR_STATES.map((key) => {
            const meta = jurorStatusMeta[key];
            const Icon = meta.icon;
            return (
              <span key={key} className="inline-flex items-center gap-1.5 flex-shrink-0 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-full bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                <span className={`inline-flex items-center w-3.5 h-3.5 ${meta.colorClass}`}><Icon /></span>
                {meta.label}
              </span>
            );
          })}
        </div>
      </div>
      {/* Toolbar: filter count + active filter/sort indicators */}
      <div className="flex items-center justify-start w-full flex-wrap gap-3">
        {(hasAnyFilter || sortValueLabel) && (
          <button
            type="button"
            className="inline-flex items-center px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs gap-1.5 cursor-pointer"
            onClick={onClearAllFilters}
            title="Clear all filters"
            aria-label="Clear all filters"
          >
            <span>Clear all</span>
            <XIcon className="w-3 h-3" />
          </button>
        )}
        {sortValueLabel && (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs cursor-pointer whitespace-nowrap flex-shrink-0"
            onClick={onClearSort}
            title="Clear sort"
            aria-label="Clear sort"
          >
            <span className="font-bold text-slate-900 dark:text-slate-100">Sorted By</span>
            <span className="text-slate-500 dark:text-slate-400">{sortValueLabel}</span>
            <span aria-hidden="true" className="text-xs leading-none">×</span>
          </button>
        )}
        {filterLabel && (
          <button
            type="button"
            className="inline-flex items-center px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs gap-1.5 cursor-pointer"
            onClick={onClearFilter}
            title={`Clear filter: ${filterLabel}`}
            aria-label={`Clear filter: ${filterLabel}`}
          >
            <span className="font-bold text-slate-900 dark:text-slate-100">Juror</span>
            <span className="text-slate-500 dark:text-slate-400">{filterLabel}</span>
            <XIcon className="w-3 h-3" />
          </button>
        )}
        {groupFilterChips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            className="inline-flex items-center px-2 py-1 border border-slate-200 dark:border-slate-700 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-xs gap-1.5 cursor-pointer"
            onClick={() => onClearGroupFilter(chip.id)}
            title={`Clear filter: ${chip.label}${chip.value ? ` ${chip.value}` : ""}`}
            aria-label={`Clear filter: ${chip.label}${chip.value ? ` ${chip.value}` : ""}`}
          >
            <span className="font-bold text-slate-900 dark:text-slate-100">{chip.label}</span>
            {chip.value && <span className="text-slate-500 dark:text-slate-400">{chip.value}</span>}
            <XIcon className="w-3 h-3" />
          </button>
        ))}
      </div>
      <div className="hidden text-11px text-slate-400 items-center gap-1.5">
        <span className="inline-flex items-center text-slate-500" aria-hidden="true"><InfoIcon className="w-3 h-3" /></span>
        <span>Swipe to view more columns. Long text scrolls on touch.</span>
      </div>
    </div>
  );
}

const AVG_TIP_TEXT = "Averages include only completed jurors.";

// AverageRow: info icon shows a fixed-position tooltip via callbacks
const AverageRow = memo(function AverageRow({ groups, averages, onShowTip, onHideTip }) {
  return (
    <tfoot>
      <tr className="bg-red-50 dark:bg-red-950">
        <td className="text-left font-semibold text-orange-700 dark:text-orange-300 whitespace-nowrap min-w-0 overflow-hidden px-2 py-1.5 border-b border-r border-slate-200 dark:border-slate-700 sticky left-0 z-20 bg-red-50 dark:bg-red-950 box-shadow-sm overflow-visible">
          <div className="flex items-center gap-1.5 w-full h-full overflow-hidden -webkit-tap-highlight-color-transparent">
            <span>Average</span>
            <span
              className="inline-flex items-center text-orange-700 dark:text-orange-300 cursor-help relative w-3.5 h-3.5"
              aria-label={AVG_TIP_TEXT}
              tabIndex={0}
              onMouseEnter={(e) => onShowTip(e, AVG_TIP_TEXT)}
              onMouseLeave={onHideTip}
              onFocus={(e) => onShowTip(e, AVG_TIP_TEXT)}
              onBlur={onHideTip}
            >
              <InfoIcon />
            </span>
          </div>
        </td>
        {averages.map((avg, i) => (
          <td key={groups[i].id} className="text-orange-700 dark:text-orange-300 font-semibold text-sm px-2 py-1.5 border-b border-r border-slate-200 dark:border-slate-700 text-center">
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
function ScoreGridInner({ data, jurors, groups, semesterName = "", criteriaTemplate }) {
  const filterPresentation = useResponsiveFilterPresentation();
  const useSheetFilters = filterPresentation.mode === "sheet";
  const [isTouchInput, setIsTouchInput] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(hover: none), (pointer: coarse)").matches
  ));
  // Scroll refs (declared before the scroll-sync useEffect)
  const topScrollRef   = useRef(null);
  const tableScrollRef = useRef(null);

  // Filter popover state
  const [activeFilterCol,  setActiveFilterCol]  = useState(null);
  const [anchorRect,       setAnchorRect]        = useState(null);
  const [anchorEl,         setAnchorEl]          = useState(null);

  // Draft state for the currently open group score filter
  const [groupScoreDraft, setGroupScoreDraft] = useState({ min: "", max: "" });

  // Fixed-position tooltip (escapes overflow-x:auto clipping)
  const [cellTip, setCellTip] = useState(null); // { x, y, text, placement, maxWidth } | null
  const showCellTip = useCallback((e, text) => {
    const r = e.currentTarget.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const maxWidth = Math.min(260, Math.max(160, viewportWidth - 16));
    const half = maxWidth / 2;
    const rawX = r.left + r.width / 2;
    const minX = 8 + half;
    const maxX = viewportWidth - 8 - half;
    const x = viewportWidth > 0 ? Math.min(maxX, Math.max(minX, rawX)) : rawX;
    const placeAbove = r.top > 56;
    setCellTip({
      x,
      y: placeAbove ? r.top - 8 : r.bottom + 8,
      text,
      placement: placeAbove ? "top" : "bottom",
      maxWidth,
    });
  }, []);
  const hideCellTip = useCallback(() => setCellTip(null), []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsTouchInput(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.addEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);
  // Hide tooltip when table is scrolled (position would be stale)
  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", hideCellTip, { passive: true });
    return () => el.removeEventListener("scroll", hideCellTip);
  }, [hideCellTip]);

  const {
    lookup,
    jurorFinalMap,
    jurorWorkflowMap,
    groupAverages,
    buildExportRows,
  } = useScoreGridData({ data, jurors, groups, criteriaTemplate });

  // All sort + filter logic extracted to custom hook
  const {
    sortGroupId, sortGroupDir, sortJurorDir, sortMode, jurorFilter, groupScoreFilters,
    visibleJurors, toggleGroupSort, toggleJurorSort, setJurorFilter, clearSort,
    setGroupScoreFilter, clearGroupScoreFilter, clearAllFilters,
  } = useGridSort(jurors, groups, lookup);

  const {
    requestExport,
  } = useGridExport({
    buildExportRows,
    groups,
    semesterName,
    visibleJurors,
  });

  // ── Scroll sync: top phantom bar ↔ table horizontal scroll ──
  useScrollSync(topScrollRef, tableScrollRef);

  const minFirstCol = 180;
  const scoreColWidth = 72;
  const scoreColsWidth = groups.length * scoreColWidth;
  const minTableWidth = scoreColsWidth + minFirstCol;
  const tableStyle = {
    width: "100%",
    minWidth: `${minTableWidth}px`,
  };

  const handleMatrixWheel = useCallback((e) => {
    const el = tableScrollRef.current;
    if (!el) return;
    if (e.shiftKey) return;
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    if (el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }, []);

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

  // Open group score filter: sync draft from persisted filter state first
  const openGroupFilter = useCallback((groupId, evt) => {
    const current = groupScoreFilters[groupId] || { min: "", max: "" };
    const min = clampRangeInput(current.min ?? "");
    const max = clampRangeInput(current.max ?? "");
    setGroupScoreDraft({ min, max });
    if (min !== (current.min ?? "") || max !== (current.max ?? "")) {
      setGroupScoreFilter(groupId, min, max);
    }
    toggleFilterCol(groupId, evt);
  }, [groupScoreFilters, setGroupScoreFilter, toggleFilterCol]);

  const isJurorFilterActive = !!jurorFilter || activeFilterCol === "juror";

  // Active group filter chips for MatrixLegend
  const activeGroupFilterChips = groups
    .filter((g) => {
      const f = groupScoreFilters[g.id];
      return hasActiveValidRange(f);
    })
    .map((g) => {
      const { min, max } = groupScoreFilters[g.id];
      const rawLabel = String(g.groupNo ?? g.label ?? "").trim();
      const label = /^group\b/i.test(rawLabel) ? rawLabel : `Group ${rawLabel}`;
      const value = min && max ? `${min}–${max}`
                  : min       ? `≥${min}`
                  :              `≤${max}`;
      return { id: g.id, label, value };
    });
  const hasAnyFilter = !!jurorFilter || activeGroupFilterChips.length > 0;

  if (!jurors.length) {
    return (
      <div className="py-1">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">Evaluation Grid</div>
        </div>
        <div className="text-sm text-slate-500">No data yet.</div>
      </div>
    );
  }

  // Group score filter popover content (rendered when a group column is active)
  const groupFilterPopover = (() => {
    const groupId = activeFilterCol && activeFilterCol !== "juror" ? activeFilterCol : null;
    if (!groupId) return null;
    const groupMeta = groups.find((g) => g.id === groupId);
    const rawGroupLabel = String(groupMeta?.groupNo ?? groupMeta?.label ?? "Group").trim();
    const groupLabel = /^group\b/i.test(rawGroupLabel) ? rawGroupLabel : `Group ${rawGroupLabel}`;
    const { min: draftMin, max: draftMax } = groupScoreDraft;
    const minNum   = toFiniteNumber(draftMin);
    const maxNum   = toFiniteNumber(draftMax);
    const hasError = minNum !== null && maxNum !== null && minNum > maxNum;
    const hasDraftValues = !!(draftMin || draftMax);
    return (
      <FilterPopoverPortal
        open={true}
        anchorRect={anchorRect}
        anchorEl={anchorEl}
        onClose={closePopover}
        className="space-y-4"
        contentKey={`${draftMin}|${draftMax}`}
        id={`filter-popover-group-${groupId}`}
        trapFocus
        sheetTitle={groupLabel}
        sheetFooter={useSheetFilters ? (
          <FilterPanelActions
            onClear={() => {
              clearGroupScoreFilter(groupId);
              setGroupScoreDraft({ min: "", max: "" });
            }}
            onApply={closePopover}
            clearDisabled={!hasDraftValues}
            applyDisabled={hasError}
          />
        ) : null}
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Min</label>
          <input
            autoFocus={!useSheetFilters}
            type="number"
            inputMode="decimal"
            min={0}
            max={TOTAL_MAX}
            value={draftMin}
            className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            onChange={(e) => {
              const nextMin = clampRangeInput(e.target.value);
              setGroupScoreDraft((p) => {
                const next = { ...p, min: nextMin };
                setGroupScoreFilter(groupId, next.min, next.max);
                return next;
              });
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Max</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            value={draftMax}
            className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            onChange={(e) => {
              const nextMax = clampRangeInput(e.target.value);
              setGroupScoreDraft((p) => {
                const next = { ...p, max: nextMax };
                setGroupScoreFilter(groupId, next.min, next.max);
                return next;
              });
            }}
          />
        </div>
        {hasError && <div className="text-sm text-red-600 dark:text-red-400">Min must be ≤ Max.</div>}
        {!useSheetFilters && hasDraftValues && (
          <button
            type="button"
            className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            onClick={() => {
              clearGroupScoreFilter(groupId);
              setGroupScoreDraft({ min: "", max: "" });
              closePopover();
            }}
          >
            Clear
          </button>
        )}
      </FilterPopoverPortal>
    );
  })();

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-sm font-bold text-slate-700 dark:text-slate-300">Evaluation Grid</div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" onClick={requestExport}>
            <DownloadIcon className="w-4 h-4" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      <MatrixLegend
        sortMode={sortMode}
        sortGroupId={sortGroupId}
        sortGroupDir={sortGroupDir}
        sortJurorDir={sortJurorDir}
        groups={groups}
        hasAnyFilter={hasAnyFilter}
        filterLabel={jurorFilter}
        onClearAllFilters={() => {
          clearAllFilters();
          clearSort();
          closePopover();
        }}
        onClearFilter={() => { setJurorFilter(""); closePopover(); }}
        onClearSort={clearSort}
        groupFilterChips={activeGroupFilterChips}
        onClearGroupFilter={(groupId) => { clearGroupScoreFilter(groupId); }}
      />

      <div className="overflow-hidden h-0 max-w-full m-0 scrollbar-none" ref={topScrollRef} aria-hidden="true">
        <div className="h-0" />
      </div>
      <div className="rounded-xl border border-border bg-background overflow-visible shadow-sm">
        <div className="overflow-x-auto overflow-y-visible -webkit-overflow-scrolling-touch touch-pan-x overscroll-x-contain scrollbar-none w-full" ref={tableScrollRef} onWheel={handleMatrixWheel}>
          <table
            className="w-full border-collapse text-sm bg-white dark:bg-slate-950 table-fixed"
            style={tableStyle}
            role="grid"
            aria-rowcount={visibleJurors.length + 1}
            aria-colcount={groups.length + 1}
          >
            <thead>
              <tr>
                {/* Juror column — sort + text filter */}
                <th
                  className="sticky left-0 z-30 relative text-left bg-slate-100 dark:bg-slate-800 px-2 py-1.5 font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap text-center"
                  aria-sort={
                    sortMode === "juror"
                      ? (sortJurorDir === "asc" ? "ascending" : "descending")
                      : "none"
                  }
                >
                  <div className="flex flex-row items-center justify-start gap-1 flex-nowrap">
                    <button
                      type="button"
                      className="bg-none border-none p-0 cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-0.5 whitespace-nowrap justify-start"
                      onClick={toggleJurorSort}
                      title="Sort by juror name"
                    >
                      <span className={`${isJurorFilterActive ? "text-blue-600 dark:text-blue-400 font-bold" : ""}`}>
                        Juror / Group
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`bg-none border-none p-1 cursor-pointer text-slate-500 dark:text-slate-400 ${isJurorFilterActive ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 rounded-lg shadow-inner-sm" : ""}`}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFilterCol("juror", e); }}
                      title="Filter jurors"
                      aria-label="Filter jurors"
                    >
                      <FilterIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </th>

                {/* Group columns — sort + numeric range filter */}
                {groups.map((g) => {
                  const isSortActive   = sortMode === "group" && sortGroupId === g.id;
                  const gFilter        = groupScoreFilters[g.id] || { min: "", max: "" };
                  const isFilterActive = hasActiveValidRange(gFilter) || activeFilterCol === g.id;
                  return (
                    <th key={g.id} scope="col" className="bg-slate-100 dark:bg-slate-800 px-2 py-1.5 font-bold text-slate-700 dark:text-slate-300 border-b border-r border-slate-200 dark:border-slate-700 whitespace-nowrap text-center sticky top-0 z-10">
                      <div className="flex flex-row items-center justify-center gap-1 flex-nowrap">
                        <button
                          className="bg-none border-none p-0 cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center justify-center gap-0.5 whitespace-nowrap"
                          onClick={() => toggleGroupSort(g.id)}
                          title={`Sort by ${g.label} — click again to reverse, third click to reset`}
                        >
                          <span className={isSortActive ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950 px-1.5 py-0.5 rounded-lg shadow-inner-sm" : ""}>{g.groupNo ?? g.label}</span>
                        </button>
                        <button
                          type="button"
                          className={`bg-none border-none p-1 cursor-pointer text-slate-500 dark:text-slate-400 ${isFilterActive ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 rounded-lg shadow-inner-sm" : ""}`}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); openGroupFilter(g.id, e); }}
                          title={`Filter by group ${g.groupNo ?? g.label} score`}
                          aria-label={`Filter group ${g.groupNo ?? g.label} scores`}
                        >
                          <FilterIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
                    <td className="text-left font-semibold text-slate-900 dark:text-slate-50 whitespace-nowrap min-w-0 overflow-hidden px-2 py-1.5 border-b border-r border-slate-200 dark:border-slate-700 sticky left-0 z-20 bg-white dark:bg-slate-950 overflow-visible" role="rowheader" scope="row">
                      <JurorCell
                        juror={juror}
                        workflowState={jurorWorkflowMap.get(juror.key)}
                        isTouchInput={isTouchInput}
                      />
                    </td>
                    {groups.map((g) => {
                      const entry = lookup[juror.key]?.[g.id] ?? null;
                      const state = getCellState(entry);
                      const tooltip = cellTooltip(state, entry, criteriaTemplate || CRITERIA);
                      return (
                        <td
                          key={g.id}
                          role="gridcell"
                          className={cellClassName(state, isFinal)}
                          aria-label={tooltip}
                          tabIndex={tooltip ? 0 : undefined}
                          onMouseEnter={tooltip ? (e) => showCellTip(e, tooltip) : undefined}
                          onMouseLeave={tooltip ? hideCellTip : undefined}
                          onFocus={tooltip ? (e) => showCellTip(e, tooltip) : undefined}
                          onBlur={tooltip ? hideCellTip : undefined}
                        >
                          {cellText(state, entry)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            <AverageRow groups={groups} averages={groupAverages} onShowTip={showCellTip} onHideTip={hideCellTip} />
          </table>
        </div>
      </div>

      {cellTip && (
        <div
          className="fixed z-50 px-2.5 py-1.5 rounded-md bg-slate-900 dark:bg-slate-800 text-slate-50 dark:text-slate-100 text-xs font-medium whitespace-pre-wrap leading-relaxed shadow-lg pointer-events-none"
          role="tooltip"
          style={{
            left: cellTip.x,
            top: cellTip.y,
            maxWidth: `${cellTip.maxWidth}px`,
            transform: cellTip.placement === "bottom" ? "translate(-50%, 0)" : "translate(-50%, -100%)",
          }}
        >
          {cellTip.text}
        </div>
      )}

      {/* Juror text filter popover */}
      <FilterPopoverPortal
        open={activeFilterCol === "juror"}
        anchorRect={anchorRect}
        anchorEl={anchorEl}
        onClose={closePopover}
        className="col-filter-popover col-filter-popover-portal"
        contentKey={jurorFilter}
        trapFocus
        id="filter-popover-juror"
        sheetTitle="Juror / Group"
        sheetFooter={useSheetFilters ? (
          <FilterPanelActions
            onClear={() => setJurorFilter("")}
            onApply={closePopover}
            clearDisabled={!jurorFilter}
          />
        ) : null}
      >
        <label htmlFor="juror-filter-input" className="sr-only">
          Filter jurors by name or Affiliation
        </label>
        <div className="relative w-full">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true"><SearchIcon className="w-4 h-4" /></span>
          <input
            id="juror-filter-input"
            autoFocus={!useSheetFilters}
            placeholder="Search juror or Affiliation"
            aria-label="Filter jurors by name or Affiliation"
            value={jurorFilter}
            onChange={(e) => setJurorFilter(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 placeholder-slate-500 dark:placeholder-slate-400 px-2.5 pl-8 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {!useSheetFilters && jurorFilter && (
          <button
            type="button"
            className="px-2 py-1 rounded-md border border-red-300 dark:border-red-700 bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900 cursor-pointer"
            onClick={() => { setJurorFilter(""); closePopover(); }}
          >
            Clear
          </button>
        )}
      </FilterPopoverPortal>

      {/* Group score numeric range filter popover */}
      {groupFilterPopover}
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
