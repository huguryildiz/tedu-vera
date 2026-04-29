// src/admin/features/outcomes/OutcomesPage.jsx
// Outcomes & Mapping page — period-scoped outcome CRUD + criterion mapping.

import { useState, useRef, useEffect } from "react";
import { Download, Filter, Lock, Plus, Search, XCircle } from "lucide-react";
import { FilterButton } from "@/shared/ui/FilterButton";
import CustomSelect from "@/shared/ui/CustomSelect";
import { updateFramework, cloneFramework, assignFrameworkToPeriod, unassignPeriodFramework, listFrameworks } from "@/shared/api";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { usePeriodOutcomes } from "@/admin/shared/usePeriodOutcomes";
import { useToast } from "@/shared/hooks/useToast";
import useCardSelection from "@/shared/hooks/useCardSelection";
import AddOutcomeDrawer from "./AddOutcomeDrawer";
import OutcomeDetailDrawer from "./OutcomeDetailDrawer";
import FbAlert from "@/shared/ui/FbAlert";
import SaveBar from "@/admin/features/criteria/SaveBar";
import "./styles/index.css";
import "@/admin/features/setup-wizard/styles/index.css";
import { useAuth } from "@/auth";
import ExportPanel from "@/admin/shared/ExportPanel";
import { useOutcomesExport } from "@/admin/features/outcomes/useOutcomesExport";
import { naturalCodeSort } from "./components/outcomeHelpers";
import OutcomesTable from "./components/OutcomesTable";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import FrameworkSetupPanel from "./components/FrameworkSetupPanel";
import DeleteOutcomeModal from "./components/DeleteOutcomeModal";
import UnassignFrameworkModal from "./components/UnassignFrameworkModal";
import ImportConfirmModal from "./components/ImportConfirmModal";

