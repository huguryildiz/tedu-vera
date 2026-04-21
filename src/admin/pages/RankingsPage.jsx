// src/admin/RankingsPage.jsx — Phase 3
// Rankings page: KPI strip, filter panel, export panel, sortable table with heat cells + consensus badges.
// Prototype reference: vera-premium-prototype.html lines 11985–12197.
import { useMemo, useState, useRef, useEffect } from "react";
import { useAdminContext } from "../hooks/useAdminContext";
import { downloadTable, generateTableBlob } from "../utils/downloadTable";
import { logExportInitiated } from "@/shared/api";
import { useToast } from "@/shared/hooks/useToast";
import { useAuth } from "@/auth";
import SendReportModal from "@/admin/modals/SendReportModal";
import { GitCompare, Filter, Icon, XCircle, Search } from "lucide-react";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import { LOCK_TOOLTIP_GRACE, LOCK_TOOLTIP_EXPIRED } from "@/auth/lockedActions";
import CompareProjectsModal from "@/admin/modals/CompareProjectsModal";
import { StudentNames } from "@/shared/ui/EntityMeta";
import JurorBadge from "../components/JurorBadge";
import CustomSelect from "@/shared/ui/CustomSelect";
import { FilterButton } from "../../shared/ui/FilterButton.jsx";
import Pagination from "@/shared/ui/Pagination";
import useCardSelection from "@/shared/hooks/useCardSelection";
import AvgDonut from "./AvgDonut";

