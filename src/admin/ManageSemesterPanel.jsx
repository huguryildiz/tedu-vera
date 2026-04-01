// src/admin/ManageSemesterPanel.jsx

import { useEffect, useMemo, useRef, useState } from "react";
import ConfirmDialog from "../shared/ConfirmDialog";
import { CheckCircle2Icon, ChevronDownIcon, PencilIcon, SearchIcon, CirclePlusIcon, TriangleAlertLucideIcon } from "../shared/Icons";
import LastActivity from "./LastActivity";
import DangerIconButton from "../components/admin/DangerIconButton";
import AlertCard from "../shared/AlertCard";
import Tooltip from "../shared/Tooltip";
import CriteriaManager from "./CriteriaManager";
import MudekManager from "./MudekManager";
import { buildTimestampSearchText } from "./utils";
import {
  APP_DATE_MIN_YEAR,
  APP_DATE_MAX_YEAR,
  APP_DATE_MIN_DATE,
  APP_DATE_MAX_DATE,
  isIsoDateWithinBounds,
} from "../shared/dateBounds";
import { sortPeriodsByStartDateDesc } from "../shared/periodSort";
import { defaultCriteriaConfig, defaultOutcomeConfig, pruneCriteriaMudekMappings } from "../shared/criteriaHelpers";
import { cn } from "@/lib/utils";

// ── 3-tab bar ────────────────────────────────────────────────

const TAB_LABELS = {
  period: "Period",
  criteria: "Evaluation Criteria",
  mudek:    "MÜDEK Outcomes",
};

