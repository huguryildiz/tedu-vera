// src/admin/ScoreDetails.jsx
// ============================================================
// Sortable details table with Excel-style column header filters.
// ============================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { cmp, exportXLSX, formatTs, tsToMillis, rowKey } from "./utils";
import { readSection, writeSection } from "./persist";
import { FilterPopoverPortal, StatusBadge } from "./components";
import { getCellState } from "./scoreHelpers";
import { FilterIcon, DownloadIcon, ArrowUpDownIcon, ArrowDown01Icon, ArrowDown10Icon, ArrowDownIcon, ArrowUpIcon, XIcon } from "../shared/Icons";

// Show "" for null/undefined/empty/NaN.  0 is a valid score.
function displayScore(val) {
  if (val === "" || val === null || val === undefined) return "";
  if (typeof val === "string" && val.trim() === "") return "";
  const n = Number(val);
  if (!Number.isFinite(n)) return "";
  return n;
}

const SCORE_COLS = [
  { key: "technical", label: "Technical /30" },
  { key: "design",    label: "Written /30"   },
  { key: "delivery",  label: "Oral /30"      },
  { key: "teamwork",  label: "Teamwork /10"  },
  { key: "total",     label: "Total"         },
];
const STATUS_OPTIONS = [
  { value: "scored",      label: "Scored"       },
  { value: "partial",     label: "Partial"      },
  { value: "empty",       label: "Empty"        },
];
const JUROR_STATUS_OPTIONS = [
  { value: "completed",       label: "Completed"       },
  { value: "ready_to_submit", label: "Ready to Submit" },
  { value: "in_progress",     label: "In Progress"     },
  { value: "editing",         label: "Editing"         },
  { value: "not_started",     label: "Not Started"     },
];

const VALID_SORT_DIRS = ["asc", "desc"];

const DATE_MIN_YEAR = 2000;
const DATE_MAX_YEAR = 2100;
const DATE_MIN_DATETIME = "2000-01-01T00:00";
const DATE_MAX_DATETIME = "2100-12-31T23:59";

function isValidDateParts(yyyy, mm, dd) {
  if (yyyy < DATE_MIN_YEAR || yyyy > DATE_MAX_YEAR) return false;
  if (mm < 1 || mm > 12) return false;
  if (dd < 1) return false;
  const maxDays = new Date(yyyy, mm, 0).getDate();
  return dd <= maxDays;
}

function isValidTimeParts(hh, mi, ss) {
  if (hh < 0 || hh > 23) return false;
  if (mi < 0 || mi > 59) return false;
  if (ss < 0 || ss > 59) return false;
  return true;
}

function parseDateString(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [datePart, timePart] = value.split("T");
    const [yyyy, mm, dd] = datePart.split("-").map(Number);
    const [hh, mi, ss = "0"] = timePart.split(":").map(Number);
    if (!isValidDateParts(yyyy, mm, dd)) return null;
    if (!isValidTimeParts(hh, mi, ss)) return null;
    return { ms: new Date(yyyy, mm - 1, dd, hh, mi, ss).getTime(), isDateOnly: false };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yyyy, mm, dd] = value.split("-").map(Number);
    if (!isValidDateParts(yyyy, mm, dd)) return null;
    return { ms: new Date(yyyy, mm - 1, dd).getTime(), isDateOnly: true };
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("/").map(Number);
    if (!isValidDateParts(yyyy, mm, dd)) return null;
    return { ms: new Date(yyyy, mm - 1, dd).getTime(), isDateOnly: true };
  }
  return null;
}

function isMissing(val) {
  if (val === "" || val === null || val === undefined) return true;
  if (typeof val === "string" && val.trim() === "") return true;
  if (typeof val === "number") return !Number.isFinite(val);
  return false;
}

const NUMERIC_SORT_KEYS = new Set(SCORE_COLS.map(({ key }) => key));
const joinClass = (...parts) => parts.filter(Boolean).join(" ");

function enableCellScroll(evt) {
  const el = evt.currentTarget;
  if (!el || !el.classList) return;
  el.classList.add("is-scrollable");
  if (typeof el.focus === "function" && document?.activeElement !== el) {
    el.focus({ preventScroll: true });
  }
}
function disableCellScroll(evt) {
  const el = evt.currentTarget;
  if (!el || !el.classList) return;
  el.classList.remove("is-scrollable");
}
const CELL_SCROLL_PROPS = {
  className: "detail-cell-scroll",
  tabIndex: 0,
  onFocus: enableCellScroll,
  onBlur: disableCellScroll,
  onTouchStart: enableCellScroll,
};

