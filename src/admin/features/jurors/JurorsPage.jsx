// src/admin/features/jurors/JurorsPage.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { useToast } from "@/shared/hooks/useToast";
import { useAuth } from "@/auth";
import { useManagePeriods } from "@/admin/features/periods/useManagePeriods";
import { useManageProjects } from "@/admin/features/projects/useManageProjects";
import { useManageJurors } from "./useManageJurors";
import { useAdminResponsiveTableMode } from "@/admin/features/jurors/useAdminResponsiveTableMode";
import useCardSelection from "@/shared/hooks/useCardSelection";
import PinResultModal from "@/admin/shared/PinResultModal";
import RemoveJurorModal from "./RemoveJurorModal";
import ResetPinModal from "@/admin/shared/ResetPinModal";
import ImportJurorsModal from "@/admin/shared/ImportJurorsModal";
import EnableEditingModal from "@/admin/features/jurors/EnableEditingModal";
import JurorScoresDrawer from "./JurorScoresDrawer";
import AddJurorDrawer from "./AddJurorDrawer";
import EditJurorDrawer from "./EditJurorDrawer";
import { sendJurorPinEmail, getActiveEntryTokenPlain, logExportInitiated } from "@/shared/api";
import { parseJurorsCsv } from "@/admin/utils/csvParser";
import ExportPanel from "@/admin/shared/ExportPanel";
import { SquarePen, Filter, Download, Search, Plus, Upload, XCircle, LockKeyhole, Lock, ClipboardList, Bell, KeyRound, RotateCcw } from "lucide-react";
import { downloadTable, generateTableBlob } from "@/admin/utils/downloadTable";
import { FilterButton } from "@/shared/ui/FilterButton";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import { LOCK_TOOLTIP_GRACE, LOCK_TOOLTIP_EXPIRED } from "@/auth/shared/lockedActions";
import FbAlert from "@/shared/ui/FbAlert";
import Pagination from "@/shared/ui/Pagination";
import {
  getLiveOverviewStatus,
  isEditWindowActive,
  formatEditWindowText,
  JUROR_COLUMNS,
  getJurorCell,
} from "./components/jurorHelpers";
import JurorsFilterPanel from "./components/JurorsFilterPanel";
import JurorsTable from "./components/JurorsTable";
import "./JurorsPage.css";