// ── Dual-handle range slider ─────────────────────────────────────
function RangeSlider({ low, high, onChange }) {
  const pctLow  = low;
  const pctHigh = high;
  const trackFill = {
    left:  `${pctLow}%`,
    right: `${100 - pctHigh}%`,
  };
  return (
    <div className="rk-range-slider">
      <div className="rk-range-track-bg">
        <div className="rk-range-track-fill" style={trackFill} />
        <input
          type="range" min={0} max={100} value={low}
          className="rk-range-input rk-range-low"
          style={{ zIndex: low > 95 ? 5 : 3 }}
          onChange={(e) => onChange([Math.min(+e.target.value, high), high])}
        />
        <input
          type="range" min={0} max={100} value={high}
          className="rk-range-input rk-range-high"
          style={{ zIndex: 3 }}
          onChange={(e) => onChange([low, Math.max(+e.target.value, low)])}
        />
      </div>
      <div className="rk-range-vals">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

// ── Competition ranking ──────────────────────────────────────────
// Tied scores share the same rank; next rank skips (1,1,3,4,…).
function computeRanks(sortedRows) {
  const map = {};
  let rank = 1;
  for (let i = 0; i < sortedRows.length; i++) {
    if (i > 0 && sortedRows[i].totalAvg < sortedRows[i - 1].totalAvg) {
      rank = i + 1;
    }
    map[sortedRows[i].id] = rank;
  }
  return map;
}

// ── Export data builder — matches UI column names exactly ────────
// ── Per-project juror consensus (σ of per-juror totals) ─────────
function buildConsensusMap(summaryData, rawScores, criteriaConfig) {
  const map = {};
  if (!rawScores || !rawScores.length) return map;

  for (const proj of summaryData) {
    if (proj.totalAvg == null) continue;
    const projScores = rawScores.filter((s) => (s.projectId ?? s.project_id) === proj.id);
    if (!projScores.length) continue;

    const byJuror = {};
    for (const s of projScores) {
      const jid = s.jurorId ?? s.juror_id;
      if (!byJuror[jid]) byJuror[jid] = 0;
      for (const c of criteriaConfig) {
        const v = s[c.id];
        if (typeof v === "number") byJuror[jid] += v;
      }
    }

    const totals = Object.values(byJuror);
    if (totals.length < 2) continue;

    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    const variance = totals.reduce((s, v) => s + (v - mean) ** 2, 0) / totals.length;
    const sigma = Math.sqrt(variance);
    const min = Math.min(...totals);
    const max = Math.max(...totals);
    const level = sigma < 3 ? "high" : sigma <= 5 ? "moderate" : "disputed";

    map[proj.id] = { level, sigma: +sigma.toFixed(2), min: Math.round(min), max: Math.round(max) };
  }

  return map;
}

// ── Sub-components ───────────────────────────────────────────────

function HeatCell({ value, max, color, label }) {
  if (value == null) {
    return (
      <td className="heat-cell">
        <span className="heat-val">—</span>
      </td>
    );
  }
  return (
    <td className="heat-cell">
      <span className="heat-val" style={{ color }}>{value.toFixed(1)}</span>
    </td>
  );
}

function ConsensusBadge({ consensus }) {
  if (!consensus) return null;
  const { level, sigma, min, max } = consensus;
  const label = level === "high" ? "High" : level === "moderate" ? "Moderate" : "Disputed";
  return (
    <>
      <span className={`consensus-badge consensus-${level}`}>{label}</span>
      <span className={`consensus-sub consensus-sub-${level}`}>
        <span className="consensus-sub-sigma">σ = {sigma}</span>
        <span className="consensus-sub-sep" />
        <span className="consensus-sub-range">range {min}–{max}</span>
      </span>
    </>
  );
}

const RANK_GRADIENTS = {
  1: "linear-gradient(135deg, #92400e, #f59e0b)",
  2: "linear-gradient(135deg, #334155, #94a3b8)",
  3: "linear-gradient(135deg, #7c3f1a, #cd7c5a)",
};

const RANK_HONORABLE = { background: "var(--accent)", color: "#fff", border: "none" };

function MedalCell({ rank }) {
  const gradient = RANK_GRADIENTS[rank];
  const honorable = !gradient && rank <= 5 ? RANK_HONORABLE : undefined;
  return (
    <span
      className="ranking-num"
      style={gradient ? { background: gradient, color: "#fff", border: "none" } : honorable}
      aria-label={`Rank ${rank}`}
    >
      {rank}
    </span>
  );
}

// ── Icons ────────────────────────────────────────────────────────
const DownloadIcon = ({ size = 14, style }) => (
  <Icon
    iconNode={[]}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </Icon>
);

function SortIcon({ field, sortField, sortDir }) {
  if (sortField !== field) {
    return <span className="sort-icon sort-icon-inactive">▲</span>;
  }
  return (
    <span className="sort-icon sort-icon-active">
      {sortDir === "asc" ? "▲" : "▼"}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────

export default function RankingsPage() {
  const {
    summaryData = [],
    rawScores = [],
    allJurors = [],
    selectedPeriod = null,
    periodName: periodNameProp = "",
    criteriaConfig = [],
    loading = false,
  } = useAdminContext();
  const _toast = useToast();
  const { activeOrganization, isEmailVerified, graceEndsAt } = useAuth();
  const isGraceLocked    = !!(graceEndsAt && !isEmailVerified && new Date(graceEndsAt) < new Date());
  const graceLockTooltip = isGraceLocked
    ? (new Date(graceEndsAt) < new Date() ? LOCK_TOOLTIP_EXPIRED : LOCK_TOOLTIP_GRACE)
    : null;
  const rowsScopeRef = useCardSelection();
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [exportPanelOpen, setExportPanelOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [consensusFilter, setConsensusFilter] = useState("all");
  const [avgRange, setAvgRange] = useState([0, 100]);
  const [criterionFilter, setCriterionFilter] = useState("all");
  const [exportFormat, setExportFormat] = useState("xlsx");
  const [sendOpen, setSendOpen] = useState(false);
  const [sortField, setSortField] = useState("avg");
  const [sortDir, setSortDir] = useState("desc");
  const [consensusPopoverOpen, setConsensusPopoverOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [consensusPopoverPos, setConsensusPopoverPos] = useState({ top: 0, left: 0 });
  const consensusIconRef = useRef(null);
  const consensusPopoverRef = useRef(null);

  const activeFilterCount =
    (consensusFilter !== "all" ? 1 : 0) +
    (avgRange[0] > 0 || avgRange[1] < 100 ? 1 : 0) +
    (criterionFilter !== "all" ? 1 : 0);

  function openConsensusPopover(e) {
    e.stopPropagation();
    if (consensusPopoverOpen) { setConsensusPopoverOpen(false); return; }
    const rect = (e.currentTarget ?? consensusIconRef.current)?.getBoundingClientRect();
    if (rect) {
      const popoverWidth = 280;
      let left = rect.right - popoverWidth;
      if (left < 8) left = 8;
      if (left + popoverWidth > window.innerWidth - 8) left = window.innerWidth - popoverWidth - 8;
      setConsensusPopoverPos({ top: rect.bottom + 6, left });
    }
    setConsensusPopoverOpen(true);
  }

  useEffect(() => {
    if (!consensusPopoverOpen) return;
    function handleClick(e) {
      if (
        consensusPopoverRef.current && !consensusPopoverRef.current.contains(e.target) &&
        consensusIconRef.current && !consensusIconRef.current.contains(e.target)
      ) {
        setConsensusPopoverOpen(false);
      }
    }
    const close = () => setConsensusPopoverOpen(false);
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [consensusPopoverOpen]);

  const periodName = periodNameProp || selectedPeriod?.name || selectedPeriod?.semester_name || "";

  // Sorted by totalAvg desc, nulls excluded — used for rank computation
  const rankedRows = useMemo(
    () =>
      [...summaryData]
        .filter((p) => p.totalAvg != null)
        .sort((a, b) => b.totalAvg - a.totalAvg),
    [summaryData]
  );

  const ranksMap = useMemo(() => computeRanks(rankedRows), [rankedRows]);

  const consensusMap = useMemo(
    () => buildConsensusMap(summaryData, rawScores, criteriaConfig),
    [summaryData, rawScores, criteriaConfig]
  );

  // ── KPIs ───────────────────────────────────────────────────────
  const totalProjects = rankedRows.length;
  const totalJurors = allJurors.length;

  // Average: only completed jurors (finalSubmitted, not in edit mode) — consistent with Overview
  const completedJurorIds = useMemo(() => new Set(
    allJurors.filter((j) => (j.finalSubmitted || j.finalSubmittedAt) && !j.editEnabled).map((j) => j.jurorId ?? j.id)
  ), [allJurors]);
  const completedRawScores = useMemo(
    () => rawScores.filter((r) => r.total != null && completedJurorIds.has(r.jurorId ?? r.juror_id)),
    [rawScores, completedJurorIds]
  );
  const avgScore = completedRawScores.length
    ? (completedRawScores.reduce((s, r) => s + r.total, 0) / completedRawScores.length).toFixed(1)
    : "—";

  const topScore = totalProjects ? rankedRows[0].totalAvg.toFixed(1) : "—";
  const bottomScore = totalProjects ? rankedRows[rankedRows.length - 1].totalAvg.toFixed(1) : "—";
  const medianScore = totalProjects
    ? rankedRows[Math.floor((rankedRows.length - 1) / 2)].totalAvg.toFixed(1)
    : "—";

  // ── Filter criterion thresholds ────────────────────────────────
  const criterionThresholds = useMemo(() => {
    const t = {};
    for (const c of criteriaConfig) {
      t[c.id] = c.max === 10 ? 8 : 25;
    }
    return t;
  }, [criteriaConfig]);

  // ── Filtered + sorted display rows ────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = rankedRows;

    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      rows = rows.filter(
        (p) =>
          (p.title || p.name || "").toLowerCase().includes(q) ||
          (p.members || p.students || "").toLowerCase().includes(q) ||
          (p.advisor || "").toLowerCase().includes(q)
      );
    }

    if (consensusFilter !== "all") {
      rows = rows.filter((p) => consensusMap[p.id]?.level === consensusFilter);
    }

    if (avgRange[0] > 0)   rows = rows.filter((p) => p.totalAvg >= avgRange[0]);
    if (avgRange[1] < 100) rows = rows.filter((p) => p.totalAvg <= avgRange[1]);

    if (criterionFilter !== "all") {
      const threshold = criterionThresholds[criterionFilter] ?? 0;
      rows = rows.filter((p) => (p.avg?.[criterionFilter] ?? 0) >= threshold);
    }

    // Re-sort if user picked a non-default sort
    if (sortField !== "avg" || sortDir !== "desc") {
      rows = [...rows].sort((a, b) => {
        let va, vb;
        if (sortField === "rank") {
          va = ranksMap[a.id] ?? 9999;
          vb = ranksMap[b.id] ?? 9999;
        } else if (sortField === "avg") {
          va = a.totalAvg;
          vb = b.totalAvg;
        } else if (sortField === "project") {
          va = a.title || a.name || "";
          vb = b.title || b.name || "";
        } else if (sortField === "consensus") {
          const lvl = { high: 0, moderate: 1, disputed: 2 };
          va = lvl[consensusMap[a.id]?.level] ?? 3;
          vb = lvl[consensusMap[b.id]?.level] ?? 3;
        } else if (sortField === "jurors") {
          va = a.count ?? 0;
          vb = b.count ?? 0;
        } else {
          va = a.avg?.[sortField] ?? 0;
          vb = b.avg?.[sortField] ?? 0;
        }
        if (typeof va === "string")
          return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
        return sortDir === "asc" ? va - vb : vb - va;
      });
    }

    return rows;
  }, [
    rankedRows,
    ranksMap,
    searchText,
    consensusFilter,
    avgRange,
    criterionFilter,
    sortField,
    sortDir,
    consensusMap,
    criterionThresholds,
  ]);

  const hasActiveFilters =
    searchText.trim() ||
    consensusFilter !== "all" ||
    avgRange[0] > 0 || avgRange[1] < 100 ||
    criterionFilter !== "all";

  const fmtMembers = (m) => {
    if (!m) return "";
    if (Array.isArray(m)) return m.map((e) => (e?.name || e || "").toString().trim()).filter(Boolean).join("; ");
    return String(m).split(/,/).map((s) => s.trim()).filter(Boolean).join("; ");
  };

  const totalMax = criteriaConfig.reduce((s, c) => s + (c.max || 0), 0);
  const columns = useMemo(() => {
    let rankCounter = 0, lastScore = null, rowIdx = 0;
    const rankOf = (p) => {
      rowIdx += 1;
      if (Number.isFinite(p?.totalAvg) && p.totalAvg !== lastScore) { rankCounter = rowIdx; lastScore = p.totalAvg; }
      return Number.isFinite(p?.totalAvg) ? rankCounter : '';
    };
    // Pre-compute ranks for filtered rows so getValue can be pure
    const rankMap = new Map();
    let ri = 0, prev = null, rk = 0;
    for (const p of filteredRows) {
      ri += 1;
      if (Number.isFinite(p?.totalAvg) && p.totalAvg !== prev) { rk = ri; prev = p.totalAvg; }
      rankMap.set(p.id, Number.isFinite(p?.totalAvg) ? rk : '');
    }
    return [
      { key: 'rank',      label: 'Rank',                  sortKey: 'rank',      thClass: 'col-rank',                        getValue: r => rankMap.get(r.id) ?? '' },
      { key: 'title',     label: 'Project Title',         sortKey: 'project',                                               getValue: r => r.title || r.name || '' },
      { key: 'members',   label: 'Team Members',                                                                            getValue: r => fmtMembers(r.members || r.students) },
      ...(filteredRows.some(r => r.advisor) ? [
        { key: 'advisor', label: 'Advised By', getValue: r => fmtMembers(r.advisor) },
      ] : []),
      ...criteriaConfig.map(c => ({
        key: c.id,
        label: `${c.shortLabel || c.label} (${c.max})`,
        sortKey: c.id,
        thClass: 'col-criteria-th',
        getValue: r => Number.isFinite(r.avg?.[c.id]) ? Number(r.avg[c.id].toFixed(2)) : '',
      })),
      { key: 'avg',       label: `Average (${totalMax})`, sortKey: 'avg',       thClass: 'text-right', style: { paddingRight: 18 }, getValue: r => Number.isFinite(r.totalAvg) ? Number(r.totalAvg.toFixed(2)) : '' },
      { key: 'consensus', label: 'Consensus',             sortKey: 'consensus', thClass: 'text-center',                    getValue: r => {
          const c = consensusMap?.[r.id];
          if (!c) return '';
          const lvl = c.level === 'high' ? 'High' : c.level === 'moderate' ? 'Moderate' : 'Disputed';
          return `${lvl} (σ=${c.sigma})`;
        },
      },
      { key: 'count',     label: 'Jurors Evaluated',      sortKey: 'jurors',    thClass: 'text-right',                     getValue: r => r.count ?? '' },
    ];
  }, [filteredRows, criteriaConfig, totalMax, consensusMap]);

  // Pagination state
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [filteredRows]);

  // Only render mobile-card cells when viewport is narrow portrait.
  // CSS alone can't cover every orientation/width combo on iOS Safari.
  const [isPortraitMobile, setIsPortraitMobile] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(max-width: 768px) and (orientation: portrait)").matches;
  });
  useEffect(() => {
    if (!window.matchMedia) return;
    const mql = window.matchMedia("(max-width: 768px) and (orientation: portrait)");
    const onChange = (e) => setIsPortraitMobile(e.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pagedRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  function handleSort(field) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "project" || field === "rank" ? "asc" : "desc");
    }
  }

  function clearFilters() {
    setSearchText("");
    setConsensusFilter("all");
    setAvgRange([0, 100]);
    setCriterionFilter("all");
  }

  async function handleExport() {
    try {
      await logExportInitiated({
        action: "export.rankings",
        organizationId: activeOrganization?.id || null,
        resourceType: "score_sheets",
        details: {
          format: exportFormat,
          period_name: periodName || null,
          row_count: filteredRows.length,
          project_count: filteredRows.length,
          juror_count: null,
          filters: {
            search: searchText || null,
            consensus: consensusFilter,
            criterion: criterionFilter,
            min_avg: avgRange[0] > 0 ? avgRange[0] : null,
            max_avg: avgRange[1] < 100 ? avgRange[1] : null,
          },
        },
      });

      const tc = activeOrganization?.code || "";
      const header = columns.map(c => c.label);
      const rows   = filteredRows.map(r => columns.map(c => c.getValue(r)));
      await downloadTable(exportFormat, {
        filenameType: "Rankings",
        sheetName: "Rankings",
        periodName,
        tenantCode: tc,
        organization: activeOrganization?.name || "",
        department: "",
        pdfTitle: "VERA — Rankings",
        pdfSubtitle: `${periodName || "All Periods"} · ${filteredRows.length} projects`,
        header,
        rows,
      });
      setExportPanelOpen(false);
      _toast.success("Rankings exported");
    } catch (e) {
      _toast.error(e?.message || "Export failed");
    }
  }

  const exportLabels = {
    xlsx: "Excel (.xlsx)",
    csv: "CSV (.csv)",
    pdf: "PDF Report",
  };

  return (
    <>
      <div className="rankings-page">
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="scores-header">
          <div className="scores-header-left">
            <div className="page-title">Rankings</div>
            <div className="page-desc">Project rankings by weighted average score.</div>
          </div>
          <div className="scores-header-actions">
            <div className="rankings-search-wrap">
              <Search size={13} className="rankings-search-icon" />
              <input
                className="rankings-search-input"
                type="text"
                placeholder="Search…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchText && (
                <button className="rankings-search-clear" onClick={() => setSearchText("")}>
                  <XCircle size={13} />
                </button>
              )}
            </div>
            <div className="scores-action-sep" />
            {summaryData.length >= 2 && (
              <>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setCompareOpen(true)}
                >
                  <GitCompare size={14} style={{ verticalAlign: "-1px" }} /> Compare
                </button>
                <div className="scores-action-sep" />
              </>
            )}
            <FilterButton
              activeCount={activeFilterCount}
              isOpen={filterPanelOpen}
              onClick={() => setFilterPanelOpen((o) => !o)}
            />
            <div className="scores-action-sep" />
            <button
              className={`btn btn-outline btn-sm${exportPanelOpen ? " active" : ""}`}
              onClick={() => setExportPanelOpen((o) => !o)}
            >
              <DownloadIcon style={{ verticalAlign: "-1px" }} /> Export
            </button>
          </div>
        </div>

        {/* ── KPI Strip ────────────────────────────────────────── */}
        <div className="scores-kpi-strip">
          <div className="scores-kpi-item">
            <div className="scores-kpi-item-value">{totalProjects}</div>
            <div className="scores-kpi-item-label">Projects</div>
          </div>
          <div className="scores-kpi-item">
            <div className="scores-kpi-item-value">{totalJurors}</div>
            <div className="scores-kpi-item-label">Jurors</div>
          </div>
          <div className="scores-kpi-item">
            <div className="scores-kpi-item-value">{avgScore}</div>
            <div className="scores-kpi-item-label">Avg. Score</div>
          </div>
          <div className="scores-kpi-item">
            <div className="scores-kpi-item-value kpi-range-triple">
              <span className="danger">{bottomScore}</span>
              <span className="kpi-range-sep"> · </span>
              <span>{medianScore}</span>
              <span className="kpi-range-sep"> · </span>
              <span className="accent">{topScore}</span>
            </div>
            <div className="scores-kpi-item-label">Score Range</div>
            <div className="scores-kpi-item-sub">
              <span className="sub-danger">Btm</span>
              <span className="sub-muted"> · Med · </span>
              <span className="sub-accent">Top</span>
            </div>
          </div>
        </div>

        {/* ── Filter Panel (always in DOM, toggled via CSS class) ─ */}
        <div className={`filter-panel${filterPanelOpen ? " show" : ""}`}>
          <div className="filter-panel-header">
            <div>
              <h4 style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Filter size={14} />
                Filter Scores
              </h4>
              <div className="filter-panel-sub">
                Narrow rankings by consensus level, score range, and evaluation coverage.
              </div>
            </div>
            <button className="filter-panel-close" onClick={() => setFilterPanelOpen(false)}>
              &#215;
            </button>
          </div>
          <div className="filter-row rk-filter-row">
            <div className="filter-group">
              <label>Consensus</label>
              <CustomSelect
                value={consensusFilter}
                onChange={(v) => setConsensusFilter(v)}
                options={[
                  { value: "all", label: "All levels" },
                  { value: "high", label: "High only" },
                  { value: "moderate", label: "Moderate only" },
                  { value: "disputed", label: "Disputed only" },
                ]}
                ariaLabel="Consensus"
              />
            </div>
            <div className="filter-group">
              <label>Avg Range — <span className="rk-range-readout">{avgRange[0]} – {avgRange[1]}</span></label>
              <RangeSlider low={avgRange[0]} high={avgRange[1]} onChange={setAvgRange} />
            </div>
            <div className="filter-group">
              <label>Criterion</label>
              <CustomSelect
                value={criterionFilter}
                onChange={(v) => setCriterionFilter(v)}
                options={[
                  { value: "all", label: "All criteria" },
                  ...criteriaConfig.map((c) => ({
                    value: c.id,
                    label: `${c.shortLabel || c.label} ≥ ${criterionThresholds[c.id]}`,
                  })),
                ]}
                ariaLabel="Criterion"
              />
            </div>
            {hasActiveFilters && (
              <button className="btn btn-outline btn-sm filter-clear-btn" onClick={clearFilters}>
                <XCircle size={12} strokeWidth={2} style={{ opacity: 0.5, verticalAlign: "-1px" }} />
                {" "}Clear all
              </button>
            )}
          </div>
          <div className="filter-tags" />
        </div>

        {/* ── Active Filters Bar ───────────────────────────────── */}
        {hasActiveFilters && (
          <div className="active-filters-bar">
            <Icon
              iconNode={[]}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2">
              <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
            </Icon>
            <span>
              Filtered · {filteredRows.length} of {totalProjects} projects
            </span>
            <span className="clear-link" onClick={clearFilters}>
              Clear filters
            </span>
          </div>
        )}

        {/* ── Export Panel (always in DOM, toggled via CSS class) ─ */}
        <div className={`export-panel${exportPanelOpen ? " show" : ""}`}>
          <div className="export-panel-header">
            <div>
              <h4>
                <DownloadIcon size={14} style={{ verticalAlign: "-1px", marginRight: 4 }} />
                Export Score Rankings
              </h4>
              <div className="export-panel-sub">
                Download rankings, averages, and per-juror breakdowns for the active evaluation
                period.
              </div>
            </div>
            <button className="export-panel-close" onClick={() => setExportPanelOpen(false)}>
              &#215;
            </button>
          </div>
          <div className="export-options">
            {[
              {
                id: "xlsx",
                label: "Excel (.xlsx)",
                fileLabel: "XLS",
                desc: "Rankings, averages, and per-juror breakdown",
                hint: "Best for sharing",
              },
              {
                id: "csv",
                label: "CSV (.csv)",
                fileLabel: "CSV",
                desc: "Raw scores for custom analysis pipelines",
                hint: "Best for analysis",
              },
              {
                id: "pdf",
                label: "PDF Report",
                fileLabel: "PDF",
                desc: "Formatted report with charts and context",
                hint: "Best for archival",
              },
            ].map((opt) => (
              <div
                key={opt.id}
                className={`export-option${exportFormat === opt.id ? " selected" : ""}`}
                onClick={() => setExportFormat(opt.id)}
              >
                <span className="export-option-selected-pill">Selected</span>
                <div className={`export-option-icon export-option-icon--${opt.id}`}>
                  <span className="file-icon">
                    <span className="file-icon-label">{opt.fileLabel}</span>
                  </span>
                </div>
                <div className="export-option-title">{opt.label}</div>
                <div className="export-option-desc">{opt.desc}</div>
                <div className="export-option-hint">{opt.hint}</div>
              </div>
            ))}
          </div>
          <div className="export-footer">
            <div className="export-footer-info">
              <div className="export-footer-format">
                {exportLabels[exportFormat]} · Score Rankings
              </div>
              <div className="export-footer-meta">
                {totalProjects} projects · {totalJurors} jurors
                {periodName ? ` · ${periodName}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <PremiumTooltip text={graceLockTooltip}>
                <button className="btn btn-outline btn-sm" onClick={() => { if (!isGraceLocked) setSendOpen(true); }} disabled={isGraceLocked} style={{ borderRadius: 999, padding: "9px 18px", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon
                    iconNode={[]}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4z" /><path d="m22 2-11 11" /></Icon>
                  {" "}Send
                </button>
              </PremiumTooltip>
              <button
                className="btn btn-primary btn-sm export-download-btn"
                onClick={handleExport}
              >
                <DownloadIcon size={14} />
                {exportFormat === "xlsx"
                  ? "Download Excel"
                  : exportFormat === "csv"
                  ? "Download CSV"
                  : "Download PDF"}
              </button>
            </div>
          </div>
        </div>

        <SendReportModal
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          format={exportFormat}
          formatLabel={`${exportLabels[exportFormat]} · Score Rankings`}
          meta={`${totalProjects} projects · ${totalJurors} jurors${periodName ? ` · ${periodName}` : ""}`}
          reportTitle="Score Rankings"
          periodName={periodName}
          organization={activeOrganization?.name || ""}
          department=""
          generateFile={async (fmt) => {
            const header = columns.map(c => c.label);
            const rows   = filteredRows.map(r => columns.map(c => c.getValue(r)));
            return generateTableBlob(fmt, {
              filenameType: "Rankings", sheetName: "Rankings", periodName,
              tenantCode: activeOrganization?.code || "", organization: activeOrganization?.name || "",
              department: "", pdfTitle: "VERA — Rankings",
              header, rows,
            });
          }}
        />

        {compareOpen && (
          <CompareProjectsModal
            open={true}
            onClose={() => setCompareOpen(false)}
            projects={summaryData}
            criteriaConfig={criteriaConfig}
            rawScores={rawScores}
          />
        )}

        {/* ── Rankings Table ───────────────────────────────────── */}
        <div id="sub-rankings">
          <div className="table-wrap table-wrap--split">
            <table className="ranking-table table-standard table-pill-balance">
              <colgroup>
                <col style={{ width: "1px" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "14%" }} />
                {criteriaConfig.map((c) => (
                  <col key={c.id} style={{ width: "8%" }} />
                ))}
                <col style={{ width: "8%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "5%" }} />
              </colgroup>
              <thead>
                <tr>
                  {columns.map(col => (
                    <th
                      key={col.key}
                      className={[
                        col.sortKey ? `sortable${sortField === col.sortKey ? ' sorted' : ''}` : '',
                        col.thClass || '',
                      ].filter(Boolean).join(' ') || undefined}
                      style={col.style}
                      onClick={col.sortKey ? () => handleSort(col.sortKey) : undefined}
                    >
                      {col.key === 'consensus' ? (
                        <div className="col-info">
                          {col.label}
                          <SortIcon field={col.sortKey} sortField={sortField} sortDir={sortDir} />
                          <span ref={consensusIconRef} className="col-info-icon" onClick={openConsensusPopover}>?</span>
                        </div>
                      ) : (
                        <>
                          {col.label}
                          {col.sortKey && <SortIcon field={col.sortKey} sortField={sortField} sortDir={sortDir} />}
                        </>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody ref={rowsScopeRef}>
                {loading && (
                  <tr>
                    <td
                      colSpan={3 + criteriaConfig.length + 3}
                      style={{ textAlign: "center", padding: 32, color: "var(--text-tertiary)" }}
                    >
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading &&
                  pagedRows.map((proj) => {
                    const rank = ranksMap[proj.id];
                    const consensus = consensusMap[proj.id];
                    const title = proj.title || proj.name || "";
                    const members = proj.members || proj.students || "";

                    return (
                      <tr
                        key={proj.id}
                        data-card-selectable=""
                        className={[
                          "mcard",
                          rank <= 3 ? "ranking-highlight" : "",
                          rank <= 3 ? `ranking-top-${rank}` : "",
                        ].filter(Boolean).join(" ")}
                      >
                        <td className="col-rank" data-label="Rank">
                          <MedalCell rank={rank} />
                        </td>
                        <td className="col-project" data-label="Project Title">
                          {proj.group_no != null && (
                            <span className="ranking-proj-no">PROJECT · P{proj.group_no}</span>
                          )}
                          {title}
                          {proj.advisor && (() => {
                            const advisors = proj.advisor.split(",").map((s) => s.trim()).filter(Boolean);
                            if (!advisors.length) return null;
                            return (
                              <div className="meta-chips-row overview-top-advisors">
                                <span className="meta-chips-eyebrow">Advised by</span>
                                {advisors.map((name, idx) => (
                                  <JurorBadge key={`${name}-${idx}`} name={name} size="sm" nameOnly />
                                ))}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="col-students" data-label="Team Members">
                          <span className="rk-members-label">Team Members</span>
                          <div className="meta-chips-row">
                            <StudentNames names={members} />
                          </div>
                          {proj.advisor && (() => {
                            const advisors = proj.advisor.split(",").map((s) => s.trim()).filter(Boolean);
                            if (!advisors.length) return null;
                            return (
                              <div className="rk-advisor-block">
                                <div className="meta-chips-row overview-top-advisors">
                                  <span className="meta-chips-eyebrow">Advised by</span>
                                  {advisors.map((name, i) => (
                                    <JurorBadge key={`${name}-${i}`} name={name} size="sm" nameOnly />
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        {criteriaConfig.map((c) => (
                          <HeatCell
                            key={c.id}
                            value={proj.avg?.[c.id]}
                            max={c.max}
                            color={c.color}
                            label={c.shortLabel || c.label}
                          />
                        ))}
                        <td className="col-avg" data-label="Average">
                          <span
                            className="rk-avg-num"
                            style={rank === 1 ? { color: "var(--accent)" } : undefined}
                          >
                            {proj.totalAvg.toFixed(1)}
                          </span>
                          <AvgDonut value={proj.totalAvg} max={100} />
                        </td>
                        <td className="text-center consensus-cell" data-label="Consensus">
                          <ConsensusBadge consensus={consensus} />
                        </td>
                        <td className="col-jurors" data-label="Jurors">{proj.count ?? "—"}</td>

                        {/* ── Mobile portrait only — conditionally rendered to avoid CSS overrides ── */}
                        {isPortraitMobile && (<>
                        <td className="rk-mobile-only rk-criteria-cell" aria-hidden="true">
                          <span className="rk-crit-label">Criteria Scores</span>
                          <div className="rk-criteria">
                            {criteriaConfig.map((c) => {
                              const val = proj.avg?.[c.id];
                              return (
                                <div key={c.id} className="rk-criterion">
                                  <div className="rk-crit-name">{c.shortLabel || c.label}</div>
                                  <div className="rk-crit-bar">
                                    {val != null && (
                                      <div
                                        className="rk-crit-fill"
                                        style={{
                                          width: c.max > 0 ? `${Math.min(100, (val / c.max) * 100)}%` : "0%",
                                          backgroundColor: c.color || "var(--accent)",
                                        }}
                                      />
                                    )}
                                  </div>
                                  <div className="rk-crit-val">
                                    {val != null ? (
                                      <>
                                        <span className="rk-crit-val-num" style={{ color: c.color || "var(--accent)" }}>
                                          {val.toFixed(0)}
                                        </span>
                                        <span className="rk-crit-val-max">/{c.max}</span>
                                      </>
                                    ) : (
                                      <span className="rk-crit-val-empty">—</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        <td className="rk-mobile-only rk-footer-cell" aria-hidden="true">
                          <div className="rk-footer-cols">
                            <div className="rk-footer-left">
                              <span className="rk-foot-label">
                                Consensus
                                <span className="col-info-icon" onClick={openConsensusPopover} style={{ marginLeft: 5 }}>?</span>
                              </span>
                              <div className="rk-footer">
                                {consensus ? (
                                  <span className={`rk-consensus rk-cons-${consensus.level}`}>
                                    {consensus.level === "high"
                                      ? "High"
                                      : consensus.level === "moderate"
                                      ? "Moderate"
                                      : "Disputed"}
                                  </span>
                                ) : (
                                  <span className="rk-consensus rk-cons-none">—</span>
                                )}
                                {consensus && (
                                  <span className="rk-meta">σ {consensus.sigma} · {consensus.min}–{consensus.max}</span>
                                )}
                              </div>
                            </div>
                            <div className="rk-jurors-block">
                              <span className="rk-jurors-label">Jurors Evaluated</span>
                              <span className="rk-jurors">{proj.count ?? "—"} jurors</span>
                            </div>
                          </div>
                        </td>
                        </>)}
                      </tr>
                    );
                  })}
                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={3 + criteriaConfig.length + 3}
                      style={{ textAlign: "center", padding: 32, color: "var(--text-tertiary)" }}
                    >
                      {totalProjects === 0
                        ? "No scores available for this period."
                        : "No projects match the current filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredRows.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            itemLabel="projects"
          />
        </div>
      </div>
      {consensusPopoverOpen && (
        <div
          ref={consensusPopoverRef}
          className="col-info-popover show"
          style={{ position: "fixed", top: consensusPopoverPos.top, left: consensusPopoverPos.left, zIndex: 9999 }}
        >
          <h5>Juror Consensus</h5>
          <p>Measures how much jurors agree on a project&apos;s score. Based on the standard deviation (σ) of total scores across all jurors.</p>
          <div className="consensus-info-rows">
            <div className="consensus-info-row">
              <span className="consensus-badge consensus-high">High</span>
              <span className="consensus-info-desc">σ &lt; 3.0 — Jurors closely agree</span>
            </div>
            <div className="consensus-info-row">
              <span className="consensus-badge consensus-moderate">Moderate</span>
              <span className="consensus-info-desc">σ 3.0–5.0 — Some variation</span>
            </div>
            <div className="consensus-info-row">
              <span className="consensus-badge consensus-disputed">Disputed</span>
              <span className="consensus-info-desc">σ &gt; 5.0 — Significant disagreement</span>
            </div>
          </div>
          <p style={{ marginTop: 8, fontSize: 10, color: "var(--text-tertiary)" }}>
            Hover each badge to see the exact σ value and score range.
          </p>
        </div>
      )}
    </>
  );
}
