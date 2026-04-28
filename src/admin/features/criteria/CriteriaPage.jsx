import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, LockKeyhole, Pencil, Plus } from "lucide-react";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { useToast } from "@/shared/hooks/useToast";
import { useManagePeriods } from "@/admin/features/periods/useManagePeriods";
import { usePeriodOutcomes } from "@/admin/shared/usePeriodOutcomes";
import FbAlert from "@/shared/ui/FbAlert";
import EditSingleCriterionDrawer from "./EditSingleCriterionDrawer";
import StarterCriteriaDrawer from "./StarterCriteriaDrawer";
import WeightBudgetBar from "./WeightBudgetBar";
import SaveBar from "./SaveBar";
import {
  rescaleRubricBandsByWeight,
  defaultRubricBands,
  nextCriterionColor,
} from "./criteriaFormHelpers";
import "./styles/index.css";
import { useAuth } from "@/auth";
import ExportPanel from "@/admin/shared/ExportPanel";
import { useCriteriaExport } from "./useCriteriaExport";
import CriteriaPageHeader from "./components/CriteriaPageHeader";
import CriteriaFilterPanel from "./components/CriteriaFilterPanel";
import {
  NoPeriodsEmpty,
  NoPeriodSelectedEmpty,
  NoCriteriaEmpty,
  PendingCriteriaPreview,
} from "./components/CriteriaEmptyStates";
import CriteriaTable from "./components/CriteriaTable";
import {
  ClearAllCriteriaModal,
  DeleteCriterionModal,
} from "./components/CriteriaConfirmModals";