export default function JurorsPage() {
  const {
    organizationId,
    selectedPeriodId,
    isDemoMode = false,
    onDirtyChange,
    onCurrentPeriodChange,
    onViewReviews,
    onNavigate,
    bgRefresh,
  } = useAdminContext();
  const _toast = useToast();
  const { activeOrganization, isEmailVerified, graceEndsAt } = useAuth();
  const isGraceLocked   = !!(graceEndsAt && !isEmailVerified && new Date(graceEndsAt) < new Date());
  const graceLockTooltip = isGraceLocked
    ? (new Date(graceEndsAt) < new Date() ? LOCK_TOOLTIP_EXPIRED : LOCK_TOOLTIP_GRACE)
    : null;
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

  const isPeriodLocked = !!periods.periodList?.find((p) => p.id === periods.viewPeriodId)?.is_locked;
  const periodLockedTooltip = isPeriodLocked
    ? "Evaluation period is locked. Unlock the period to make changes."
    : null;

  const projectsHook = useManageProjects({
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

  const jurorsHook = useManageJurors({
    organizationId,
    viewPeriodId: periods.viewPeriodId,
    viewPeriodLabel: periods.viewPeriodLabel,
    projects: projectsHook.projects,
    setMessage,
    incLoading,
    decLoading,
    setPanelError,
    clearPanelError,
    setEvalLockError: periods.setEvalLockError,
    bgRefresh,
  });

  // ── UI state ────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [affilFilter, setAffilFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [editDrawerJuror, setEditDrawerJuror] = useState(null);
  const [pinResetJuror, setPinResetJuror] = useState(null);
  const [pinResetting, setPinResetting] = useState(false);
  const [removeJuror, setRemoveJuror] = useState(null);
  const [editWindowNowMs, setEditWindowNowMs] = useState(() => Date.now());
  const [editModeJuror, setEditModeJuror] = useState(null);
  const [scoresJuror, setScoresJuror] = useState(null);
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (affilFilter !== "all" ? 1 : 0) +
    (progressFilter !== "all" ? 1 : 0);

  const { shouldUseCardLayout } = useAdminResponsiveTableMode();
  const rowsScopeRef = useCardSelection();

  // ── Data loading ────────────────────────────────────────────
  useEffect(() => {
    incLoading();
    periods.loadPeriods()
      .catch(() => setPanelError("period", "Failed to load periods."))
      .finally(() => decLoading());
  }, [periods.loadPeriods]);

  useEffect(() => {
    if (!periods.viewPeriodId) return;
    incLoading();
    projectsHook.loadProjects()
      .catch(() => setPanelError("project", "Failed to load projects."))
      .finally(() => decLoading());
  }, [periods.viewPeriodId, projectsHook.loadProjects]);

  useEffect(() => {
    if (!periods.viewPeriodId) return;
    incLoading();
    jurorsHook.loadJurorsAndEnrich()
      .catch(() => setPanelError("juror", "Failed to load jurors."))
      .finally(() => decLoading());
  }, [periods.viewPeriodId, jurorsHook.loadJurorsAndEnrich]);

  const jurorList = jurorsHook.jurors || [];
  const periodMaxScore = jurorsHook.periodMaxScore;

  const affiliations = useMemo(() => {
    const set = new Set();
    jurorList.forEach((j) => { if (j.affiliation) set.add(j.affiliation); });
    return [...set].sort();
  }, [jurorList]);

  const filteredList = useMemo(() => {
    let list = jurorList;
    if (statusFilter !== "all") {
      list = list.filter((j) => getLiveOverviewStatus(j, editWindowNowMs) === statusFilter);
    }
    if (affilFilter !== "all") {
      list = list.filter((j) => (j.affiliation || "") === affilFilter);
    }
    if (progressFilter !== "all") {
      list = list.filter((j) => {
        const scored = j.overviewScoredProjects || 0;
        const total = j.overviewTotalProjects || 0;
        const pct = total > 0 ? scored / total : 0;
        if (progressFilter === "not_started") return scored === 0;
        if (progressFilter === "partial_low")  return pct > 0 && pct < 0.5;
        if (progressFilter === "partial_high") return pct >= 0.5 && pct < 1;
        if (progressFilter === "complete")     return total > 0 && scored >= total;
        return true;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((j) =>
        (j.juryName || j.juror_name || "").toLowerCase().includes(q) ||
        (j.affiliation || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [jurorList, statusFilter, affilFilter, progressFilter, search, editWindowNowMs]);

  const jurorAvgMap = useMemo(() => {
    const byJuror = new Map();
    for (const r of jurorsHook.scoreRows || []) {
      if (r.total == null || !r.jurorId) continue;
      if (!byJuror.has(r.jurorId)) byJuror.set(r.jurorId, []);
      byJuror.get(r.jurorId).push(r.total);
    }
    const result = new Map();
    for (const [id, totals] of byJuror) {
      result.set(id, (totals.reduce((s, v) => s + v, 0) / totals.length).toFixed(1));
    }
    return result;
  }, [jurorsHook.scoreRows]);

  useEffect(() => { setCurrentPage(1); }, [filteredList]);
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));

  const sortedFilteredList = useMemo(() => {
    const statusRank = { not_started: 1, in_progress: 2, ready_to_submit: 3, editing: 4, completed: 5 };
    const rows = [...filteredList];
    rows.sort((a, b) => {
      const aName = (a.juryName || a.juror_name || "").trim();
      const bName = (b.juryName || b.juror_name || "").trim();
      const direction = sortDir === "asc" ? 1 : -1;
      let cmp = 0;
      if (sortKey === "name") {
        cmp = aName.localeCompare(bName, "tr", { sensitivity: "base", numeric: true });
      } else if (sortKey === "progress") {
        const aScored = Number(a.overviewScoredProjects || 0);
        const bScored = Number(b.overviewScoredProjects || 0);
        const aTotal = Number(a.overviewTotalProjects || 0);
        const bTotal = Number(b.overviewTotalProjects || 0);
        const aPct = aTotal > 0 ? (aScored / aTotal) * 100 : -1;
        const bPct = bTotal > 0 ? (bScored / bTotal) * 100 : -1;
        cmp = aPct - bPct;
        if (cmp === 0) cmp = aScored - bScored;
        if (cmp === 0) cmp = aTotal - bTotal;
      } else if (sortKey === "avgScore") {
        const aId = String(a.juror_id || a.jurorId || "");
        const bId = String(b.juror_id || b.jurorId || "");
        const aAvg = Number(jurorAvgMap.get(aId));
        const bAvg = Number(jurorAvgMap.get(bId));
        const aValue = Number.isFinite(aAvg) ? aAvg : Number.NEGATIVE_INFINITY;
        const bValue = Number.isFinite(bAvg) ? bAvg : Number.NEGATIVE_INFINITY;
        cmp = aValue - bValue;
      } else if (sortKey === "status") {
        const aStatus = getLiveOverviewStatus(a, editWindowNowMs);
        const bStatus = getLiveOverviewStatus(b, editWindowNowMs);
        cmp = (statusRank[aStatus] || 0) - (statusRank[bStatus] || 0);
      } else if (sortKey === "lastActive") {
        const aTs = Date.parse(a.lastSeenAt || a.last_activity_at || a.finalSubmittedAt || a.final_submitted_at || "");
        const bTs = Date.parse(b.lastSeenAt || b.last_activity_at || b.finalSubmittedAt || b.final_submitted_at || "");
        const aValue = Number.isFinite(aTs) ? aTs : Number.NEGATIVE_INFINITY;
        const bValue = Number.isFinite(bTs) ? bTs : Number.NEGATIVE_INFINITY;
        cmp = aValue - bValue;
      }
      if (cmp !== 0) return cmp * direction;
      return aName.localeCompare(bName, "tr", { sensitivity: "base", numeric: true });
    });
    return rows;
  }, [filteredList, sortKey, sortDir, jurorAvgMap, editWindowNowMs]);

  const safePage = Math.min(currentPage, totalPages);
  const pagedList = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedFilteredList.slice(start, start + pageSize);
  }, [sortedFilteredList, safePage, pageSize]);

  function handleSort(key) {
    if (sortKey === key) { setSortDir((prev) => (prev === "asc" ? "desc" : "asc")); return; }
    setSortKey(key);
    setSortDir(key === "lastActive" ? "desc" : "asc");
  }

  function clearFilters() {
    setStatusFilter("all");
    setAffilFilter("all");
    setProgressFilter("all");
  }

  // ── KPI stats ────────────────────────────────────────────────
  const totalJurors      = jurorList.length;
  const completedJurors  = jurorList.filter((j) => getLiveOverviewStatus(j, editWindowNowMs) === "completed").length;
  const notStartedJurors = jurorList.filter((j) => j.overviewStatus === "not_started").length;
  const completionPct    = totalJurors > 0 ? Math.round((completedJurors / totalJurors) * 100) : 0;
  const kpiScoreRows     = jurorsHook.scoreRows || [];
  const kpiScoredSheets  = kpiScoreRows.filter((r) => r.total != null);
  const kpiUniqueProjects = new Set(kpiScoreRows.map((r) => r.projectId).filter(Boolean)).size;
  const avgEvalPerProject = kpiUniqueProjects > 0 ? (kpiScoredSheets.length / kpiUniqueProjects).toFixed(1) : "—";
  const avgScore         = kpiScoredSheets.length > 0
    ? (kpiScoredSheets.reduce((s, r) => s + r.total, 0) / kpiScoredSheets.length).toFixed(1)
    : "—";

  const editingBannerJurors = useMemo(
    () => jurorList.filter(
      (j) => j.overviewStatus === "editing" && isEditWindowActive(j.editExpiresAt || j.edit_expires_at, editWindowNowMs)
    ),
    [jurorList, editWindowNowMs]
  );

  useEffect(() => {
    if (!editingBannerJurors.length) return;
    setEditWindowNowMs(Date.now());
    const timerId = setInterval(() => { setEditWindowNowMs(Date.now()); }, 1_000);
    return () => clearInterval(timerId);
  }, [editingBannerJurors.length]);

  // ── Modal handlers ──────────────────────────────────────────
  function openEditModal(juror) { setEditDrawerJuror(juror); setOpenMenuId(null); }
  async function handleSaveAddJuror({ name, affiliation, email }) {
    await jurorsHook.handleAddJuror({ juror_name: name, affiliation, email });
  }
  async function handleSaveEditJuror(jurorId, { name, affiliation, email }) {
    const result = await jurorsHook.handleEditJuror({ jurorId, juror_name: name, affiliation, email });
    if (!result?.ok) throw new Error(result?.message || "Failed to update juror.");
  }
  const handleEnableEditMode = async ({ reason, durationMinutes }) => {
    const jurorId = editModeJuror?.juror_id || editModeJuror?.jurorId;
    const result = await jurorsHook.handleToggleJurorEdit({ jurorId, enabled: true, reason, durationMinutes });
    if (!result?.ok) throw new Error(result?.message || "Failed to enable editing mode.");
    setEditModeJuror(null);
  };
  function openPinResetModal(juror) { setPinResetJuror(juror); setOpenMenuId(null); }
  async function handleResetPin() {
    if (!pinResetJuror) return;
    const juror = pinResetJuror;
    setPinResetJuror(null);
    await jurorsHook.resetPinForJuror(juror);
  }
  async function handleSendPinEmail({ email, includeQr }) {
    const info = jurorsHook.resetPinInfo;
    const target = jurorsHook.pinResetTarget;
    if (!info?.pin_plain_once || !email) return;
    let tokenUrl;
    if (includeQr) {
      const pid = selectedPeriodId || periods.viewPeriodId;
      if (pid) {
        const plain = await getActiveEntryTokenPlain(pid);
        if (plain) tokenUrl = `${window.location.origin}${isDemoMode ? "/demo" : ""}/eval?t=${encodeURIComponent(plain)}`;
      }
    }
    await sendJurorPinEmail({
      recipientEmail: email,
      jurorName: target?.juryName || target?.juror_name || info?.juror_name || "",
      jurorAffiliation: target?.affiliation || info?.affiliation || "",
      organizationName: activeOrganization?.name || "",
      organizationId: activeOrganization?.id || undefined,
      jurorId: target?.jurorId || target?.juror_id || undefined,
      pin: info.pin_plain_once,
      tokenUrl,
      periodName: periods.viewPeriodLabel,
    });
  }
  function openRemoveModal(juror) { setRemoveJuror(juror); setOpenMenuId(null); }
  async function handleRemoveJuror() {
    if (!removeJuror) return;
    try {
      await jurorsHook.handleDeleteJuror(removeJuror.juror_id || removeJuror.jurorId);
      setRemoveJuror(null);
    } catch (e) {
      _toast.error("Failed to remove juror");
    }
  }

  return (
    <div id="page-jurors">
      {/* Editing mode banners */}
      {editingBannerJurors.map((j) => (
        <div key={j.jurorId || j.juror_id} className="fb-banner fbb-editing">
          <SquarePen size={16} />
          <span className="fb-banner-text">
            Editing enabled for <strong>{j.juryName || j.juror_name}</strong> — changes will overwrite existing scores
            {formatEditWindowText(j, editWindowNowMs)}
          </span>
          <button
            className="fb-banner-action"
            style={{ color: "var(--fb-editing-text)", background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
            onClick={() => jurorsHook.handleForceCloseJurorEdit({ jurorId: j.jurorId || j.juror_id })}
          >
            <span className="fb-action-line">Disable</span>
            <span className="fb-action-line">editing →</span>
          </button>
        </div>
      ))}
      {/* Header */}
      <div className="jurors-page-header">
        <div className="jurors-page-header-top">
          <div className="jurors-page-header-left">
            <div className="page-title">Jurors</div>
            <div className="page-desc">Manage juror assignments, progress, access, and scoring activity across the live term.</div>
          </div>
          <div className="sem-header-actions mobile-toolbar-stack">
            <div className="admin-search-wrap mobile-toolbar-search">
              <Search size={14} strokeWidth={2} style={{ opacity: 0.45 }} />
              <input
                className="search-input"
                type="text"
                placeholder="Search jurors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <FilterButton
              className="mobile-toolbar-filter"
              activeCount={activeFilterCount}
              isOpen={filterOpen}
              onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}
            />
            <button className="btn btn-outline btn-sm mobile-toolbar-export" onClick={() => { setExportOpen((v) => !v); setFilterOpen(false); }}>
              <Download size={14} strokeWidth={2} style={{ verticalAlign: "-1px" }} />
              {" "}Export
            </button>
            <button className="btn btn-outline btn-sm mobile-toolbar-secondary" onClick={() => setImportOpen(true)}>
              <Upload size={14} strokeWidth={2} style={{ verticalAlign: "-1px" }} />
              {" "}Import
            </button>
            <PremiumTooltip text={graceLockTooltip}>
              <button
                className="btn btn-primary btn-sm mobile-toolbar-primary"
                onClick={() => setAddDrawerOpen(true)}
                disabled={isGraceLocked}
                data-testid="jurors-create-btn"
              >
                <Plus size={13} strokeWidth={2.2} />
                Add Juror
              </button>
            </PremiumTooltip>
          </div>
        </div>
      </div>
      {/* KPI strip */}
      <div className="scores-kpi-strip">
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">
            <span className={completionPct === 100 ? "success" : completionPct >= 50 ? "accent" : "warning"}>{completionPct}%</span>
          </div>
          <div className="scores-kpi-item-label">Completion Rate</div>
          <div className="scores-kpi-item-sub"><span className="sub-muted">{completedJurors}/{totalJurors} jurors</span></div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{avgEvalPerProject}</div>
          <div className="scores-kpi-item-label">Avg Evals / Project</div>
          <div className="scores-kpi-item-sub"><span className="sub-muted">{kpiUniqueProjects > 0 ? `across ${kpiUniqueProjects} projects` : "no data yet"}</span></div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">
            {avgScore !== "—" ? (
              <span className="accent">{avgScore}<span className="vera-score-denom">/{periodMaxScore ?? 100}</span></span>
            ) : "—"}
          </div>
          <div className="scores-kpi-item-label">Avg Score</div>
          <div className="scores-kpi-item-sub"><span className="sub-muted">{kpiScoredSheets.length > 0 ? `${kpiScoredSheets.length} submissions` : "no submissions yet"}</span></div>
        </div>
        <div className="scores-kpi-item">
          <div className={`scores-kpi-item-value${notStartedJurors > 0 ? " warning" : ""}`}>{notStartedJurors}</div>
          <div className="scores-kpi-item-label">Not Started</div>
          <div className="scores-kpi-item-sub">
            {notStartedJurors > 0
              ? <span className="sub-warn">needs attention</span>
              : <span className="sub-success">all active</span>}
          </div>
        </div>
      </div>
      <PremiumTooltip text={graceLockTooltip}>
        <button
          className="btn btn-primary btn-sm mobile-primary-below-kpi"
          onClick={() => setAddDrawerOpen(true)}
          disabled={isGraceLocked}
        >
          <Plus size={13} strokeWidth={2.2} />
          Add Juror
        </button>
      </PremiumTooltip>
      {/* Lock banner */}
      {isPeriodLocked && periods.viewPeriodId && (
        <div className="lock-notice">
          <div className="lock-notice-left">
            <div className="lock-notice-icon-wrap">
              <LockKeyhole size={20} strokeWidth={1.8} />
            </div>
            <div className="lock-notice-badge">locked</div>
          </div>
          <div className="lock-notice-body">
            <div className="lock-notice-title">Evaluation in progress — juror list locked</div>
            <div className="lock-notice-desc">
              Jurors can still be added or imported. Editing and removing existing jurors is disabled while scores exist for this period.
            </div>
            <div className="lock-notice-chips">
              <span className="lock-notice-chip editable"><ClipboardList size={11} strokeWidth={2} /> View Scores</span>
              <span className="lock-notice-chip editable"><KeyRound size={11} strokeWidth={2} /> Reset PIN</span>
              <span className="lock-notice-chip editable"><Bell size={11} strokeWidth={2} /> Notify Juror</span>
              <span className="lock-notice-chip editable"><RotateCcw size={11} strokeWidth={2} /> Reopen Evaluation</span>
              <span className="lock-notice-chip editable"><Plus size={11} strokeWidth={2} /> Add Jurors</span>
              <span className="lock-notice-chip editable"><Upload size={11} strokeWidth={2} /> Import CSV</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Edit Jurors</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Delete Jurors</span>
            </div>
          </div>
        </div>
      )}
      {/* Filter panel */}
      {filterOpen && (
        <JurorsFilterPanel
          affiliations={affiliations}
          statusFilter={statusFilter}
          affilFilter={affilFilter}
          progressFilter={progressFilter}
          onStatusChange={setStatusFilter}
          onAffilChange={setAffilFilter}
          onProgressChange={setProgressFilter}
          onClearAll={clearFilters}
          onClose={() => setFilterOpen(false)}
        />
      )}
      {/* Export panel */}
      {exportOpen && (
        <ExportPanel
          title="Export Jurors"
          subtitle="Download the juror roster with status, affiliation, and scoring progress."
          meta={`${periods.viewPeriodLabel} · ${totalJurors} jurors`}
          periodName={periods.viewPeriodLabel}
          organization={activeOrganization?.name || ""}
          department=""
          onClose={() => setExportOpen(false)}
          generateFile={async (fmt) => {
            const header = JUROR_COLUMNS.map((c) => c.label);
            const rows = sortedFilteredList.map((j) => JUROR_COLUMNS.map((c) => getJurorCell(j, c.key, jurorAvgMap)));
            return generateTableBlob(fmt, {
              filenameType: "Jurors", sheetName: "Jurors",
              periodName: periods.viewPeriodLabel, tenantCode: activeOrganization?.code || "",
              organization: activeOrganization?.name || "", department: "",
              pdfTitle: "VERA — Jurors", header, rows,
              colWidths: JUROR_COLUMNS.map((c) => c.exportWidth),
            });
          }}
          onExport={async (fmt) => {
            try {
              const header = JUROR_COLUMNS.map((c) => c.label);
              const rows = sortedFilteredList.map((j) => JUROR_COLUMNS.map((c) => getJurorCell(j, c.key, jurorAvgMap)));
              logExportInitiated({
                action: "export.jurors",
                organizationId: activeOrganization?.id || null,
                resourceType: "jurors",
                details: {
                  format: fmt,
                  row_count: rows.length,
                  period_name: periods.viewPeriodLabel || null,
                  project_count: null,
                  juror_count: rows.length,
                  filters: { search: search || null, status: statusFilter || null, affiliation: affilFilter || null },
                },
              }).catch((err) => {
                console.warn("[export] audit log failed:", err);
              });
              await downloadTable(fmt, {
                filenameType: "Jurors", sheetName: "Jurors",
                periodName: periods.viewPeriodLabel, tenantCode: activeOrganization?.code || "",
                organization: activeOrganization?.name || "", department: "",
                pdfTitle: "VERA — Jurors", header, rows,
                colWidths: JUROR_COLUMNS.map((c) => c.exportWidth),
              });
              const fmtLabel = fmt === "pdf" ? "PDF" : fmt === "csv" ? "CSV" : "Excel";
              _toast.success(`${filteredList.length} juror${filteredList.length !== 1 ? "s" : ""} exported · ${fmtLabel}`);
            } catch (e) {
              _toast.error("Jurors export failed — try again");
            }
          }}
        />
      )}
      {/* Error */}
      {panelError && (
        <FbAlert variant="danger" style={{ marginBottom: "12px" }}>{panelError}</FbAlert>
      )}
      {/* Table */}
      <JurorsTable
        pagedList={pagedList}
        loadingCount={loadingCount}
        filteredList={filteredList}
        jurorList={jurorList}
        periodMaxScore={periodMaxScore}
        jurorAvgMap={jurorAvgMap}
        editWindowNowMs={editWindowNowMs}
        sortKey={sortKey}
        sortDir={sortDir}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        rowsScopeRef={rowsScopeRef}
        shouldUseCardLayout={shouldUseCardLayout}
        isGraceLocked={isGraceLocked}
        graceLockTooltip={graceLockTooltip}
        isPeriodLocked={isPeriodLocked}
        activeFilterCount={activeFilterCount}
        search={search}
        onSort={handleSort}
        onEdit={openEditModal}
        onPinReset={openPinResetModal}
        onRemove={openRemoveModal}
        onEnableEdit={setEditModeJuror}
        onViewScores={setScoresJuror}
        onNotify={jurorsHook.handleNotifyJuror}
        onClearSearch={() => setSearch("")}
        onClearFilters={clearFilters}
        onAddJuror={() => setAddDrawerOpen(true)}
        onImport={() => setImportOpen(true)}
        onNavigatePeriods={() => onNavigate?.("periods")}
        viewPeriodId={periods.viewPeriodId}
        periodList={periods.periodList}
      />
      {/* Pagination */}
      <Pagination
        currentPage={safePage}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={filteredList.length}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
        itemLabel="jurors"
      />
      {/* Modals */}
      <AddJurorDrawer
        open={addDrawerOpen}
        onClose={() => setAddDrawerOpen(false)}
        onSave={handleSaveAddJuror}
        periodName={periods.viewPeriodLabel}
      />
      <EditJurorDrawer
        open={!!editDrawerJuror}
        onClose={() => setEditDrawerJuror(null)}
        juror={editDrawerJuror ? {
          id: editDrawerJuror.juror_id || editDrawerJuror.jurorId,
          name: editDrawerJuror.juror_name || editDrawerJuror.juryName || "",
          affiliation: editDrawerJuror.affiliation || "",
          email: editDrawerJuror.email || "",
          progress: {
            scored: editDrawerJuror.overviewScoredProjects ?? 0,
            total: editDrawerJuror.overviewTotalProjects ?? 0,
          },
          lastActive: editDrawerJuror.lastSeenAt || editDrawerJuror.last_activity_at,
          overviewStatus: editDrawerJuror.overviewStatus,
        } : null}
        onSave={handleSaveEditJuror}
        onResetPin={() => { setEditDrawerJuror(null); setPinResetJuror(editDrawerJuror); }}
        onRemove={() => { setEditDrawerJuror(null); setRemoveJuror(editDrawerJuror); }}
      />
      <ResetPinModal
        open={!!pinResetJuror && !jurorsHook.resetPinInfo}
        onClose={() => setPinResetJuror(null)}
        juror={pinResetJuror ? {
          name: pinResetJuror.juryName || pinResetJuror.juror_name || "",
          affiliation: pinResetJuror.affiliation || "",
        } : null}
        onConfirm={handleResetPin}
      />
      <PinResultModal
        open={!!jurorsHook.resetPinInfo}
        onClose={jurorsHook.closeResetPinDialog}
        juror={jurorsHook.pinResetTarget ? {
          name: jurorsHook.pinResetTarget.juryName || jurorsHook.pinResetTarget.juror_name || "",
          affiliation: jurorsHook.pinResetTarget.affiliation || "",
          email: jurorsHook.pinResetTarget.email || "",
        } : null}
        newPin={jurorsHook.resetPinInfo?.pin_plain_once}
        onSendEmail={handleSendPinEmail}
      />
      <RemoveJurorModal
        open={!!removeJuror}
        onClose={() => setRemoveJuror(null)}
        juror={removeJuror ? {
          name: removeJuror.juryName || removeJuror.juror_name || "",
          affiliation: removeJuror.affiliation || "",
        } : null}
        impact={{
          scores: removeJuror?.overviewScoredProjects ?? 0,
          groupsAffected: removeJuror?.overviewScoredProjects ?? 0,
          avgScore: removeJuror
            ? (jurorAvgMap.get(String(removeJuror.juror_id || removeJuror.jurorId || "")) ?? "—")
            : "—",
        }}
        periodName={periods.viewPeriodLabel}
        onRemove={handleRemoveJuror}
      />
      <EnableEditingModal
        open={!!editModeJuror}
        onClose={() => setEditModeJuror(null)}
        juror={editModeJuror ? {
          name: editModeJuror.juryName || editModeJuror.juror_name || "",
          affiliation: editModeJuror.affiliation || "",
        } : null}
        onEnable={handleEnableEditMode}
      />
      <JurorScoresDrawer
        open={!!scoresJuror}
        onClose={() => setScoresJuror(null)}
        juror={scoresJuror}
        periodId={periods.viewPeriodId}
        periodLabel={periods.viewPeriodLabel}
        scoreRows={jurorsHook.scoreRows}
        projects={projectsHook.projects}
        onOpenReviews={() => { setScoresJuror(null); onViewReviews?.(scoresJuror); }}
      />
      <ImportJurorsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        parseFile={(f) => parseJurorsCsv(f, jurorsHook.jurors)}
        onImport={async (rows) => {
          const result = await jurorsHook.handleImportJurors(rows);
          if (result?.ok === false) throw new Error(result.formError || "Import failed.");
          return result;
        }}
      />
    </div>
  );
}
