// src/admin/ScoreDetails.jsx
// ============================================================
// Sortable details table with Excel-style column header filters.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { CRITERIA, TOTAL_MAX } from "../config";
import { cmp, formatTs, tsToMillis, rowKey } from "./utils";
import { exportXLSX } from "./xlsx/exportXLSX";
import {
  FilterPanelActions,
  StatusBadge,
  useResponsiveFilterPresentation,
} from "./components";
import { getCellState } from "./scoreHelpers";
import { getActiveCriteria } from "../shared/criteriaHelpers";
import { DownloadIcon, InfoIcon, SearchIcon } from "../shared/Icons";
import {
  APP_DATE_MIN_DATETIME,
  APP_DATE_MAX_DATETIME,
} from "../shared/dateBounds";

import {
  useScoreDetailsFilters,
  STATUS_OPTIONS,
  JUROR_STATUS_OPTIONS,
  VALID_SORT_DIRS,
  DEFAULT_SORT_KEY,
  DEFAULT_SORT_DIR,
  DATE_MIN_DATETIME,
  DATE_MAX_DATETIME,
  parseDateString,
  buildDateRange,
  toFiniteNumber,
  isInvalidNumberRange,
  hasActiveValidNumberRange,
  isMissing,
  NUMERIC_SORT_KEYS,
} from "./hooks/useScoreDetailsFilters";

import {
  buildProjectMetaMap,
  buildJurorEditMap,
  deriveGroupNoOptions,
  generateMissingRows,
  enrichRows,
  applyFilters,
  sortRows,
  computeActiveFilterCount,
} from "./selectors/filterPipeline";

import ScoreDetailsFilters from "./components/details/ScoreDetailsFilters";
import ScoreDetailsTable, {
  displayScore,
  formatDateOnlyFromMs,
  CELL_SCROLL_PROPS,
  CELL_SCROLL_NATIVE_PROPS,
  joinClass,
} from "./components/details/ScoreDetailsTable";

