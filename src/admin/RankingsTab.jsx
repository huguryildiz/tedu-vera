// src/admin/RankingsTab.jsx
// ── Ranking view with medal badges ──

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import AutoSizer from "react-virtualized-auto-sizer";
import { VariableSizeList as List } from "react-window";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { APP_CONFIG, CRITERIA, TOTAL_MAX } from "../config";
import { InfoIcon, ChevronDownIcon, DownloadIcon, ArrowUpIcon, ArrowDownIcon, SearchIcon, FilterIcon } from "../shared/Icons";
import { GroupLabel, ProjectTitle, StudentNames } from "../components/EntityMeta";
import { readSection, writeSection } from "./persist";
import { exportRankingsXLSX } from "./xlsx/exportXLSX";
import { useAuth } from "../shared/auth";
import medalFirst from "../assets/1st-place-medal.svg";
import medalSecond from "../assets/2nd-place-medal.svg";
import medalThird from "../assets/3rd-place-medal.svg";

const CRITERIA_LIST = CRITERIA.map((c) => ({ id: c.id, label: c.label, shortLabel: c.shortLabel, max: c.max, color: c.color }));
const MEDALS = [medalFirst, medalSecond, medalThird];
const SORT_OPTIONS = [
  { value: "totalAvg", label: "Total Avg" },
  { value: "groupNo", label: "Group No" },
  { value: "projectTitle", label: "Title" },
  ...CRITERIA_LIST.map((c) => ({ value: c.id, label: `${c.shortLabel || c.label} Avg` })),
];
const VIRTUAL_THRESHOLD = 40;
const ESTIMATED_ROW_HEIGHT = 220;

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, [query]);
  return matches;
}

function getRankKey(p, fallback) {
  return p?.id ?? p?.groupNo ?? p?.name ?? fallback;
}

function formatScore(val, digits = 2) {
  if (!Number.isFinite(val)) return "—";
  return Number(val).toFixed(digits);
}

function buildSearchText(p) {
  const group = `group ${p?.groupNo ?? ""}`;
  const title = p?.name ?? "";
  const students = p?.students ?? "";
  return `${group} ${p?.groupNo ?? ""} ${title} ${students}`.toLowerCase();
}

// ── Sub-components (module level — stable identity across renders) ─────────

function MedalBadge({ rank }) {
  if (rank >= 1 && rank <= 3) {
    return (
      <div className="flex items-center justify-center">
        <img
          src={MEDALS[rank - 1]}
          alt={`${rank}${rank === 1 ? "st" : rank === 2 ? "nd" : "rd"} place`}
          className="h-6 w-6"
        />
      </div>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
      {rank ?? "—"}
    </span>
  );
}

function CriterionBar({ value, max, color }) {
  const pct = max > 0 && Number.isFinite(value) ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, pct)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="w-8 text-right text-xs text-muted-foreground tabular-nums">
        {formatScore(value)}
      </span>
    </div>
  );
}