export default function CriteriaPage() {
  const {
    organizationId,
    selectedPeriodId,
    onCurrentPeriodChange,
    onNavigate,
    loading: adminLoading,
    sortedPeriods: contextPeriods = [],
    bgRefresh,
  } = useAdminContext();
  const _toast = useToast();
  const setMessage = useCallback((msg) => { if (msg) _toast.success(msg); }, [_toast]);

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
    onCurrentPeriodChange,
    setPanelError,
    clearPanelError,
    bgRefresh,
  });

  useEffect(() => {
    incLoading();
    periods.loadPeriods()
      .catch(() => setPanelError("period", "Failed to load periods. Try refreshing."))
      .finally(() => decLoading());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periods.loadPeriods]);

  // Single-criterion editor state: null = closed, -1 = add new, >= 0 = edit index
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingInitialTab, setEditingInitialTab] = useState("details");
  const [starterDrawerOpen, setStarterDrawerOpen] = useState(false);
  const closeEditor = () => { setEditingIndex(null); setEditingInitialTab("details"); };
  const openEditor = (i, tab = "details") => { setEditingInitialTab(tab); setEditingIndex(i); };

  // Inline period rename
  const [periodRenaming, setPeriodRenaming] = useState(false);
  const [periodRenameVal, setPeriodRenameVal] = useState("");
  const [periodRenameSaving] = useState(false);
  const periodRenameInputRef = useRef(null);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [mappingFilter, setMappingFilter] = useState("all");
  const [rubricFilter, setRubricFilter] = useState("all");
  const activeFilterCount =
    (mappingFilter !== "all" ? 1 : 0) + (rubricFilter !== "all" ? 1 : 0);

  const [deleteIndex, setDeleteIndex] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearAllConfirmText, setClearAllConfirmText] = useState("");
  const [clearAllSubmitting] = useState(false);

  const [cloneLoading, setCloneLoading] = useState(false);
  const [showClonePicker, setShowClonePicker] = useState(false);
  const [startingBlank, setStartingBlank] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    setCurrentPage(1);
  }, [mappingFilter, rubricFilter, searchText]);

  const viewPeriod = periods.periodList.find((s) => s.id === periods.viewPeriodId);
  const draftCriteria = periods.draftCriteria || [];
  const outcomeConfig = periods.outcomeConfig || [];
  const isLocked = !!(viewPeriod?.is_locked);
  const [saving, setSaving] = useState(false);

  const { activeOrganization } = useAuth();
  const { generateFile: generateCriteriaFile, handleExport: handleCriteriaExport } = useCriteriaExport({
    criteria: draftCriteria,
    periodName: periods.viewPeriodLabel || "",
  });

  const po = usePeriodOutcomes({ periodId: periods.viewPeriodId });

  const pendingCriteriaName = periods.pendingCriteriaName;
  const effectiveCriteriaName =
    pendingCriteriaName !== undefined ? pendingCriteriaName : viewPeriod?.criteria_name;

  // Scratch mode: DB has criteria_name committed, or draft items exist. Pending-only
  // name (queued rename with no DB state yet) does NOT activate scratch mode — that's
  // represented by pendingCriteriaPreview showing the "ready to apply" banner instead.
  // A pending clear-all forces the empty state back so the user can pick a new start.
  const scratchMode =
    !periods.pendingClearAll &&
    (!!viewPeriod?.criteria_name || draftCriteria.length > 0);

  const pendingCriteriaPreview = periods.pendingCriteriaPreviewKind
    ? { kind: periods.pendingCriteriaPreviewKind, sourceLabel: periods.pendingCriteriaPreviewSource }
    : null;

  const filteredCriteria = draftCriteria.filter((c) => {
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const match =
        (c.label || "").toLowerCase().includes(q) ||
        (c.shortLabel || "").toLowerCase().includes(q) ||
        (c.blurb || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    const hasMapping = Array.isArray(c.outcomes) && c.outcomes.length > 0;
    const hasRubric = Array.isArray(c.rubric) && c.rubric.length > 0;
    if (mappingFilter === "mapped" && !hasMapping) return false;
    if (mappingFilter === "unmapped" && hasMapping) return false;
    if (rubricFilter === "defined" && !hasRubric) return false;
    if (rubricFilter === "none" && hasRubric) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredCriteria.length / pageSize));
  const safePage = Math.min(currentPage, Math.max(1, totalPages));
  const pageRows = filteredCriteria.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleDistribute = () => {
    if (!draftCriteria.length) return;
    const each = Math.floor(100 / draftCriteria.length);
    const remainder = 100 - each * draftCriteria.length;
    const next = draftCriteria.map((c, i) => {
      const newMax = each + (i < remainder ? 1 : 0);
      const rubric = Array.isArray(c.rubric) ? c.rubric : [];
      const scaled = rubric.length > 0
        ? rescaleRubricBandsByWeight(rubric, newMax)
        : defaultRubricBands(newMax);
      return { ...c, max: newMax, rubric: scaled };
    });
    periods.updateDraft(next);
  };

  const handleAutoFill = (criterion) => {
    const total = draftCriteria.reduce((s, c) => s + (c.max || 0), 0);
    const remaining = 100 - total;
    if (remaining <= 0) return;
    const next = draftCriteria.map((c) => {
      if (c !== criterion) return c;
      const newMax = (c.max || 0) + remaining;
      const rubric = Array.isArray(c.rubric) ? c.rubric : [];
      const scaled = rubric.length > 0
        ? rescaleRubricBandsByWeight(rubric, newMax)
        : defaultRubricBands(newMax);
      return { ...c, max: newMax, rubric: scaled };
    });
    periods.updateDraft(next);
  };

  const handleWeightChange = (index, newWeight) => {
    const next = draftCriteria.map((c, i) => {
      if (i !== index) return c;
      const rubric = Array.isArray(c.rubric) ? c.rubric : [];
      const scaled = rubric.length > 0
        ? rescaleRubricBandsByWeight(rubric, newWeight)
        : defaultRubricBands(newWeight);
      return { ...c, max: newWeight, rubric: scaled };
    });
    periods.updateDraft(next);
  };

  const handleDuplicate = (index) => {
    const orig = draftCriteria[index];
    const copy = {
      ...structuredClone(orig),
      label: (orig.label || "") + " (copy)",
      shortLabel: ((orig.shortLabel || "") + " Copy").substring(0, 15),
      key: `${orig.key || "crt"}-copy-${Date.now()}`,
      color: nextCriterionColor(draftCriteria),
    };
    const next = [...draftCriteria];
    next.splice(index + 1, 0, copy);
    periods.updateDraft(next);
  };

  const handleMove = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= draftCriteria.length) return;
    const next = [...draftCriteria];
    [next[index], next[target]] = [next[target], next[index]];
    periods.updateDraft(next);
  };

  const handleCommit = async () => {
    setSaving(true);
    try {
      await periods.commitDraft();
      // Outcome mappings edited via the criterion drawer live in po's draft;
      // commit them after criteria so mapping target IDs (period_criterion_id)
      // are stable. Re-fetch after mapping commit so Mapping column reflects
      // fresh DB state — otherwise listPeriodCriteria inside commitDraft runs
      // BEFORE the mappings land, leaving draftCriteria[i].outcomes stale.
      // organizationId is passed so commitDraft honors a pendingFrameworkImport
      // queued on OutcomesPage before navigating here.
      if (po.itemsDirty) {
        await po.commitDraft({ organizationId });
        await periods.reloadCriteria();
      }
    } catch (err) {
      const raw = err?.message || "";
      let msg = "Failed to save criteria. Please try again.";
      if (raw.includes("foreign key") && raw.includes("score_sheet_items")) {
        msg = "Cannot modify criteria while scores exist for this period. Lock the evaluation period first, or contact an administrator to clear existing scores before making structural changes.";
      } else if (raw.includes("foreign key")) {
        msg = "Cannot save — other data depends on the current criteria structure. Make sure no scores or evaluations reference criteria you're trying to remove.";
      } else if (raw.includes("duplicate key")) {
        msg = "A criterion with that label already exists. Please use a unique name for each criterion.";
      } else if (raw.includes("permission") || raw.includes("denied") || raw.includes("RLS")) {
        msg = "You don't have permission to modify criteria for this period. Contact your organization admin.";
      }
      setPanelError("criteria", msg);
      _toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    periods.discardDraft();
    po.discardDraft();
  };

  const startPeriodRename = () => {
    setPeriodRenameVal(effectiveCriteriaName || viewPeriod?.name || "");
    setPeriodRenaming(true);
    setTimeout(() => {
      periodRenameInputRef.current?.focus();
      periodRenameInputRef.current?.select();
    }, 0);
  };

  const cancelPeriodRename = () => {
    setPeriodRenaming(false);
    setPeriodRenameVal("");
  };

  const savePeriodRename = () => {
    const trimmed = periodRenameVal.trim();
    const currentName = effectiveCriteriaName || viewPeriod?.name || "";
    if (!trimmed || !viewPeriod || trimmed === currentName) {
      cancelPeriodRename();
      return;
    }
    periods.setPendingCriteriaName(trimmed);
    setPeriodRenaming(false);
    setPeriodRenameVal("");
  };

  const handlePeriodRenameKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); savePeriodRename(); }
    if (e.key === "Escape") { e.preventDefault(); cancelPeriodRename(); }
  };

  const handleSave = async (newTemplate) => {
    periods.updateDraft(newTemplate);
    return { ok: true };
  };

  const handleDeleteConfirm = () => {
    if (deleteIndex === null) return;
    const next = draftCriteria.filter((_, i) => i !== deleteIndex);
    periods.updateDraft(next);
    setDeleteIndex(null);
    setDeleteSubmitting(false);
  };

  const handleClearAllCriteria = () => {
    periods.markClearAll();
    setClearAllOpen(false);
    setClearAllConfirmText("");
  };

  const otherPeriods = (periods.periodList || []).filter(
    (p) => p.id !== periods.viewPeriodId && p.id
  );

  const handleClone = async (sourcePeriodId) => {
    setCloneLoading(true);
    try {
      const { listPeriodCriteria } = await import("@/shared/api");
      const { getActiveCriteria } = await import("@/shared/criteria/criteriaHelpers");
      const rows = await listPeriodCriteria(sourcePeriodId);
      const cloned = getActiveCriteria(rows).map((c) => ({
        ...structuredClone(c),
        key: `${c.key || "crt"}-clone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      }));
      if (cloned.length > 0) {
        periods.updateDraft(cloned);
        const sourcePeriod = periods.periodList.find((p) => p.id === sourcePeriodId);
        const cloneName = `${sourcePeriod?.criteria_name || sourcePeriod?.name || "Criteria"} (copy)`;
        periods.setPendingCriteriaName(cloneName);
        periods.setPendingCriteriaPreview("clone", sourcePeriod?.name || "another period");
        setShowClonePicker(false);
      } else {
        _toast.info("Source period has no criteria to clone");
      }
    } catch (err) {
      setPanelError("criteria", "Failed to clone criteria. Please try again.");
    } finally {
      setCloneLoading(false);
    }
  };

  const handleStartBlank = () => {
    setStartingBlank(true);
    periods.setPendingCriteriaName("Custom Criteria");
    periods.setPendingCriteriaPreview("blank", null);
    setStartingBlank(false);
  };

  const handleApplyTemplate = (template) => {
    periods.updateDraft(template);
    periods.setPendingCriteriaName("VERA Standard");
    periods.setPendingCriteriaPreview("template", "the VERA Standard template");
    setShowClonePicker(false);
  };

  const deleteLabel = deleteIndex !== null
    ? (draftCriteria[deleteIndex]?.label || `Criterion ${deleteIndex + 1}`)
    : "";
  const canDeleteCriterion = !deleteLabel || deleteConfirmText === deleteLabel;

  useEffect(() => {
    setDeleteConfirmText("");
  }, [deleteIndex]);

  const hasCriteriaContent =
    periods.viewPeriodId && (draftCriteria.length > 0 || scratchMode) && !pendingCriteriaPreview;
  const clearAllDisplayName = effectiveCriteriaName || periods.viewPeriodLabel || "";

  return (
    <div id="page-criteria">
      {panelError && (
        <FbAlert variant="danger" style={{ marginBottom: 16 }}>
          {panelError}
        </FbAlert>
      )}

      <div className="crt-header">
        <div className="crt-header-left">
          <div className="page-title">Evaluation Criteria</div>
          <div className="page-desc">Define scoring rubrics and criteria weights for the active evaluation period.</div>
        </div>
        <CriteriaPageHeader
          visible={hasCriteriaContent}
          searchText={searchText}
          onSearchChange={setSearchText}
          filterOpen={filterOpen}
          activeFilterCount={activeFilterCount}
          onToggleFilter={() => { setFilterOpen((v) => !v); setExportOpen(false); }}
          onToggleExport={() => { setExportOpen((v) => !v); setFilterOpen(false); }}
          isLocked={isLocked}
          onAddCriterion={() => setEditingIndex(-1)}
        />
      </div>

      {hasCriteriaContent && !isLocked && (
        <button
          className="btn btn-primary btn-sm mobile-primary-below-kpi"
          onClick={() => setEditingIndex(-1)}
        >
          <Plus size={13} strokeWidth={2.2} />
          Add Criterion
        </button>
      )}

      {exportOpen && (
        <ExportPanel
          title="Export Criteria"
          subtitle="Download evaluation criteria with rubric bands and outcome mappings."
          meta={`${(draftCriteria || []).length} criteria · ${periods.viewPeriodLabel || "—"}`}
          periodName={periods.viewPeriodLabel || ""}
          organization={activeOrganization?.name || ""}
          department=""
          onClose={() => setExportOpen(false)}
          generateFile={generateCriteriaFile}
          onExport={handleCriteriaExport}
        />
      )}

      {filterOpen && (
        <CriteriaFilterPanel
          mappingFilter={mappingFilter}
          rubricFilter={rubricFilter}
          onMappingChange={setMappingFilter}
          onRubricChange={setRubricFilter}
          onClose={() => setFilterOpen(false)}
          onClearAll={() => { setMappingFilter("all"); setRubricFilter("all"); }}
        />
      )}

      {isLocked && periods.viewPeriodId && (
        <div className="lock-notice">
          <div className="lock-notice-left">
            <div className="lock-notice-icon-wrap">
              <LockKeyhole size={20} strokeWidth={1.8} />
            </div>
            <div className="lock-notice-badge">locked</div>
          </div>
          <div className="lock-notice-body">
            <div className="lock-notice-title">Evaluation in progress — structural fields locked</div>
            <div className="lock-notice-desc">
              Criterion weights, rubric bands, and outcome mappings are locked while scores exist. Labels and descriptions can still be edited.
            </div>
            <div className="lock-notice-chips">
              <span className="lock-notice-chip editable"><Pencil size={11} strokeWidth={2} /> Labels &amp; Descriptions</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Criterion Weights</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Rubric Bands</span>
              <span className="lock-notice-chip locked"><Lock size={11} strokeWidth={2} /> Outcome Mappings</span>
            </div>
          </div>
        </div>
      )}

      {periods.viewPeriodId && draftCriteria.length > 0 && !pendingCriteriaPreview && (
        <WeightBudgetBar
          criteria={draftCriteria}
          onDistribute={handleDistribute}
          onAutoFill={handleAutoFill}
          locked={isLocked}
        />
      )}

      {periods.viewPeriodId && pendingCriteriaPreview && (
        <PendingCriteriaPreview
          kind={pendingCriteriaPreview.kind}
          sourceLabel={pendingCriteriaPreview.sourceLabel}
          effectiveCriteriaName={effectiveCriteriaName}
          criteriaCount={draftCriteria.length}
          totalPoints={draftCriteria.reduce((s, c) => s + (Number(c.max) || 0), 0)}
        />
      )}

      {!periods.viewPeriodId && periods.periodList.length === 0 && !panelError && !adminLoading && contextPeriods.length === 0 && loadingCount === 0 && (
        <NoPeriodsEmpty onNavigateToPeriods={() => onNavigate?.("periods")} />
      )}

      {!periods.viewPeriodId && periods.periodList.length > 0 && !adminLoading && contextPeriods.length > 0 && loadingCount === 0 && (
        <NoPeriodSelectedEmpty />
      )}

      {periods.viewPeriodId && draftCriteria.length === 0 && !scratchMode && !pendingCriteriaPreview && !adminLoading && loadingCount === 0 && contextPeriods.length > 0 && (
        <NoCriteriaEmpty
          otherPeriods={otherPeriods}
          showClonePicker={showClonePicker}
          onToggleClonePicker={() => setShowClonePicker((s) => !s)}
          onStartBlank={handleStartBlank}
          onClone={handleClone}
          onApplyTemplate={handleApplyTemplate}
          startingBlank={startingBlank}
          cloneLoading={cloneLoading}
          isLocked={isLocked}
        />
      )}

      {hasCriteriaContent && (
        <CriteriaTable
          draftCriteria={draftCriteria}
          filteredCriteria={filteredCriteria}
          pageRows={pageRows}
          activeFilterCount={activeFilterCount}
          effectiveCriteriaName={effectiveCriteriaName}
          viewPeriodLabel={periods.viewPeriodLabel}
          draftTotal={periods.draftTotal}
          isLocked={isLocked}
          periodRenaming={periodRenaming}
          periodRenameVal={periodRenameVal}
          periodRenameInputRef={periodRenameInputRef}
          periodRenameSaving={periodRenameSaving}
          onPeriodRenameChange={setPeriodRenameVal}
          onPeriodRenameBlur={savePeriodRename}
          onPeriodRenameKeyDown={handlePeriodRenameKeyDown}
          onStartPeriodRename={startPeriodRename}
          openMenuId={openMenuId}
          setOpenMenuId={setOpenMenuId}
          onOpenEditor={openEditor}
          onEditIndex={setEditingIndex}
          onDuplicate={handleDuplicate}
          onMove={handleMove}
          onDelete={setDeleteIndex}
          onClearAll={() => { setClearAllOpen(true); setClearAllConfirmText(""); }}
          onWeightChange={handleWeightChange}
          onClearFilters={() => { setMappingFilter("all"); setRubricFilter("all"); }}
          currentPage={safePage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
        />
      )}

      <ClearAllCriteriaModal
        open={clearAllOpen}
        submitting={clearAllSubmitting}
        confirmText={clearAllConfirmText}
        onConfirmTextChange={setClearAllConfirmText}
        onClose={() => { setClearAllOpen(false); setClearAllConfirmText(""); }}
        onConfirm={handleClearAllCriteria}
        displayName={clearAllDisplayName}
      />

      <DeleteCriterionModal
        open={deleteIndex !== null}
        submitting={deleteSubmitting}
        confirmText={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
        onClose={() => setDeleteIndex(null)}
        onConfirm={handleDeleteConfirm}
        deleteLabel={deleteLabel}
        canDelete={canDeleteCriterion}
      />

      <SaveBar
        isDirty={periods.isDraftDirty || po.itemsDirty}
        canSave={periods.canSaveDraft}
        total={draftCriteria.length > 0 ? periods.draftTotal : undefined}
        statusText={
          periods.pendingClearAll
            ? "All criteria will be cleared"
            : (draftCriteria.length === 0 ? "Ready to save" : undefined)
        }
        onSave={handleCommit}
        onDiscard={handleDiscard}
        saving={saving}
      />

      <EditSingleCriterionDrawer
        open={editingIndex !== null}
        onClose={closeEditor}
        period={{ id: periods.viewPeriodId, name: periods.viewPeriodLabel }}
        criterion={editingIndex >= 0 ? draftCriteria[editingIndex] : null}
        editIndex={editingIndex}
        initialTab={editingInitialTab}
        criteriaConfig={draftCriteria}
        outcomeConfig={outcomeConfig}
        onSave={handleSave}
        disabled={loadingCount > 0}
        isLocked={isLocked}
        po={po}
      />
      <StarterCriteriaDrawer
        open={starterDrawerOpen}
        onClose={() => setStarterDrawerOpen(false)}
        draftCriteria={draftCriteria}
        otherPeriods={otherPeriods}
        isLocked={isLocked}
        onApplyTemplate={(criteria) => {
          periods.updateDraft(criteria);
          setStarterDrawerOpen(false);
        }}
        onCopyFromPeriod={(periodId) => {
          setStarterDrawerOpen(false);
          handleClone(periodId);
        }}
      />
    </div>
  );
}