function SemesterEditorTabs({ activeTab, onTab, dirtyTabs = {} }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-muted p-1.5" role="tablist" aria-label="Period editor tabs">
      {["period", "criteria", "mudek"].map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={activeTab === t}
          className={cn(
            "flex-1 inline-flex items-center justify-center rounded-lg border border-transparent px-2.5 py-1 text-xs font-semibold transition-all",
            activeTab === t
              ? "bg-primary border-primary text-primary-foreground shadow-md"
              : "bg-transparent text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
          )}
          onClick={() => onTab(t)}
          type="button"
        >
          {TAB_LABELS[t]}
          {dirtyTabs[t] && <span className="ml-1.5 inline-block size-1.5 shrink-0 rounded-full bg-amber-400 align-middle" aria-label="unsaved changes" />}
        </button>
      ))}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export default function ManageSemesterPanel({
  periods,
  currentPeriodId,
  currentPeriodName,
  formatSemesterName = (n) => n,
  panelError = "",
  isMobile,
  isOpen,
  onToggle,
  onDirtyChange,
  onSetCurrent,
  onCreateSemester,
  onUpdateSemester,
  onUpdateCriteriaTemplate,
  onUpdateMudekTemplate,
  onDeleteSemester,
  isLockedFn,
  externalUpdatedPeriodId,
  externalDeletedPeriodId,
  isDemoMode = false,
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Create form — always starts on "period" tab
  const [createTab, setCreateTab] = useState("period");
  const [createForm, setCreateForm] = useState({
    period_name: "",
    start_date: "",
    criteria_config: defaultCriteriaConfig(),
    outcome_config: defaultOutcomeConfig(),
  });
  const [createError, setCreateError] = useState("");

  // Edit form — always starts on "period" tab
  const [editTab, setEditTab] = useState("period");
  const [editForm, setEditForm] = useState({ id: "", period_name: "", start_date: "", criteria_config: [], outcome_config: [] });
  const [editError, setEditError] = useState("");

  // Track original edit form values to avoid false dirty on open/cancel (Fix 7)
  const editOrigRef = useRef(null);

  // Unsaved indicator state for Criteria / MÜDEK tabs (Fix 8)
  const [editCriteriaDirty, setEditCriteriaDirty] = useState(false);
  const [editMudekDirty, setEditMudekDirty] = useState(false);

  // Unsaved-changes leave dialog (Fix 1)
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);

  // Stale-edit detection: set when a Realtime UPDATE arrives for the period currently being edited
  const [staleSemester, setStaleSemester] = useState(false);
  useEffect(() => {
    if (!showEdit || !externalUpdatedPeriodId || !editForm.id) return;
    if (externalUpdatedPeriodId === editForm.id) {
      setStaleSemester(true);
    }
  }, [externalUpdatedPeriodId, showEdit, editForm.id]);

  // Auto-close edit modal when the period being edited is deleted externally
  const [deletedWhileEditing, setDeletedWhileEditing] = useState(false);
  useEffect(() => {
    if (!showEdit || !externalDeletedPeriodId || !editForm.id) return;
    if (externalDeletedPeriodId === editForm.id) {
      setShowEdit(false);
      setDeletedWhileEditing(true);
    }
  }, [externalDeletedPeriodId, showEdit, editForm.id]);

  const editDirty =
    showEdit &&
    editOrigRef.current !== null &&
    (editForm.period_name !== editOrigRef.current.period_name ||
      editForm.start_date !== editOrigRef.current.start_date);

  const isDirty =
    (showCreate && (createForm.period_name.trim() !== "" || createForm.start_date !== "")) ||
    editDirty;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  // Warn before browser/tab close when any unsaved changes exist
  const isAnyDirty = isDirty || editCriteriaDirty || editMudekDirty;
  useEffect(() => {
    if (!isAnyDirty) return;
    const handler = (e) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isAnyDirty]);

  const handleLeaveConfirm = () => {
    setLeaveDialogOpen(false);
    closeCreate();
    closeEdit();
    onToggle();
  };

  const handleToggle = () => {
    if (isOpen && isAnyDirty) {
      setLeaveDialogOpen(true);
      return;
    }
    onToggle();
  };

  const minYear = APP_DATE_MIN_YEAR;
  const maxYear = APP_DATE_MAX_YEAR;
  const minPosterDate = APP_DATE_MIN_DATE;
  const maxPosterDate = APP_DATE_MAX_DATE;

  const getFormMeta = (value) => {
    const hasPosterDate = !!value.start_date;
    const yearError =
      hasPosterDate && !isIsoDateWithinBounds(value.start_date)
        ? `Year must be between ${minYear} and ${maxYear}.`
        : "";
    const canSubmit = value.period_name.trim() && hasPosterDate && !yearError;
    return { yearError, canSubmit };
  };
  const createMeta = getFormMeta(createForm);
  const editMeta = getFormMeta(editForm);
  const createCriteriaTemplate = useMemo(
    () => pruneCriteriaMudekMappings(createForm.criteria_config, createForm.outcome_config),
    [createForm.criteria_config, createForm.outcome_config]
  );
  const editCriteriaTemplate = useMemo(
    () => pruneCriteriaMudekMappings(editForm.criteria_config, editForm.outcome_config),
    [editForm.criteria_config, editForm.outcome_config]
  );

  const uniqueSemesters = useMemo(() => {
    const byId = new Map();
    (periods || []).forEach((s) => {
      const key = s?.id || `${s?.period_name || ""}|${s?.start_date || ""}`;
      if (!key) return;
      const prev = byId.get(key);
      if (!prev) { byId.set(key, s); return; }
      const prevTs = new Date(prev?.updated_at || prev?.updatedAt || 0).getTime();
      const nextTs = new Date(s?.updated_at || s?.updatedAt || 0).getTime();
      if (Number.isFinite(nextTs) && nextTs > prevTs) byId.set(key, s);
    });
    return Array.from(byId.values());
  }, [periods]);

  const normalizeDateInput = (value) => !value ? "" : String(value).slice(0, 10);

  const formatDate = (value) => {
    if (!value) return "—";
    const parts = String(value).slice(0, 10).split("-");
    if (parts.length !== 3) return value;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return value;
    const pad = (v) => String(v).padStart(2, "0");
    return `${pad(d)}.${pad(m)}.${y}`;
  };

  const orderedPeriods = sortPeriodsByStartDateDesc(uniqueSemesters);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredSemesters = normalizedSearch
    ? orderedPeriods.filter((s) => {
        const rawDate = s?.start_date || "";
        const prettyDate = formatDate(rawDate);
        const updatedRaw = s?.updated_at || s?.updatedAt || "";
        const updatedSearch = buildTimestampSearchText(updatedRaw);
        const prettyDateAlt = prettyDate
          ? `${prettyDate} ${prettyDate.replace(/\./g, "/")} ${prettyDate.replace(/\./g, "-")}`
          : "";
        const haystack = [s?.period_name || "", rawDate, prettyDateAlt, updatedSearch]
          .join(" ").toLowerCase();
        return haystack.includes(normalizedSearch);
      })
    : orderedPeriods;
  const visibleSemesters = normalizedSearch
    ? filteredSemesters
    : (showAll ? orderedPeriods : orderedPeriods.slice(0, 4));
  const getLastActivity = (s) => s.updated_at || s.updatedAt || null;

  // ── Reset helpers ──────────────────────────────────────────

  const closeCreate = () => {
    setShowCreate(false);
    setCreateError("");
    setCreateTab("period");
    setCreateForm({
      period_name: "",
      start_date: "",
      criteria_config: defaultCriteriaConfig(),
      outcome_config: defaultOutcomeConfig(),
    });
  };

  const closeEdit = () => {
    setShowEdit(false);
    setEditError("");
    setEditTab("period");
    setEditForm({ id: "", period_name: "", start_date: "", criteria_config: [], outcome_config: [] });
    editOrigRef.current = null;
    setEditCriteriaDirty(false);
    setEditMudekDirty(false);
    setStaleSemester(false);
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm flex flex-col gap-3.5 p-4.5 max-w-full min-w-0 overflow-x-hidden">
      <button
        type="button"
        className="flex items-center justify-between gap-3 bg-transparent border-none p-0 cursor-pointer text-left"
        onClick={handleToggle}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 font-bold text-foreground">
          <span className="text-muted-foreground [&_svg]:size-[18px] [&_svg]:block" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15.228 16.852-.923-.383" />
              <path d="m15.228 19.148-.923.383" />
              <path d="M16 2v4" />
              <path d="m16.47 14.305.382.923" />
              <path d="m16.852 20.772-.383.924" />
              <path d="m19.148 15.228.383-.923" />
              <path d="m19.53 21.696-.382-.924" />
              <path d="m20.772 16.852.924-.383" />
              <path d="m20.772 19.148.924.383" />
              <path d="M21 10.592V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6" />
              <path d="M3 10h18" />
              <path d="M8 2v4" />
              <circle cx="18" cy="18" r="3" />
            </svg>
          </span>
          <span className="section-label">Period Settings</span>
        </div>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-3 max-w-full min-w-0">
          <div className="text-xs text-muted-foreground -mt-0.5 text-justify text-left leading-relaxed w-full">Manage evaluation periods, dates, and the system-wide active term.</div>
          {panelError && <AlertCard variant="error">{panelError}</AlertCard>}

          {deletedWhileEditing && (
            <AlertCard variant="warning">
              This period was deleted in another session.{" "}
              <button
                className="inline-flex items-center gap-1.5 rounded-full border border-input bg-muted px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:-translate-y-px hover:border-border hover:shadow-md"
                onClick={() => setDeletedWhileEditing(false)}
              >
                Dismiss
              </button>
            </AlertCard>
          )}

          {/* Current period selector */}
          <div className="flex flex-col gap-1.5 rounded-xl border bg-muted/40 p-3">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Set Current Period</label>
            <div className="text-xs text-muted-foreground">
              The jury form opens for the selected period and its groups.
            </div>
            <div>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={currentPeriodId || ""}
                onChange={(e) => onSetCurrent(e.target.value)}
                disabled={isDemoMode}
              >
                {orderedPeriods.map((s) => (
                  <option key={s.id} value={s.id}>{formatSemesterName(s.period_name)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Period list */}
          <div className="flex flex-col gap-2 max-w-full min-w-0 overflow-x-hidden">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">All Periods</div>
            <div className="flex items-center justify-between gap-2.5">
              <div className="relative flex-1 min-w-0" style={{ width: "min(360px, 100%)" }}>
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none [&_svg]:size-4" aria-hidden="true"><SearchIcon /></span>
                <input
                  className="h-9 w-full rounded-md border border-input bg-background pl-[34px] pr-3 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
                  type="text"
                  placeholder="Search periods"
                  aria-label="Search periods"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="inline-flex items-center gap-1.5 rounded-full bg-primary border-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-md hover:shadow-lg disabled:pointer-events-none disabled:opacity-60 ml-auto shrink-0" type="button" onClick={() => setShowCreate(true)}>
                <span aria-hidden="true"><CirclePlusIcon className="size-3.5" /></span>
                Period
              </button>
            </div>

            {visibleSemesters.map((s) => (
              <div key={s.id} data-testid="period-item" className={cn(
                "flex justify-between gap-3 rounded-xl border px-3 py-2.5 bg-background items-center flex-nowrap max-w-full min-w-0 overflow-x-hidden",
                (s.is_current || s.id === currentPeriodId) && "border-primary border-2 shadow-none"
              )}>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div data-testid="period-item-title" className="font-semibold text-foreground max-w-full whitespace-nowrap overflow-x-auto scrollbar-none relative pr-4.5">{formatSemesterName(s.period_name)}</div>
                  </div>
                  {(s.is_current || s.id === currentPeriodId) && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium [&_svg]:size-3.5">
                      <span aria-hidden="true">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 14v2.2l1.6 1" />
                          <path d="M16 2v4" />
                          <path d="M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5" />
                          <path d="M3 10h5" />
                          <path d="M8 2v4" />
                          <circle cx="16" cy="16" r="6" />
                        </svg>
                      </span>
                      <span>Current Period</span>
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                    <span className="inline-flex items-center shrink-0 text-muted-foreground [&_svg]:size-3.5" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M8 2v4" /><path d="M16 2v4" />
                        <rect width="18" height="18" x="3" y="4" rx="2" />
                        <path d="M3 10h18" /><path d="M8 14h.01" />
                        <path d="M12 14h.01" /><path d="M16 14h.01" />
                        <path d="M8 18h.01" /><path d="M12 18h.01" /><path d="M16 18h.01" />
                      </svg>
                    </span>
                    <span>{formatDate(s.start_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                    <LastActivity value={getLastActivity(s)} />
                  </div>
                  {(!Array.isArray(s.criteria_config) || s.criteria_config.length === 0) && (
                    <span className="period-default-template-badge text-xs text-muted-foreground">
                      <span aria-hidden="true"><TriangleAlertLucideIcon width={13} height={13} /></span>
                      {" "}Default criteria — no custom template saved
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Tooltip text="Edit period">
                    <button
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-input bg-background px-3 h-[34px] text-muted-foreground shadow-sm cursor-pointer transition-all hover:-translate-y-px hover:border-border hover:shadow-md"
                      type="button"
                      aria-label={`Edit ${s.period_name}`}
                      onClick={() => {
                        const normalizedDate = normalizeDateInput(s.start_date);
                        setEditForm({
                          id: s.id,
                          period_name: s.period_name || "",
                          start_date: normalizedDate,
                          criteria_config: Array.isArray(s.criteria_config) && s.criteria_config.length > 0
                            ? s.criteria_config
                            : defaultCriteriaConfig(),
                          outcome_config: Array.isArray(s.outcome_config) && s.outcome_config.length > 0
                            ? s.outcome_config
                            : defaultOutcomeConfig(),
                        });
                        editOrigRef.current = { period_name: s.period_name || "", start_date: normalizedDate };
                        setEditCriteriaDirty(false);
                        setEditMudekDirty(false);
                        setEditTab("period");
                        setShowEdit(true);
                      }}
                    >
                      <PencilIcon />
                      <span className="text-xs font-semibold max-md:hidden">Edit</span>
                    </button>
                  </Tooltip>
                  <DangerIconButton
                    ariaLabel={`Delete ${s.period_name}`}
                    title={s.id === currentPeriodId
                      ? "Cannot delete the current period"
                      : "Delete period"}
                    showLabel={true}
                    label="Delete Period"
                    labelClassName="max-md:hidden"
                    disabled={s.id === currentPeriodId}
                    onClick={() => onDeleteSemester?.(s)}
                  />
                </div>
              </div>
            ))}

            {normalizedSearch && filteredSemesters.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">No periods match your search.</div>
            )}
          </div>

          {!normalizedSearch && orderedPeriods.length > 4 && (
            <button
              className="inline-flex items-center gap-1.5 border-transparent bg-transparent text-primary pl-0 text-xs font-semibold cursor-pointer"
              type="button"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? "Show fewer periods" : `Show all periods (${orderedPeriods.length})`}
            </button>
          )}

          {/* ── Create Period modal ── */}
          {showCreate && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true">
              <div data-testid="modal-card" className="w-[min(520px,92vw)] max-w-[100vw] max-h-[90vh] rounded-2xl border bg-card shadow-lg flex flex-col gap-3 relative overflow-hidden min-w-[min(320px,90vw)] min-h-[min(200px,80vh)]">
                <div className="flex items-center gap-2.5 text-foreground mb-0.5 px-5 pt-5">
                  <span className="inline-flex items-center justify-center size-9 rounded-xl bg-muted text-muted-foreground border border-input [&_svg]:size-[18px]" aria-hidden="true"><CirclePlusIcon /></span>
                  <div className="text-lg font-bold tracking-tight">Create Period</div>
                </div>

                <div className="px-5">
                  <SemesterEditorTabs activeTab={createTab} onTab={setCreateTab} />
                </div>

                <div className="flex flex-col gap-3 px-6 py-4 flex-1 overflow-y-auto min-h-0 pr-5">
                  {/* Tab 1: Period metadata */}
                  {createTab === "period" && (
                    <>
                      <label className="text-sm font-medium">Period name</label>
                      <input
                        className={cn(
                          "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus:ring-2 focus:ring-ring",
                          createError && "border-destructive ring-destructive/20 ring-2"
                        )}
                        value={createForm.period_name}
                        onChange={(e) => {
                          setCreateForm((f) => ({ ...f, period_name: e.target.value }));
                          if (createError) setCreateError("");
                        }}
                        placeholder="2026 Spring"
                      />
                      {createError && <div className="text-sm text-destructive">{createError}</div>}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">Poster date</label>
                        <input
                          type="date"
                          className={cn(
                            "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus:ring-2 focus:ring-ring",
                            !createForm.start_date && "text-muted-foreground",
                            createMeta.yearError && "border-destructive ring-destructive/20 ring-2"
                          )}
                          value={createForm.start_date}
                          onChange={(e) => setCreateForm((f) => ({ ...f, start_date: e.target.value }))}
                          min={minPosterDate}
                          max={maxPosterDate}
                          aria-invalid={!!createMeta.yearError}
                        />
                      </div>
                      {createMeta.yearError && <div className="text-sm text-destructive">{createMeta.yearError}</div>}
                      <p className="text-xs text-muted-foreground">
                        Evaluation criteria and MÜDEK Outcomes are pre-seeded with defaults.
                        You can customise them in the other tabs after creation, or now.
                      </p>
                    </>
                  )}

                  {/* Tab 2: Criteria — secondary during create */}
                  {createTab === "criteria" && (
                    <CriteriaManager
                      key={`create-criteria-${JSON.stringify(createCriteriaTemplate)}-${JSON.stringify(createForm.outcome_config.map((o) => o.code))}`}
                      template={createCriteriaTemplate}
                      outcomeConfig={createForm.outcome_config}
                      disabled={false}
                      isLocked={false}
                      onSave={async (template) => {
                        setCreateForm((f) => ({ ...f, criteria_config: template }));
                        return { ok: true };
                      }}
                    />
                  )}

                  {/* Tab 3: MÜDEK — secondary during create */}
                  {createTab === "mudek" && (
                    <MudekManager
                      outcomeConfig={createForm.outcome_config}
                      criteriaConfig={createCriteriaTemplate}
                      disabled={false}
                      isLocked={false}
                      onDraftChange={(template) => {
                        setCreateForm((f) => ({
                          ...f,
                          outcome_config: template,
                          criteria_config: pruneCriteriaMudekMappings(f.criteria_config, template),
                        }));
                      }}
                      onSave={async (template) => {
                        const prunedCriteria = pruneCriteriaMudekMappings(createCriteriaTemplate, template);
                        setCreateForm((f) => ({ ...f, outcome_config: template, criteria_config: prunedCriteria }));
                        return { ok: true };
                      }}
                    />
                  )}
                </div>

                <div className="flex justify-end gap-3 border-t px-6 py-4 shrink-0 mt-auto pt-3">
                  <button className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50" type="button" onClick={closeCreate}>
                    Cancel
                  </button>
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                    type="button"
                    disabled={!createMeta.canSubmit || isDemoMode}
                    onClick={async () => {
                      const trimmedName = createForm.period_name.trim();
                      const duplicate = uniqueSemesters.some(
                        (s) => (s.period_name || "").trim().toLowerCase() === trimmedName.toLowerCase()
                      );
                      if (duplicate) {
                        setCreateError(`A period named "${trimmedName}" already exists.`);
                        setCreateTab("period");
                        return;
                      }
                      const res = await onCreateSemester({
                        period_name: trimmedName,
                        start_date: createForm.start_date,
                        criteria_config: createForm.criteria_config,
                        outcome_config: createForm.outcome_config,
                      });
                      if (res?.fieldErrors) {
                        setCreateError(res.fieldErrors.period_name || res.fieldErrors.start_date || "Invalid period data.");
                        setCreateTab("period");
                        return;
                      }
                      closeCreate();
                    }}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Edit Period modal ── */}
          {showEdit && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true">
              <div className="w-[min(520px,92vw)] max-w-[100vw] max-h-[90vh] rounded-2xl border bg-card shadow-lg flex flex-col gap-3 relative overflow-hidden min-w-[min(320px,90vw)] min-h-[min(200px,80vh)]">
                <div className="flex items-center gap-2.5 text-foreground mb-0.5 px-5 pt-5">
                  <span className="inline-flex items-center justify-center size-9 rounded-xl bg-muted text-muted-foreground border border-input [&_svg]:size-[18px]" aria-hidden="true"><PencilIcon /></span>
                  <div className="text-lg font-bold tracking-tight">Edit Period</div>
                </div>

                <div className="px-5">
                  <SemesterEditorTabs activeTab={editTab} onTab={setEditTab} dirtyTabs={{ criteria: editCriteriaDirty, mudek: editMudekDirty }} />
                </div>

                {staleSemester && (
                  <AlertCard variant="warning">
                    This period was updated in another session. Reload before saving to avoid overwriting newer changes.
                  </AlertCard>
                )}

                <div className="flex flex-col gap-3 px-6 py-4 flex-1 overflow-y-auto min-h-0 pr-5">
                  {/* Tab 1: Period metadata */}
                  {editTab === "period" && (
                    <>
                      <label className="text-sm font-medium">Period name</label>
                      <input
                        className={cn(
                          "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus:ring-2 focus:ring-ring",
                          editError && "border-destructive ring-destructive/20 ring-2"
                        )}
                        value={editForm.period_name}
                        onChange={(e) => {
                          setEditForm((f) => ({ ...f, period_name: e.target.value }));
                          if (editError) setEditError("");
                        }}
                        placeholder="2026 Spring"
                      />
                      {editError && <div className="text-sm text-destructive">{editError}</div>}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium">Poster date</label>
                        <input
                          type="date"
                          className={cn(
                            "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm outline-none transition-colors focus:ring-2 focus:ring-ring",
                            !editForm.start_date && "text-muted-foreground",
                            editMeta.yearError && "border-destructive ring-destructive/20 ring-2"
                          )}
                          value={editForm.start_date}
                          onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
                          min={minPosterDate}
                          max={maxPosterDate}
                          aria-invalid={!!editMeta.yearError}
                        />
                      </div>
                      {editMeta.yearError && <div className="text-sm text-destructive">{editMeta.yearError}</div>}
                    </>
                  )}

                  {/* Tab 2: Criteria */}
                  {editTab === "criteria" && (
                    <CriteriaManager
                      key={`edit-criteria-${editForm.id}-${JSON.stringify(editCriteriaTemplate)}-${JSON.stringify(editForm.outcome_config.map((o) => o.code))}`}
                      template={editCriteriaTemplate}
                      outcomeConfig={editForm.outcome_config}
                      disabled={false}
                      isLocked={isLockedFn ? isLockedFn(editForm.id) : false}
                      saveDisabled={isDemoMode}
                      onDirtyChange={setEditCriteriaDirty}
                      onSave={async (template) => {
                        if (!onUpdateCriteriaTemplate) return { ok: false, error: "Not configured" };
                        const result = await onUpdateCriteriaTemplate(
                          editForm.id,
                          editForm.period_name.trim(),
                          editForm.start_date,
                          template
                        );
                        if (result?.ok) {
                          setEditForm((f) => ({ ...f, criteria_config: template }));
                        }
                        return result;
                      }}
                    />
                  )}

                  {/* Tab 3: MÜDEK */}
                  {editTab === "mudek" && (
                    <MudekManager
                      outcomeConfig={editForm.outcome_config}
                      criteriaConfig={editCriteriaTemplate}
                      disabled={false}
                      isLocked={isLockedFn ? isLockedFn(editForm.id) : false}
                      saveDisabled={isDemoMode}
                      onDirtyChange={setEditMudekDirty}
                      onDraftChange={(template) => {
                        setEditForm((f) => ({
                          ...f,
                          outcome_config: template,
                          criteria_config: pruneCriteriaMudekMappings(f.criteria_config, template),
                        }));
                        setEditCriteriaDirty(true);
                      }}
                      onSave={async (template) => {
                        const prunedCriteria = pruneCriteriaMudekMappings(editCriteriaTemplate, template);
                        const criteriaChanged = prunedCriteria !== editCriteriaTemplate;

                        if (criteriaChanged) {
                          const res = await onUpdateSemester({
                            id: editForm.id,
                            period_name: editForm.period_name.trim(),
                            start_date: editForm.start_date,
                            outcome_config: template,
                            criteria_config: prunedCriteria,
                          });
                          if (res?.fieldErrors) return { ok: false, error: "Invalid period data." };
                          if (res?.ok === false) {
                            return {
                              ok: false,
                              error: res?.error || "Could not save MÜDEK Outcomes.",
                            };
                          }
                          
                          setEditForm((f) => ({ ...f, outcome_config: template, criteria_config: prunedCriteria }));
                          return { ok: true };
                        } else {
                          if (!onUpdateMudekTemplate) return { ok: false, error: "Not configured" };
                          const result = await onUpdateMudekTemplate(
                            editForm.id,
                            editForm.period_name.trim(),
                            editForm.start_date,
                            template
                          );
                          if (result?.ok) {
                            setEditForm((f) => ({ ...f, outcome_config: template }));
                          }
                          return result;
                        }
                      }}
                    />
                  )}
                </div>

                <div className="flex justify-end gap-2.5 border-t pt-4">
                  {editTab !== "period" && (
                    <div className="text-xs text-muted-foreground">
                      Save template changes with the tab-specific button ({editTab === "criteria" ? "Save Criteria" : "Save MÜDEK Outcomes"}).
                    </div>
                  )}
                  <button className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50" type="button" onClick={closeEdit}>
                    Cancel
                  </button>
                  {/* Save button on Period tab saves name/date only */}
                  {editTab === "period" && (
                    <button
                      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                      type="button"
                      disabled={!editMeta.canSubmit || staleSemester || isDemoMode}
                      title={staleSemester ? "Reload the page before saving — this period was updated externally" : undefined}
                      onClick={async () => {
                        const res = await onUpdateSemester({
                          id: editForm.id,
                          period_name: editForm.period_name.trim(),
                          start_date: editForm.start_date,
                        });
                        if (res?.fieldErrors) {
                          setEditError(res.fieldErrors.period_name || res.fieldErrors.start_date || "Invalid period data.");
                          return;
                        }
                        closeEdit();
                      }}
                    >
                      Save
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={leaveDialogOpen}
        onOpenChange={setLeaveDialogOpen}
        title="Unsaved changes"
        body="You have unsaved changes. Leave anyway?"
        confirmLabel="Leave anyway"
        cancelLabel="Keep editing"
        onConfirm={handleLeaveConfirm}
      />
    </div>
  );
}