function RankCard({ p, index, rankMap, expandedGroups, onToggleGroup, criteriaList: critList = CRITERIA_LIST }) {
  const rankKey = getRankKey(p, index);
  const dr = rankMap.get(rankKey) ?? null;
  const groupLabel = `Group ${p.groupNo}`;
  const projectTitle = (p.name || "").trim();
  const showTitle = !!projectTitle && projectTitle !== groupLabel;
  const studentList = p.students
    ? p.students.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  const hasDetails = showTitle || (APP_CONFIG.showStudents && studentList.length > 0);
  const groupKey = `summary-${p.id ?? index}`;
  const isExpanded = expandedGroups.has(groupKey);
  const hasScores = Number.isFinite(p.totalAvg);
  const isTop3 = hasScores && dr !== null && dr <= 3;
  const panelId = `summary-group-panel-${groupKey}`;

  return (
    <div
      key={p.id ?? index}
      className={cn(
        "rounded-lg border border-border bg-card p-4 transition-colors",
        isTop3 && "bg-amber-500/5"
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex flex-1 items-start gap-3">
          <div className="shrink-0">
            <MedalBadge rank={dr} />
          </div>
          <div className="min-w-0 flex-1">
            <button
              className={cn(
                "w-full text-left text-sm font-medium transition-colors",
                hasDetails ? "cursor-pointer hover:text-primary" : "cursor-default"
              )}
              tabIndex={hasDetails ? 0 : -1}
              aria-expanded={hasDetails ? isExpanded : undefined}
              aria-controls={hasDetails ? panelId : undefined}
              type="button"
              onClick={() => { if (hasDetails) onToggleGroup(groupKey); }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && hasDetails) {
                  e.preventDefault();
                  onToggleGroup(groupKey);
                }
              }}
            >
              <span className="flex items-center gap-1">
                <GroupLabel text={groupLabel} shortText={`Group ${p.groupNo}`} />
                {hasDetails && (
                  <ChevronDownIcon className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                )}
              </span>
            </button>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs text-muted-foreground">Avg /{TOTAL_MAX}</div>
          <div className="text-lg font-semibold tabular-nums">
            {hasScores ? formatScore(p.totalAvg) : "—"}
          </div>
        </div>
      </div>

      {!hasScores && (
        <div className="mb-4">
          <Badge variant="secondary">No finalized evaluations</Badge>
        </div>
      )}

      {hasDetails && (
        <div
          id={panelId}
          className={cn(
            "space-y-3 overflow-hidden transition-all",
            isExpanded ? "max-h-96" : "max-h-0"
          )}
        >
          {showTitle && (
            <div className="border-t border-border pt-3">
              <ProjectTitle text={projectTitle} />
            </div>
          )}
          {APP_CONFIG.showStudents && studentList.length > 0 && (
            <div>
              <StudentNames names={studentList} />
            </div>
          )}
        </div>
      )}

      {hasScores && (
        <div className="space-y-2.5">
          {critList.map((c) => {
            const val = p.avg?.[c.id];
            const hasVal = Number.isFinite(val) && c.max > 0;
            return (
              <div key={c.id} className="flex items-center gap-2">
                <span className="w-12 text-xs font-medium text-muted-foreground">
                  {c.shortLabel}
                </span>
                <div className="flex-1">
                  <CriterionBar value={val} max={c.max} color={c.color} />
                </div>
                {hasVal && (
                  <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
                    {formatScore(val)}/{c.max}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Row({ index, style, data }) {
  const { items, onMeasure, rankMap, expandedGroups, onToggleGroup, criteriaList: rowCriteriaList } = data;
  const rowRef = useRef(null);

  useLayoutEffect(() => {
    if (!rowRef.current) return;
    onMeasure(index, rowRef.current.getBoundingClientRect().height);
  }, [index, onMeasure]);

  useLayoutEffect(() => {
    if (!rowRef.current || typeof ResizeObserver === "undefined") return;
    const el = rowRef.current;
    const ro = new ResizeObserver(() => {
      onMeasure(index, el.getBoundingClientRect().height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [index, onMeasure]);

  return (
    <div style={{ ...style, width: "100%", paddingRight: "1rem", paddingLeft: "1rem", paddingBottom: "0.75rem" }}>
      <div ref={rowRef}>
        <RankCard
          p={items[index]}
          index={index}
          rankMap={rankMap}
          expandedGroups={expandedGroups}
          onToggleGroup={onToggleGroup}
          criteriaList={rowCriteriaList}
        />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────

export default function RankingsTab({ ranked, semesterName = "", criteriaTemplate }) {
  const { activeTenant } = useAuth();
  const tenantCode = activeTenant?.code || "";
  const criteriaList = useMemo(
    () => (criteriaTemplate || CRITERIA_LIST).map((c) => ({
      id: c.id ?? c.key,
      label: c.label,
      shortLabel: c.shortLabel,
      max: c.max,
      color: c.color,
    })),
    [criteriaTemplate] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const sortOptions = useMemo(() => [
    { value: "totalAvg", label: "Total Avg" },
    { value: "groupNo", label: "Group No" },
    { value: "projectTitle", label: "Title" },
    ...criteriaList.map((c) => ({ value: c.id, label: `${c.shortLabel || c.label} Avg` })),
  ], [criteriaList]);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [search, setSearch] = useState(() => {
    const s = readSection("rankings");
    return typeof s.search === "string" ? s.search : "";
  });
  const [sortKey, setSortKey] = useState(() => {
    const s = readSection("rankings");
    const valid = SORT_OPTIONS.some((opt) => opt.value === s.sortKey);
    return valid ? s.sortKey : "totalAvg";
  });
  const [sortDir, setSortDir] = useState(() => {
    const s = readSection("rankings");
    return s.sortDir === "asc" || s.sortDir === "desc" ? s.sortDir : "desc";
  });
  const [filtersOpen, setFiltersOpen] = useState(() => {
    const s = readSection("rankings");
    return typeof s.filtersOpen === "boolean" ? s.filtersOpen : true;
  });

  const isSmallMobile = useMediaQuery("(max-width: 500px)");

  const listRef = useRef(null);
  const sizeMapRef = useRef({});
  const virtualWrapRef = useRef(null);
  const [virtualHeight, setVirtualHeight] = useState(null);

  // Reset accordion state when the semester changes (ranked data replaced).
  useEffect(() => {
    setExpandedGroups(new Set());
  }, [semesterName]);

  useEffect(() => {
    writeSection("rankings", { search, sortKey, sortDir, filtersOpen });
  }, [search, sortKey, sortDir, filtersOpen]);

  const finalized = useMemo(
    () => (ranked || []).filter((p) => Number.isFinite(p?.totalAvg)),
    [ranked]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return finalized.filter((p) => {
      if (!q) return true;
      return buildSearchText(p).includes(q);
    });
  }, [finalized, search]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    const dir = sortDir === "desc" ? -1 : 1;
    items.sort((a, b) => {
      let base = 0;
      if (sortKey === "projectTitle") {
        const aStr = String(a?.name ?? "").toLowerCase();
        const bStr = String(b?.name ?? "").toLowerCase();
        base = aStr.localeCompare(bStr, "tr", { numeric: true });
      } else if (sortKey === "groupNo") {
        const aVal = Number.isFinite(a?.groupNo) ? a.groupNo : null;
        const bVal = Number.isFinite(b?.groupNo) ? b.groupNo : null;
        if (aVal == null && bVal == null) base = 0;
        else if (aVal == null) base = 1;
        else if (bVal == null) base = -1;
        else base = aVal - bVal;
      } else {
        const aVal = sortKey === "totalAvg" ? a?.totalAvg : a?.avg?.[sortKey];
        const bVal = sortKey === "totalAvg" ? b?.totalAvg : b?.avg?.[sortKey];
        const aNum = Number.isFinite(aVal) ? aVal : null;
        const bNum = Number.isFinite(bVal) ? bVal : null;
        if (aNum == null && bNum == null) base = 0;
        else if (aNum == null) base = 1;
        else if (bNum == null) base = -1;
        else base = aNum - bNum;
      }

      if (base === 0) {
        const aGrp = Number.isFinite(a?.groupNo) ? a.groupNo : 0;
        const bGrp = Number.isFinite(b?.groupNo) ? b.groupNo : 0;
        base = aGrp - bGrp;
      }

      return base * dir;
    });
    return items;
  }, [filtered, sortKey, sortDir]);

  const useVirtual = sorted.length >= VIRTUAL_THRESHOLD;

  const rankMap = useMemo(() => {
    const scored = [...finalized].sort((a, b) => {
      const aVal = Number.isFinite(a?.totalAvg) ? a.totalAvg : -Infinity;
      const bVal = Number.isFinite(b?.totalAvg) ? b.totalAvg : -Infinity;
      return bVal - aVal;
    });
    const map = new Map();
    let scoredIndex = 0;
    let lastScore = null;
    let lastRank = 0;
    scored.forEach((p, i) => {
      const key = getRankKey(p, i);
      if (!Number.isFinite(p?.totalAvg)) {
        map.set(key, null);
        return;
      }
      scoredIndex += 1;
      if (lastScore === null || p.totalAvg !== lastScore) {
        lastRank = scoredIndex;
        lastScore = p.totalAvg;
      }
      map.set(key, lastRank);
    });
    return map;
  }, [finalized]);

  const setSize = useCallback((index, size) => {
    if (sizeMapRef.current[index] !== size) {
      sizeMapRef.current[index] = size;
      if (listRef.current) listRef.current.resetAfterIndex(index);
    }
  }, []);

  const getSize = useCallback(
    (index) => sizeMapRef.current[index] || ESTIMATED_ROW_HEIGHT,
    []
  );

  useEffect(() => {
    sizeMapRef.current = {};
    if (listRef.current) listRef.current.resetAfterIndex(0, true);
  }, [sorted.length, sortKey, sortDir, search]);

  const updateVirtualHeight = useCallback(() => {
    if (!virtualWrapRef.current) return;
    const rect = virtualWrapRef.current.getBoundingClientRect();
    const vh = typeof window !== "undefined" ? window.innerHeight : 0;
    if (!vh) return;
    const next = Math.max(240, Math.floor(vh - rect.top - 24));
    setVirtualHeight(next);
  }, []);

  useEffect(() => {
    if (!useVirtual) return;
    const raf = () => requestAnimationFrame(updateVirtualHeight);
    raf();
    window.addEventListener("resize", raf);
    window.addEventListener("orientationchange", raf);
    return () => {
      window.removeEventListener("resize", raf);
      window.removeEventListener("orientationchange", raf);
    };
  }, [useVirtual, updateVirtualHeight, filtersOpen]);

  function toggleGroup(groupKey) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      const isOpening = !next.has(groupKey);
      if (isOpening && isSmallMobile) {
        return new Set([groupKey]);
      }
      if (isOpening) next.add(groupKey);
      else next.delete(groupKey);
      return next;
    });
  }

  async function handleExport() {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await exportRankingsXLSX(sorted, criteriaList, { semesterName, tenantCode });
    } finally {
      setIsExporting(false);
    }
  }

  // Guard: ranked may be undefined during initial render
  if (!finalized.length) {
    return <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-sm text-muted-foreground">No finalized evaluations yet.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header with info tooltip and export */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="relative group">
            <InfoIcon className="h-5 w-5 text-muted-foreground cursor-help" />
            <div className="absolute bottom-full left-0 mb-2 hidden w-max rounded-lg bg-popover p-2 text-xs text-popover-foreground border border-border shadow-md group-hover:block z-10">
              Ranking is based on finalized submissions only (Total Avg). Ties share the same rank (e.g., 1, 1, 3).
            </div>
          </div>
          <span className="text-xs text-muted-foreground">Ranking is based on finalized submissions only (Total Avg). Ties share the same rank (e.g., 1, 1, 3).</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
        >
          <DownloadIcon className="mr-1.5 h-4 w-4" />
          {isExporting ? "Exporting…" : "Excel"}
        </Button>
      </div>

      {/* Filters toolbar */}
      <div className="rounded-lg border border-border bg-card">
        <button
          type="button"
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-label={filtersOpen ? "Collapse filters" : "Expand filters"}
        >
          <span className="flex items-center gap-2 font-medium text-sm">
            <FilterIcon className="h-4 w-4" />
            Filters
          </span>
          <ChevronDownIcon className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")} />
        </button>

        {filtersOpen && (
          <div className="border-t border-border px-4 py-3 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search groups, projects, or students"
                  aria-label="Search groups, projects, or students"
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Sort</label>
              <div className="flex gap-2">
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value)}
                  aria-label="Sort by"
                  className={cn(
                    "flex-1 rounded-md border border-input bg-background px-3 py-2",
                    "text-sm focus:outline-none focus:ring-2 focus:ring-ring/50"
                  )}
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                  aria-label={`Sort ${sortDir === "desc" ? "descending" : "ascending"}`}
                >
                  {sortDir === "desc" ? <ArrowDownIcon className="h-4 w-4" /> : <ArrowUpIcon className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="border-t border-border pt-3 text-xs text-muted-foreground">
              Showing {sorted.length} of {finalized.length}
            </div>
          </div>
        )}
      </div>

      {/* Results list */}
      <div>
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-border bg-muted/50 p-8 text-center text-sm text-muted-foreground">
            No results for the current filters.
          </div>
        ) : useVirtual ? (
          <div
            className="rounded-lg border border-border overflow-hidden"
            ref={virtualWrapRef}
            style={virtualHeight ? { height: virtualHeight } : undefined}
          >
            <AutoSizer>
              {({ height, width }) => (
                <List
                  ref={listRef}
                  height={height}
                  width={width}
                  itemCount={sorted.length}
                  itemSize={getSize}
                  itemData={{ items: sorted, onMeasure: setSize, rankMap, expandedGroups, onToggleGroup: toggleGroup, criteriaList }}
                >
                  {Row}
                </List>
              )}
            </AutoSizer>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((p, i) => <RankCard key={p.id ?? i} p={p} index={i} rankMap={rankMap} expandedGroups={expandedGroups} onToggleGroup={toggleGroup} criteriaList={criteriaList} />)}
          </div>
        )}
      </div>
    </div>
  );
}