export default function OutcomesPage() {
  const {
    organizationId,
    selectedPeriodId,
    selectedPeriod,
    frameworks = [],
    periodOptions: allPeriods = [],
    onFrameworksChange,
    loading: adminLoading,
    fetchData,
  } = useAdminContext();

  const toast = useToast();
  const isLocked = !!selectedPeriod?.is_locked;
  const frameworkId = selectedPeriod?.framework_id || null;
  const savedFrameworkName = frameworks.find((f) => f.id === frameworkId)?.name || "";
  const savedFrameworkThreshold = frameworks.find((f) => f.id === frameworkId)?.default_threshold ?? 70;
  // Only show accreditation frameworks (MÜDEK/ABET) in the "no framework" picker —
  // VERA Standard belongs to the Criteria page, not here.
  const isAccreditationFramework = (fw) => /MÜDEK|ABET/i.test(fw.name);
  const platformFrameworks = frameworks.filter((f) => !f.organization_id && isAccreditationFramework(f));
  const periodsWithFrameworks = allPeriods.filter(
    (p) => p.id !== selectedPeriodId && p.framework_id
  );

  const [localPlatformFrameworks, setLocalPlatformFrameworks] = useState(null);
  useEffect(() => {
    if (frameworkId || !organizationId) return;
    listFrameworks(organizationId)
      .then((rows) => setLocalPlatformFrameworks(rows.filter((f) => !f.organization_id && isAccreditationFramework(f))))
      .catch(() => {});
  }, [frameworkId, organizationId]);

  const effectivePlatformFrameworks = localPlatformFrameworks ?? platformFrameworks;

  const fw = usePeriodOutcomes({ periodId: selectedPeriodId });
  const { activeOrganization } = useAuth();
  const { generateFile: generateOutcomesFile, handleExport: handleOutcomesExport } = useOutcomesExport({
    outcomes: fw.outcomes,
    criteria: fw.criteria,
    mappings: fw.mappings,
    periodName: selectedPeriod?.name || "",
  });

  const frameworkName =
    fw.pendingFrameworkName !== undefined ? fw.pendingFrameworkName : savedFrameworkName;

  const [sortOrder, setSortOrder] = useState("asc");
  const [openMenuId, setOpenMenuId] = useState(null);
  const rowsScopeRef = useCardSelection();
  const [exportOpen, setExportOpen] = useState(false);
  const [pageSize, setPageSize] = useState(15);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [coverageFilter, setCoverageFilter] = useState("all");
  const [criterionFilter, setCriterionFilter] = useState("all");
  const activeFilterCount =
    (coverageFilter !== "all" ? 1 : 0) + (criterionFilter !== "all" ? 1 : 0);

  useEffect(() => {
    setCurrentPage(1);
  }, [coverageFilter, criterionFilter, searchText]);

  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editingOutcome, setEditingOutcome] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const [unassignFwOpen, setUnassignFwOpen] = useState(false);
  const [unassignFwConfirmText, setUnassignFwConfirmText] = useState("");
  const [unassignFwSubmitting, _setUnassignFwSubmitting] = useState(false);

  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

  const [panelError, setPanelError] = useState("");

  const [showFwPicker, setShowFwPicker] = useState(false);

  const requireOrg = () => {
    if (!organizationId) {
      toast.error("No active organization — switch tenant from the org switcher");
      return false;
    }
    return true;
  };

  const handleStartBlank = () => {
    if (!selectedPeriodId || !requireOrg()) return;
    fw.setPendingFrameworkImport({ kind: "blank", proposedName: "Custom Outcome" });
  };

  const handleCloneFromPeriod = (period) => {
    if (!selectedPeriodId || !requireOrg()) return;
    setShowFwPicker(false);
    const fwName =
      frameworks.find((f) => f.id === period.framework_id)?.name || "Custom Outcome";
    fw.setPendingFrameworkImport({
      kind: "clonePeriod",
      sourceFrameworkId: period.framework_id,
      proposedName: `${fwName} (copy)`,
    });
  };

  const handleCloneTemplate = (template) => {
    if (!selectedPeriodId || !requireOrg()) return;
    setShowFwPicker(false);
    fw.setPendingFrameworkImport({
      kind: "cloneTemplate",
      sourceFrameworkId: template.id,
      proposedName: template.name,
    });
  };

  const [fwRenaming, setFwRenaming] = useState(false);
  const [fwRenameVal, setFwRenameVal] = useState("");
  const [fwRenameSaving, _setFwRenameSaving] = useState(false);
  const fwRenameInputRef = useRef(null);

  const [thresholdEditing, setThresholdEditing] = useState(false);
  const [thresholdVal, setThresholdVal] = useState("");
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const thresholdInputRef = useRef(null);

  const sortedOutcomes = [...fw.outcomes].sort((a, b) => {
    const cmp = naturalCodeSort(a, b);
    return sortOrder === "desc" ? -cmp : cmp;
  });

  const filteredOutcomes = sortedOutcomes.filter((o) => {
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      const match =
        (o.code || "").toLowerCase().includes(q) ||
        (o.label || "").toLowerCase().includes(q) ||
        (o.description || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    const cov = fw.getCoverage(o.id);
    if (coverageFilter !== "all" && cov !== coverageFilter) return false;
    if (criterionFilter !== "all") {
      const mapped = fw.getMappedCriteria(o.id);
      if (!mapped.some((c) => c.id === criterionFilter)) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredOutcomes.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageRows = filteredOutcomes.slice((safePage - 1) * pageSize, safePage * pageSize);

  const totalOutcomes = fw.outcomes.length;
  const directCount = fw.outcomes.filter((o) => fw.getCoverage(o.id) === "direct").length;
  const indirectCount = fw.outcomes.filter((o) => fw.getCoverage(o.id) === "indirect").length;
  const unmappedCount = totalOutcomes - directCount - indirectCount;
  const incompleteCount = unmappedCount + indirectCount;

  const drawerCriteria = fw.criteria.map((c) => ({
    id: c.id,
    label: c.label,
    color: c.color || "var(--accent)",
  }));

  const handleAddOutcome = async ({ code, shortLabel, description, criterionIds }) => {
    setPanelError("");
    try {
      await fw.addOutcome({ code, shortLabel, description, criterionIds });
      toast.success("Outcome added");
    } catch (e) {
      toast.error("Failed to add outcome");
      throw e;
    }
  };

  const handleEditOutcome = async ({ code, shortLabel, description, criterionIds, coverageType }) => {
    if (!editingOutcome) return;
    setPanelError("");
    try {
      await fw.editOutcome(editingOutcome.id, {
        code,
        label: shortLabel,
        description,
        criterionIds,
        coverageType: coverageType || "direct",
      });
      toast.success("Outcome updated");
    } catch (e) {
      toast.error("Failed to update outcome");
      throw e;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setPanelError("");
    try {
      await fw.removeOutcome(deleteTarget.id);
      setDeleteTarget(null);
      setDeleteConfirmText("");
      toast.success("Outcome removed");
    } catch (e) {
      setPanelError("Failed to remove outcome. Please try again.");
      toast.error("Failed to remove outcome. Please try again.");
      setDeleteTarget(null);
      setDeleteConfirmText("");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleDuplicate = async (outcome) => {
    setPanelError("");
    try {
      const newCode = outcome.code + " (copy)";
      await fw.addOutcome({
        code: newCode,
        shortLabel: outcome.label,
        description: outcome.description || "",
        criterionIds: fw.getMappedCriteria(outcome.id).map((c) => c.id),
      });
      toast.success("Outcome duplicated");
    } catch (e) {
      toast.error("Failed to duplicate outcome");
    }
  };

  const handleRemoveChip = async (criterionId, outcomeId) => {
    try {
      await fw.removeMapping(criterionId, outcomeId);
    } catch (e) {
      toast.error("Failed to remove mapping");
    }
  };

  const handleCycleCoverage = async (outcomeId) => {
    try {
      await fw.cycleCoverage(outcomeId);
    } catch (e) {
      toast.error("Failed to update coverage");
    }
  };

  const openEditDrawer = (outcome) => {
    const mapped = fw.getMappedCriteria(outcome.id);
    const coverage = fw.getCoverage(outcome.id);
    setEditingOutcome({
      id: outcome.id,
      code: outcome.code,
      shortLabel: outcome.label,
      description: outcome.description || "",
      criterionIds: mapped.map((c) => c.id),
      coverageType: coverage === "none" ? "direct" : coverage,
    });
    setEditDrawerOpen(true);
  };

  const startFwRename = () => {
    setFwRenameVal(frameworkName);
    setFwRenaming(true);
    setTimeout(() => {
      fwRenameInputRef.current?.focus();
      fwRenameInputRef.current?.select();
    }, 0);
  };

  const cancelFwRename = () => {
    setFwRenaming(false);
    setFwRenameVal("");
  };

  const saveFwRename = () => {
    const trimmed = fwRenameVal.trim();
    if (!trimmed || trimmed === frameworkName || !frameworkId) {
      cancelFwRename();
      return;
    }
    fw.setPendingFrameworkName(trimmed);
    setFwRenaming(false);
    setFwRenameVal("");
  };

  const handleFwRenameKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); saveFwRename(); }
    if (e.key === "Escape") { e.preventDefault(); cancelFwRename(); }
  };

  const startThresholdEdit = () => {
    setThresholdVal(String(savedFrameworkThreshold));
    setThresholdEditing(true);
    setTimeout(() => { thresholdInputRef.current?.focus(); thresholdInputRef.current?.select(); }, 0);
  };

  const saveThreshold = async () => {
    const num = parseInt(thresholdVal, 10);
    if (isNaN(num) || num < 0 || num > 100 || num === savedFrameworkThreshold || !frameworkId) {
      setThresholdEditing(false);
      return;
    }
    setThresholdSaving(true);
    try {
      await updateFramework(frameworkId, { default_threshold: num });
      onFrameworksChange?.();
    } catch {
      toast.error("Failed to update attainment threshold");
    } finally {
      setThresholdSaving(false);
      setThresholdEditing(false);
    }
  };

  const handleThresholdKeyDown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); saveThreshold(); }
    if (e.key === "Escape") { e.preventDefault(); setThresholdEditing(false); }
  };

  const runSaveDraft = async () => {
    try {
      if (fw.pendingUnassign) {
        await unassignPeriodFramework(selectedPeriodId);
        await Promise.all([fetchData?.(), fw.loadAll()]);
        onFrameworksChange?.();
        toast.success("Outcomes removed from this period");
        return;
      }

      const hadImport = !!fw.pendingFrameworkImport;
      if (fw.itemsDirty || fw.pendingFrameworkImport) {
        await fw.commitDraft({ organizationId });
      }
      if (hadImport) {
        await fetchData?.();
        onFrameworksChange?.();
      }

      if (fw.pendingFrameworkName !== undefined && frameworkId) {
        const trimmed = fw.pendingFrameworkName;
        const sharedWith = allPeriods.filter(
          (p) => p.framework_id === frameworkId && p.id !== selectedPeriodId
        );
        if (sharedWith.length > 0 && organizationId) {
          const { id: clonedId } = await cloneFramework(frameworkId, trimmed, organizationId);
          await assignFrameworkToPeriod(selectedPeriodId, clonedId);
        } else {
          await updateFramework(frameworkId, { name: trimmed });
        }
        await fetchData?.();
        onFrameworksChange?.();
        fw.setPendingFrameworkName(undefined);
      }

      toast.success("Outcomes saved");
    } catch (e) {
      toast.error("Failed to save outcomes");
    }
  };

  const handleSaveDraft = async () => {
    const hasExistingOutcomes =
      (fw.savedOutcomesCount ?? 0) > 0 || (fw.savedMappingsCount ?? 0) > 0;
    if (fw.pendingFrameworkImport && hasExistingOutcomes) {
      setImportConfirmOpen(true);
      return;
    }
    await runSaveDraft();
  };

  const handleConfirmImport = async () => {
    setImportConfirmOpen(false);
    await runSaveDraft();
  };

  const handleDiscardDraft = () => {
    fw.discardDraft();
  };

  const handleUnassignFramework = () => {
    fw.markUnassign();
    setUnassignFwOpen(false);
    setUnassignFwConfirmText("");
  };

  const pendingImport = fw.pendingFrameworkImport;
  const noPeriods = !adminLoading && !selectedPeriodId && allPeriods.length === 0;
  const noperiodSelected = !adminLoading && !selectedPeriodId && allPeriods.length > 0;
  const noFramework = !adminLoading && !!selectedPeriodId && !frameworkId && !pendingImport;
  const showPendingImportView = !adminLoading && !!selectedPeriodId && !frameworkId && !!pendingImport;

  return (
    <div id="page-accreditation">
      {panelError && (
        <FbAlert variant="danger" style={{ marginBottom: 16 }}>{panelError}</FbAlert>
      )}
      <div className="sem-header">
        <div className="sem-header-left">
          <div className="page-title">Outcomes &amp; Mapping</div>
          <div className="page-desc">Map evaluation criteria to programme outcomes and track coverage.</div>
        </div>
        {!noFramework && !noPeriods && !noperiodSelected && (
          <div className="sem-header-actions mobile-toolbar-stack">
            <div className="admin-search-wrap mobile-toolbar-search">
              <Search size={14} strokeWidth={2} style={{ opacity: 0.45 }} />
              <input
                className="search-input"
                type="text"
                placeholder="Search outcomes…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
            <FilterButton
              className="mobile-toolbar-filter"
              activeCount={activeFilterCount}
              isOpen={filterOpen}
              onClick={() => { setFilterOpen((v) => !v); setExportOpen(false); }}
            />
            <button
              className="btn btn-outline btn-sm mobile-toolbar-export"
              onClick={() => { setExportOpen((v) => !v); setFilterOpen(false); }}
            >
              <Download size={14} strokeWidth={2} style={{ verticalAlign: "-1px" }} />
              {" "}Export
            </button>
            {isLocked ? (
              <span className="acc-lock-badge mobile-toolbar-primary">
                <Lock size={11} strokeWidth={2.5} />
                Evaluation Active
              </span>
            ) : (
              <button
                data-testid="outcomes-add-btn"
                className="btn btn-primary btn-sm mobile-toolbar-primary"
                onClick={() => setAddDrawerOpen(true)}
              >
                <Plus size={13} strokeWidth={2.2} />
                Add Outcome
              </button>
            )}
          </div>
        )}
      </div>
      {exportOpen && (
        <ExportPanel
          title="Export Outcomes"
          subtitle="Download programme outcomes with criterion mappings and coverage analysis."
          meta={`${(fw.outcomes || []).length} outcomes · ${selectedPeriod?.name || "—"}`}
          periodName={selectedPeriod?.name || ""}
          organization={activeOrganization?.name || ""}
          department=""
          onClose={() => setExportOpen(false)}
          generateFile={generateOutcomesFile}
          onExport={handleOutcomesExport}
        />
      )}
      {filterOpen && (
        <div className="filter-panel show">
          <div className="filter-panel-header">
            <div>
              <h4>
                <Filter size={14} style={{ display: "inline", marginRight: 4, opacity: 0.5, verticalAlign: "-1px" }} />
                Filter Outcomes
              </h4>
              <div className="filter-panel-sub">Narrow outcomes by coverage and mapped criterion.</div>
            </div>
            <button className="filter-panel-close" aria-label="Close filter panel" onClick={() => setFilterOpen(false)}>&#215;</button>
          </div>
          <div className="filter-row">
            <div className="filter-group">
              <label>Coverage</label>
              <CustomSelect
                compact
                value={coverageFilter}
                onChange={(v) => setCoverageFilter(v)}
                options={[
                  { value: "all", label: "All coverage" },
                  { value: "direct", label: "Direct" },
                  { value: "indirect", label: "Indirect" },
                  { value: "none", label: "Unmapped" },
                ]}
                ariaLabel="Coverage"
              />
            </div>
            <div className="filter-group">
              <label>Mapped Criterion</label>
              <CustomSelect
                compact
                value={criterionFilter}
                onChange={(v) => setCriterionFilter(v)}
                options={[
                  { value: "all", label: "All criteria" },
                  ...drawerCriteria.map((c) => ({ value: c.id, label: c.label })),
                ]}
                ariaLabel="Mapped Criterion"
              />
            </div>
            <button
              className="btn btn-outline btn-sm filter-clear-btn"
              onClick={() => { setCoverageFilter("all"); setCriterionFilter("all"); }}
            >
              <XCircle size={12} strokeWidth={2} style={{ opacity: 0.5, verticalAlign: "-1px" }} />
              {" "}Clear all
            </button>
          </div>
        </div>
      )}
      {noPeriods ? (
        <FrameworkSetupPanel variant="noPeriods" />
      ) : noperiodSelected ? (
        <FrameworkSetupPanel variant="noperiodSelected" />
      ) : noFramework ? (
        <FrameworkSetupPanel
          variant="noFramework"
          showFwPicker={showFwPicker}
          setShowFwPicker={setShowFwPicker}
          periodsWithFrameworks={periodsWithFrameworks}
          effectivePlatformFrameworks={effectivePlatformFrameworks}
          frameworks={frameworks}
          onStartBlank={handleStartBlank}
          onCloneFromPeriod={handleCloneFromPeriod}
          onCloneTemplate={handleCloneTemplate}
          onAddDrawerOpen={() => setAddDrawerOpen(true)}
        />
      ) : showPendingImportView ? (
        <FrameworkSetupPanel variant="pendingImport" pendingImport={pendingImport} />
      ) : (
        <>
          {/* KPI strip */}
          <div className="scores-kpi-strip">
            <div
              className={`scores-kpi-item ${coverageFilter === "all" ? "scores-kpi-item--active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => { setCoverageFilter("all"); setFilterOpen(false); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setCoverageFilter("all");
                  setFilterOpen(false);
                }
              }}
            >
              <div className="scores-kpi-item-value">{totalOutcomes}</div>
              <div className="scores-kpi-item-label">Total Outcomes</div>
            </div>
            <div
              className={`scores-kpi-item ${coverageFilter === "direct" ? "scores-kpi-item--active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => { setCoverageFilter("direct"); setFilterOpen(true); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setCoverageFilter("direct");
                  setFilterOpen(true);
                }
              }}
            >
              <div className="scores-kpi-item-value success">{directCount}</div>
              <div className="scores-kpi-item-label">Direct</div>
            </div>
            <div
              className={`scores-kpi-item ${coverageFilter === "indirect" ? "scores-kpi-item--active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => { setCoverageFilter("indirect"); setFilterOpen(true); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setCoverageFilter("indirect");
                  setFilterOpen(true);
                }
              }}
            >
              <div className="scores-kpi-item-value warning">{indirectCount}</div>
              <div className="scores-kpi-item-label">Indirect</div>
            </div>
            <div
              className={`scores-kpi-item ${coverageFilter === "none" ? "scores-kpi-item--active" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => { setCoverageFilter("none"); setFilterOpen(true); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setCoverageFilter("none");
                  setFilterOpen(true);
                }
              }}
            >
              <div className="scores-kpi-item-value muted">{unmappedCount}</div>
              <div className="scores-kpi-item-label">Unmapped</div>
            </div>
          </div>
          <PremiumTooltip text={isLocked ? "Evaluation period is locked. Unlock the period to make changes." : null} position="bottom">
            <button
              data-testid="outcomes-add-btn-below"
              className="btn btn-primary btn-sm mobile-primary-below-kpi"
              onClick={() => !isLocked && setAddDrawerOpen(true)}
              disabled={isLocked}
            >
              <Plus size={13} strokeWidth={2.2} />
              Add Outcome
            </button>
          </PremiumTooltip>

          {totalOutcomes > 0 && (
            <div className="acc-coverage-progress">
              <div className="acc-coverage-progress-top">
                <span className="acc-coverage-progress-label">Overall Coverage</span>
                <span className="acc-coverage-progress-pct">
                  {totalOutcomes > 0 ? Math.round(((directCount + indirectCount) / totalOutcomes) * 100) : 0}% covered
                </span>
              </div>
              <div className="acc-coverage-bar-track">
                <div className="acc-coverage-bar-direct" style={{ width: `${totalOutcomes > 0 ? (directCount / totalOutcomes) * 100 : 0}%` }} />
                <div className="acc-coverage-bar-indirect" style={{ width: `${totalOutcomes > 0 ? (indirectCount / totalOutcomes) * 100 : 0}%` }} />
              </div>
              <div className="acc-coverage-bar-legend">
                <span className="acc-coverage-bar-legend-item"><span className="legend-dot" style={{ background: "var(--success)" }} /> Direct ({directCount})</span>
                <span className="acc-coverage-bar-legend-item"><span className="legend-dot" style={{ background: "var(--warning)" }} /> Indirect ({indirectCount})</span>
                <span className="acc-coverage-bar-legend-item"><span className="legend-dot" style={{ background: "var(--text-quaternary)" }} /> Unmapped ({unmappedCount})</span>
              </div>
            </div>
          )}

          {incompleteCount > 0 && totalOutcomes > 0 && (
            <FbAlert variant="warning" style={{ marginBottom: 16 }} title="Incomplete outcome coverage">
              {incompleteCount} of {totalOutcomes} programme outcome{totalOutcomes !== 1 ? "s" : ""} lack direct criterion mapping
              ({unmappedCount > 0 ? `${unmappedCount} unmapped` : ""}
              {unmappedCount > 0 && indirectCount > 0 ? ", " : ""}
              {indirectCount > 0 ? `${indirectCount} indirect` : ""}).
              {" "}Consider adding explicit mappings or supplementary assessment instruments to strengthen accreditation compliance.
            </FbAlert>
          )}

          <OutcomesTable
            isLocked={isLocked}
            frameworkId={frameworkId}
            frameworkName={frameworkName}
            totalOutcomes={totalOutcomes}
            directCount={directCount}
            savedFrameworkThreshold={savedFrameworkThreshold}
            fw={fw}
            pageRows={pageRows}
            filteredOutcomes={filteredOutcomes}
            safePage={safePage}
            totalPages={totalPages}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            setCurrentPage={setCurrentPage}
            openMenuId={openMenuId}
            setOpenMenuId={setOpenMenuId}
            rowsScopeRef={rowsScopeRef}
            fwRenaming={fwRenaming}
            fwRenameVal={fwRenameVal}
            setFwRenameVal={setFwRenameVal}
            fwRenameInputRef={fwRenameInputRef}
            saveFwRename={saveFwRename}
            handleFwRenameKeyDown={handleFwRenameKeyDown}
            fwRenameSaving={fwRenameSaving}
            startFwRename={startFwRename}
            onOpenUnassign={() => { setUnassignFwOpen(true); setUnassignFwConfirmText(""); }}
            thresholdEditing={thresholdEditing}
            thresholdVal={thresholdVal}
            setThresholdVal={setThresholdVal}
            thresholdInputRef={thresholdInputRef}
            saveThreshold={saveThreshold}
            handleThresholdKeyDown={handleThresholdKeyDown}
            thresholdSaving={thresholdSaving}
            startThresholdEdit={startThresholdEdit}
            onEditOutcome={openEditDrawer}
            onDeleteOutcome={(o) => setDeleteTarget(o)}
            onDuplicate={handleDuplicate}
            onRemoveChip={handleRemoveChip}
            onCycleCoverage={handleCycleCoverage}
            setCoverageFilter={setCoverageFilter}
            setCriterionFilter={setCriterionFilter}
          />
        </>
      )}

      <AddOutcomeDrawer
        open={addDrawerOpen}
        onClose={() => setAddDrawerOpen(false)}
        frameworkName={frameworkName}
        frameworkId={frameworkId}
        platformFrameworks={effectivePlatformFrameworks}
        criteria={drawerCriteria}
        onSave={handleAddOutcome}
        onSelectFrameworkTemplate={(template) => {
          if (!selectedPeriodId || !requireOrg()) return;
          if (template) {
            fw.setPendingFrameworkImport({
              kind: "cloneTemplate",
              sourceFrameworkId: template.id,
              proposedName: template.name,
            });
          } else {
            fw.setPendingFrameworkImport({
              kind: "blank",
              proposedName: "Custom Outcome",
            });
          }
          setAddDrawerOpen(false);
        }}
      />
      <OutcomeDetailDrawer
        open={editDrawerOpen}
        onClose={() => { setEditDrawerOpen(false); setEditingOutcome(null); }}
        outcome={editingOutcome}
        criteria={drawerCriteria}
        onSave={handleEditOutcome}
        isLocked={isLocked}
      />
      <DeleteOutcomeModal
        target={deleteTarget}
        confirmText={deleteConfirmText}
        onConfirmTextChange={setDeleteConfirmText}
        submitting={deleteSubmitting}
        onCancel={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}
        onConfirm={handleDeleteConfirm}
      />
      <UnassignFrameworkModal
        open={unassignFwOpen}
        frameworkName={frameworkName}
        confirmText={unassignFwConfirmText}
        onConfirmTextChange={setUnassignFwConfirmText}
        submitting={unassignFwSubmitting}
        onCancel={() => { setUnassignFwOpen(false); setUnassignFwConfirmText(""); }}
        onConfirm={handleUnassignFramework}
      />
      <ImportConfirmModal
        open={importConfirmOpen}
        proposedName={fw.pendingFrameworkImport?.proposedName}
        saving={fw.saving}
        onCancel={() => setImportConfirmOpen(false)}
        onConfirm={handleConfirmImport}
      />
      <SaveBar
        isDirty={fw.isDirty}
        canSave={true}
        total={100}
        onSave={handleSaveDraft}
        onDiscard={handleDiscardDraft}
        saving={fw.saving}
      />
    </div>
  );
}
