import { useMemo, useState, useRef, useEffect } from "react";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { downloadTable, generateTableBlob } from "@/admin/utils/downloadTable";
import { logExportInitiated } from "@/shared/api";
import { useToast } from "@/shared/hooks/useToast";
import { useAuth } from "@/auth";
import SendReportModal from "@/admin/shared/SendReportModal";
import { GitCompare, Filter, Icon, Send, XCircle, Search } from "lucide-react";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import { LOCK_TOOLTIP_GRACE, LOCK_TOOLTIP_EXPIRED } from "@/auth/shared/lockedActions";
import CompareProjectsModal from "@/admin/features/projects/CompareProjectsModal";
import { FilterButton } from "@/shared/ui/FilterButton.jsx";
import CustomSelect from "@/shared/ui/CustomSelect";
import useCardSelection from "@/shared/hooks/useCardSelection";
import { computeRanks, buildConsensusMap } from "./components/rankingHelpers";
import { DownloadIcon } from "./components/RankingCells";
import RangeSlider from "./components/RangeSlider";
import RankingsTable from "./components/RankingsTable";
import "./RankingsPage.css";

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

  const totalProjects = rankedRows.length;
  const totalJurors = allJurors.length;

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

  const topScore    = totalProjects ? rankedRows[0].totalAvg.toFixed(1) : "—";
  const bottomScore = totalProjects ? rankedRows[rankedRows.length - 1].totalAvg.toFixed(1) : "—";
  const medianScore = totalProjects
    ? rankedRows[Math.floor((rankedRows.length - 1) / 2)].totalAvg.toFixed(1)
    : "—";

  const criterionThresholds = useMemo(() => {
    const t = {};
    for (const c of criteriaConfig) {
      t[c.id] = c.max === 10 ? 8 : 25;
    }
    return t;
  }, [criteriaConfig]);

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
  }, [rankedRows, ranksMap, searchText, consensusFilter, avgRange, criterionFilter, sortField, sortDir, consensusMap, criterionThresholds]);

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
    const rankMap = new Map();
    let ri = 0, prev = null, rk = 0;
    for (const p of filteredRows) {
      ri += 1;
      if (Number.isFinite(p?.totalAvg) && p.totalAvg !== prev) { rk = ri; prev = p.totalAvg; }
      rankMap.set(p.id, Number.isFinite(p?.totalAvg) ? rk : '');
    }
    return [
      { key: 'rank',      label: 'Rank',                  sortKey: 'rank',      thClass: 'col-rank',       getValue: r => rankMap.get(r.id) ?? '' },
      { key: 'title',     label: 'Project Title',         sortKey: 'project',                              getValue: r => r.group_no != null ? `P${r.group_no} — ${r.title || r.name || ''}` : (r.title || r.name || '') },
      { key: 'members',   label: 'Team Members',                                                           getValue: r => fmtMembers(r.members || r.students) },
      { key: 'advisor',   label: 'Advised By',    exportOnly: true,                                        getValue: r => r.advisor ? r.advisor.split(',').map(s => s.trim()).filter(Boolean).join('; ') : '' },
      ...criteriaConfig.map(c => ({
        key: c.id,
        label: `${c.shortLabel || c.label} (${c.max})`,
        sortKey: c.id,
        thClass: 'col-criteria-th',
        getValue: r => Number.isFinite(r.avg?.[c.id]) ? Number(r.avg[c.id].toFixed(2)) : '',
      })),
      { key: 'avg',       label: `Average (${totalMax})`, sortKey: 'avg',       thClass: 'text-center', getValue: r => Number.isFinite(r.totalAvg) ? Number(r.totalAvg.toFixed(2)) : '' },
      { key: 'consensus', label: 'Consensus',             sortKey: 'consensus', thClass: 'text-center', getValue: r => {
          const c = consensusMap?.[r.id];
          if (!c) return '';
          const lvl = c.level === 'high' ? 'High' : c.level === 'moderate' ? 'Moderate' : 'Disputed';
          return `${lvl} (σ=${c.sigma})`;
        },
      },
      { key: 'count',     label: 'Jurors Evaluated',      sortKey: 'jurors',    thClass: 'text-center', getValue: r => r.count ?? '' },
    ];
  }, [filteredRows, criteriaConfig, totalMax, consensusMap]);

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [filteredRows]);

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
          <div className="scores-header-actions mobile-toolbar-stack">
            <div className="admin-search-wrap mobile-toolbar-search">
              <Search size={14} strokeWidth={2} style={{ opacity: 0.45 }} />
              <input
                className="search-input"
                type="text"
                placeholder="Search…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <div className="scores-action-sep" />
            {summaryData.length >= 2 && (
              <>
                <button
                  className="btn btn-outline btn-sm mobile-toolbar-secondary"
                  onClick={() => setCompareOpen(true)}
                >
                  <GitCompare size={14} style={{ verticalAlign: "-1px" }} /> Compare
                </button>
                <div className="scores-action-sep" />
              </>
            )}
            <FilterButton
              className="mobile-toolbar-filter"
              activeCount={activeFilterCount}
              isOpen={filterPanelOpen}
              onClick={() => setFilterPanelOpen((o) => !o)}
            />
            <div className="scores-action-sep" />
            <button
              className={`btn btn-outline btn-sm mobile-toolbar-export${exportPanelOpen ? " active" : ""}`}
              onClick={() => setExportPanelOpen((o) => !o)}
              data-testid="rankings-export-btn"
            >
              <DownloadIcon style={{ verticalAlign: "-1px" }} /> Export
            </button>
          </div>
        </div>

        {/* ── KPI Strip ────────────────────────────────────────── */}
        <div className="scores-kpi-strip" data-testid="rankings-kpi-strip">
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
        <div className={`export-panel${exportPanelOpen ? " show" : ""}`} data-testid="rankings-export-panel">
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
              { id: "xlsx", label: "Excel (.xlsx)", fileLabel: "XLS", desc: "Rankings, averages, and per-juror breakdown", hint: "Best for sharing" },
              { id: "csv",  label: "CSV (.csv)",    fileLabel: "CSV", desc: "Raw scores for custom analysis pipelines",    hint: "Best for analysis" },
              { id: "pdf",  label: "PDF Report",    fileLabel: "PDF", desc: "Formatted report with charts and context",    hint: "Best for archival" },
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
                <button className="btn btn-outline btn-sm export-send-btn" onClick={() => { if (!isGraceLocked) setSendOpen(true); }} disabled={isGraceLocked} type="button" title="Send report via email">
                  <Send size={14} strokeWidth={2} />
                  Send
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

        <RankingsTable
          pagedRows={pagedRows}
          filteredRows={filteredRows}
          totalProjects={totalProjects}
          criteriaConfig={criteriaConfig}
          ranksMap={ranksMap}
          consensusMap={consensusMap}
          sortField={sortField}
          sortDir={sortDir}
          loading={loading}
          isPortraitMobile={isPortraitMobile}
          columns={columns.filter(c => !c.exportOnly)}
          rowsScopeRef={rowsScopeRef}
          onSort={handleSort}
          openConsensusPopover={openConsensusPopover}
          consensusIconRef={consensusIconRef}
          searchText={searchText}
          activeFilterCount={activeFilterCount}
          onClearSearch={() => setSearchText("")}
          onClearFilters={clearFilters}
          pageSize={pageSize}
          safePage={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
        />
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
