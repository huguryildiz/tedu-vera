// src/admin/features/periods/PeriodsPage.jsx
// Evaluation Periods management page.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { useToast } from "@/shared/hooks/useToast";
import { useAuth } from "@/auth";
import { useManagePeriods } from "./useManagePeriods";
import ExportPanel from "@/admin/shared/ExportPanel";
import { downloadTable, generateTableBlob } from "@/admin/utils/downloadTable";
import FbAlert from "@/shared/ui/FbAlert";
import AddEditPeriodDrawer from "./AddEditPeriodDrawer";
import { FilterButton } from "@/shared/ui/FilterButton.jsx";
import useCardSelection from "@/shared/hooks/useCardSelection";
import {
  setEvalLock,
  deletePeriod,
  listPeriodStats,
  requestPeriodUnlock,
  listUnlockRequests,
  checkPeriodReadiness,
  publishPeriod,
  closePeriod,
  generateEntryToken,
  getActiveEntryTokenPlain,
  logExportInitiated,
} from "@/shared/api";
import {
  Download,
  Plus,
  Search,
} from "lucide-react";
import RevertToDraftModal from "./RevertToDraftModal";
import RequestRevertModal from "./RequestRevertModal";
import PublishPeriodModal from "./PublishPeriodModal";
import ClosePeriodModal from "./ClosePeriodModal";
import DeletePeriodModal from "./DeletePeriodModal";
import Pagination from "@/shared/ui/Pagination";
import { formatDateTime as formatFull } from "@/shared/lib/dateUtils";
import {
  setRawToken as storageSetRawToken,
  clearRawToken as storageClearRawToken,
  getRawToken as storageGetRawToken,
} from "@/shared/storage/adminStorage";
import LifecycleBar from "./components/LifecycleBar";
import LifecycleGuide from "./components/LifecycleGuide";
import PeriodsTable from "./components/PeriodsTable";
import PeriodsFilterPanel from "./components/PeriodsFilterPanel";
import { getPeriodState } from "./components/periodHelpers";
import "./styles/index.css";
import "@/admin/features/setup-wizard/styles/index.css";