// ── ColHeader ─────────────────────────────────────────────────
// Reusable <th> with optional sort button + optional filter icon.
// sk         — sort key (falsy → no sort)
// filterCol  — filter column id (falsy or noFilter → no filter)
// isActive   — drives "filtered" CSS class + filter-icon-active
// onFilterClick — custom filter button click (overrides default)
// sortIconNode  — extra node rendered inside the sort button (for score cols)
function ColHeader({ label, sk, filterCol, isActive, noFilter = false, noSort = false,
                     sortKey, sortDir, onSort, onFilter, onFilterClick, sortIconNode,
                     thClassName, filterId, isOpen }) {
  const ariaSortVal = sk && sortKey === sk
    ? (sortDir === "asc" ? "ascending" : "descending")
    : undefined;
  const defaultFilterClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onFilter(filterCol, e);
  };
  return (
    <th style={{ position: "relative", whiteSpace: "nowrap" }} className={thClassName}
      {...(ariaSortVal ? { "aria-sort": ariaSortVal } : {})}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {noSort ? (
          <span className={`details-col-label${isActive ? " filtered" : ""}`}>{label}</span>
        ) : (
          <button
            type="button"
            className={`col-sort-label details-col-label${isActive ? " filtered" : ""}`}
            onClick={() => onSort(sk)}
          >
            {label}{sortIconNode && <> {sortIconNode}</>}
          </button>
        )}
        {!noFilter && (
          <button
            type="button"
            className={`col-filter-hotspot${isActive ? " active filter-icon-active" : ""}`}
            onClick={onFilterClick ?? defaultFilterClick}
            title={`Filter by ${label.toLowerCase()}`}
            aria-label={`Filter by ${label}`}
            aria-expanded={!!isOpen}
            aria-controls={filterId}
          >
            <FilterIcon />
          </button>
        )}
      </div>
    </th>
  );
}

