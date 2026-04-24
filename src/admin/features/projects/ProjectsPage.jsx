// src/admin/pages/ProjectsPage.jsx — Phase 7
// Projects management page. Structure from prototype lines 14001–14241.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { ClipboardList, Download, LockKeyhole, Lock, Plus, Search, Upload } from "lucide-react";
import { useToast } from "@/shared/hooks/useToast";
import { useAuth } from "@/auth";
import FbAlert from "@/shared/ui/FbAlert";
import DeleteProjectModal from "./DeleteProjectModal";
import { FilterButton } from "@/shared/ui/FilterButton";
import { logExportInitiated } from "@/shared/api";
import { useManagePeriods } from "@/admin/features/periods/useManagePeriods";
import { useManageProjects } from "./useManageProjects";
import ImportCsvModal from "@/admin/shared/ImportCsvModal";
import { parseProjectsCsv } from "@/admin/utils/csvParser";
import ExportPanel from "@/admin/shared/ExportPanel";
import EditProjectDrawer from "./EditProjectDrawer";
import AddProjectDrawer from "./AddProjectDrawer";
import ProjectScoresDrawer from "./ProjectScoresDrawer";
import { downloadTable, generateTableBlob } from "@/admin/utils/downloadTable";
import useCardSelection from "@/shared/hooks/useCardSelection";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import { COLUMNS, getProjectCell, membersToArray, membersToString } from "./components/projectHelpers";
import ProjectsFilterPanel from "./components/ProjectsFilterPanel";
import ProjectsTable from "./components/ProjectsTable";
import "./ProjectsPage.css";