export default function PeriodsPage() {
  const {
    organizationId,
    selectedPeriodId,
    frameworks = [],
    isDemoMode = false,
    onCurrentPeriodChange,
    onNavigate,
    bgRefresh,
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

  const [periodStats, setPeriodStats] = useState({});
  // Readiness state — map of period_id → { ok, issues, counts } for Draft rows.
  // Populated after periodList loads; refreshed when stats reload (proxy for
  // underlying criteria/project changes). Locked periods don't need readiness.
  const [periodReadiness, setPeriodReadiness] = useState({});

  const [filterOpen, setFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [criteriaFilter, setCriteriaFilter] = useState("all");
  const [setupFilter, setSetupFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("start_date");
  const [sortDir, setSortDir] = useState("desc");

  const activeFilterCount = [statusFilter, dateRangeFilter, outcomeFilter, progressFilter, criteriaFilter, setupFilter].filter((v) => v !== "all").length;

  function clearAllFilters() {
    setStatusFilter("all");
    setDateRangeFilter("all");
    setOutcomeFilter("all");
    setProgressFilter("all");
    setCriteriaFilter("all");
    setSetupFilter("all");
  }

  const [deletePeriodTarget, setDeletePeriodTarget] = useState(null);
  const [revertTarget, setRevertTarget] = useState(null);
  const [requestRevertTarget, setRequestRevertTarget] = useState(null);
  const [pendingRequests, setPendingRequests] = useState({});
  const [publishTarget, setPublishTarget] = useState(null);
  const [closeTarget, setCloseTarget] = useState(null);
  const [periodDrawerOpen, setPeriodDrawerOpen] = useState(false);
  const [periodDrawerTarget, setPeriodDrawerTarget] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    incLoading();
    periods.loadPeriods()
      .catch(() => setPanelError("period", "Could not load periods."))
      .finally(() => decLoading());
  }, [periods.loadPeriods]);


  const periodList = periods.periodList || [];

  useEffect(() => {
    if (!organizationId) return;
    listPeriodStats(organizationId)
      .then(setPeriodStats)
      .catch(() => {}); // Non-fatal — columns show "—" on failure
  }, [organizationId, periodList.length]);

  // Load readiness for all Draft (not-yet-locked) periods. Locked periods
  // already passed readiness, so we skip them. Runs alongside stats reloads
  // to catch criteria/project edits that may have shifted readiness.
  useEffect(() => {
    const draftIds = periodList.filter((p) => !p.is_locked).map((p) => p.id);
    if (draftIds.length === 0) {
      setPeriodReadiness({});
      return;
    }
    let cancelled = false;
    Promise.all(
      draftIds.map((id) =>
        checkPeriodReadiness(id).then((r) => [id, r]).catch(() => [id, null])
      )
    ).then((pairs) => {
      if (cancelled) return;
      const next = {};
      for (const [id, r] of pairs) if (r) next[id] = r;
      setPeriodReadiness(next);
    });
    return () => { cancelled = true; };
  }, [periodList.map((p) => `${p.id}:${p.is_locked}:${p.closed_at ?? ""}`).sort().join(","), periodStats]);

  const reloadPendingRequests = useCallback(async () => {
    try {
      const rows = await listUnlockRequests("pending");
      const map = {};
      for (const r of rows || []) {
        if (r?.period_id) map[r.period_id] = r;
      }
      setPendingRequests(map);
    } catch {
      // Non-fatal — direct unlock still attempts and server guard enforces correctness
    }
  }, []);

  useEffect(() => {
    reloadPendingRequests();
  }, [reloadPendingRequests, periodList.length]);

  const totalPeriods = periodList.length;
  const draftPeriods = periodList.filter((p) => !p.is_locked).length;
  const publishedPeriods = periodList.filter((p) => p.is_locked && !p.closed_at && !(periodStats[p.id]?.hasScores)).length;
  const livePeriods = periodList.filter((p) => p.is_locked && !p.closed_at && periodStats[p.id]?.hasScores).length;
  const closedPeriods = periodList.filter((p) => !!p.closed_at).length;

  // Helper to pull the canonical state label for a period inside filter/sort
  // callbacks. Filter maps "draft" → both draft_ready and draft_incomplete.
  const getState = useCallback((p) => getPeriodState(
    p,
    !!periodStats[p.id]?.hasScores,
    periodReadiness[p.id]
  ), [periodStats, periodReadiness]);

  const filteredList = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const q = search.trim().toLowerCase();
    return periodList.filter((p) => {
      const state = getState(p);
      const stats = periodStats[p.id] || {};

      if (q) {
        const name = String(p.name || "").toLowerCase();
        if (!name.includes(q)) return false;
      }

      if (statusFilter !== "all") {
        if (statusFilter === "draft" && state !== "draft_ready" && state !== "draft_incomplete") return false;
        if (statusFilter !== "draft" && state !== statusFilter) return false;
      }

      if (dateRangeFilter !== "all") {
        const start = p.start_date ? new Date(p.start_date) : null;
        const end = p.end_date ? new Date(p.end_date) : null;
        if (dateRangeFilter === "this_year") {
          const inYear = (start && start.getFullYear() === currentYear) || (end && end.getFullYear() === currentYear);
          if (!inYear) return false;
        } else if (dateRangeFilter === "past") {
          if (!end || end >= now) return false;
        } else if (dateRangeFilter === "future") {
          if (!start || start <= now) return false;
        }
      }

      if (outcomeFilter !== "all") {
        if (outcomeFilter === "not_set" && p.framework_id) return false;
        if (outcomeFilter !== "not_set" && p.framework_id !== outcomeFilter) return false;
      }

      if (progressFilter !== "all") {
        const progress = stats.progress ?? null;
        const isClosed = !!p.closed_at;
        if (progressFilter === "not_started" && (stats.hasScores && progress > 0)) return false;
        if (progressFilter === "in_progress" && (!stats.hasScores || progress === null || progress >= 100 || isClosed)) return false;
        if (progressFilter === "complete" && !isClosed && (progress === null || progress < 100)) return false;
      }

      if (criteriaFilter !== "all") {
        const count = stats.criteriaCount ?? 0;
        if (criteriaFilter === "has" && count === 0) return false;
        if (criteriaFilter === "none" && count > 0) return false;
      }

      if (setupFilter !== "all") {
        if (setupFilter === "no_projects" && (stats.projectCount ?? 0) > 0) return false;
        if (setupFilter === "no_jurors" && (stats.jurorCount ?? 0) > 0) return false;
      }

      return true;
    });
  }, [periodList, search, statusFilter, dateRangeFilter, outcomeFilter, progressFilter, criteriaFilter, setupFilter, periodStats, periodReadiness, getState]);

  const sortedFilteredList = useMemo(() => {
    const statusRank = { draft_incomplete: 1, draft_ready: 2, published: 3, live: 4, closed: 5 };
    const rows = [...filteredList];
    rows.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;
      const aName = String(a.name || "");
      const bName = String(b.name || "");
      let cmp = 0;
      if (sortKey === "name") {
        cmp = aName.localeCompare(bName, "tr", { sensitivity: "base", numeric: true });
      } else if (sortKey === "status") {
        cmp = (statusRank[getState(a)] || 0) - (statusRank[getState(b)] || 0);
      } else if (sortKey === "start_date") {
        const aTs = Date.parse(a.start_date || "");
        const bTs = Date.parse(b.start_date || "");
        const aValue = Number.isFinite(aTs) ? aTs : Number.NEGATIVE_INFINITY;
        const bValue = Number.isFinite(bTs) ? bTs : Number.NEGATIVE_INFINITY;
        cmp = aValue - bValue;
      } else if (sortKey === "updated_at") {
        const aTs = Date.parse(a.updated_at || "");
        const bTs = Date.parse(b.updated_at || "");
        const aValue = Number.isFinite(aTs) ? aTs : Number.NEGATIVE_INFINITY;
        const bValue = Number.isFinite(bTs) ? bTs : Number.NEGATIVE_INFINITY;
        cmp = aValue - bValue;
      }
      if (cmp !== 0) return cmp * direction;
      return aName.localeCompare(bName, "tr", { sensitivity: "base", numeric: true });
    });
    return rows;
  }, [filteredList, sortKey, sortDir, getState]);

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  useEffect(() => { setCurrentPage(1); }, [filteredList]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
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


  function openAddDrawer() {
    setPeriodDrawerTarget(null);
    setPeriodDrawerOpen(true);
  }

  function openEditDrawer(period) {
    setPeriodDrawerTarget(period);
    setPeriodDrawerOpen(true);
    setOpenMenuId(null);
  }

  async function handlePublishPeriod() {
    if (!publishTarget) return;
    const target = publishTarget;
    const result = await publishPeriod(target.id);
    if (result && result.ok === false) {
      if (result.error_code === "readiness_failed") {
        _toast.error(`${target.name || "Period"} is not ready to publish. Review the readiness panel.`);
      } else {
        _toast.error(`Could not publish ${target.name || "period"}.`);
      }
      throw new Error(result.error_code || "publish_failed");
    }
    periods.applyPeriodPatch({
      id: target.id,
      is_locked: true,
      activated_at: result?.activated_at || new Date().toISOString(),
    });
    setPeriodReadiness((prev) => {
      const next = { ...prev };
      delete next[target.id];
      return next;
    });

    // Auto-generate a QR entry token on first publish so the admin doesn't
    // have to make a second trip to Entry Control. If publish was a no-op
    // (already published) we skip this — the existing token is still valid.
    // Critical: the freshly-issued plaintext must be persisted to storage
    // using the same key Entry Control reads from, otherwise Entry Control
    // will show the QR of a stale/revoked token left over from a previous
    // run and jurors will scan an invalid code.
    let tokenToastSuffix = "";
    if (!result?.already_published) {
      storageClearRawToken(target.id);
      try {
        const freshToken = await generateEntryToken(target.id);
        if (freshToken) storageSetRawToken(target.id, freshToken);
        tokenToastSuffix = " QR ready.";
      } catch {
        tokenToastSuffix = " (Generate QR manually.)";
      }
    }

    _toast.success(
      result?.already_published
        ? `${target.name || "Period"} was already published.`
        : `${target.name || "Period"} published.${tokenToastSuffix}`
    );
    setPublishTarget(null);
  }

  async function handleCopyEntryLink(period) {
    try {
      const token = storageGetRawToken(period.id) || await getActiveEntryTokenPlain(period.id);
      if (!token) {
        _toast.error("No active QR token. Open Entry Control to generate one.");
        return;
      }
      const basePath = isDemoMode ? "/demo" : "";
      const url = `${window.location.origin}${basePath}/eval?t=${encodeURIComponent(token)}`;
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch { /* noop */ }
        document.body.removeChild(ta);
      }
      _toast.success("Entry link copied to clipboard.");
    } catch {
      _toast.error("Could not copy entry link. Try Entry Control.");
    }
  }

  async function handleRevertPeriod() {
    if (!revertTarget) return;
    const target = revertTarget;
    // Underlying RPC remains rpc_admin_set_period_lock (wrapped by
    // setEvalLock). Server rejects when scores exist, prompting the
    // request-revert flow.
    const result = await setEvalLock(target.id, false);
    if (result && result.ok === false) {
      if (result.error_code === "cannot_unlock_period_has_scores") {
        setRevertTarget(null);
        setRequestRevertTarget(target);
        return;
      }
      _toast.error(`Could not revert ${target.name || "period"}.`);
      setRevertTarget(null);
      return;
    }
    periods.applyPeriodPatch({ id: target.id, is_locked: false, closed_at: null });
    // Server-side RPCs revoke entry_tokens on revert; mirror that on the
    // client so Entry Control doesn't display a stale plaintext QR.
    storageClearRawToken(target.id);
    _toast.success(`${target.name || "Period"} reverted to Draft — structural editing re-enabled.`);
    setRevertTarget(null);
  }

  async function handleRequestRevert(reason) {
    if (!requestRevertTarget) return { ok: false };
    const result = await requestPeriodUnlock(requestRevertTarget.id, reason);
    if (result?.ok) {
      _toast.success(`Revert request submitted for ${requestRevertTarget.name || "period"}.`);
      reloadPendingRequests();
    }
    return result;
  }

  async function handleClosePeriodAction() {
    if (!closeTarget) return;
    const target = closeTarget;
    const result = await closePeriod(target.id);
    if (result && result.ok === false) {
      if (result.error_code === "period_not_published") {
        _toast.error("Publish the period before closing it.");
      } else {
        _toast.error(`Could not close ${target.name || "period"}.`);
      }
      throw new Error(result.error_code || "close_failed");
    }
    periods.applyPeriodPatch({
      id: target.id,
      closed_at: result?.closed_at || new Date().toISOString(),
    });
    _toast.success(
      result?.already_closed
        ? `${target.name || "Period"} was already closed.`
        : `${target.name || "Period"} closed — rankings archived.`
    );
    setCloseTarget(null);
  }

  async function handleDeletePeriodViaModal() {
    if (!deletePeriodTarget) return;
    await deletePeriod(deletePeriodTarget.id);
    periods.removePeriod(deletePeriodTarget.id);
    _toast.success(`${deletePeriodTarget.name || "Period"} deleted.`);
    setDeletePeriodTarget(null);
  }

  function refreshReadinessFor(periodId) {
    if (!periodId) return;
    checkPeriodReadiness(periodId)
      .then((r) => {
        if (r) setPeriodReadiness((prev) => ({ ...prev, [periodId]: r }));
      })
      .catch(() => {});
  }

  async function handleSavePeriod(data) {
    if (periodDrawerTarget) {
      const result = await periods.handleUpdatePeriod({
        id: periodDrawerTarget.id,
        name: data.name,
        description: data.description,
        start_date: data.start_date,
        end_date: data.end_date,
      });
      if (result && !result.ok && result.fieldErrors?.name) {
        throw new Error(result.fieldErrors.name);
      }
      refreshReadinessFor(periodDrawerTarget.id);
    } else {
      const result = await periods.handleCreatePeriod({
        name: data.name,
        description: data.description,
        start_date: data.start_date,
        end_date: data.end_date,
      });
      if (result && !result.ok && result.fieldErrors?.name) {
        throw new Error(result.fieldErrors.name);
      }
      if (result?.id) refreshReadinessFor(result.id);
    }
  }

  const rowHandlers = useMemo(() => ({
    onEdit: openEditDrawer,
    onDuplicate: periods.handleDuplicatePeriod,
    onCopyEntryLink: handleCopyEntryLink,
    onClose: (period) => setCloseTarget(period),
    onRevert: (period) => setRevertTarget(period),
    onPublish: (period) => setPublishTarget(period),
    onDelete: (period) => setDeletePeriodTarget(period),
  }), [periods.handleDuplicatePeriod]);

  function buildExportRows() {
    return sortedFilteredList.map((p) => {
      const st = periodStats[p.id] || {};
      const fw = frameworks.find((f) => f.id === p.framework_id);
      const isDraft = !p.is_locked;
      const pct = isDraft ? null : (st.progress ?? (p.closed_at ? 100 : null));
      const criteriaCount = st.criteriaCount ?? 0;
      return [
        p.name ?? "",
        getState(p),
        p.start_date && p.end_date ? `${p.start_date} – ${p.end_date}` : (p.start_date ?? p.end_date ?? "—"),
        pct !== null ? `${pct}%` : "—",
        st.projectCount ?? "",
        st.jurorCount ?? "",
        p.criteria_name || (criteriaCount > 0 ? `${criteriaCount} criteria` : "Not set"),
        fw?.name ?? "Not set",
        formatFull(p.updated_at),
      ];
    });
  }

  const exportHeader = ["Period", "Status", "Date Range", "Progress", "Projects", "Jurors", "Criteria Set", "Outcome Set", "Updated At"];
  const exportColWidths = [24, 12, 22, 12, 10, 10, 16, 16, 16];

  return (
    <div className="periods-page">
      {/* Page header */}
      <div className="sem-header">
        <div className="sem-header-left">
          <div className="page-title">Evaluation Periods</div>
          <div className="page-desc">Manage evaluation periods, active sessions, and locked historical records.</div>
        </div>
        <div className="sem-header-actions mobile-toolbar-stack">
          <div className="admin-search-wrap mobile-toolbar-search">
            <Search size={14} strokeWidth={2} style={{ opacity: 0.45 }} />
            <input
              className="search-input"
              type="text"
              placeholder="Search periods..."
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
          <button className="btn btn-primary btn-sm mobile-toolbar-primary" onClick={openAddDrawer} data-testid="periods-add-btn">
            <Plus size={13} strokeWidth={2.2} />
            Add Period
          </button>
        </div>
      </div>
      {filterOpen && (
        <PeriodsFilterPanel
          onClose={() => setFilterOpen(false)}
          frameworks={frameworks}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          dateRangeFilter={dateRangeFilter}
          setDateRangeFilter={setDateRangeFilter}
          progressFilter={progressFilter}
          setProgressFilter={setProgressFilter}
          criteriaFilter={criteriaFilter}
          setCriteriaFilter={setCriteriaFilter}
          outcomeFilter={outcomeFilter}
          setOutcomeFilter={setOutcomeFilter}
          setupFilter={setupFilter}
          setSetupFilter={setSetupFilter}
          onClearAll={clearAllFilters}
        />
      )}
      {/* Export panel */}
      {exportOpen && (
        <ExportPanel
          title="Export Periods"
          subtitle="Download period records with project counts, juror counts, and status history."
          meta={`${totalPeriods} periods · All records`}
          organization={activeOrganization?.name || ""}
          department=""
          onClose={() => setExportOpen(false)}
          generateFile={async (fmt) => {
            return generateTableBlob(fmt, {
              filenameType: "Periods", sheetName: "Evaluation Periods", periodName: "",
              tenantCode: activeOrganization?.code || "", organization: activeOrganization?.name || "",
              department: "", pdfTitle: "VERA — Evaluation Periods",
              header: exportHeader, rows: buildExportRows(), colWidths: exportColWidths,
            });
          }}
          onExport={async (fmt) => {
            try {
              const rows = buildExportRows();
              logExportInitiated({
                action: "export.periods",
                organizationId: activeOrganization?.id || null,
                resourceType: "periods",
                details: {
                  format: fmt,
                  row_count: rows.length,
                  period_name: null,
                  project_count: null,
                  juror_count: null,
                  filters: {
                    search: search || null,
                    status: statusFilter !== "all" ? statusFilter : null,
                    date_range: dateRangeFilter !== "all" ? dateRangeFilter : null,
                    outcome: outcomeFilter !== "all" ? outcomeFilter : null,
                    progress: progressFilter !== "all" ? progressFilter : null,
                    criteria: criteriaFilter !== "all" ? criteriaFilter : null,
                    setup: setupFilter !== "all" ? setupFilter : null,
                  },
                },
              }).catch((err) => {
                console.warn("[export] audit log failed:", err);
              });
              await downloadTable(fmt, {
                filenameType: "Periods", sheetName: "Evaluation Periods", periodName: "",
                tenantCode: activeOrganization?.code || "", organization: activeOrganization?.name || "",
                department: "", pdfTitle: "VERA — Evaluation Periods",
                header: exportHeader, rows, colWidths: exportColWidths,
              });
              const fmtLabel = fmt === "pdf" ? "PDF" : fmt === "csv" ? "CSV" : "Excel";
              _toast.success(`${filteredList.length} period${filteredList.length !== 1 ? "s" : ""} exported · ${fmtLabel}`);
            } catch (e) {
              _toast.error(e?.message || "Periods export failed — please try again");
            }
          }}
        />
      )}
      {/* KPI strip */}
      <div className="scores-kpi-strip">
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value">{totalPeriods}</div>
          <div className="scores-kpi-item-label">Periods</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value" style={{ color: "#4f46e5" }}>{draftPeriods}</div>
          <div className="scores-kpi-item-label">Draft</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value" style={{ color: "#2563eb" }}>{publishedPeriods}</div>
          <div className="scores-kpi-item-label">Published</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value"><span className="success">{livePeriods}</span></div>
          <div className="scores-kpi-item-label">Live</div>
        </div>
        <div className="scores-kpi-item">
          <div className="scores-kpi-item-value" style={{ color: "#64748b" }}>{closedPeriods}</div>
          <div className="scores-kpi-item-label">Closed</div>
        </div>
      </div>
      <button className="btn btn-primary btn-sm mobile-primary-below-kpi" onClick={openAddDrawer}>
        <Plus size={13} strokeWidth={2.2} />
        Add Period
      </button>
      <LifecycleGuide />
      <LifecycleBar
        draft={draftPeriods}
        published={publishedPeriods}
        live={livePeriods}
        closed={closedPeriods}
      />
      {panelError && (
        <FbAlert variant="danger" style={{ marginBottom: "12px" }}>
          {panelError}
        </FbAlert>
      )}
      {/* Table */}
      <div className="periods-table-card">
        <div className="periods-table-card-header">
          <div className="periods-table-card-title">All Evaluation Periods</div>
        </div>
        <PeriodsTable
          rows={filteredList}
          pagedRows={pagedList}
          loadingCount={loadingCount}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          rowsScopeRef={rowsScopeRef}
          activeFilterCount={activeFilterCount}
          search={search}
          onClearSearch={() => setSearch("")}
          onClearFilters={clearAllFilters}
          onAddPeriod={openAddDrawer}
          onOpenSetup={() => onNavigate?.("setup")}
          stats={periodStats}
          readiness={periodReadiness}
          frameworks={frameworks}
          pendingRequests={pendingRequests}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          getState={getState}
          onCurrentPeriodChange={onCurrentPeriodChange}
          onNavigate={onNavigate}
          rowHandlers={rowHandlers}
        />
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredList.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          itemLabel="periods"
        />
      </div>
      <DeletePeriodModal
        open={!!deletePeriodTarget}
        onClose={() => setDeletePeriodTarget(null)}
        period={deletePeriodTarget}
        onDelete={handleDeletePeriodViaModal}
      />
      <RevertToDraftModal
        open={!!revertTarget}
        onClose={() => setRevertTarget(null)}
        period={revertTarget}
        onRevert={handleRevertPeriod}
      />
      <PublishPeriodModal
        open={!!publishTarget}
        onClose={() => setPublishTarget(null)}
        period={publishTarget}
        onPublish={handlePublishPeriod}
      />
      <ClosePeriodModal
        open={!!closeTarget}
        onClose={() => setCloseTarget(null)}
        period={closeTarget}
        onCloseAction={handleClosePeriodAction}
      />
      <RequestRevertModal
        open={!!requestRevertTarget}
        onClose={() => setRequestRevertTarget(null)}
        period={requestRevertTarget}
        onRequest={handleRequestRevert}
      />
      <AddEditPeriodDrawer
        open={periodDrawerOpen}
        onClose={() => setPeriodDrawerOpen(false)}
        period={periodDrawerTarget}
        onSave={handleSavePeriod}
        allPeriods={periodList}
      />
    </div>
  );
}