// jurors prop: { key, name, dept }[]
export default function ScoreDetails({
  data,
  jurors,
  assignedJurors = null,
  groups = [],
  semesterName = "",
  summaryData = [],
}) {
  // Read persisted state exactly once (mount only) — useRef prevents re-reads on every render.
  const _sRef = useRef(null);
  if (_sRef.current === null) _sRef.current = readSection("details");
  const _s = _sRef.current;

  const [filterSemester, setFilterSemester] = useState(() => typeof _s.filterSemester === "string" ? _s.filterSemester : "");
  const [filterGroupNo,  setFilterGroupNo]  = useState(() => {
    if (Array.isArray(_s.filterGroupNo)) return _s.filterGroupNo;
    if (typeof _s.filterGroupNo === "string" && _s.filterGroupNo) return [_s.filterGroupNo];
    return [];
  });
  const [filterJuror,    setFilterJuror]    = useState(() => {
    if (typeof _s.filterJuror === "string") return _s.filterJuror === "ALL" ? "" : _s.filterJuror;
    return "";
  });
  const [filterDept,     setFilterDept]     = useState(() => {
    if (typeof _s.filterDept === "string") return _s.filterDept === "ALL" ? "" : _s.filterDept;
    return "";
  });
  const [filterStatus,   setFilterStatus]   = useState(() => {
    if (Array.isArray(_s.filterStatus)) {
      return _s.filterStatus.map((v) => (v === "not_started" ? "empty" : v));
    }
    if (typeof _s.filterStatus === "string" && _s.filterStatus && _s.filterStatus !== "ALL") {
      return [_s.filterStatus === "not_started" ? "empty" : _s.filterStatus];
    }
    return [];
  });
  const [filterJurorStatus, setFilterJurorStatus] = useState(() => {
    if (Array.isArray(_s.filterJurorStatus)) return _s.filterJurorStatus;
    if (typeof _s.filterJurorStatus === "string" && _s.filterJurorStatus && _s.filterJurorStatus !== "ALL") {
      return [_s.filterJurorStatus];
    }
    return [];
  });
  const [filterProjectTitle, setFilterProjectTitle] = useState(() => typeof _s.filterProjectTitle === "string" ? _s.filterProjectTitle : "");
  const [filterStudents,     setFilterStudents]     = useState(() => typeof _s.filterStudents     === "string" ? _s.filterStudents     : "");
  const [dateFrom,       setDateFrom]       = useState(() => typeof _s.dateFrom     === "string" ? _s.dateFrom     : "");
  const [dateTo,         setDateTo]         = useState(() => typeof _s.dateTo       === "string" ? _s.dateTo       : "");
  const [dateFilterCol,  setDateFilterCol]  = useState(() => _s.dateFilterCol === "completed" ? "completed" : "updated");
  const [dateError,      setDateError]      = useState(null);
  const jurorEditMap = useMemo(() => {
    const map = new Map();
    (jurors || []).forEach((j) => {
      const editEnabled = !!(j.editEnabled ?? j.edit_enabled);
      if (j.jurorId) map.set(j.jurorId, editEnabled);
      if (j.key) map.set(j.key, editEnabled);
      const name = String(j.name ?? j.juryName ?? "").trim().toLowerCase();
      const dept = String(j.dept ?? j.juryDept ?? "").trim().toLowerCase();
      if (name || dept) map.set(`${name}__${dept}`, editEnabled);
    });
    return map;
  }, [jurors]);
  const [filterComment,  setFilterComment]  = useState(() => typeof _s.filterComment === "string" ? _s.filterComment : "");
  const [sortKey,        setSortKey]        = useState(() => {
    const rawKey = typeof _s.sortKey === "string" && _s.sortKey ? _s.sortKey : "updatedMs";
    const key = rawKey === "tsMs" ? "updatedMs" : rawKey;
    return key === "projectId" ? "projectTitle" : key;
  });
  const [sortDir,        setSortDir]        = useState(() => VALID_SORT_DIRS.includes(_s.sortDir) ? _s.sortDir : "desc");
  const [activeFilterCol, setActiveFilterCol] = useState(null);
  const [anchorRect, setAnchorRect] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isMobile, setIsMobile] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(max-width: 480px)").matches
  ));
  const topScrollRef = useRef(null);
  const tableScrollRef = useRef(null);

  const projectMetaById = useMemo(
    () => new Map((summaryData || []).map((p) => [p.id, { title: p?.name ?? "", students: p?.students ?? "" }])),
    [summaryData]
  );
  const semesterOptions = useMemo(() => {
    const map = new Map();
    const add = (val) => {
      const label = String(val ?? "").trim();
      if (!label) return;
      map.set(label.toLowerCase(), label);
    };
    data.forEach((row) => add(row?.semester));
    add(semesterName);
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "tr"))
      .map(([, label]) => label);
  }, [data, semesterName]);
  const groupNoOptions = useMemo(() => {
    const map = new Map();
    data.forEach((row) => {
      const label = String(row?.groupNo ?? "").trim();
      if (!label) return;
      map.set(label.toLowerCase(), label);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1], "tr", { numeric: true }))
      .map(([, label]) => label);
  }, [data]);
  useEffect(() => {
    if (!isMobile) return;
    if (activeFilterCol !== "updatedAt" && activeFilterCol !== "completedAt") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [activeFilterCol, isMobile]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 480px)");
    const update = () => setIsMobile(mq.matches);
    update();
    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);
    return () => {
      if (mq.addEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, []);


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

  useEffect(() => {
    writeSection("details", {
      filterSemester, filterGroupNo, filterJuror, filterDept, filterProjectTitle, filterStudents,
      filterStatus, filterJurorStatus, dateFrom, dateTo, dateFilterCol, filterComment,
      sortKey, sortDir,
    });
  }, [filterSemester, filterGroupNo, filterJuror, filterDept, filterStatus, filterJurorStatus, filterProjectTitle, filterStudents, dateFrom, dateTo, dateFilterCol, filterComment, sortKey, sortDir]);

  const parsedFrom = useMemo(() => (dateFrom ? parseDateString(dateFrom) : null), [dateFrom]);
  const parsedTo = useMemo(() => (dateTo ? parseDateString(dateTo) : null), [dateTo]);
  const parsedFromMs = parsedFrom ? parsedFrom.ms : null;
  const parsedToMs = parsedTo ? parsedTo.ms : null;
  const isInvalidRange = useMemo(() => {
    if (parsedFromMs === null || parsedToMs === null) return false;
    return parsedFromMs > parsedToMs;
  }, [parsedFromMs, parsedToMs]);

  useEffect(() => {
    if ((dateFrom && parsedFromMs === null) || (dateTo && parsedToMs === null)) {
      setDateError("Invalid date format.");
    } else if (isInvalidRange) {
      setDateError("The 'From' date cannot be later than the 'To' date.");
    } else {
      setDateError(null);
    }
  }, [dateFrom, dateTo, parsedFromMs, parsedToMs, isInvalidRange]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterSemester) count += 1;
    if (filterGroupNo.length > 0) count += 1;
    if (filterJuror) count += 1;
    if (filterDept) count += 1;
    if (filterStatus.length > 0) count += 1;
    if (filterJurorStatus.length > 0) count += 1;
    if (filterProjectTitle) count += 1;
    if (filterStudents) count += 1;
    if (dateFrom || dateTo) count += 1;
    if (filterComment) count += 1;
    return count;
  }, [filterSemester, filterGroupNo, filterJuror, filterDept, filterStatus, filterJurorStatus, filterProjectTitle, filterStudents, dateFrom, dateTo, filterComment]);
  const hasAnyFilter = activeFilterCount > 0;
  const isSemesterFilterActive = !!filterSemester || activeFilterCol === "semester";
  const isGroupNoFilterActive = filterGroupNo.length > 0 || activeFilterCol === "groupNo";
  const isJurorFilterActive = !!filterJuror || activeFilterCol === "juror";
  const isDeptFilterActive = !!filterDept || activeFilterCol === "dept";
  const isStatusFilterActive = filterStatus.length > 0 || activeFilterCol === "status";
  const isJurorStatusFilterActive = filterJurorStatus.length > 0 || activeFilterCol === "jurorStatus";
  const isProjectTitleFilterActive = !!filterProjectTitle || activeFilterCol === "projectTitle";
  const isStudentsFilterActive = !!filterStudents || activeFilterCol === "students";
  const isUpdatedDateFilterActive = (dateFilterCol === "updated" && (dateFrom || dateTo)) || activeFilterCol === "updatedAt";
  const isCompletedDateFilterActive = (dateFilterCol === "completed" && (dateFrom || dateTo)) || activeFilterCol === "completedAt";
  const isCommentFilterActive = !!filterComment || activeFilterCol === "comment";

  function resetFilters() {
    setFilterSemester("");
    setFilterGroupNo([]);
    setFilterJuror("");
    setFilterDept("");
    setFilterStatus([]);
    setFilterJurorStatus([]);
    setFilterProjectTitle("");
    setFilterStudents("");
    setDateFrom("");
    setDateTo("");
    setDateError(null);
    setDateFilterCol("updated");
    setFilterComment("");
    setActiveFilterCol(null);
    setAnchorRect(null);
  }

  function closePopover() {
    setActiveFilterCol(null);
    setAnchorRect(null);
    setAnchorEl(null);
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

  const rows = useMemo(() => {
    const fromMs = parsedFromMs ?? 0;
    const toMsBase = parsedToMs ?? Infinity;
    const toMs = Number.isFinite(toMsBase)
      ? toMsBase + (parsedTo?.isDateOnly ? (24 * 60 * 60 * 1000 - 1) : 0)
      : toMsBase;

    const assignedList = Array.isArray(assignedJurors) && assignedJurors.length
      ? assignedJurors
      : (Array.isArray(jurors) ? jurors : []);
    const groupList = Array.isArray(groups) ? groups : [];
    const existingKeys = new Set();
    data.forEach((row) => {
      if (!row?.projectId) return;
      const key = rowKey(row);
      if (!key) return;
      existingKeys.add(`${key}__${row.projectId}`);
    });

    const generated = [];
    if (assignedList.length > 0 && groupList.length > 0) {
      assignedList.forEach((j) => {
        const jurorId = j.jurorId ?? j.key;
        const juryName = String(j.name ?? j.juryName ?? "").trim();
        const juryDept = String(j.dept ?? j.juryDept ?? "").trim();
        if (!jurorId && !juryName) return;
        const jurorKey = rowKey({ jurorId, juryName, juryDept });
        groupList.forEach((g) => {
          const projectId = g.id ?? g.projectId;
          if (!projectId) return;
          const key = `${jurorKey}__${projectId}`;
          if (existingKeys.has(key)) return;
          const meta = projectMetaById.get(projectId);
          generated.push({
            jurorId,
            juryName,
            juryDept,
            projectId,
            groupNo: g.groupNo ?? g.group_no ?? null,
            projectName: String(meta?.title ?? g.title ?? "").trim(),
            students: meta?.students ?? g.students ?? "",
            technical: null,
            design: null,
            delivery: null,
            teamwork: null,
            total: null,
            comments: "",
            updatedAt: "",
            updatedMs: null,
            finalSubmittedAt: "",
            finalSubmittedMs: null,
            timestamp: "",
            tsMs: null,
            status: "empty",
            editingFlag: "",
          });
        });
      });
    }

    const combinedRows = [...data, ...generated];
    const jurorAgg = new Map();
    combinedRows.forEach((row) => {
      const key = rowKey(row);
      if (!key) return;
      const cellSt = getCellState(row);
      const prev = jurorAgg.get(key) || { scored: 0, started: 0, isFinal: false, jurorId: row.jurorId };
      if (cellSt === "scored") prev.scored += 1;
      if (cellSt !== "empty") prev.started += 1;
      if (row.finalSubmittedAt || row.finalSubmittedMs) prev.isFinal = true;
      jurorAgg.set(key, prev);
    });
    const totalGroups = groupList.length;
    const jurorStatusMap = new Map();
    jurorAgg.forEach((agg, key) => {
      const isEditing = !!(jurorEditMap.get(agg.jurorId) || jurorEditMap.get(key));
      if (isEditing) { jurorStatusMap.set(key, "editing"); return; }
      if (agg.isFinal) { jurorStatusMap.set(key, "completed"); return; }
      if (totalGroups > 0 && agg.scored >= totalGroups) { jurorStatusMap.set(key, "ready_to_submit"); return; }
      if (agg.started > 0) { jurorStatusMap.set(key, "in_progress"); return; }
      jurorStatusMap.set(key, "not_started");
    });

    let list = combinedRows.map((row) => {
      const meta = projectMetaById.get(row.projectId);
      const projectTitle = String(row.projectName ?? meta?.title ?? "").trim();
      const studentsRaw = row.students ?? meta?.students ?? "";
      const students = Array.isArray(studentsRaw)
        ? studentsRaw.map((s) => String(s).trim()).filter(Boolean).join(", ")
        : String(studentsRaw).trim();
      const jurorKey = rowKey(row);
      const isEditing = !!(jurorEditMap.get(row.jurorId) || jurorEditMap.get(jurorKey));
      return {
        ...row,
        semester: row.semester ?? semesterName ?? "",
        projectTitle,
        students,
        isEditing,
        effectiveStatus: getCellState(row), // "scored" | "partial" | "empty"
        jurorStatus: jurorStatusMap.get(jurorKey) || "not_started",
      };
    });

    if (filterSemester) {
      const q = filterSemester.toLowerCase();
      list = list.filter((r) => String(r.semester || "").trim().toLowerCase() === q);
    }
    if (filterGroupNo.length > 0) {
      const set = new Set(filterGroupNo.map((v) => String(v).trim().toLowerCase()));
      list = list.filter((r) => set.has(String(r.groupNo ?? "").trim().toLowerCase()));
    }
    if (filterJuror) {
      const q = filterJuror.toLowerCase();
      list = list.filter((r) => `${r.juryName ?? ""} ${r.juryDept ?? ""}`.toLowerCase().includes(q));
    }
    if (filterDept) {
      const q = filterDept.toLowerCase();
      list = list.filter((r) => String(r.juryDept ?? "").toLowerCase().includes(q));
    }
    if (filterStatus.length > 0) {
      const set = new Set(filterStatus);
      list = list.filter((r) => set.has(r.effectiveStatus));
    }
    if (filterJurorStatus.length > 0) {
      const set = new Set(filterJurorStatus);
      list = list.filter((r) => set.has(r.jurorStatus));
    }
    if (filterProjectTitle) {
      const q = filterProjectTitle.toLowerCase();
      list = list.filter((r) => (r.projectTitle || "").toLowerCase().includes(q));
    }
    if (filterStudents) {
      const q = filterStudents.toLowerCase();
      list = list.filter((r) => (r.students || "").toLowerCase().includes(q));
    }
    const canApplyDateFilter =
      (!dateFrom || parsedFromMs !== null) &&
      (!dateTo || parsedToMs !== null) &&
      !isInvalidRange;
    if ((dateFrom || dateTo) && canApplyDateFilter) {
      list = list.filter((r) => {
        const ms = dateFilterCol === "completed"
          ? (r.finalSubmittedMs || tsToMillis(r.finalSubmittedAt))
          : (r.updatedMs || tsToMillis(r.updatedAt));
        return ms >= fromMs && ms <= toMs;
      });
    }
    if (filterComment) {
      const q = filterComment.toLowerCase();
      list = list.filter((r) => (r.comments || "").toLowerCase().includes(q));
    }

    // Missing values always sink to bottom regardless of sort direction.
    list.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const aMiss = isMissing(av);
      const bMiss = isMissing(bv);
      if (aMiss && bMiss) return 0;
      if (aMiss) return 1;
      if (bMiss) return -1;
      return sortDir === "asc" ? cmp(av, bv) : cmp(bv, av);
    });
    return list;
  }, [data, projectMetaById, semesterName, filterSemester, filterGroupNo, filterJuror, filterDept, filterStatus, filterJurorStatus, filterProjectTitle, filterStudents,
      dateFrom, dateTo, dateFilterCol, filterComment, sortKey, sortDir, jurorEditMap, assignedJurors, jurors, groups]);

  function setSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }
  const sortIcon = (key) => {
    if (sortKey !== key) return <ArrowUpDownIcon />;
    if (NUMERIC_SORT_KEYS.has(key)) return sortDir === "asc" ? <ArrowDown01Icon /> : <ArrowDown10Icon />;
    return sortDir === "asc" ? <ArrowUpIcon /> : <ArrowDownIcon />;
  };

  const columns = useMemo(() => {
    const dateFilterValue = { from: dateFrom, to: dateTo };
    const base = [
      {
        id: "semester",
        label: "Semester",
        sortKey: "semester",
        filter: {
          type: "select",
          value: filterSemester,
          setValue: setFilterSemester,
          options: semesterOptions,
          allLabel: "All semesters",
          isActive: isSemesterFilterActive,
          clear: () => setFilterSemester(""),
        },
        className: "cell-semester",
      },
      {
        id: "groupNo",
        label: "Group No",
        sortKey: "groupNo",
        filter: {
          type: "multi",
          value: filterGroupNo,
          setValue: setFilterGroupNo,
          options: groupNoOptions.map((l) => ({ value: l, label: l })),
          allLabel: "All groups",
          isActive: isGroupNoFilterActive,
          clear: () => setFilterGroupNo([]),
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
          placeholder: "Search project title…",
          isActive: isProjectTitleFilterActive,
          clear: () => setFilterProjectTitle(""),
        },
        className: "cell-project-title",
        minWidthClass: "col-project-title",
      },
      {
        id: "students",
        label: "Group Students",
        sortKey: "students",
        filter: {
          type: "text",
          value: filterStudents,
          setValue: setFilterStudents,
          placeholder: "Search students…",
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
          placeholder: "Search juror…",
          isActive: isJurorFilterActive,
          clear: () => setFilterJuror(""),
        },
        className: "cell-juror",
        minWidthClass: "col-juror",
      },
      {
        id: "dept",
        label: "Department",
        sortKey: "juryDept",
        filter: {
          type: "text",
          value: filterDept,
          setValue: setFilterDept,
          placeholder: "Search department…",
          isActive: isDeptFilterActive,
          clear: () => setFilterDept(""),
        },
        className: "cell-dept",
        minWidthClass: "col-dept",
      },
      {
        id: "status",
        label: "Cell Status",
        sortKey: "effectiveStatus",
        filter: {
          type: "multi",
          value: filterStatus,
          setValue: setFilterStatus,
          options: STATUS_OPTIONS,
          allLabel: "All cell statuses",
          isActive: isStatusFilterActive,
          clear: () => setFilterStatus([]),
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
          allLabel: "All juror statuses",
          isActive: isJurorStatusFilterActive,
          clear: () => setFilterJurorStatus([]),
        },
        className: "cell-juror-status",
      },
    ];

    const scores = SCORE_COLS.map(({ key: col, label }) => ({
      id: col,
      label,
      sortKey: col,
      filter: null,
      className: null,
      headerIcon: <span className={`sort-icon${sortKey === col ? " icon-active-box" : ""}`}>{sortIcon(col)}</span>,
      cellClassName: (row) => (row.effectiveStatus === "empty" ? "score-cell-unscored" : undefined),
      renderCell: (row) => (col === "total" ? <strong>{displayScore(row[col])}</strong> : displayScore(row[col])),
    }));

    const dates = [
      {
        id: "updatedAt",
        label: "Updated At",
        sortKey: "updatedMs",
        filter: {
          type: "dateRange",
          value: dateFilterValue,
          isActive: isUpdatedDateFilterActive,
          onOpen: () => setDateFilterCol("updated"),
          clear: () => { setDateFrom(""); setDateTo(""); setDateError(null); },
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
          value: dateFilterValue,
          isActive: isCompletedDateFilterActive,
          onOpen: () => setDateFilterCol("completed"),
          clear: () => { setDateFrom(""); setDateTo(""); setDateError(null); },
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
          placeholder: "Search comments…",
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
    filterSemester, filterGroupNo, filterJuror, filterDept, filterStatus, filterJurorStatus, filterProjectTitle,
    filterStudents, filterComment, dateFrom, dateTo, dateFilterCol, semesterOptions, groupNoOptions,
    isSemesterFilterActive, isGroupNoFilterActive, isJurorFilterActive, isDeptFilterActive, isStatusFilterActive,
    isJurorStatusFilterActive, isProjectTitleFilterActive, isStudentsFilterActive, isUpdatedDateFilterActive,
    isCompletedDateFilterActive, isCommentFilterActive, sortKey, sortDir,
  ]);

  const columnsById = useMemo(() => new Map(columns.map((col) => [col.id, col])), [columns]);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    columns.forEach((col) => {
      const f = col.filter;
      if (!f || !f.isActive) return;
      let value = "";
      if (f.type === "text" || f.type === "select") value = f.value || "";
      if (f.type === "multi") {
        const selected = Array.isArray(f.value) ? f.value : [];
        if (selected.length === 0) return;
        const labelMap = new Map((f.options || []).map((o) => {
          if (typeof o === "string") return [o, o];
          return [o.value, o.label];
        }));
        value = selected.length <= 2
          ? selected.map((v) => labelMap.get(v) ?? v).join(", ")
          : `${selected.length} selected`;
      }
      if (f.type === "dateRange") {
        if (!dateFrom && !dateTo) return;
        const from = dateFrom || "—";
        const to = dateTo || "—";
        value = `${from} → ${to}`;
      }
      chips.push({ id: col.id, label: col.label, value, onClear: f.clear });
    });
    return chips;
  }, [columns, dateFrom, dateTo]);

  const openFilterCol = (colId, evt) => {
    const col = columnsById.get(colId);
    col?.filter?.onOpen?.();
    toggleFilterCol(colId, evt);
  };

  // ── Popover config helpers ─────────────────────────────────
  // Closed over closePopover / toggleMulti — called inline below.
  const makeTextFilter = (value, setValue, placeholder, isActive) => ({
    className: "col-filter-popover col-filter-popover-portal",
    contentKey: value,
    content: (
      <>
        <input
          autoFocus
          placeholder={placeholder}
          aria-label={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={isActive ? "filter-input-active" : ""}
        />
        {value && (
          <button className="col-filter-clear" onClick={() => { setValue(""); closePopover(); }}>
            Clear
          </button>
        )}
      </>
    ),
  });

  const makeSelectFilter = (value, setValue, options, allLabel, isActive) => ({
    className: "col-filter-popover col-filter-popover-portal",
    contentKey: value,
    content: (
      <>
        <select
          autoFocus
          value={value}
          onChange={(e) => { setValue(e.target.value); closePopover(); }}
          aria-label={allLabel}
          className={isActive ? "filter-input-active" : ""}
        >
          <option value="">{allLabel}</option>
          {options.map((label) => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
        {value && (
          <button className="col-filter-clear" onClick={() => { setValue(""); closePopover(); }}>
            Clear
          </button>
        )}
      </>
    ),
  });

  const makeMultiFilter = (options, selected, setSelected, allLabel) => ({
    className: "col-filter-popover col-filter-popover-portal col-filter-popover-multi",
    contentKey: selected.join("|"),
    content: (
      <>
        <label className="status-option">
          <input type="checkbox" checked={selected.length === 0} onChange={() => setSelected([])} />
          <span>{allLabel}</span>
        </label>
        {options.map((opt) => {
          const val = typeof opt === "string" ? opt : opt.value;
          const lbl = typeof opt === "string" ? opt : opt.label;
          return (
            <label key={val} className="status-option">
              <input
                type="checkbox"
                checked={selected.includes(val)}
                onChange={() => toggleMulti(val, selected, setSelected, options.map((o) => typeof o === "string" ? o : o.value))}
              />
              <span>{lbl}</span>
            </label>
          );
        })}
        {selected.length > 0 && (
          <button className="col-filter-clear" onClick={() => { setSelected([]); closePopover(); }}>
            Clear
          </button>
        )}
      </>
    ),
  });

  const popoverConfig = (() => {
    if (!activeFilterCol) return null;
    const col = columnsById.get(activeFilterCol);
    const filter = col?.filter;
    if (!filter) return null;

    if (filter.type === "select") {
      return makeSelectFilter(filter.value, filter.setValue, filter.options, filter.allLabel, filter.isActive);
    }
    if (filter.type === "multi") {
      return makeMultiFilter(filter.options, filter.value, filter.setValue, filter.allLabel);
    }
    if (filter.type === "text") {
      return makeTextFilter(filter.value, filter.setValue, filter.placeholder, filter.isActive);
    }
    if (filter.type === "dateRange") {
      const isDateFilterActive =
        dateFilterCol === "completed" ? isCompletedDateFilterActive : isUpdatedDateFilterActive;
      const handleDateBlur = () => {
        if ((dateFrom && parsedFromMs === null) || (dateTo && parsedToMs === null)) {
          setDateError("Invalid date format.");
          return;
        }
        setDateError(isInvalidRange ? "The 'From' date cannot be later than the 'To' date." : null);
      };
      return {
        className: `col-filter-popover col-filter-popover-portal col-filter-popover-timestamp${isMobile ? " is-centered" : ""}`,
        contentKey: `${dateFrom}|${dateTo}`,
        mode: isMobile ? "center" : "anchor",
        content: (
          <>
            <div className="timestamp-field">
              <label>From</label>
              <input
                autoFocus
                type="datetime-local"
                step="60"
                placeholder="YYYY-MM-DDThh:mm"
                value={dateFrom}
                min={DATE_MIN_DATETIME}
                max={DATE_MAX_DATETIME}
                onChange={(e) => setDateFrom(e.target.value)}
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
                value={dateTo}
                min={DATE_MIN_DATETIME}
                max={DATE_MAX_DATETIME}
                onChange={(e) => setDateTo(e.target.value)}
                onBlur={handleDateBlur}
                className={`timestamp-date-input ${dateError ? "is-invalid " : ""}${isDateFilterActive ? "filter-input-active" : ""}`}
                aria-invalid={!!dateError}
              />
            </div>
            {dateError && (
              <div className="timestamp-error" role="alert">{dateError}</div>
            )}
            {isMobile ? (
              <div className="timestamp-actions">
                {(dateFrom || dateTo) && (
                  <button className="col-filter-clear" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                    Clear
                  </button>
                )}
                <button className="timestamp-done-btn" onClick={closePopover} disabled={!!dateError}>
                  Done
                </button>
              </div>
            ) : (
              (dateFrom || dateTo) && (
                <button className="col-filter-clear" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                  Clear
                </button>
              )
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
      </div>

      {/* Compact toolbar: row count + clear + export */}
      <div className="detail-table-toolbar">
        <span className="filter-count">
          Showing <strong>{rows.length}</strong> row{rows.length !== 1 ? "s" : ""}
        </span>
        {hasAnyFilter && (
          <>
            <span className="filters-active-pill">Filters: {activeFilterCount}</span>
            {activeFilterChips.length > 0 && (
              <div className="filters-chip-row">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className="filter-chip"
                    onClick={chip.onClear}
                    title={`Clear ${chip.label}`}
                    aria-label={`Clear ${chip.label}`}
                  >
                    <span className="chip-label">{chip.label}</span>
                    {chip.value && <span className="chip-value">{chip.value}</span>}
                    <XIcon />
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              className="filters-clear-btn"
              onClick={resetFilters}
              aria-label="Clear filters"
              title="Clear filters"
            >
              <XIcon />
            </button>
          </>
        )}
        <button className="xlsx-export-btn" onClick={() => { void exportXLSX(rows, { semesterName, summaryData }); }}>
          <DownloadIcon />
          <span className="export-label">Excel</span>
        </button>
      </div>

      <FilterPopoverPortal
        open={!!popoverConfig}
        anchorRect={anchorRect}
        anchorEl={anchorEl}
        onClose={closePopover}
        className={popoverConfig?.className}
        contentKey={popoverConfig?.contentKey}
        mode={popoverConfig?.mode}
        trapFocus
        id={activeFilterCol ? `filter-popover-${activeFilterCol}` : undefined}
      >
        {popoverConfig?.content}
      </FilterPopoverPortal>

      {/* Details table */}
      <div className="detail-table-scroll-top" ref={topScrollRef} aria-hidden="true">
        <div className="detail-table-scroll-top-inner" />
      </div>
      <div className="detail-table-wrap" ref={tableScrollRef}>
        <table className="detail-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <ColHeader
                  key={col.id}
                  label={col.label}
                  sk={col.sortKey}
                  filterCol={col.filter ? col.id : null}
                  isActive={!!col.filter?.isActive}
                  noFilter={!col.filter}
                  noSort={!col.sortKey}
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={setSort}
                  onFilter={openFilterCol}
                  onFilterClick={col.filter ? (e) => { e.preventDefault(); e.stopPropagation(); openFilterCol(col.id, e); } : undefined}
                  sortIconNode={col.headerIcon}
                  thClassName={col.minWidthClass}
                  filterId={col.filter ? `filter-popover-${col.id}` : undefined}
                  isOpen={activeFilterCol === col.id}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: "center", padding: 32, color: "#64748b" }}>
                  No matching rows.
                </td>
              </tr>
            )}
            {rows.map((row, i) => {
              return (
                <tr
                  key={`${rowKey(row)}-${row.projectId}`}
                  className={i % 2 === 1 ? "row-even" : ""}
                >
                  {columns.map((col) => {
                    const cellClassName = typeof col.cellClassName === "function" ? col.cellClassName(row) : col.cellClassName;
                    const content = col.renderCell
                      ? col.renderCell(row)
                      : (() => {
                          if (col.id === "semester") return row.semester ? row.semester : "—";
                          if (col.id === "groupNo") return row.groupNo ?? "—";
                          if (col.id === "projectTitle") return row.projectTitle || "—";
                          if (col.id === "students") return row.students || "—";
                          if (col.id === "juror") return row.juryName;
                          if (col.id === "dept") return row.juryDept;
                          if (col.id === "status") {
                            return <StatusBadge status={row.effectiveStatus} editingFlag={null} />;
                          }
                          if (col.id === "jurorStatus") {
                            return <StatusBadge status={row.jurorStatus} editingFlag={row.jurorStatus === "editing" ? "editing" : null} />;
                          }
                          return row[col.id] ?? "";
                        })();
                    const cellTitle = typeof col.cellTitle === "function" ? col.cellTitle(row) : undefined;
                    const isTextCell = ["semester", "groupNo", "projectTitle", "students", "juror", "dept"].includes(col.id);
                    return (
                      <td
                        key={`${col.id}-${row.projectId}`}
                        className={joinClass(col.className, col.minWidthClass, cellClassName)}
                        style={isTextCell ? { whiteSpace: "nowrap" } : undefined}
                        title={cellTitle}
                      >
                        {isTextCell ? (
                          <span {...CELL_SCROLL_PROPS}>
                            {content}
                          </span>
                        ) : (
                          content
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