export default function ProjectsPage() {
  const {
    organizationId,
    selectedPeriodId,
    isDemoMode = false,
    onDirtyChange,
    onCurrentPeriodChange,
    onNavigate,
    rawScores,
    summaryData,
    allJurors,
    sortedPeriods,
    bgRefresh,
    criteriaConfig = [],
  } = useAdminContext();
  const _toast = useToast();
  const { activeOrganization } = useAuth();
  const rowsScopeRef = useCardSelection();
  const setMessage = (msg) => { if (msg) _toast.success(msg); };
  const [panelError, setPanelErrorState] = useState("");
  const setPanelError = useCallback((_panel, msg) => setPanelErrorState(msg || ""), []);
  const clearPanelError = useCallback(() => setPanelErrorState(""), []);
  const [loadingCount, setLoadingCount] = useState(0);
  const incLoading = useCallback(() => setLoadingCount((c) => c + 1), []);
  const decLoading = useCallback(() => setLoadingCount((c) => Math.max(0, c - 1)), []);

  const periods = useManagePeriods({
    organizationId,
    selectedPeriodId,
    setMessage,
    incLoading,
    decLoading,
    onCurrentPeriodChange: onCurrentPeriodChange,
    setPanelError,
    clearPanelError,
    bgRefresh,
  });

  const isLocked = !!(periods.viewPeriod?.is_locked);
  const lockedTooltip = isLocked ? "Evaluation period is locked. Unlock the period to make changes." : null;

  const projects = useManageProjects({
    organizationId,
    viewPeriodId: periods.viewPeriodId,
    viewPeriodLabel: periods.viewPeriodLabel,
    periodList: periods.periodList,
    setMessage,
    incLoading,
    decLoading,
    setPanelError,
    clearPanelError,
  });

  // Local UI state
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    evalStatus: "all",
    advisor:    "",
    scoreBand:  "all",
    teamSize:   "all",
  });
  const [exportOpen, setExportOpen] = useState(false);
  const [sortKey, setSortKey] = useState("group_no");
  const [sortDir, setSortDir] = useState("asc");
  const [openMenuId, setOpenMenuId] = useState(null);

  // Edit / Add drawers
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editDrawerProject, setEditDrawerProject] = useState(null);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);

  // View Scores drawer
  const [scoresProject, setScoresProject] = useState(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Per-project average score map
  const projectAvgMap = useMemo(() => {
    const map = new Map();
    if (!rawScores?.length) return map;
    const byProject = new Map();
    for (const r of rawScores) {
      const pid = r.projectId || r.project_id;
      if (!pid) continue;
      const total = Number(r.total);
      if (!Number.isFinite(total)) continue;
      if (!byProject.has(pid)) byProject.set(pid, []);
      byProject.get(pid).push(total);
    }
    for (const [pid, totals] of byProject) {
      map.set(pid, (totals.reduce((s, v) => s + v, 0) / totals.length).toFixed(1));
    }
    return map;
  }, [rawScores]);

  // Per-project distinct juror count (for mobile footer "N evaluations").
  const projectEvalCountMap = useMemo(() => {
    const map = new Map();
    if (!rawScores?.length) return map;
    const byProject = new Map();
    for (const r of rawScores) {
      const pid = r.projectId || r.project_id;
      const jid = r.jurorId || r.juror_id;
      if (!pid || !jid) continue;
      if (!byProject.has(pid)) byProject.set(pid, new Set());
      byProject.get(pid).add(jid);
    }
    for (const [pid, set] of byProject) map.set(pid, set.size);
    return map;
  }, [rawScores]);

  const deleteImpact = useMemo(() => {
    if (!deleteTarget || !rawScores?.length) return { scores: 0, jurors: 0, avgScore: "—" };
    const projectScores = rawScores.filter(
      (r) => r.projectId === deleteTarget.id || r.project_id === deleteTarget.id
    );
    const jurors = new Set(projectScores.map((r) => r.jurorId || r.juror_id).filter(Boolean)).size;
    const totals = projectScores.map((r) => Number(r.total)).filter(Number.isFinite);
    const avgScore = totals.length > 0
      ? (totals.reduce((s, v) => s + v, 0) / totals.length).toFixed(1)
      : "—";
    return { scores: projectScores.length, jurors, avgScore };
  }, [deleteTarget, rawScores]);

  // Period max score (for column header + /N suffix) — derived from criteriaConfig
  const periodMaxScore = useMemo(
    () => { const s = criteriaConfig.reduce((acc, c) => acc + (c.max || 0), 0); return s > 0 ? s : null; },
    [criteriaConfig]
  );

  // Import CSV state
  const cancelImportRef = useRef(false);
  const [importOpen, setImportOpen] = useState(false);

  // Load periods, then projects
  useEffect(() => {
    incLoading();
    periods.loadPeriods()
      .catch(() => setPanelError("period", "Could not load periods."))
      .finally(() => decLoading());
  }, [periods.loadPeriods]);

  useEffect(() => {
    if (!periods.viewPeriodId) return;
    incLoading();
    projects.loadProjects()
      .catch(() => setPanelError("project", "Could not load projects."))
      .finally(() => decLoading());
  }, [periods.viewPeriodId, projects.loadProjects]);

  const projectList = projects.projects || [];

  const distinctAdvisors = useMemo(() => {
    const set = new Set();
    for (const p of projectList) {
      (p.advisor || "").split(",").map((s) => s.trim()).filter(Boolean).forEach((a) => set.add(a));
    }
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [projectList]);

  const filterActiveCount = [
    filters.evalStatus !== "all",
    filters.advisor !== "",
    filters.scoreBand !== "all",
    filters.teamSize !== "all",
  ].filter(Boolean).length;

  // Filter by search + criteria
  const filteredList = useMemo(() => {
    let list = projectList;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        (p.title || "").toLowerCase().includes(q) ||
        membersToString(p.members).toLowerCase().includes(q) ||
        String(p.group_no || "").includes(q)
      );
    }

    list = list.filter((p) => {
      if (filters.evalStatus === "evaluated" && !projectAvgMap.has(p.id)) return false;
      if (filters.evalStatus === "not_evaluated" && projectAvgMap.has(p.id)) return false;

      if (filters.advisor) {
        const advisors = (p.advisor || "").split(",").map((s) => s.trim());
        if (!advisors.includes(filters.advisor)) return false;
      }

      if (filters.scoreBand !== "all" && projectAvgMap.has(p.id)) {
        const max = periodMaxScore || 100;
        const pct = (Number(projectAvgMap.get(p.id)) / max) * 100;
        if (filters.scoreBand === "high" && pct < 85) return false;
        if (filters.scoreBand === "mid" && (pct < 70 || pct >= 85)) return false;
        if (filters.scoreBand === "low" && pct >= 70) return false;
      }

      if (filters.teamSize !== "all") {
        const count = membersToArray(p.members).length;
        if (filters.teamSize === "small" && count > 2) return false;
        if (filters.teamSize === "mid" && (count < 3 || count > 4)) return false;
        if (filters.teamSize === "large" && count < 5) return false;
      }

      return true;
    });

    return list;
  }, [projectList, search, filters, projectAvgMap, periodMaxScore]);

  // Pagination state
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [filteredList]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));

  const sortedFilteredList = useMemo(() => {
    const rows = [...filteredList];
    rows.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;
      const aTitle = String(a.title || "");
      const bTitle = String(b.title || "");
      let cmp = 0;

      if (sortKey === "group_no") {
        const aNo = Number(a.group_no);
        const bNo = Number(b.group_no);
        const aValue = Number.isFinite(aNo) ? aNo : Number.POSITIVE_INFINITY;
        const bValue = Number.isFinite(bNo) ? bNo : Number.POSITIVE_INFINITY;
        cmp = aValue - bValue;
      } else if (sortKey === "title") {
        cmp = aTitle.localeCompare(bTitle, "tr", { sensitivity: "base", numeric: true });
      } else if (sortKey === "members") {
        cmp = membersToString(a.members).localeCompare(membersToString(b.members), "tr", { sensitivity: "base", numeric: true });
      } else if (sortKey === "avg_score") {
        const aAvg = Number(projectAvgMap.get(a.id));
        const bAvg = Number(projectAvgMap.get(b.id));
        const aValue = Number.isFinite(aAvg) ? aAvg : Number.NEGATIVE_INFINITY;
        const bValue = Number.isFinite(bAvg) ? bAvg : Number.NEGATIVE_INFINITY;
        cmp = aValue - bValue;
      } else if (sortKey === "updated_at") {
        const aTs = Date.parse(a.updated_at || "");
        const bTs = Date.parse(b.updated_at || "");
        const aValue = Number.isFinite(aTs) ? aTs : Number.NEGATIVE_INFINITY;
        const bValue = Number.isFinite(bTs) ? bTs : Number.NEGATIVE_INFINITY;
        cmp = aValue - bValue;
      }

      if (cmp !== 0) return cmp * direction;
      return aTitle.localeCompare(bTitle, "tr", { sensitivity: "base", numeric: true });
    });
    return rows;
  }, [filteredList, sortKey, sortDir, projectAvgMap]);

  const safePage = Math.min(currentPage, totalPages);
  const pagedList = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedFilteredList.slice(start, start + pageSize);
  }, [sortedFilteredList, safePage, pageSize]);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "updated_at" ? "desc" : "asc");
  }

  // KPI stats
  const totalProjects = projectList.length;
  const totalMembers = projectList.reduce((sum, p) => sum + membersToArray(p.members).length, 0);
  const kpiBase = filteredList.length !== projectList.length ? filteredList : projectList;
  const kpiTotalProjects = kpiBase.length;
  const kpiTotalMembers = kpiBase.reduce((sum, p) => sum + membersToArray(p.members).length, 0);
  const kpiEvaluated = kpiBase.filter((p) => projectAvgMap.has(p.id)).length;

  function openEditDrawer(project) {
    setEditDrawerProject({
      id: project.id,
      groupNo: project.group_no,
      title: project.title || "",
      advisor: project.advisor || "",
      description: project.description || "",
      members: membersToArray(project.members),
    });
    setEditDrawerOpen(true);
    setOpenMenuId(null);
  }

  async function handleEditSave(id, data) {
    const project = (projects.projects || []).find((p) => p.id === id);
    const result = await projects.handleEditProject({
      id,
      title: data.title,
      advisor: data.advisor,
      description: data.description,
      group_no: project?.group_no,
      members: data.members,
    });
    if (result?.ok === false) throw new Error(result.message || "Could not save project.");
  }

  async function handleAddSave(data) {
    const result = await projects.handleAddProject({
      title: data.title,
      advisor: data.advisor,
      description: data.description,
      group_no: parseInt(data.groupNo, 10) || (totalProjects + 1),
      members: data.members,
    });
    if (result?.ok === false) {
      const fieldErr = result.fieldErrors?.group_no;
      throw new Error(fieldErr || result.message || "Could not add project.");
    }
  }

  async function handleDuplicate(project) {
    setOpenMenuId(null);
    const maxNo = Math.max(0, ...projectList.map((p) => Number(p.group_no) || 0));
    const result = await projects.handleAddProject({
      title: `Copy of ${project.title}`.slice(0, 100),
      advisor: project.advisor || "",
      description: project.description || "",
      group_no: maxNo + 1,
      members: membersToArray(project.members),
    });
    if (result?.ok === false) {
      _toast.error(result.message || "Could not duplicate project.");
    } else {
      _toast.success("Project duplicated.");
    }
  }

  return (
    <div id="page-projects">
      {/* Header */}
      <div className="sem-header">
        <div className="sem-header-left">
          <div className="page-title">Projects</div>
          <div className="page-desc">Manage project records, student teams, and evaluation coverage for the active term.</div>
        </div>
        <div className="sem-header-actions mobile-toolbar-stack">
          <div className="admin-search-wrap mobile-toolbar-search">
            <Search size={14} strokeWidth={2} style={{ opacity: 0.45 }} />
            <input
              className="search-input"
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <FilterButton
            className="mobile-toolbar-filter"
            activeCount={filterActiveCount}
            isOpen={filterOpen}
            onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}
          />
          <button className="btn btn-outline btn-sm mobile-toolbar-export" onClick={() => { setExportOpen((v) => !v); setFilterOpen(false); }}>
            <Download size={14} strokeWidth={2} style={{ verticalAlign: "-1px" }} />
            {" "}Export
          </button>
          <PremiumTooltip text={lockedTooltip} position="bottom">
            <button className="btn btn-outline btn-sm mobile-toolbar-secondary" onClick={() => !isLocked && setImportOpen(true)} disabled={isLocked} data-testid="projects-import-btn">
              <Upload size={14} strokeWidth={2} style={{ verticalAlign: "-1px" }} />
              {" "}Import
            </button>
          </PremiumTooltip>
          <PremiumTooltip text={lockedTooltip} position="bottom">
            <button
              className="btn btn-primary btn-sm mobile-toolbar-primary"
              onClick={() => !isLocked && setAddDrawerOpen(true)}
              disabled={isLocked}
              data-testid="projects-add-btn"
            >
              <Plus size={13} strokeWidth={2.2} />
              Add Project
            </button>
          </PremiumTooltip>
        </div>
      </div>
      {/* KPI strip */}
      <div className="scores-kpi-strip">
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{kpiTotalProjects}</div>
          <div className="scores-kpi-item-label">Projects</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{kpiTotalMembers}</div>
          <div className="scores-kpi-item-label">Team Members</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{kpiEvaluated} / {kpiTotalProjects}</div>
          <div className="scores-kpi-item-label">Evaluated</div>
        </div>
      </div>
      <PremiumTooltip text={lockedTooltip} position="bottom">
        <button
          className="btn btn-primary btn-sm mobile-primary-below-kpi"
          onClick={() => !isLocked && setAddDrawerOpen(true)}
          disabled={isLocked}
        >
          <Plus size={13} strokeWidth={2.2} />
          Add Project
        </button>
      </PremiumTooltip>
      {/* Lock banner */}
      {isLocked && periods.viewPeriodId && (
        <div className="lock-notice">
          <div className="lock-notice-left">
            <div className="lock-notice-icon-wrap">
              <LockKeyhole size={20} strokeWidth={1.8} />
            </div>
            <div className="lock-notice-badge">locked</div>
          </div>
          <div className="lock-notice-body">
            <div className="lock-notice-title">Evaluation in progress — project list locked</div>
            <div className="lock-notice-desc">
              Projects cannot be added, edited, or deleted while scores exist for this period.
            </div>
            <div className="lock-notice-chips">
              <span className="lock-notice-chip editable"><ClipboardList size={11} strokeWidth={2} /> View Scores</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Add Projects</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Import CSV</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Edit Projects</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Duplicate Projects</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Delete Projects</span>
            </div>
          </div>
        </div>
      )}
      {/* Filter panel */}
      {filterOpen && (
        <ProjectsFilterPanel
          filters={filters}
          setFilters={setFilters}
          filterActiveCount={filterActiveCount}
          distinctAdvisors={distinctAdvisors}
          onClose={() => setFilterOpen(false)}
        />
      )}
      {/* Export panel */}
      {exportOpen && (
        <ExportPanel
          title="Export Projects"
          subtitle="Download the project list with team members and evaluation coverage."
          meta={`${periods.viewPeriodLabel} · ${totalProjects} projects`}
          periodName={periods.viewPeriodLabel}
          organization={activeOrganization?.name || ""}
          department=""
          onClose={() => setExportOpen(false)}
          generateFile={async (fmt) => {
            const header = COLUMNS.map((c) => c.key === "avg_score" && periodMaxScore != null ? `Avg Score (${periodMaxScore})` : c.label);
            const rows = sortedFilteredList.map((p) => COLUMNS.map((c) => getProjectCell(p, c.key, projectAvgMap)));
            return generateTableBlob(fmt, {
              filenameType: "Projects", sheetName: "Projects",
              periodName: periods.viewPeriodLabel, tenantCode: activeOrganization?.code || "",
              organization: activeOrganization?.name || "", department: "",
              pdfTitle: "VERA — Projects", header, rows,
              colWidths: COLUMNS.map((c) => c.exportWidth),
            });
          }}
          onExport={async (fmt) => {
            try {
              const header = COLUMNS.map((c) => c.key === "avg_score" && periodMaxScore != null ? `Avg Score (${periodMaxScore})` : c.label);
              const rows = sortedFilteredList.map((p) => COLUMNS.map((c) => getProjectCell(p, c.key, projectAvgMap)));
              await logExportInitiated({
                action: "export.projects",
                organizationId: activeOrganization?.id || null,
                resourceType: "projects",
                details: {
                  format: fmt,
                  row_count: rows.length,
                  period_name: periods.viewPeriodLabel || null,
                  project_count: rows.length,
                  juror_count: null,
                  filters: {
                    search: search || null,
                  },
                },
              });
              await downloadTable(fmt, {
                filenameType: "Projects", sheetName: "Projects",
                periodName: periods.viewPeriodLabel, tenantCode: activeOrganization?.code || "",
                organization: activeOrganization?.name || "", department: "",
                pdfTitle: "VERA — Projects", header, rows,
                colWidths: COLUMNS.map((c) => c.exportWidth),
              });
              const fmtLabel = fmt === "pdf" ? "PDF" : fmt === "csv" ? "CSV" : "Excel";
              _toast.success(`${filteredList.length} project${filteredList.length !== 1 ? "s" : ""} exported · ${fmtLabel}`);
            } catch (e) {
              _toast.error(e?.message || "Projects export failed — please try again");
            }
          }}
        />
      )}
      {/* Error */}
      {panelError && (
        <FbAlert variant="danger" style={{ marginBottom: "12px" }}>
          {panelError}
        </FbAlert>
      )}
      {/* Table + Pagination */}
      <ProjectsTable
        pagedList={pagedList}
        filteredList={filteredList}
        projectList={projectList}
        loadingCount={loadingCount}
        sortKey={sortKey}
        sortDir={sortDir}
        projectAvgMap={projectAvgMap}
        projectEvalCountMap={projectEvalCountMap}
        periodMaxScore={periodMaxScore}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        rowsScopeRef={rowsScopeRef}
        isLocked={isLocked}
        viewPeriodId={periods.viewPeriodId}
        hasPeriods={!!(periods.periodList?.length)}
        onSort={handleSort}
        onEdit={openEditDrawer}
        onDuplicate={handleDuplicate}
        onViewScores={setScoresProject}
        onDelete={setDeleteTarget}
        onAddProject={() => !isLocked && setAddDrawerOpen(true)}
        onImport={() => !isLocked && setImportOpen(true)}
        onNavigate={onNavigate}
        search={search}
        filterActiveCount={filterActiveCount}
        onClearSearch={() => setSearch("")}
        onClearFilters={() => setFilters({ evalStatus: "all", advisor: "", scoreBand: "all", teamSize: "all" })}
        pageSize={pageSize}
        safePage={safePage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
      />
      {/* Edit project drawer */}
      <EditProjectDrawer
        open={editDrawerOpen}
        onClose={() => setEditDrawerOpen(false)}
        project={editDrawerProject}
        onSave={handleEditSave}
      />
      {/* Add project drawer */}
      <AddProjectDrawer
        open={addDrawerOpen}
        onClose={() => setAddDrawerOpen(false)}
        onSave={handleAddSave}
      />
      <ImportCsvModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        parseFile={(f) => parseProjectsCsv(f, projects.projects || [])}
        onImport={async (rows) => {
          cancelImportRef.current = false;
          const result = await projects.handleImportProjects(rows, { cancelRef: cancelImportRef });
          if (result?.ok === false) throw new Error(result.formError || "Import failed.");
          return result;
        }}
      />
      <ProjectScoresDrawer
        open={!!scoresProject}
        onClose={() => setScoresProject(null)}
        project={scoresProject}
        periodId={periods.viewPeriodId}
        periodLabel={periods.viewPeriodLabel}
        rawScores={rawScores}
        summaryData={summaryData}
        allJurors={allJurors}
        onOpenReviews={() => onNavigate?.("reviews")}
      />
      <DeleteProjectModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        project={deleteTarget}
        impact={deleteImpact}
        periodName={sortedPeriods?.find((p) => p.id === selectedPeriodId)?.name}
        onDelete={async () => {
          await projects.handleDeleteProject(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