// jurors prop: { key, name, dept }[]
export default function ScoreDetails({
  data,
  jurors,
  assignedJurors = null,
  groups = [],
  semesterName = "",
  summaryData = [],
  loading = false,
  criteriaTemplate,
}) {
  const activeCriteria = getActiveCriteria(criteriaTemplate);
  const {
    scoreCols,
    scoreKeys,
    scoreMaxByKey,
    updateScoreFilter,
    buildEmptyFilters,
    filterGroupNo, setFilterGroupNo,
    filterJuror, setFilterJuror,
    filterDept, setFilterDept,
    filterStatus, setFilterStatus,
    filterJurorStatus, setFilterJurorStatus,
    filterProjectTitle, setFilterProjectTitle,
    filterStudents, setFilterStudents,
    filterComment, setFilterComment,
    scoreFilters, setScoreFilters,
    updatedFrom, setUpdatedFrom,
    updatedTo, setUpdatedTo,
    completedFrom, setCompletedFrom,
    completedTo, setCompletedTo,
    updatedDateError, setUpdatedDateError,
    completedDateError, setCompletedDateError,
    updatedParsedFrom,
    updatedParsedTo,
    updatedParsedFromMs,
    updatedParsedToMs,
    isUpdatedInvalidRange,
    completedParsedFrom,
    completedParsedTo,
    completedParsedFromMs,
    completedParsedToMs,
    isCompletedInvalidRange,
    sortKey, setSortKey,
    sortDir, setSortDir,
    pageSize, setPageSize,
    currentPage, setCurrentPage,
    activeFilterCol, setActiveFilterCol,
    anchorRect, setAnchorRect,
    anchorEl, setAnchorEl,
    multiSearchQuery, setMultiSearchQuery,
    showStatusLegend, setShowStatusLegend,
    filterPresentation,
  } = useScoreDetailsFilters(activeCriteria);

  const scoreFilterMax = scoreMaxByKey.total;

  const useSheetFilters = filterPresentation.mode === "sheet";

  const [isTouchInput, setIsTouchInput] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(hover: none), (pointer: coarse)").matches
  ));

  // Scroll sync refs — must stay in ScoreDetails
  const topScrollRef = useRef(null);
  const tableScrollRef = useRef(null);
  const cellScrollProps = isTouchInput ? CELL_SCROLL_NATIVE_PROPS : CELL_SCROLL_PROPS;

  const projectMetaById = useMemo(
    () => buildProjectMetaMap(summaryData),
    [summaryData]
  );


  const groupNoOptions = useMemo(() => deriveGroupNoOptions(data), [data]);

  const jurorEditMap = useMemo(() => buildJurorEditMap(jurors), [jurors]);

  // Touch detection effect
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

  // Scroll sync effect — uses both refs
  useEffect(() => {
    const top = topScrollRef.current;
    const wrap = tableScrollRef.current;
    if (!top || !wrap) return;

    const inner = top.firstElementChild;
    if (!inner) return;

    let syncing = false;
    const syncFromWrap = () => {
      if (syncing) return;
      syncing = true;
      top.scrollLeft = wrap.scrollLeft;
      syncing = false;
    };
    const syncFromTop = () => {
      if (syncing) return;
      syncing = true;
      wrap.scrollLeft = top.scrollLeft;
      syncing = false;
    };
    const updateWidth = () => {
      inner.style.width = `${wrap.scrollWidth}px`;
      syncFromWrap();
    };

    updateWidth();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updateWidth) : null;
    ro?.observe(wrap);
    window.addEventListener("resize", updateWidth);
    wrap.addEventListener("scroll", syncFromWrap, { passive: true });
    top.addEventListener("scroll", syncFromTop, { passive: true });

    return () => {
      wrap.removeEventListener("scroll", syncFromWrap);
      top.removeEventListener("scroll", syncFromTop);
      window.removeEventListener("resize", updateWidth);
      ro?.disconnect();
    };
  }, []);

  const isUpdatedDateFilterValid = useMemo(() => (
    !!updatedFrom
    && updatedParsedFromMs !== null
    && (!updatedTo || updatedParsedToMs !== null)
    && !isUpdatedInvalidRange
  ), [updatedFrom, updatedTo, updatedParsedFromMs, updatedParsedToMs, isUpdatedInvalidRange]);

  const isCompletedDateFilterValid = useMemo(() => (
    !!completedFrom
    && completedParsedFromMs !== null
    && (!completedTo || completedParsedToMs !== null)
    && !isCompletedInvalidRange
  ), [completedFrom, completedTo, completedParsedFromMs, completedParsedToMs, isCompletedInvalidRange]);

  const activeFilterCount = useMemo(() => computeActiveFilterCount({
    filterGroupNo, filterJuror, filterDept, filterStatus, filterJurorStatus,
    filterProjectTitle, filterStudents, isUpdatedDateFilterValid, isCompletedDateFilterValid,
    scoreFilters, scoreKeys, filterComment,
  }), [filterGroupNo, filterJuror, filterDept, filterStatus, filterJurorStatus, filterProjectTitle, filterStudents, isUpdatedDateFilterValid, isCompletedDateFilterValid, scoreFilters, filterComment]);

  const hasAnyFilter = activeFilterCount > 0;
  const isGroupNoFilterActive = Array.isArray(filterGroupNo) || activeFilterCol === "groupNo";
  const isJurorFilterActive = !!filterJuror || activeFilterCol === "juror";
  const isDeptFilterActive = !!filterDept || activeFilterCol === "dept";
  const isStatusFilterActive = Array.isArray(filterStatus) || activeFilterCol === "status";
  const isJurorStatusFilterActive = Array.isArray(filterJurorStatus) || activeFilterCol === "jurorStatus";
  const isProjectTitleFilterActive = !!filterProjectTitle || activeFilterCol === "projectTitle";
  const isStudentsFilterActive = !!filterStudents || activeFilterCol === "students";
  const isUpdatedDateFilterActive = isUpdatedDateFilterValid || activeFilterCol === "updatedAt";
  const isCompletedDateFilterActive = isCompletedDateFilterValid || activeFilterCol === "completedAt";
  const isCommentFilterActive = !!filterComment || activeFilterCol === "comment";

  function resetFilters() {
    setFilterGroupNo(null);
    setFilterJuror("");
    setFilterDept("");
    setFilterStatus(null);
    setFilterJurorStatus(null);
    setFilterProjectTitle("");
    setFilterStudents("");
    setUpdatedFrom("");
    setUpdatedTo("");
    setUpdatedDateError(null);
    setCompletedFrom("");
    setCompletedTo("");
    setCompletedDateError(null);
    setScoreFilters(buildEmptyFilters());
    setFilterComment("");
    setSortKey(null);
    setSortDir(DEFAULT_SORT_DIR);
    setActiveFilterCol(null);
    setAnchorRect(null);
  }

  function closePopover() {
    setActiveFilterCol(null);
    setAnchorRect(null);
    setAnchorEl(null);
    setMultiSearchQuery("");
  }


  const toggleMulti = (value, selected, setter, order = []) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    let list = Array.from(next);
    if (order.length > 0) {
      const orderMap = new Map(order.map((v, i) => [v, i]));
      list.sort((a, b) => (orderMap.get(a) ?? 9999) - (orderMap.get(b) ?? 9999));
    }
    setter(list);
  };

  function toggleFilterCol(colId, evt) {
    const rect = evt?.currentTarget?.getBoundingClientRect?.();
    const el = evt?.currentTarget ?? null;
    setActiveFilterCol((prev) => {
      const next = prev === colId ? null : colId;
      if (next && rect) {
        setAnchorRect(rect);
        setAnchorEl(el);
      }
      if (!next) {
        setAnchorRect(null);
        setAnchorEl(null);
      }
      return next;
    });
  }

  // ── Rows computation ────────────────────────────────────
  const filteredData = useMemo(() => {
    const assignedList = Array.isArray(assignedJurors) && assignedJurors.length
      ? assignedJurors
      : (Array.isArray(jurors) ? jurors : []);

    const generated = generateMissingRows(assignedList, groups, data, projectMetaById);
    const combinedRows = [...data, ...generated];
    const enriched = enrichRows(combinedRows, projectMetaById, jurorEditMap, groups, semesterName);

    const filtered = applyFilters(enriched, {
      semesterName, filterGroupNo, filterJuror, filterDept, filterStatus, filterJurorStatus,
      filterProjectTitle, filterStudents,
      updatedFrom, updatedTo, updatedParsedFrom, updatedParsedTo,
      updatedParsedFromMs, updatedParsedToMs, isUpdatedInvalidRange,
      completedFrom, completedTo, completedParsedFrom, completedParsedTo,
      completedParsedFromMs, completedParsedToMs, isCompletedInvalidRange,
      scoreFilters, scoreKeys, filterComment,
    });

    return sortRows(filtered, sortKey, sortDir);
  }, [data, projectMetaById, semesterName, filterGroupNo, filterJuror, filterDept, filterStatus, filterJurorStatus, filterProjectTitle, filterStudents,
      updatedFrom, updatedTo, completedFrom, completedTo, updatedParsedFrom, updatedParsedTo, completedParsedFrom, completedParsedTo,
      updatedParsedFromMs, updatedParsedToMs, completedParsedFromMs, completedParsedToMs, isUpdatedInvalidRange, isCompletedInvalidRange,
      scoreFilters, filterComment, sortKey, sortDir, jurorEditMap, assignedJurors, jurors, groups]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterGroupNo, filterJuror, filterDept, filterStatus, filterJurorStatus,
      filterProjectTitle, filterStudents, updatedFrom, updatedTo, completedFrom, completedTo, scoreFilters, filterComment,
      sortKey, sortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const safePage   = Math.min(Math.max(1, currentPage), totalPages);
  const pageStart  = (safePage - 1) * pageSize;
  const pageRows   = filteredData.slice(pageStart, pageStart + pageSize);

  function setSort(key) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("desc");
      return;
    }
    if (sortDir === "desc") {
      setSortDir("asc");
      return;
    }
    setSortKey(null);
    setSortDir(DEFAULT_SORT_DIR);
  }

  // ── Columns definition ──────────────────────────────────
  const columns = useMemo(() => {
    const updatedDateFilterValue = { from: updatedFrom, to: updatedTo };
    const completedDateFilterValue = { from: completedFrom, to: completedTo };
    const base = [
      {
        id: "groupNo",
        label: "Group No",
        sortKey: "groupNo",
        filter: {
          type: "multi",
          value: filterGroupNo,
          setValue: setFilterGroupNo,
          options: groupNoOptions.map((l) => ({ value: l, label: l })),
          allLabel: "All Groups",
          allMode: "all",
          isActive: isGroupNoFilterActive,
          clear: () => setFilterGroupNo(null),
          searchable: true,
        },
        className: "cell-group-no",
      },
      {
        id: "projectTitle",
        label: "Project Title",
        sortKey: "projectTitle",
        filter: {
          type: "text",
          value: filterProjectTitle,
          setValue: setFilterProjectTitle,
          placeholder: "Search projects",
          isActive: isProjectTitleFilterActive,
          clear: () => setFilterProjectTitle(""),
        },
        className: "cell-project-title",
        minWidthClass: "col-project-title",
      },
      {
        id: "students",
        label: "Students",
        sortKey: "students",
        filter: {
          type: "text",
          value: filterStudents,
          setValue: setFilterStudents,
          placeholder: "Search students",
          isActive: isStudentsFilterActive,
          clear: () => setFilterStudents(""),
        },
        className: "cell-students",
        minWidthClass: "col-students",
      },
      {
        id: "juror",
        label: "Juror",
        sortKey: "juryName",
        filter: {
          type: "text",
          value: filterJuror,
          setValue: setFilterJuror,
          placeholder: "Search jurors",
          isActive: isJurorFilterActive,
          clear: () => setFilterJuror(""),
        },
        className: "cell-juror",
        minWidthClass: "col-juror",
      },
      {
        id: "dept",
        label: "Institution / Department",
        sortKey: "juryDept",
        filter: {
          type: "text",
          value: filterDept,
          setValue: setFilterDept,
          placeholder: "Search Institution / Department",
          isActive: isDeptFilterActive,
          clear: () => setFilterDept(""),
        },
        className: "cell-dept",
        minWidthClass: "col-dept",
      },
      {
        id: "status",
        label: "Score Status",
        sortKey: "effectiveStatus",
        filter: {
          type: "multi",
          value: filterStatus,
          setValue: setFilterStatus,
          options: STATUS_OPTIONS,
          allLabel: "All Statuses",
          allMode: "all",
          isActive: isStatusFilterActive,
          clear: () => setFilterStatus(null),
        },
        className: "cell-status",
      },
      {
        id: "jurorStatus",
        label: "Juror Status",
        sortKey: "jurorStatus",
        filter: {
          type: "multi",
          value: filterJurorStatus,
          setValue: setFilterJurorStatus,
          options: JUROR_STATUS_OPTIONS,
          allLabel: "All Statuses",
          allMode: "all",
          isActive: isJurorStatusFilterActive,
          clear: () => setFilterJurorStatus(null),
        },
        className: "cell-juror-status",
      },
    ];

    const scores = scoreCols.map(({ key: col, label }) => {
      const filterValue = scoreFilters[col] || { min: "", max: "" };
      const isActive = hasActiveValidNumberRange(filterValue) || activeFilterCol === col;
      return ({
        id: col,
        label,
        sortKey: col,
        filter: {
          type: "numberRange",
          value: filterValue,
          filterKey: col,
          isActive,
          clear: () => setScoreFilters((prev) => ({
            ...prev,
            [col]: { min: "", max: "" },
          })),
        },
        className: null,
        headerIcon: null,
        cellClassName: (row) => (row.effectiveStatus === "empty" ? "score-cell-unscored" : undefined),
        renderCell: (row) => (col === "total" ? <strong>{displayScore(row[col])}</strong> : displayScore(row[col])),
      });
    });

    const dates = [
      {
        id: "updatedAt",
        label: "Updated At",
        sortKey: "updatedMs",
        filter: {
          type: "dateRange",
          value: updatedDateFilterValue,
          parsedFrom: updatedParsedFrom,
          parsedTo: updatedParsedTo,
          setFrom: setUpdatedFrom,
          setTo: setUpdatedTo,
          error: updatedDateError,
          setError: setUpdatedDateError,
          isActive: isUpdatedDateFilterActive,
          clear: () => { setUpdatedFrom(""); setUpdatedTo(""); setUpdatedDateError(null); },
        },
        className: "cell-updated-at",
        renderCell: (row) => formatTs(row.updatedAt),
      },
      {
        id: "completedAt",
        label: "Completed At",
        sortKey: "finalSubmittedMs",
        filter: {
          type: "dateRange",
          value: completedDateFilterValue,
          parsedFrom: completedParsedFrom,
          parsedTo: completedParsedTo,
          setFrom: setCompletedFrom,
          setTo: setCompletedTo,
          error: completedDateError,
          setError: setCompletedDateError,
          isActive: isCompletedDateFilterActive,
          clear: () => { setCompletedFrom(""); setCompletedTo(""); setCompletedDateError(null); },
        },
        className: "cell-completed-at",
        renderCell: (row) => formatTs(row.finalSubmittedAt),
      },
      {
        id: "comment",
        label: "Comment",
        sortKey: null,
        filter: {
          type: "text",
          value: filterComment,
          setValue: setFilterComment,
          placeholder: "Search comments",
          isActive: isCommentFilterActive,
          clear: () => setFilterComment(""),
        },
        className: "cell-comment comment-cell",
        minWidthClass: "col-comment",
        renderCell: (row) => row.comments,
        cellTitle: (row) => row.comments || "",
      },
    ];

    return [...base, ...scores, ...dates];
  }, [
    filterGroupNo, filterJuror, filterDept, filterStatus, filterJurorStatus, filterProjectTitle,
    filterStudents, filterComment, updatedFrom, updatedTo, completedFrom, completedTo, updatedParsedFrom, updatedParsedTo,
    completedParsedFrom, completedParsedTo, updatedDateError, completedDateError, scoreFilters, activeFilterCol,
    groupNoOptions,
    isGroupNoFilterActive, isJurorFilterActive, isDeptFilterActive, isStatusFilterActive,
    isJurorStatusFilterActive, isProjectTitleFilterActive, isStudentsFilterActive, isUpdatedDateFilterActive,
    isCompletedDateFilterActive, isCommentFilterActive, sortKey, sortDir,
  ]);

  const columnsById = useMemo(() => new Map(columns.map((col) => [col.id, col])), [columns]);

  const sortLabel = useMemo(() => {
    if (!sortKey) return null;
    const col = columns.find((c) => c.sortKey === sortKey);
    const colLabel = col?.label || "Column";
    const isDateSort = sortKey === "updatedMs" || sortKey === "finalSubmittedMs";
    const isTextSort = [
      "semester",
      "projectTitle",
      "students",
      "juryName",
      "juryDept",
      "effectiveStatus",
      "jurorStatus",
    ].includes(sortKey);
    const dirLabel = isDateSort
      ? (sortDir === "asc" ? "oldest → newest" : "newest → oldest")
      : isTextSort
        ? (sortDir === "asc" ? "A → Z" : "Z → A")
        : (sortDir === "asc" ? "low → high" : "high → low");
    return `${colLabel} (${dirLabel})`;
  }, [columns, sortKey, sortDir]);

  function clearSort() {
    setSortKey(null);
    setSortDir(DEFAULT_SORT_DIR);
  }

  const activeFilterChips = useMemo(() => {
    const chips = [];
    columns.forEach((col) => {
      const f = col.filter;
      if (!f || !f.isActive) return;
      let value = "";
      if (f.type === "text" || f.type === "select") value = f.value || "";
      if (f.type === "multi") {
        const allMode = f.allMode || "empty";
        if (allMode === "all" && f.value === null) return;
        const selected = Array.isArray(f.value) ? f.value : [];
        if (selected.length === 0) {
          if (allMode === "all") {
            value = "None";
          } else {
            return;
          }
        } else {
          const labelMap = new Map((f.options || []).map((o) => {
            if (typeof o === "string") return [o, o];
            return [o.value, o.label];
          }));
          value = selected.length <= 2
            ? selected.map((v) => labelMap.get(v) ?? v).join(", ")
            : `${selected.length} selected`;
        }
      }
      if (f.type === "dateRange") {
        const fromRaw = f.value?.from ?? "";
        const toRaw = f.value?.to ?? "";
        if (!fromRaw && !toRaw) return;
        const fromParsed = f.parsedFrom;
        const toParsed = f.parsedTo;
        const fromMs = fromParsed ? fromParsed.ms : null;
        const toMs = toParsed ? toParsed.ms : null;
        const invalidDateRange = (fromRaw && fromMs === null)
          || (toRaw && toMs === null)
          || (toRaw && !fromRaw)
          || (fromMs !== null && toMs !== null && fromMs > toMs);
        if (invalidDateRange) return;
        const from = fromRaw
          ? (fromParsed?.isDateOnly ? formatDateOnlyFromMs(fromParsed.ms) : formatTs(fromRaw))
          : "—";
        const to = toRaw
          ? (toParsed?.isDateOnly ? formatDateOnlyFromMs(toParsed.ms) : formatTs(toRaw))
          : "—";
        value = `${from} → ${to}`;
      }
      if (f.type === "numberRange") {
        const minRaw = f.value?.min ?? "";
        const maxRaw = f.value?.max ?? "";
        if (minRaw === "" && maxRaw === "") return;
        if (isInvalidNumberRange(minRaw, maxRaw)) return;
        if (minRaw !== "" && maxRaw !== "") value = `${minRaw}–${maxRaw}`;
        else if (minRaw !== "") value = `≥ ${minRaw}`;
        else value = `≤ ${maxRaw}`;
      }
      chips.push({ id: col.id, label: col.label, value, onClear: f.clear });
    });
    return chips;
  }, [columns]);

  const openFilterCol = (colId, evt) => {
    const col = columnsById.get(colId);
    col?.filter?.onOpen?.();
    setMultiSearchQuery("");
    toggleFilterCol(colId, evt);
  };

  // ── Popover config helpers ─────────────────────────────────
  const makeTextFilter = (title, value, setValue, placeholder, isActive) => ({
    title,
    className: "col-filter-popover col-filter-popover-portal",
    contentKey: value,
    sheetFooter: useSheetFilters ? (
      <FilterPanelActions
        onClear={() => setValue("")}
        onApply={closePopover}
        clearDisabled={!value}
      />
    ) : null,
    content: (
      <>
        <div className="col-filter-search-wrap">
          <span className="col-filter-search-icon" aria-hidden="true"><SearchIcon /></span>
          <input
            autoFocus={!useSheetFilters}
            placeholder={placeholder}
            aria-label={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={joinClass("col-filter-search-input", isActive && "filter-input-active")}
          />
        </div>
        {!useSheetFilters && value && (
          <button className="col-filter-clear" onClick={() => { setValue(""); closePopover(); }}>
            Clear
          </button>
        )}
      </>
    ),
  });

  const makeNumberRangeFilter = (title, key, isActive) => {
    const current = scoreFilters[key] || { min: "", max: "" };
    const minValue = current.min ?? "";
    const maxValue = current.max ?? "";
    const minNum = toFiniteNumber(minValue);
    const maxNum = toFiniteNumber(maxValue);
    const hasError = minNum !== null && maxNum !== null && minNum > maxNum;
    const hasValue = !!(minValue || maxValue);
    const maxAllowed = Number.isFinite(scoreMaxByKey[key]) ? scoreMaxByKey[key] : scoreFilterMax;
    const clearRange = () => {
      setScoreFilters((prev) => ({ ...prev, [key]: { min: "", max: "" } }));
    };

    return ({
      title,
      className: "col-filter-popover col-filter-popover-portal col-filter-popover-number",
      contentKey: `${minValue}|${maxValue}`,
      sheetFooter: useSheetFilters ? (
        <FilterPanelActions
          onClear={clearRange}
          onApply={closePopover}
          clearDisabled={!hasValue}
          applyDisabled={hasError}
        />
      ) : null,
      content: (
        <>
          <div className="range-field">
            <label>Min</label>
            <input
              autoFocus={!useSheetFilters}
              type="number"
              inputMode="decimal"
              min={SCORE_FILTER_MIN}
              max={maxAllowed}
              value={minValue}
              onChange={(e) => updateScoreFilter(key, "min", e.target.value)}
              className={isActive ? "filter-input-active" : ""}
            />
          </div>
          <div className="range-field">
            <label>Max</label>
            <input
              type="number"
              inputMode="decimal"
              min={SCORE_FILTER_MIN}
              max={maxAllowed}
              value={maxValue}
              onChange={(e) => updateScoreFilter(key, "max", e.target.value)}
              className={isActive ? "filter-input-active" : ""}
            />
          </div>
          {hasError && (
            <div className="range-error">Min must be ≤ Max.</div>
          )}
          {!useSheetFilters && hasValue && (
            <button
              type="button"
              className="col-filter-clear"
              onClick={clearRange}
            >
              Clear
            </button>
          )}
        </>
      ),
    });
  };

  const makeSelectFilter = (title, value, setValue, options, allLabel, isActive) => ({
    title,
    className: "col-filter-popover col-filter-popover-portal",
    contentKey: value,
    sheetFooter: useSheetFilters ? (
      <FilterPanelActions
        onClear={() => setValue("")}
        onApply={closePopover}
        clearDisabled={!value}
      />
    ) : null,
    content: (
      <>
        <select
          autoFocus={!useSheetFilters}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (!useSheetFilters) closePopover();
          }}
          aria-label={allLabel}
          className={isActive ? "filter-input-active" : ""}
        >
          <option value="">{allLabel}</option>
          {options.map((label) => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
        {!useSheetFilters && value && (
          <button className="col-filter-clear" onClick={() => { setValue(""); closePopover(); }}>
            Clear
          </button>
        )}
      </>
    ),
  });

  const makeMultiFilter = (
    title, options, selected, setSelected, allLabel, allMode = "empty",
    searchable = false, searchQuery = "", setSearchQuery = () => {}
  ) => {
    const optionValues = options.map((o) => (typeof o === "string" ? o : o.value));
    const isAll = allMode === "all" ? selected == null : (Array.isArray(selected) && selected.length === 0);
    const hasSelection = allMode === "all"
      ? selected !== null
      : (Array.isArray(selected) && selected.length > 0);
    const clearSelection = () => setSelected(allMode === "all" ? null : []);
    const toggleOption = (val) => {
      if (isAll && allMode === "all") {
        setSelected(optionValues.filter((v) => v !== val));
        return;
      }
      if (!Array.isArray(selected) || selected.length === 0) {
        setSelected([val]);
        return;
      }
      toggleMulti(val, selected, setSelected, optionValues);
    };
    const filteredOptions = searchable && searchQuery.trim()
      ? options.filter((o) => {
          const lbl = typeof o === "string" ? o : o.label;
          return lbl.toLowerCase().includes(searchQuery.trim().toLowerCase());
        })
      : options;

    const searchNode = searchable ? (
      <div className="col-filter-search-wrap multi-filter-search-wrap">
        <span className="col-filter-search-icon" aria-hidden="true"><SearchIcon /></span>
        <input
          autoFocus={!useSheetFilters}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${allLabel.replace(/^All\s+/i, "").toLowerCase()}`}
          className="multi-filter-search col-filter-search-input"
          aria-label={`Search ${allLabel}`}
        />
      </div>
    ) : null;

    const optionsNode = (
      <>
        <label className="status-option">
          <input
            type="checkbox"
            checked={isAll}
            onChange={() => {
              if (allMode === "all") {
                setSelected(isAll ? [] : null);
              } else {
                setSelected([]);
              }
            }}
          />
          <span>{allLabel}</span>
        </label>
        {filteredOptions.map((opt) => {
          const val = typeof opt === "string" ? opt : opt.value;
          const lbl = typeof opt === "string" ? opt : opt.label;
          return (
            <label key={val} className="status-option">
              <input
                type="checkbox"
                checked={isAll || (Array.isArray(selected) && selected.includes(val))}
                onChange={() => toggleOption(val)}
              />
              <span>{lbl}</span>
            </label>
          );
        })}
        {searchable && searchQuery.trim() && filteredOptions.length === 0 && (
          <div className="multi-filter-empty">No results</div>
        )}
      </>
    );

    return {
      title,
      className: "col-filter-popover col-filter-popover-portal col-filter-popover-multi",
      contentKey: Array.isArray(selected) ? selected.join("|") : "ALL",
      sheetBodyClassName: useSheetFilters
        ? `filter-sheet-body--multi-options ${searchable ? "is-searchable" : "is-plain"}`
        : "",
      sheetSearch: useSheetFilters ? searchNode : null,
      sheetFooter: useSheetFilters ? (
        <FilterPanelActions
          onClear={clearSelection}
          onApply={closePopover}
          clearDisabled={!hasSelection}
        />
      ) : null,
      content: (
        useSheetFilters ? (
          <div className="filter-sheet-multi-options-content">
            {optionsNode}
          </div>
        ) : (
          <>
            {searchNode}
            {optionsNode}
            {hasSelection && (
              <button className="col-filter-clear" onClick={() => { clearSelection(); closePopover(); }}>
                Clear
              </button>
            )}
          </>
        )
      ),
    };
  };

  const popoverConfig = (() => {
    if (!activeFilterCol) return null;
    const col = columnsById.get(activeFilterCol);
    const filter = col?.filter;
    if (!filter) return null;

    if (filter.type === "select") {
      return makeSelectFilter(col.label, filter.value, filter.setValue, filter.options, filter.allLabel, filter.isActive);
    }
    if (filter.type === "multi") {
      return makeMultiFilter(
        col.label,
        filter.options, filter.value, filter.setValue,
        filter.allLabel, filter.allMode,
        filter.searchable ?? false,
        multiSearchQuery, setMultiSearchQuery
      );
    }
    if (filter.type === "text") {
      return makeTextFilter(col.label, filter.value, filter.setValue, filter.placeholder, filter.isActive);
    }
    if (filter.type === "numberRange") {
      return makeNumberRangeFilter(col.label, filter.filterKey, filter.isActive);
    }
    if (filter.type === "dateRange") {
      const from = filter.value?.from ?? "";
      const to = filter.value?.to ?? "";
      const parsedFrom = filter.parsedFrom;
      const parsedTo = filter.parsedTo;
      const parsedFromMs = parsedFrom ? parsedFrom.ms : null;
      const parsedToMs = parsedTo ? parsedTo.ms : null;
      const isInvalidRange = parsedFromMs !== null && parsedToMs !== null && parsedFromMs > parsedToMs;
      const isDateFilterActive = filter.isActive;
      const dateError = filter.error;
      const setDateError = filter.setError || (() => {});
      const setFrom = filter.setFrom || (() => {});
      const setTo = filter.setTo || (() => {});
      const validateDate = () => {
        if (to && !from) return "The 'From' date is required.";
        if ((from && parsedFromMs === null) || (to && parsedToMs === null)) return "Invalid date format.";
        if (isInvalidRange) return "The 'From' date cannot be later than the 'To' date.";
        return null;
      };
      const handleDateBlur = () => {
        setDateError(validateDate());
      };
      const handleApply = () => {
        const nextError = validateDate();
        setDateError(nextError);
        if (!nextError) closePopover();
      };
      const hasDateValue = !!(from || to);
      return {
        title: col.label,
        className: "col-filter-popover col-filter-popover-portal col-filter-popover-timestamp",
        contentKey: `${from}|${to}`,
        sheetFooter: useSheetFilters ? (
          <FilterPanelActions
            onClear={() => { setFrom(""); setTo(""); setDateError(null); }}
            onApply={handleApply}
            clearDisabled={!hasDateValue}
            applyDisabled={!!validateDate()}
          />
        ) : null,
        content: (
          <>
            <div className="timestamp-shortcuts" style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              {[
                {
                  label: "This Week",
                  onClick: () => {
                    const today = new Date();
                    const day = today.getDay();
                    const diffToMon = (day === 0 ? -6 : 1 - day);
                    const mon = new Date(today);
                    mon.setDate(today.getDate() + diffToMon);
                    const sun = new Date(mon);
                    sun.setDate(mon.getDate() + 6);
                    const pad = (n) => String(n).padStart(2, "0");
                    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                    setFrom(fmt(mon));
                    setTo(fmt(sun));
                    setDateError(null);
                    closePopover();
                  },
                },
                {
                  label: "This Month",
                  onClick: () => {
                    const today = new Date();
                    const pad = (n) => String(n).padStart(2, "0");
                    const y = today.getFullYear();
                    const m = today.getMonth() + 1;
                    const lastDay = new Date(y, m, 0).getDate();
                    setFrom(`${y}-${pad(m)}-01`);
                    setTo(`${y}-${pad(m)}-${pad(lastDay)}`);
                    setDateError(null);
                    closePopover();
                  },
                },
                {
                  label: "All Time",
                  onClick: () => { setFrom(""); setTo(""); setDateError(null); closePopover(); },
                },
              ].map(({ label, onClick }) => (
                <button
                  key={label}
                  type="button"
                  className="col-filter-clear"
                  style={{ fontSize: 11, padding: "2px 6px" }}
                  onClick={onClick}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="timestamp-field">
              <label>From</label>
              <input
                autoFocus={!useSheetFilters}
                type="datetime-local"
                step="60"
                placeholder="YYYY-MM-DDThh:mm"
                value={from}
                min={DATE_MIN_DATETIME}
                max={DATE_MAX_DATETIME}
                onChange={(e) => setFrom(e.target.value)}
                onBlur={handleDateBlur}
                className={`timestamp-date-input ${dateError ? "is-invalid " : ""}${isDateFilterActive ? "filter-input-active" : ""}`}
                aria-invalid={!!dateError}
              />
            </div>
            <div className="timestamp-field">
              <label>To</label>
              <input
                type="datetime-local"
                step="60"
                placeholder="YYYY-MM-DDThh:mm"
                value={to}
                min={DATE_MIN_DATETIME}
                max={DATE_MAX_DATETIME}
                onChange={(e) => setTo(e.target.value)}
                onBlur={handleDateBlur}
                className={`timestamp-date-input ${dateError ? "is-invalid " : ""}${isDateFilterActive ? "filter-input-active" : ""}`}
                aria-invalid={!!dateError}
              />
            </div>
            {dateError && (
              <div className="timestamp-error" role="alert">{dateError}</div>
            )}
            {!useSheetFilters && hasDateValue && (
              <button className="col-filter-clear" onClick={() => { setFrom(""); setTo(""); setDateError(null); }}>
                Clear
              </button>
            )}
          </>
        ),
      };
    }

    return null;
  })();

  return (
    <div className="score-details">
      <div className="admin-section-header">
        <div className="section-label">Details</div>
        <div className="admin-section-actions">
          <button
            className="xlsx-export-btn"
            onClick={() => {
              const onRequestExport = () => {
                exportXLSX(filteredData, {
                  semesterName: semesterName || "TEDU VERA",
                  criteria: activeCriteria,
                  summaryData,
                });
              };
              onRequestExport();
            }}
          >
            <DownloadIcon />
            <span className="export-label">Export XLSX ({filteredData.length} rows)</span>
          </button>
        </div>
      </div>

      <ScoreDetailsFilters
        showStatusLegend={showStatusLegend}
        setShowStatusLegend={setShowStatusLegend}
        loading={loading}
        hasAnyFilter={hasAnyFilter}
        sortLabel={sortLabel}
        activeFilterChips={activeFilterChips}
        onResetFilters={resetFilters}
        onClearSort={clearSort}
        popoverConfig={popoverConfig}
        anchorRect={anchorRect}
        anchorEl={anchorEl}
        activeFilterCol={activeFilterCol}
        onClosePopover={closePopover}
      />

      <ScoreDetailsTable
        rows={filteredData}
        pageRows={pageRows}
        columns={columns}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={setSort}
        openFilterCol={openFilterCol}
        activeFilterCol={activeFilterCol}
        cellScrollProps={cellScrollProps}
        topScrollRef={topScrollRef}
        tableScrollRef={tableScrollRef}
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
