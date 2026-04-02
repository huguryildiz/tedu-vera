// src/admin/scores/RankingsTable.jsx
// Phase C — Rankings page rewritten from vera-premium-prototype.html

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { CRITERIA, TOTAL_MAX } from "../../config";
import { readSection, writeSection } from "../persist";
import { exportRankingsXLSX } from "../xlsx/exportXLSX";
import { useAuth } from "../../shared/auth";

const CRITERIA_LIST = CRITERIA.map((c) => ({
  id: c.id,
  label: c.label,
  shortLabel: c.shortLabel,
  max: c.max,
  color: c.color,
}));

const PAGE_SIZE = 20;

const MEDALS = [
  { emoji: "🥇", label: "1st place" },
  { emoji: "🥈", label: "2nd place" },
  { emoji: "🥉", label: "3rd place" },
];

function formatScore(val, digits = 1) {
  if (!Number.isFinite(val)) return "\u2014";
  return Number(val).toFixed(digits);
}

/**
 * @param {object[]} props.ranked             Sorted project summaries
 * @param {string}   props.periodName         Current period name
 * @param {object[]} [props.criteriaConfig]   Active criteria (falls back to CRITERIA)
 */
export default function RankingsTable({ ranked = [], periodName, criteriaConfig }) {
  const { activeOrganization } = useAuth();

  const criteriaList = useMemo(
    () =>
      (criteriaConfig || CRITERIA_LIST).map((c) => ({
        id: c.id ?? c.key,
        label: c.label,
        shortLabel: c.shortLabel,
        max: c.max,
        color: c.color,
      })),
    [criteriaConfig]
  );

  const totalMax = useMemo(
    () => criteriaList.reduce((sum, c) => sum + (c.max || 0), 0) || TOTAL_MAX,
    [criteriaList]
  );

  // Persisted sort
  const [sortKey, setSortKey] = useState(() => {
    const saved = readSection("rankings");
    return saved?.sortKey || "totalAvg";
  });
  const [sortDir, setSortDir] = useState(() => {
    const saved = readSection("rankings");
    return saved?.sortDir || "desc";
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [minAvg, setMinAvg] = useState("");
  const [maxAvg, setMaxAvg] = useState("");
  const [selectedExport, setSelectedExport] = useState("xlsx");

  const handleSort = useCallback(
    (key) => {
      let newDir;
      if (sortKey === key) {
        newDir = sortDir === "asc" ? "desc" : "asc";
        setSortDir(newDir);
        writeSection("rankings", { sortKey: key, sortDir: newDir });
      } else {
        newDir = key === "totalAvg" || criteriaList.some((c) => c.id === key) ? "desc" : "asc";
        setSortKey(key);
        setSortDir(newDir);
        writeSection("rankings", { sortKey: key, sortDir: newDir });
      }
    },
    [sortKey, sortDir, criteriaList]
  );

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const minAvgNum = minAvg !== "" ? parseFloat(minAvg) : null;
  const maxAvgNum = maxAvg !== "" ? parseFloat(maxAvg) : null;

  const filtered = useMemo(() => {
    let list = ranked.filter((p) => Number.isFinite(p.totalAvg));
    if (normalizedSearch) {
      list = list.filter((p) => {
        const haystack = `group ${p.groupNo} ${p.groupNo} ${p.name || ""} ${p.students || ""}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      });
    }
    if (minAvgNum !== null) list = list.filter((p) => p.totalAvg >= minAvgNum);
    if (maxAvgNum !== null) list = list.filter((p) => p.totalAvg <= maxAvgNum);
    return list;
  }, [ranked, normalizedSearch, minAvgNum, maxAvgNum]);

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const getVal = (p) => {
        if (sortKey === "totalAvg") return p.totalAvg ?? -Infinity;
        if (sortKey === "groupNo") return p.groupNo ?? 0;
        if (sortKey === "title") return (p.name || "").toLowerCase();
        const av = p.avg?.[sortKey];
        return typeof av === "number" ? av : -Infinity;
      };
      const av = getVal(a);
      const bv = getVal(b);
      if (typeof av === "string" && typeof bv === "string") return dir * av.localeCompare(bv);
      return dir * (av > bv ? 1 : av < bv ? -1 : 0);
    });
  }, [filtered, sortKey, sortDir]);

  // Tie-aware rank map (based on full filtered set sorted by totalAvg)
  const rankMap = useMemo(() => {
    const byTotal = [...filtered].sort(
      (a, b) => (b.totalAvg ?? -Infinity) - (a.totalAvg ?? -Infinity)
    );
    const map = new Map();
    let rank = 1;
    for (let i = 0; i < byTotal.length; i++) {
      if (i > 0 && byTotal[i].totalAvg !== byTotal[i - 1].totalAvg) rank = i + 1;
      map.set(byTotal[i].id ?? byTotal[i].groupNo ?? i, rank);
    }
    return map;
  }, [filtered]);

  // Reset page when search/filter/sort changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => setPage(0), [normalizedSearch, sortKey, sortDir, minAvg, maxAvg]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // KPI stats
  const scoredList = ranked.filter((p) => Number.isFinite(p.totalAvg));
  const avgScore =
    scoredList.length > 0
      ? scoredList.reduce((s, p) => s + p.totalAvg, 0) / scoredList.length
      : null;
  const topScore = scoredList.length > 0 ? Math.max(...scoredList.map((p) => p.totalAvg)) : null;

  const hasFilters = normalizedSearch || minAvg !== "" || maxAvg !== "";

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportRankingsXLSX(sorted, criteriaList, {
        periodName,
        tenantCode: activeOrganization?.code,
      });
    } finally {
      setExporting(false);
    }
  };

  function SortTh({ id, children, className }) {
    const isActive = sortKey === id;
    return (
      <th
        className={["sortable", isActive ? "sorted" : "", className].filter(Boolean).join(" ")}
        onClick={() => handleSort(id)}
      >
        {children}
        <span className="sort-icon">{isActive ? (sortDir === "asc" ? "▲" : "▼") : "▲"}</span>
      </th>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="scores-header">
        <div className="scores-header-left">
          <div className="page-title">Rankings</div>
          <div className="text-sm">Project rankings by weighted average score.</div>
        </div>
        <div className="scores-header-actions">
          <button
            className="btn btn-outline btn-sm"
            onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px" }}>
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            {" "}Filter
          </button>
          <div style={{ width: "1px", height: "20px", background: "var(--border)", margin: "0 4px" }} />
          <button
            className="btn btn-outline btn-sm"
            onClick={handleExport}
            disabled={exporting || sorted.length === 0}
            style={{ gap: "5px" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px" }}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? "Exporting\u2026" : "Export"}
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="scores-kpi-strip" id="scores-kpi-strip">
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{scoredList.length}</div>
          <div className="scores-kpi-item-label">Projects</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">
            {avgScore !== null ? <span className="accent">{formatScore(avgScore)}</span> : "\u2014"}
          </div>
          <div className="scores-kpi-item-label">Avg. Score</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">
            {topScore !== null ? <span className="accent">{formatScore(topScore)}</span> : "\u2014"}
          </div>
          <div className="scores-kpi-item-label">Top Score</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">
            <span className="success">{totalMax}</span>
          </div>
          <div className="scores-kpi-item-label">Max Score</div>
        </div>
      </div>

      {/* Filter Panel */}
      <div className={`filter-panel${filterOpen ? " show" : ""}`} id="filter-panel">
        <div className="filter-panel-header">
          <div>
            <h4>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-1px", marginRight: "4px", opacity: 0.5 }}>
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              Filter Scores
            </h4>
            <div className="filter-panel-sub">Narrow rankings by score range or project name.</div>
          </div>
          <button className="filter-panel-close" onClick={() => setFilterOpen(false)} aria-label="Close filter" />
        </div>
        <div className="filter-row">
          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Group, project, or student…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="filter-group filter-range-pair">
            <label>Average Range</label>
            <div className="filter-range-input">
              <input
                type="number"
                placeholder="Min"
                min="0"
                max="100"
                value={minAvg}
                onChange={(e) => setMinAvg(e.target.value)}
              />
            </div>
            <div className="filter-range-input">
              <input
                type="number"
                placeholder="Max"
                min="0"
                max="100"
                value={maxAvg}
                onChange={(e) => setMaxAvg(e.target.value)}
              />
            </div>
          </div>
          <button
            className="btn btn-outline btn-sm filter-clear-btn"
            onClick={() => { setSearchTerm(""); setMinAvg(""); setMaxAvg(""); }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
            {" "}Clear all
          </button>
        </div>
      </div>

      {/* Active Filters Bar */}
      {hasFilters && (
        <div className="active-filters-bar show">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
          </svg>
          <span>
            {sorted.length} project{sorted.length !== 1 ? "s" : ""} shown
            {filtered.length !== scoredList.length && ` (filtered from ${scoredList.length})`}
          </span>
          <span
            className="clear-link"
            role="button"
            tabIndex={0}
            onClick={() => { setSearchTerm(""); setMinAvg(""); setMaxAvg(""); }}
            onKeyDown={(e) => e.key === "Enter" && (setSearchTerm(""), setMinAvg(""), setMaxAvg(""))}
          >
            Clear filters
          </span>
        </div>
      )}

      {/* Table */}
      <div id="sub-rankings">
        <div className="table-wrap">
          <table className="ranking-table">
            <colgroup>
              <col style={{ width: "42px" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "14%" }} />
              {criteriaList.map((c) => (
                <col key={c.id} style={{ width: `${Math.floor(52 / criteriaList.length)}%` }} />
              ))}
              <col style={{ width: "9%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="col-rank">#</th>
                <SortTh id="title">Project</SortTh>
                <th>Team Members</th>
                {criteriaList.map((c) => (
                  <SortTh key={c.id} id={c.id} className="text-right">
                    {c.shortLabel || c.label}
                  </SortTh>
                ))}
                <SortTh id="totalAvg" className="text-right" style={{ paddingRight: "18px" }}>
                  Average
                </SortTh>
              </tr>
            </thead>
            <tbody>
              {pageItems.length === 0 && (
                <tr>
                  <td
                    colSpan={3 + criteriaList.length + 1}
                    style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-tertiary)" }}
                  >
                    {hasFilters ? "No projects match the current filter." : "No scored projects yet."}
                  </td>
                </tr>
              )}
              {pageItems.map((p, idx) => {
                const key = p.id ?? p.groupNo ?? idx;
                const rank = rankMap.get(key);
                const isTop3 = rank >= 1 && rank <= 3;
                const studentList = p.students
                  ? p.students.split(",").map((s) => s.trim()).filter(Boolean)
                  : [];

                return (
                  <tr key={key} className={isTop3 ? "ranking-highlight" : ""}>
                    <td className="col-rank">
                      {isTop3 ? (
                        <div className="ranking-medal-cell">
                          <span
                            className="ranking-medal"
                            role="img"
                            aria-label={MEDALS[rank - 1].label}
                            title={`${rank}${rank === 1 ? "st" : rank === 2 ? "nd" : "rd"} Place`}
                          >
                            {MEDALS[rank - 1].emoji}
                          </span>
                        </div>
                      ) : (
                        <span className="ranking-num">{rank ?? "\u2014"}</span>
                      )}
                    </td>
                    <td className="col-project">
                      {p.name || `Group ${p.groupNo}`}
                    </td>
                    <td className="col-students">
                      {studentList.length > 0 ? studentList.join(" \u00b7 ") : (
                        <span style={{ color: "var(--text-tertiary)" }}>\u2014</span>
                      )}
                    </td>
                    {criteriaList.map((c) => {
                      const val = p.avg?.[c.id];
                      const pct = c.max > 0 && Number.isFinite(val) ? (val / c.max) * 100 : 0;
                      const barWidth = `calc(${Math.min(100, pct).toFixed(1)}% - 28px)`;
                      return (
                        <td key={c.id} className="heat-cell">
                          <span className="heat-val">{formatScore(val)}</span>
                          {Number.isFinite(val) && (
                            <div
                              className="heat-bar"
                              style={{ background: c.color, width: barWidth }}
                            />
                          )}
                          <span className="heat-tip">
                            {c.label}: {formatScore(val)} / {c.max}
                            {Number.isFinite(val) && c.max > 0 && (
                              <> ({Math.round(pct)}%)</>
                            )}
                          </span>
                        </td>
                      );
                    })}
                    <td
                      className="col-avg"
                      style={{ color: rank === 1 ? "var(--accent)" : "var(--text-primary)" }}
                    >
                      {formatScore(p.totalAvg)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination + summary */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px 0" }}>
        <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
          {sorted.length} project{sorted.length !== 1 ? "s" : ""} scored
          {hasFilters && ` (filtered from ${scoredList.length})`}
        </span>
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button
              className="btn btn-outline btn-sm"
              style={{ width: "32px", height: "32px", padding: 0 }}
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Previous page"
            >
              ‹
            </button>
            <span style={{ padding: "0 8px", fontSize: "12px", color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
              {safePage + 1} / {totalPages}
            </span>
            <button
              className="btn btn-outline btn-sm"
              style={{ width: "32px", height: "32px", padding: 0 }}
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
