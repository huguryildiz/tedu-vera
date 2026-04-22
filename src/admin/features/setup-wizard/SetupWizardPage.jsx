// src/admin/pages/SetupWizardPage.jsx — Setup wizard for first-time organization admin
// ============================================================
// 5-step wizard guiding admins through initial evaluation setup.
// Steps: Welcome → Period → Criteria (+Framework) → Projects → Jurors (+Launch)

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useAdminContext } from "@/admin/hooks/useAdminContext";
import { useSetupWizard } from "./useSetupWizard";
import { useToast } from "@/shared/hooks/useToast";
import ImportJurorsModal from "@/admin/shared/ImportJurorsModal";
import ImportCsvModal from "@/admin/modals/ImportCsvModal";
import { parseJurorsCsv, parseProjectsCsv } from "@/admin/utils/csvParser";
import { normalizeStudentNames } from "@/admin/utils/auditUtils";
import { avatarGradient, initials } from "@/shared/ui/avatarColor";
import {
  createPeriod,
  savePeriodCriteria,
  createJuror,
  createProject,
  generateEntryToken,
  listPeriodOutcomes,
  listPeriodCriteriaForMapping,
  upsertPeriodCriterionOutcomeMap,
  assignFrameworkToPeriod,
  getVeraStandardCriteria,
  setPeriodCriteriaName,
  checkPeriodReadiness,
  publishPeriod,
  markSetupComplete,
  getSecurityPolicy,
} from "@/shared/api";
import { useAuth } from "@/auth";
import { KEYS } from "@/shared/storage/keys";
import { CRITERIA } from "@/shared/constants";
import QRCodeStyling from "qr-code-styling";
import veraLogo from "@/assets/vera_logo.png";
import {
  Diamond,
  CalendarRange,
  ClipboardCheck,
  Users,
  Layers,
  Zap,
  BookOpen,
  Plus,
  X,
  Check,
  ArrowRight,
  Clock,
  Star,
  Upload,
  AlertCircle,
  QrCode,
  Loader2,
  Copy,
  CheckCircle2,
  Download,
} from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";
import "./SetupWizardPage.css";

// Celebratory confetti burst for the completion screen — mirrors jury DoneStep.
function useConfetti() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#3b82f6", "#60a5fa", "#6366f1", "#a5b4fc", "#22c55e", "#4ade80", "#f1f5f9"];
    const particles = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -10 - Math.random() * 100,
      r: 3 + Math.random() * 4,
      d: 1 + Math.random() * 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 3,
      tiltAngle: 0,
      opacity: 1,
    }));

    let frame = 0;
    const totalFrames = 140;
    let rafId;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.tiltAngle += 0.07;
        p.y += p.d;
        p.x += p.vx;
        const tilt = Math.sin(p.tiltAngle) * 8;
        if (frame > 80) p.opacity = Math.max(0, 1 - (frame - 80) / 60);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.5, tilt, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      frame++;
      if (frame < totalFrames) rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []);
  return canvasRef;
}

const STEP_LABELS = [
  "Welcome",
  "Period",
  "Criteria",
  "Projects",
  "Jurors",
];

const STEP_ICONS = {
  1: Diamond,
  2: CalendarRange,
  3: ClipboardCheck,
  4: Layers,
  5: Users,
};

// ============================================================
// Helper: Season auto-suggest based on current month
// ============================================================
function getSuggestedSeason() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();

  if (month >= 1 && month <= 5) return `Spring ${year}`;
  if (month >= 6 && month <= 8) return `Summer ${year}`;
  return `Fall ${year}`;
}

// ============================================================
// Helper: Build criteria payload for savePeriodCriteria
// ============================================================
function buildCriteriaPayload() {
  return CRITERIA.map((c) => ({
    key: c.id,
    label: c.label,
    shortLabel: c.shortLabel,
    color: c.color,
    max: c.max,
    blurb: c.blurb,
    outcomes: c.outcomes,
    rubric: c.rubric.map((r) => ({
      min: r.min,
      max: r.max,
      level: r.level,
      desc: r.desc,
    })),
  }));
}

// ============================================================
// Stepper Component
// ============================================================
function WizardStepper({ currentStep, completedSteps, onStepClick }) {
  const stepperRef = useRef(null);
  const activeRef = useRef(null);

  useEffect(() => {
    if (activeRef.current && stepperRef.current) {
      const container = stepperRef.current;
      const activeEl = activeRef.current;
      const offsetLeft = activeEl.offsetLeft - container.clientWidth / 2 + activeEl.clientWidth / 2;
      container.scrollTo({ left: offsetLeft, behavior: "smooth" });
    }
  }, [currentStep]);

  return (
    <div className="sw-stepper" ref={stepperRef}>
      {STEP_LABELS.map((label, idx) => {
        const step = idx + 1;
        const isActive = step === currentStep;
        const isCompleted = completedSteps.has(step);
        const stepClass = isCompleted ? "completed" : isActive ? "active" : "";
        const isClickable = isCompleted || step <= currentStep;

        return (
          <div key={step} ref={isActive ? activeRef : null}>
            <div
              className={`sw-step ${stepClass}${isClickable ? " clickable" : ""}`}
              onClick={isClickable ? () => onStepClick(step) : undefined}
            >
              <div className="sw-step-circle">
                {isCompleted ? <Check size={13} strokeWidth={2.5} /> : step}
              </div>
              <div className="sw-step-label">{label}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Step 1: Welcome
// ============================================================
function StepWelcome({ onContinue, onSkip }) {
  const previewIcons = [
    { icon: CalendarRange,  label: "Create Period",        color: "#3b82f6" },
    { icon: ClipboardCheck, label: "Criteria",             color: "#8b5cf6" },
    { icon: Layers,         label: "Add Projects",         color: "#f59e0b" },
    { icon: Users,          label: "Add Jurors",           color: "#10b981" },
    { icon: Zap,            label: "Launch",               color: "#f43f5e" },
  ];

  return (
    <div className="sw-card sw-fade-in">
      <div className="sw-card-icon">
        <Diamond size={24} />
      </div>
      <h2 className="sw-card-title">Set up your evaluation</h2>
      <p className="sw-card-desc">
        Configure your first evaluation period in a few straightforward steps.
        You can always adjust settings later.
      </p>

      <div className="sw-steps-preview">
        {previewIcons.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="sw-preview-item" style={{ "--pi-delay": `${idx * 80}ms`, "--pi-float-delay": `${idx * 370}ms` }}>
              <div
                className="sw-preview-icon sw-preview-icon--color"
                style={{
                  "--pi-color": item.color,
                  "--pi-bg": item.color + "18",
                  "--pi-border": item.color + "38",
                }}
              >
                <Icon size={18} />
              </div>
              <div className="sw-preview-label">{item.label}</div>
            </div>
          );
        })}
      </div>

      <div className="sw-time-estimate">
        <Clock size={14} />
        Estimated time: ~5 minutes
      </div>

      <div className="sw-actions">
        <button className="sw-btn sw-btn-primary" onClick={onContinue}>
          Get Started <ArrowRight size={16} />
        </button>
      </div>

      <div className="sw-footer">
        <button className="sw-btn-link" onClick={onSkip}>
          I'll set up later
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Step 2: Create Evaluation Period
// ============================================================
function StepCreatePeriod({ onContinue, onBack, onCreateNew, existingPeriods = [], wizardPeriodId }) {
  const toast = useToast();
  const { activeOrganization, fetchData } = useAdminContext();
  const existingPeriod = wizardPeriodId
    ? existingPeriods.find((p) => p.id === wizardPeriodId) ?? null
    : null;
  const [formData, setFormData] = useState({
    periodName: getSuggestedSeason(),
    description: "",
    startDate: "",
    endDate: "",
  });
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  const handleCreate = async () => {
    const trimmed = formData.periodName.trim();
    if (!trimmed) {
      setNameError("Period name is required.");
      return;
    }
    const duplicate = existingPeriods.some(
      (p) => p.name?.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setNameError("A period with this name already exists. Please choose a different name.");
      return;
    }
    if (!activeOrganization?.id) {
      toast.error("No organization selected. Please select an organization first.");
      return;
    }

    setSaving(true);
    try {
      const result = await createPeriod({
        organizationId: activeOrganization.id,
        name: formData.periodName,
        description: formData.description || null,
        start_date: formData.startDate || null,
        end_date: formData.endDate || null,
      });

      toast.success("Period created");
      try { await fetchData(); } catch { /* non-fatal */ }
      onContinue(result.id);
    } catch (err) {
      toast.error("Failed to create period: " + (err?.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  if (existingPeriod) {
    const fmt = (d) => {
      if (!d) return null;
      try { return new Date(d).toLocaleDateString(); } catch { return d; }
    };
    const dateRange = [fmt(existingPeriod.start_date), fmt(existingPeriod.end_date)]
      .filter(Boolean)
      .join(" → ");
    const subParts = [existingPeriod.description, dateRange].filter(Boolean);
    return (
      <div className="sw-card sw-fade-in">
        <div className="sw-status-chip">
          <CheckCircle2 size={12} /> Completed
        </div>
        <div className="sw-card-icon">
          <CalendarRange size={24} />
        </div>
        <h2 className="sw-card-title">Create your first evaluation period</h2>
        <p className="sw-card-desc">
          An evaluation period defines the timeframe and context for a set of jury evaluations.
        </p>
        <div className="sw-done-summary">
          <div className="sw-done-summary-icon">
            <Check size={16} strokeWidth={2.5} />
          </div>
          <div className="sw-done-summary-body">
            <div className="sw-done-summary-meta">Period created</div>
            <div className="sw-done-summary-title">{existingPeriod.name}</div>
            {subParts.length > 0 && (
              <div className="sw-done-summary-sub">{subParts.join(" · ")}</div>
            )}
          </div>
        </div>
        <div className="sw-actions">
          <button className="sw-btn sw-btn-primary" onClick={() => onContinue(existingPeriod.id)}>
            Continue <ArrowRight size={16} />
          </button>
        </div>
        <div className="sw-footer sw-footer-stack">
          {onCreateNew && (
            <button className="sw-btn-link" onClick={onCreateNew}>
              Create a new period instead
            </button>
          )}
          <button className="sw-btn-link" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sw-card sw-fade-in">
      <div className="sw-card-icon">
        <CalendarRange size={24} />
      </div>
      <h2 className="sw-card-title">Create your first evaluation period</h2>
      <p className="sw-card-desc">
        An evaluation period defines the timeframe and context for a set of jury
        evaluations.
      </p>

      <div className="sw-form-group">
        <label className="sw-form-label">
          Period Name <span className="sw-required">*</span>
        </label>
        <input
          type="text"
          className={`sw-form-input${nameError ? " error" : ""}`}
          placeholder="e.g., Spring 2024"
          value={formData.periodName}
          onChange={(e) => {
            setFormData({ ...formData, periodName: e.target.value });
            if (nameError) setNameError("");
          }}
        />
        {nameError ? (
          <p className="vera-inline-error"><AlertCircle size={12} strokeWidth={2} />{nameError}</p>
        ) : (
          <div className="sw-form-hint">
            Auto-suggested based on current date. You can customize it.
          </div>
        )}
      </div>

      <div className="sw-form-group">
        <label className="sw-form-label">Description <span className="sw-form-optional">(optional)</span></label>
        <textarea
          className="sw-form-input"
          placeholder="Optional description for this evaluation period"
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
        />
      </div>

      <div className="sw-form-row">
        <div className="sw-form-group">
          <label className="sw-form-label">Start Date <span className="sw-form-optional">(optional)</span></label>
          <input
            type="date"
            className="sw-form-input"
            value={formData.startDate}
            onChange={(e) =>
              setFormData({ ...formData, startDate: e.target.value })
            }
          />
        </div>
        <div className="sw-form-group">
          <label className="sw-form-label">End Date <span className="sw-form-optional">(optional)</span></label>
          <input
            type="date"
            className="sw-form-input"
            value={formData.endDate}
            onChange={(e) =>
              setFormData({ ...formData, endDate: e.target.value })
            }
          />
        </div>
      </div>

      <div className="sw-actions">
        <button
          className="sw-btn sw-btn-primary"
          onClick={handleCreate}
          disabled={saving}
        >
          {saving ? <><Loader2 size={16} className="sw-btn-spinner" /> Creating…</> : <>Create Period & Continue <ArrowRight size={16} /></>}
        </button>
      </div>

      <div className="sw-footer">
        <button className="sw-btn-link" onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Step 3: Criteria + Framework (merged)
// ============================================================
// Phase 1 = criteria setup, Phase 2 = (optional) framework selection.
// After criteria are saved the wizard automatically transitions to the framework
// phase. Framework is optional — skipping it advances to step 4 (Projects).
function StepCriteriaAndFramework({ periodId, frameworks, onContinue, onBack }) {
  const { criteriaConfig, sortedPeriods } = useAdminContext();

  const currentPeriod = (sortedPeriods || []).find((p) => p.id === periodId) ?? null;
  const assignedFramework = currentPeriod?.framework_id
    ? (frameworks || []).find((fw) => fw.id === currentPeriod.framework_id) ?? null
    : null;

  // Scope hasCriteria to the CURRENT period via criteria_name — criteriaConfig may
  // transiently hold stale data from a previous period before fetchData completes
  // (e.g. after "Create a new period instead"). criteria_name is set atomically when
  // criteria are saved, so it reliably reflects this period's state.
  const hasCriteria = !!currentPeriod?.criteria_name
    && Array.isArray(criteriaConfig) && criteriaConfig.length > 0;

  const [phase, setPhase] = useState(hasCriteria ? "framework" : "criteria");

  // Reset phase whenever the period changes so a new period always starts at "criteria".
  useEffect(() => {
    setPhase(hasCriteria ? "framework" : "criteria");
  // periodId is the only dependency we need — hasCriteria intentionally excluded
  // so that data-loading after period creation doesn't re-trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId]);

  // When criteria are saved in the criteria phase, advance automatically.
  useEffect(() => {
    if (hasCriteria && phase === "criteria") setPhase("framework");
  }, [hasCriteria, phase]);

  // Combined done state: both criteria and framework are set — show unified summary.
  if (hasCriteria && assignedFramework) {
    const total = criteriaConfig.reduce((sum, c) => sum + (c.max || 0), 0);
    const maxPct = total > 0
      ? Math.max(...criteriaConfig.map((c) => ((c.max || 0) / total) * 100))
      : 100;
    return (
      <div className="sw-card sw-fade-in">
        <div className="sw-status-chip">
          <CheckCircle2 size={12} /> Configured
        </div>
        <div className="sw-card-icon">
          <ClipboardCheck size={24} />
        </div>
        <h2 className="sw-card-title">Criteria & Framework</h2>
        <p className="sw-card-desc">
          Your evaluation criteria and accreditation framework are configured for this period.
        </p>

        <div className="sw-done-summary">
          <div className="sw-done-summary-icon"><Check size={16} strokeWidth={2.5} /></div>
          <div className="sw-done-summary-body">
            <div className="sw-done-summary-meta">Criteria set</div>
            <div className="sw-done-summary-title">
              {criteriaConfig.length} criteria · {total} points total
            </div>
          </div>
        </div>
        <div className="sw-criteria-preview" style={{ marginBottom: 16 }}>
          {criteriaConfig.map((c) => {
            const fillPct = total > 0 ? ((c.max || 0) / total) * 100 : 0;
            return (
              <div key={c.key ?? c.id} className="sw-criteria-row">
                <div className="sw-criteria-dot" style={{ backgroundColor: c.color }} />
                <div className="sw-criteria-name">{c.label}</div>
                <div className="sw-criteria-pts">{c.max} pts</div>
                <div className="sw-criteria-bar">
                  <div className="sw-criteria-bar-fill" style={{
                    backgroundColor: c.color,
                    width: `${(fillPct / maxPct) * 100}%`,
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="sw-done-summary">
          <div className="sw-done-summary-icon"><Check size={16} strokeWidth={2.5} /></div>
          <div className="sw-done-summary-body">
            <div className="sw-done-summary-meta">Framework assigned</div>
            <div className="sw-done-summary-title">{assignedFramework.name}</div>
            {assignedFramework.description && (
              <div className="sw-done-summary-sub">{assignedFramework.description}</div>
            )}
          </div>
        </div>

        <div className="sw-actions">
          <button className="sw-btn sw-btn-primary" onClick={() => onContinue(assignedFramework.id)}>
            Continue <ArrowRight size={16} />
          </button>
        </div>
        <div className="sw-footer sw-footer-stack">
          <button className="sw-btn-link" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  if (phase === "criteria") {
    return (
      <StepCriteria
        periodId={periodId}
        onContinue={() => setPhase("framework")}
        onBack={onBack}
      />
    );
  }

  return (
    <StepFramework
      periodId={periodId}
      frameworks={frameworks}
      onContinue={onContinue}
      onBack={() => setPhase("criteria")}
    />
  );
}

// ============================================================
// Step 3a: Set Framework (internal — used by StepCriteriaAndFramework)
// ============================================================
function StepFramework({ periodId, frameworks = [], onContinue, onBack }) {
  const toast = useToast();
  const { navigateTo, setSelectedPeriodId, fetchData, reloadCriteriaAndOutcomes, sortedPeriods } = useAdminContext();
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const currentPeriod = (sortedPeriods || []).find((p) => p.id === periodId) ?? null;
  const assignedFramework = currentPeriod?.framework_id
    ? (frameworks || []).find((fw) => fw.id === currentPeriod.framework_id) ?? null
    : null;

  const handleSelect = async (fw) => {
    if (!periodId) {
      onContinue(fw.id);
      return;
    }
    setSelected(fw.id);
    setSaving(true);
    try {
      await assignFrameworkToPeriod(periodId, fw.id);
      toast.success(`${fw.name} assigned`);
      onContinue(fw.id);
      await Promise.all([fetchData?.(), reloadCriteriaAndOutcomes?.()]);
    } catch (err) {
      toast.error("Failed to assign framework: " + (err?.message || String(err)));
      setSelected(null);
    } finally {
      setSaving(false);
    }
  };

  const BADGES = { MÜDEK: { label: "MÜDEK", color: "#2563eb" }, ABET: { label: "ABET", color: "#16a34a" } };
  const getBadge = (name = "") => Object.entries(BADGES).find(([k]) => name.toUpperCase().includes(k))?.[1];

  // Wizard only surfaces the canonical platform-level accreditation standards
  // (organization_id === null means global/built-in, not a tenant clone).
  // Custom/cloned frameworks and the generic VERA template are hidden here — they stay
  // available from Period settings but shouldn't distract a first-time admin.
  const visibleFrameworks = frameworks.filter((fw) => fw.organization_id === null && !!getBadge(fw.name));

  if (assignedFramework) {
    return (
      <div className="sw-card sw-fade-in">
        <div className="sw-status-chip">
          <CheckCircle2 size={12} /> Assigned
        </div>
        <div className="sw-card-icon">
          <BookOpen size={24} />
        </div>
        <h2 className="sw-card-title">Set accreditation framework</h2>
        <p className="sw-card-desc">
          Outcomes, analytics, and coverage tracking follow the selected framework.
        </p>
        <div className="sw-done-summary">
          <div className="sw-done-summary-icon">
            <Check size={16} strokeWidth={2.5} />
          </div>
          <div className="sw-done-summary-body">
            <div className="sw-done-summary-meta">Framework assigned</div>
            <div className="sw-done-summary-title">{assignedFramework.name}</div>
            {assignedFramework.description && (
              <div className="sw-done-summary-sub">{assignedFramework.description}</div>
            )}
          </div>
        </div>
        <div className="sw-actions">
          <button className="sw-btn sw-btn-primary" onClick={() => onContinue(assignedFramework.id)}>
            Continue <ArrowRight size={16} />
          </button>
        </div>
        <div className="sw-footer sw-footer-stack">
          <button className="sw-btn-link" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sw-card sw-fade-in">
      <div className="sw-card-icon">
        <BookOpen size={24} />
      </div>
      <h2 className="sw-card-title">Set accreditation framework</h2>
      <p className="sw-card-desc">
        Choose the accreditation standard for this period. Outcomes, analytics,
        and coverage tracking will follow the selected framework.
      </p>

      {visibleFrameworks.length === 0 ? (
        <div className="sw-warning-banner">
          <AlertCircle size={16} />
          No frameworks found. You can skip and assign a framework from Period settings later.
        </div>
      ) : (
        <div className="sw-template-cards sw-template-cards--grid">
          {visibleFrameworks.map((fw) => {
            const badge = getBadge(fw.name);
            const isActive = selected === fw.id;
            return (
              <div
                key={fw.id}
                className={`sw-template-card sw-framework-card${isActive ? " is-active" : ""}`}
              >
                <div className="sw-template-card-header">
                  <div className="sw-template-card-icon">
                    <BookOpen size={16} />
                  </div>
                  <div className="sw-template-card-title">{fw.name}</div>
                </div>
                {fw.description && (
                  <div className="sw-template-card-desc">{fw.description}</div>
                )}
                <button
                  className="sw-btn sw-btn-primary"
                  onClick={() => handleSelect(fw)}
                  disabled={saving}
                >
                  {saving && isActive
                    ? <><Loader2 size={16} className="sw-btn-spinner" /> Assigning…</>
                    : <>Use {fw.name} <ArrowRight size={16} /></>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <button
        className="sw-scratch-card"
        onClick={() => {
          if (periodId) setSelectedPeriodId(periodId);
          navigateTo("outcomes");
        }}
      >
        <div className="sw-scratch-card-icon">
          <Plus size={16} />
        </div>
        <div className="sw-scratch-card-body">
          <span className="sw-scratch-card-title">Create from scratch</span>
          <span className="sw-scratch-card-hint">Define your own outcomes and criteria in the Outcomes page</span>
        </div>
        <ArrowRight size={15} className="sw-scratch-card-arrow" />
      </button>

      <div className="sw-footer sw-footer-stack">
        <button className="sw-btn-link" onClick={() => onContinue(null)}>
          Skip for now →
        </button>
        <button className="sw-btn-link sw-btn-link-sub" onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Step 3b: Evaluation Criteria (internal — used by StepCriteriaAndFramework)
// ============================================================
function StepCriteria({ periodId, onContinue, onBack, loading }) {
  const toast = useToast();
  const { fetchData, navigateTo, setSelectedPeriodId, reloadCriteriaAndOutcomes, criteriaConfig, criteriaLoading, sortedPeriods } = useAdminContext();
  const hasCriteria = !criteriaLoading && Array.isArray(criteriaConfig) && criteriaConfig.length > 0;
  const criteriaName = sortedPeriods?.find((p) => p.id === periodId)?.criteria_name ?? null;
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [templateCriteria, setTemplateCriteria] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getVeraStandardCriteria()
      .then((rows) => { if (!cancelled) setTemplateCriteria(rows); })
      .catch(() => { /* fall through to CRITERIA constant */ })
      .finally(() => { if (!cancelled) setLoadingTemplate(false); });
    return () => { cancelled = true; };
  }, []);

  // Display criteria: DB rows if loaded, otherwise hardcoded fallback
  const displayCriteria = templateCriteria ?? CRITERIA;

  const handleApplyTemplate = async () => {
    if (!periodId) {
      toast.error("No period selected");
      return;
    }

    try {
      const payload = templateCriteria ? templateCriteria : buildCriteriaPayload();
      await savePeriodCriteria(periodId, payload);

      // Criterion↔outcome mappings live in period_criterion_outcome_maps now.
      // Create them explicitly after criteria save — the save RPC only writes
      // criterion metadata.
      const [periodOutcomes, periodCriteria] = await Promise.all([
        listPeriodOutcomes(periodId),
        listPeriodCriteriaForMapping(periodId),
      ]);
      const outcomeIdByCode = new Map(periodOutcomes.map((o) => [o.code, o.id]));
      const criterionIdByKey = new Map(periodCriteria.map((c) => [c.key, c.id]));
      for (const c of payload) {
        const critId = criterionIdByKey.get(c.key);
        if (!critId || !Array.isArray(c.outcomes)) continue;
        for (const code of c.outcomes) {
          const outcomeId = outcomeIdByCode.get(code);
          if (!outcomeId) continue;
          try {
            await upsertPeriodCriterionOutcomeMap({
              period_id: periodId,
              period_criterion_id: critId,
              period_outcome_id: outcomeId,
              coverage_type: "direct",
            });
          } catch {
            // Non-fatal: continue with remaining mappings.
          }
        }
      }

      await setPeriodCriteriaName(periodId, "VERA Standard");
      toast.success("Criteria applied");
      onContinue();
      await Promise.all([fetchData(), reloadCriteriaAndOutcomes?.()]);
    } catch (err) {
      toast.error("Failed to apply criteria: " + err.message);
    }
  };

  const handleBuildCustom = () => {
    if (periodId) setSelectedPeriodId(periodId);
    navigateTo("criteria");
  };

  const totalPoints = displayCriteria.reduce((sum, c) => sum + c.max, 0);
  const maxPercentage = displayCriteria.length > 0
    ? Math.max(...displayCriteria.map((c) => (c.max / totalPoints) * 100))
    : 100;

  if (hasCriteria) {
    const existingTotal = criteriaConfig.reduce((sum, c) => sum + (c.max || 0), 0);
    const existingMaxPct = criteriaConfig.length > 0 && existingTotal > 0
      ? Math.max(...criteriaConfig.map((c) => ((c.max || 0) / existingTotal) * 100))
      : 100;
    const criteriaLabels = criteriaConfig.map((c) => c.label).join(" · ");
    return (
      <div className="sw-card sw-fade-in">
        <div className="sw-status-chip">
          <CheckCircle2 size={12} /> Configured
        </div>
        <div className="sw-card-icon">
          <ClipboardCheck size={24} />
        </div>
        <h2 className="sw-card-title">Set up evaluation criteria</h2>
        <p className="sw-card-desc">
          Criteria define what jurors evaluate during this period.
        </p>
        <div className="sw-done-summary">
          <div className="sw-done-summary-icon">
            <Check size={16} strokeWidth={2.5} />
          </div>
          <div className="sw-done-summary-body">
            <div className="sw-done-summary-meta">Criteria set</div>
            <div className="sw-done-summary-title">
              {criteriaConfig.length} criteria · {existingTotal} points total
            </div>
            {criteriaLabels && (
              <div className="sw-done-summary-sub">{criteriaLabels}</div>
            )}
          </div>
        </div>
        <div className="sw-criteria-preview" style={{ marginBottom: 16 }}>
          {criteriaConfig.map((c) => {
            const fillPercentage = existingTotal > 0 ? ((c.max || 0) / existingTotal) * 100 : 0;
            return (
              <div key={c.key ?? c.id} className="sw-criteria-row">
                <div className="sw-criteria-dot" style={{ backgroundColor: c.color }} />
                <div className="sw-criteria-name">{c.label}</div>
                <div className="sw-criteria-pts">{c.max} pts</div>
                <div className="sw-criteria-bar">
                  <div
                    className="sw-criteria-bar-fill"
                    style={{
                      backgroundColor: c.color,
                      width: `${(fillPercentage / existingMaxPct) * 100}%`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {!criteriaName && (
          <div className="sw-form-group" style={{ marginBottom: 16 }}>
            <label className="sw-form-label">Criteria set name</label>
            <input
              className={`sw-form-input${nameError ? " error" : ""}`}
              type="text"
              placeholder="e.g. VERA Standard"
              value={nameInput}
              onChange={(e) => { setNameInput(e.target.value); if (nameError) setNameError(""); }}
            />
            {nameError && (
              <p className="crt-field-error"><AlertCircle size={12} strokeWidth={2} />{nameError}</p>
            )}
          </div>
        )}
        <div className="sw-actions">
          <button
            className="sw-btn sw-btn-primary"
            disabled={savingName}
            onClick={async () => {
              if (!criteriaName) {
                const trimmed = nameInput.trim();
                if (!trimmed) { setNameError("Please enter a name for this criteria set."); return; }
                setSavingName(true);
                try {
                  await setPeriodCriteriaName(periodId, trimmed);
                  await fetchData();
                } catch (err) {
                  toast.error("Could not save name: " + err.message);
                  setSavingName(false);
                  return;
                }
                setSavingName(false);
              }
              onContinue();
            }}
          >
            {savingName ? "Saving…" : <>Continue <ArrowRight size={16} /></>}
          </button>
        </div>
        <div className="sw-footer sw-footer-stack">
          <button className="sw-btn-link" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sw-card sw-fade-in">
      <div className="sw-card-icon">
        <ClipboardCheck size={24} />
      </div>
      <h2 className="sw-card-title">Set up evaluation criteria</h2>
      <p className="sw-card-desc">
        Criteria define what jurors evaluate. Choose a template for a quick
        start or build custom criteria.
      </p>

      <div className="sw-inline-alert">
        <FbAlert variant="warning" title="At least one criterion required">
          Your evaluation needs at least one scoring criterion before it can launch. Apply the VERA Standard template below for a fast start, or go to the Criteria page to define your own.
        </FbAlert>
      </div>

      <div className="sw-template-cards">
        {/* Template 1: Standard */}
        <div className="sw-template-card recommended">
          <div className="sw-template-card-header">
            <div className="sw-template-card-icon">
              <Star size={16} />
            </div>
            <div className="sw-template-card-title">VERA Standard</div>
            <div className="sw-template-card-badge">RECOMMENDED</div>
          </div>

          <div className="sw-criteria-preview">
            {loadingTemplate ? (
              <div className="sw-criteria-loading">
                <Loader2 size={16} className="sw-btn-spinner" /> Loading criteria…
              </div>
            ) : displayCriteria.map((c) => {
              const fillPercentage = (c.max / totalPoints) * 100;
              return (
                <div key={c.key ?? c.id} className="sw-criteria-row">
                  <div
                    className="sw-criteria-dot"
                    style={{ backgroundColor: c.color }}
                  />
                  <div className="sw-criteria-name">{c.label}</div>
                  <div className="sw-criteria-pts">{c.max} pts</div>
                  <div className="sw-criteria-bar">
                    <div
                      className="sw-criteria-bar-fill"
                      style={{
                        backgroundColor: c.color,
                        width: `${(fillPercentage / maxPercentage) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sw-criteria-info">
            {displayCriteria.length} criteria · {totalPoints} points total · 4-level
            rubric bands
          </div>

          <button
            className="sw-btn sw-btn-primary"
            onClick={handleApplyTemplate}
            disabled={loading || criteriaLoading}
          >
            {loading
              ? <><Loader2 size={16} className="sw-btn-spinner" /> Applying…</>
              : <>Apply Template & Continue <ArrowRight size={16} /></>}
          </button>
        </div>

      </div>

      <button className="sw-scratch-card" onClick={handleBuildCustom}>
        <div className="sw-scratch-card-icon">
          <Plus size={16} />
        </div>
        <div className="sw-scratch-card-body">
          <span className="sw-scratch-card-title">Build custom criteria</span>
          <span className="sw-scratch-card-hint">Define your own scoring categories, weights, and rubric bands in the Criteria page</span>
        </div>
        <ArrowRight size={15} className="sw-scratch-card-arrow" />
      </button>

      <div className="sw-footer">
        <button className="sw-btn-link" onClick={onBack}>
          ← Back
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Step 5: Add Jurors
// ============================================================
function StepJurors({ periodId, onContinue, onBack, onSkip, onLaunch, loading }) {
  const toast = useToast();
  const { activeOrganization, fetchData, allJurors, navigateTo, setSelectedPeriodId } = useAdminContext();
  // allJurors is already scoped to selectedPeriodId by listJurorsSummary —
  // items have no period_id field, so we can't filter by it. Trust the list.
  const periodJurors = allJurors || [];
  const [rows, setRows] = useState([{ name: "", affiliation: "", email: "" }]);
  const [rowErrors, setRowErrors] = useState([{ name: false, affiliation: false }]);
  const [importOpen, setImportOpen] = useState(false);

  const addRow = () => {
    setRows([...rows, { name: "", affiliation: "", email: "" }]);
    setRowErrors((prev) => [...prev, { name: false, affiliation: false }]);
  };

  const removeRow = (idx) => {
    setRows(rows.filter((_, i) => i !== idx));
    setRowErrors((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx, field, value) => {
    const updated = [...rows];
    updated[idx][field] = value;
    setRows(updated);
    if (field === "name" || field === "affiliation") {
      setRowErrors((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: false };
        return next;
      });
    }
  };

  const handleSave = async () => {
    const errors = rows.map((r) => ({ name: !r.name.trim(), affiliation: !r.affiliation.trim() }));
    const hasError = errors.some((e) => e.name || e.affiliation);
    const validRows = rows.filter((r) => r.name.trim() && r.affiliation.trim());
    if (validRows.length === 0) {
      setRowErrors(errors);
      toast.error("Please add at least one juror");
      return;
    }
    if (hasError) {
      setRowErrors(errors);
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      for (const row of validRows) {
        await createJuror({
          period_id: periodId,
          organization_id: activeOrganization?.id,
          juror_name: row.name,
          affiliation: row.affiliation,
          email: row.email || null,
        });
      }
      toast.success(`${validRows.length} jurors added`);
      onContinue();
      await fetchData();
    } catch (err) {
      toast.error("Failed to add jurors: " + err.message);
    }
  };

  if (periodJurors.length > 0) {
    return (
      <div className="sw-card sw-fade-in">
        <div className="sw-status-chip">
          <CheckCircle2 size={12} /> {periodJurors.length} added
        </div>
        <div className="sw-card-icon">
          <Users size={24} />
        </div>
        <h2 className="sw-card-title">Add your evaluation team</h2>
        <p className="sw-card-desc">
          Register the jurors who will evaluate projects during this period.
        </p>
        <div className="sw-done-summary">
          <div className="sw-done-summary-icon">
            <Check size={16} strokeWidth={2.5} />
          </div>
          <div className="sw-done-summary-body">
            <div className="sw-done-summary-meta">Jurors added</div>
            <div className="sw-done-summary-title">
              {periodJurors.length} {periodJurors.length === 1 ? "juror" : "jurors"} registered
            </div>
            <div className="sw-done-summary-sub">
              To add more or edit details, go to the Jurors page.
            </div>
          </div>
        </div>
        <div className="sw-existing-list">
          <div className="sw-existing-head">
            <span />
            <span>Juror</span>
            <span>Affiliation</span>
            <span>Email</span>
          </div>
          {periodJurors.map((j) => {
            const jName = j.juryName || j.juror_name || "";
            return (
              <div key={j.jurorId ?? j.id} className="sw-existing-item">
                <div className="sw-existing-item-icon sw-existing-item-icon--avatar">
                  <span className="sw-member-chip" style={{ background: avatarGradient(jName) }}>
                    {initials(jName)}
                  </span>
                </div>
                <span className="sw-existing-item-name">{jName || "—"}</span>
                <span className="sw-existing-item-meta">{j.affiliation || "—"}</span>
                <span className="sw-existing-item-meta">{j.email || "—"}</span>
              </div>
            );
          })}
        </div>
        <div className="sw-actions">
          <button className="sw-btn sw-btn-success" onClick={onLaunch}>
            <Zap size={16} /> Generate Entry Token
          </button>
        </div>
        <div className="sw-footer sw-footer-stack">
          <button
            className="sw-btn-link"
            onClick={() => { if (periodId) setSelectedPeriodId(periodId); navigateTo("jurors"); }}
          >
            Add more jurors →
          </button>
          <button className="sw-btn-link sw-btn-link-sub" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sw-card sw-fade-in">
      <div className="sw-card-icon">
        <Users size={24} />
      </div>
      <h2 className="sw-card-title">Add your evaluation team</h2>
      <p className="sw-card-desc">
        Register the jurors who will evaluate projects.
      </p>

      {rows.map((row, idx) => (
        <div key={idx} className="sw-item-row">
          <div className="sw-form-group">
            <label className="sw-form-label">
              Name <span className="sw-required">*</span>
            </label>
            <input
              type="text"
              className={`sw-form-input${rowErrors[idx]?.name ? " error" : ""}`}
              placeholder="Dr. Ayşe Demir"
              value={row.name}
              onChange={(e) => updateRow(idx, "name", e.target.value)}
            />
          </div>
          <div className="sw-form-group">
            <label className="sw-form-label">
              Affiliation <span className="sw-required">*</span>
            </label>
            <input
              type="text"
              className={`sw-form-input${rowErrors[idx]?.affiliation ? " error" : ""}`}
              placeholder="TED University"
              value={row.affiliation}
              onChange={(e) => updateRow(idx, "affiliation", e.target.value)}
            />
          </div>
          <div className="sw-form-group">
            <label className="sw-form-label">Email</label>
            <input
              type="email"
              className="sw-form-input"
              placeholder="juror@example.com"
              value={row.email}
              onChange={(e) => updateRow(idx, "email", e.target.value)}
            />
          </div>
          <button
            className="sw-item-remove"
            onClick={() => removeRow(idx)}
            type="button"
            aria-label="Remove juror"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <button className="sw-add-another-btn" onClick={addRow} type="button">
        <Plus size={14} /> Add Another Juror
      </button>

      <div className="sw-or-divider">or</div>

      <button className="sw-btn sw-btn-ghost" style={{ width: "100%" }} type="button" onClick={() => setImportOpen(true)}>
        <Upload size={14} /> Import from CSV
      </button>

      <div className="sw-actions">
        <button
          className="sw-btn sw-btn-primary"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? <><Loader2 size={16} className="sw-btn-spinner" /> Saving…</> : <>Save Jurors & Continue <ArrowRight size={16} /></>}
        </button>
      </div>

      <div className="sw-footer sw-footer-stack">
        <button className="sw-btn-link" onClick={onLaunch}>
          Skip jurors &amp; launch →
        </button>
        <button className="sw-btn-link sw-btn-link-sub" onClick={onBack}>
          ← Back
        </button>
      </div>

      <ImportJurorsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        parseFile={(f) => parseJurorsCsv(f, allJurors || [])}
        onImport={async (validRows) => {
          let imported = 0, skipped = 0, failed = 0;
          for (const row of validRows) {
            try {
              await createJuror({
                period_id: periodId,
                organization_id: activeOrganization?.id,
                juror_name: row.juror_name,
                affiliation: row.affiliation,
                email: row.email || null,
              });
              imported += 1;
            } catch (e) {
              const msg = String(e?.message || "").toLowerCase();
              if (msg.includes("duplicate") || msg.includes("uniq")) {
                skipped += 1;
              } else {
                failed += 1;
              }
            }
          }
          await fetchData();
          return { imported, skipped, failed };
        }}
      />
    </div>
  );
}

// ============================================================
// Step 6: Add Projects
// ============================================================
// Convert a comma/semicolon/newline-delimited member string to the JSONB
// shape the projects table expects: `[{ name, order }]`. Mirrors
// `membersToJsonb` in `useManageProjects.js`.
function membersStringToJsonb(value) {
  const normalized = normalizeStudentNames(value);
  const names = normalized
    ? normalized.split(";").map((s) => s.trim()).filter(Boolean)
    : [];
  return names.map((name, i) => ({ name, order: i + 1 }));
}

function StepProjects({ periodId, onContinue, onBack, loading }) {
  const toast = useToast();
  const { activeOrganization, fetchData, summaryData, navigateTo, setSelectedPeriodId } = useAdminContext();
  // summaryData is already scoped to selectedPeriodId by getProjectSummary —
  // items have no period_id field. Trust the list.
  const periodProjects = summaryData || [];
  const [rows, setRows] = useState([
    { title: "", advisor: "", teamMembers: [] },
  ]);
  const [rowErrors, setRowErrors] = useState([{ title: false, teamMembers: false }]);
  const [importOpen, setImportOpen] = useState(false);
  const cancelImportRef = useRef(false);

  const addRow = () => {
    setRows([...rows, { title: "", advisor: "", teamMembers: [] }]);
    setRowErrors((prev) => [...prev, { title: false, teamMembers: false }]);
  };

  const removeRow = (idx) => {
    setRows(rows.filter((_, i) => i !== idx));
    setRowErrors((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx, field, value) => {
    const updated = [...rows];
    updated[idx][field] = value;
    setRows(updated);
    if (field === "title" || field === "teamMembers") {
      setRowErrors((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], [field]: false };
        return next;
      });
    }
  };

  const handleSave = async () => {
    const errors = rows.map((r) => ({
      title: !r.title.trim(),
      teamMembers: !r.teamMembers.some((m) => m.trim()),
    }));
    const hasError = errors.some((e) => e.title || e.teamMembers);
    const validRows = rows.filter((r) => r.title.trim());
    if (validRows.length === 0) {
      setRowErrors(errors);
      toast.error("Please add at least one project");
      return;
    }

    const missingMembers = validRows.some(
      (r) => !r.teamMembers.some((m) => m.trim())
    );
    if (missingMembers || hasError) {
      setRowErrors(errors);
      toast.error("Team members are required for each project");
      return;
    }

    try {
      for (const row of validRows) {
        await createProject({
          period_id: periodId,
          title: row.title,
          advisor: row.advisor || null,
          members: row.teamMembers
            .filter((m) => m.trim())
            .map((name, i) => ({ name: name.trim(), order: i + 1 })),
        });
      }
      toast.success(`${validRows.length} projects added`);
      onContinue();
      await fetchData();
    } catch (err) {
      toast.error("Failed to add projects: " + err.message);
    }
  };

  if (periodProjects.length > 0) {
    return (
      <div className="sw-card sw-fade-in">
        <div className="sw-status-chip">
          <CheckCircle2 size={12} /> {periodProjects.length} registered
        </div>
        <div className="sw-card-icon">
          <Layers size={24} />
        </div>
        <h2 className="sw-card-title">Add projects</h2>
        <p className="sw-card-desc">
          Register the projects that jurors will evaluate during this period.
        </p>
        <div className="sw-done-summary">
          <div className="sw-done-summary-icon">
            <Check size={16} strokeWidth={2.5} />
          </div>
          <div className="sw-done-summary-body">
            <div className="sw-done-summary-meta">Projects registered</div>
            <div className="sw-done-summary-title">
              {periodProjects.length} {periodProjects.length === 1 ? "project" : "projects"}
            </div>
            <div className="sw-done-summary-sub">
              To add more or edit details, go to the Projects page.
            </div>
          </div>
        </div>
        <div className="sw-existing-list">
          <div className="sw-existing-head">
            <span />
            <span>Project Title</span>
            <span>Team Members</span>
            <span>Advisor</span>
          </div>
          {periodProjects.map((p) => (
            <div key={p.id} className="sw-existing-item">
              <div className="sw-existing-item-icon">
                <Layers size={13} />
              </div>
              <span className="sw-existing-item-name">{p.title || "—"}</span>
              <span className="sw-existing-item-meta">
                {(() => {
                  const arr = p.members
                    ? String(p.members).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
                    : [];
                  if (!arr.length) return <span style={{ color: "var(--text-tertiary)" }}>—</span>;
                  const visible = arr.slice(0, 5);
                  const extra = arr.length - visible.length;
                  return (
                    <span className="sw-member-chips">
                      {visible.map((name) => (
                        <span key={name} className="sw-member-chip-row">
                          <span className="sw-member-chip" style={{ background: avatarGradient(name) }}>
                            {initials(name)}
                          </span>
                          <span className="sw-member-chip-name">{name}</span>
                        </span>
                      ))}
                      {extra > 0 && (
                        <span className="sw-member-chip-row">
                          <span className="sw-member-chip sw-member-chip-more">+{extra} more</span>
                        </span>
                      )}
                    </span>
                  );
                })()}
              </span>
              <span className="sw-existing-item-meta">
                {p.advisor ? (
                  <span className="sw-member-chip-row">
                    <span className="sw-member-chip" style={{ background: avatarGradient(p.advisor) }}>
                      {initials(p.advisor)}
                    </span>
                    <span className="sw-member-chip-name">{p.advisor}</span>
                  </span>
                ) : "—"}
              </span>
            </div>
          ))}
        </div>
        <div className="sw-actions">
          <button className="sw-btn sw-btn-primary" onClick={onContinue}>
            Continue <ArrowRight size={16} />
          </button>
        </div>
        <div className="sw-footer sw-footer-stack">
          <button
            className="sw-btn-link"
            onClick={() => { if (periodId) setSelectedPeriodId(periodId); navigateTo("projects"); }}
          >
            Add more projects →
          </button>
          <button className="sw-btn-link sw-btn-link-sub" onClick={onBack}>← Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="sw-card sw-fade-in">
      <div className="sw-card-icon">
        <Layers size={24} />
      </div>
      <h2 className="sw-card-title">Add projects</h2>
      <p className="sw-card-desc">
        Register the projects that jurors will evaluate during this period.
      </p>

      {rows.map((row, idx) => (
        <div key={idx} className="sw-item-row">
          <div className="sw-form-group">
            <label className="sw-form-label">
              Project Title <span className="sw-required">*</span>
            </label>
            <input
              type="text"
              className={`sw-form-input${rowErrors[idx]?.title ? " error" : ""}`}
              placeholder="Autonomous Warehouse Router"
              value={row.title}
              onChange={(e) => updateRow(idx, "title", e.target.value)}
            />
          </div>
          <div className="sw-form-group">
            <label className="sw-form-label">
              Team Members <span className="sw-required">*</span>
            </label>
            <input
              type="text"
              className={`sw-form-input${rowErrors[idx]?.teamMembers ? " error" : ""}`}
              placeholder="Ali Vural, Zeynep Şahin, Ege Tan"
              defaultValue={row.teamMembers.join(", ")}
              onChange={(e) =>
                updateRow(idx, "teamMembers", e.target.value.split(",").map((s) => s.trim()))
              }
            />
          </div>
          <div className="sw-form-group">
            <label className="sw-form-label">Advisor</label>
            <input
              type="text"
              className="sw-form-input"
              placeholder="Dr. Mehmet Kara"
              value={row.advisor}
              onChange={(e) => updateRow(idx, "advisor", e.target.value)}
            />
          </div>
          <button
            className="sw-item-remove"
            onClick={() => removeRow(idx)}
            type="button"
            aria-label="Remove project"
          >
            <X size={14} />
          </button>
        </div>
      ))}

      <button className="sw-add-another-btn" onClick={addRow} type="button">
        <Plus size={14} /> Add Another Project
      </button>

      <div className="sw-or-divider">or</div>

      <button
        className="sw-btn sw-btn-ghost"
        style={{ width: "100%" }}
        type="button"
        onClick={() => setImportOpen(true)}
      >
        <Upload size={14} /> Import from CSV
      </button>

      <div className="sw-actions">
        <button
          className="sw-btn sw-btn-primary"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? <><Loader2 size={16} className="sw-btn-spinner" /> Saving…</> : <>Save Projects & Continue <ArrowRight size={16} /></>}
        </button>
      </div>

      <div className="sw-footer">
        <button className="sw-btn-link" onClick={onBack}>
          ← Back
        </button>
      </div>

      <ImportCsvModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        parseFile={(f) => parseProjectsCsv(f, summaryData || [])}
        onImport={async (validRows) => {
          cancelImportRef.current = false;
          let imported = 0, skipped = 0, failed = 0;
          for (const row of validRows) {
            if (cancelImportRef.current) break;
            try {
              await createProject({
                period_id: periodId,
                title: row.title,
                members: membersStringToJsonb(row.members),
              });
              imported += 1;
            } catch (e) {
              const msg = String(e?.message || "").toLowerCase();
              if (msg.includes("duplicate") || msg.includes("uniq")) {
                skipped += 1;
              } else {
                failed += 1;
              }
            }
          }
          await fetchData();
          return { imported, skipped, failed };
        }}
      />
    </div>
  );
}

// ============================================================
// Map a readiness check key from rpc_admin_check_period_readiness to the
// wizard step that owns that data. Used by CompletionScreen to render
// "Fix now" shortcuts that jump straight back to the offending step.
function readinessCheckToStep(check) {
  if (!check) return null;
  if (check.startsWith("criteria") || check === "weights") return 3;
  if (check === "no_framework" || check.startsWith("outcome")) return 3;
  if (check === "no_projects") return 4;
  if (check === "no_jurors") return 5;
  return null;
}

// ============================================================
// Completion Screen — two-phase token flow (pre-generate → generated)
// ============================================================
const QR_TTL_LABELS = { "12h": "12 hours", "24h": "24 hours", "48h": "48 hours", "7d": "7 days" };

function CompletionScreen({ periodId, organizationId, isDemoMode, onDashboard, onPublished, onMarkSetupComplete, onNavigateStep }) {
  const confettiRef = useConfetti();
  const toast = useToast();
  const { isSuper } = useAuth();
  const [entryToken, setEntryToken] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [readinessIssues, setReadinessIssues] = useState([]);
  const [qrTtlLabel, setQrTtlLabel] = useState("24 hours");
  const qrInstance = useRef(null);
  const qrRef = useRef(null);

  // Preview readiness on mount so the user sees any blockers (missing criteria,
  // no projects, etc.) BEFORE clicking Generate. The same check runs again at
  // publish time as a safety net, but surfacing issues here lets the user jump
  // straight back to the offending step instead of discovering the problem
  // only after clicking Generate.
  useEffect(() => {
    if (!periodId || entryToken) return;
    let cancelled = false;
    checkPeriodReadiness(periodId)
      .then((r) => {
        if (cancelled) return;
        const blockers = (r?.issues || []).filter((i) => i.severity === "required");
        setReadinessIssues(blockers);
      })
      .catch(() => { /* non-fatal — handleGenerate will surface any errors */ });
    return () => { cancelled = true; };
  }, [periodId, entryToken]);

  const entryUrl = entryToken
    ? `${window.location.origin}${isDemoMode ? "/demo" : ""}/eval?t=${encodeURIComponent(entryToken)}`
    : "";

  useEffect(() => {
    qrInstance.current = new QRCodeStyling({
      width: 200,
      height: 200,
      type: "svg",
      dotsOptions: { type: "extra-rounded", color: "#1e3a5f" },
      cornersSquareOptions: { type: "extra-rounded", color: "#1e3a5f" },
      cornersDotOptions: { type: "dot", color: "#2563eb" },
      backgroundOptions: { color: "#ffffff" },
      imageOptions: { crossOrigin: "anonymous", margin: 4, imageSize: 0.46 },
    });
  }, []);

  useEffect(() => {
    if (!qrInstance.current || !entryUrl) return;
    qrInstance.current.update({ data: entryUrl, image: veraLogo });
    if (qrRef.current) {
      qrRef.current.innerHTML = "";
      qrInstance.current.append(qrRef.current);
    }
  }, [entryUrl]);

  useEffect(() => {
    if (!isSuper) return;
    getSecurityPolicy()
      .then((p) => {
        const ttl = p?.qrTtl || "24h";
        setQrTtlLabel(QR_TTL_LABELS[ttl] ?? "24 hours");
      })
      .catch(() => {});
  }, [isSuper]);

  const handleDownloadQr = () => {
    if (!entryUrl) return;
    const hiRes = new QRCodeStyling({
      width: 800,
      height: 800,
      data: entryUrl,
      image: veraLogo,
      dotsOptions: { type: "extra-rounded", color: "#1e3a5f" },
      cornersSquareOptions: { type: "extra-rounded", color: "#1e3a5f" },
      cornersDotOptions: { type: "dot", color: "#2563eb" },
      backgroundOptions: { color: "#ffffff" },
      imageOptions: { crossOrigin: "anonymous", margin: 4, imageSize: 0.46 },
    });
    hiRes.download({ name: "vera-entry-token", extension: "png" });
  };

  const handleCopy = async () => {
    if (!entryUrl) return;
    try {
      await navigator.clipboard.writeText(entryUrl);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = entryUrl;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleGenerate = async () => {
    if (!periodId) {
      toast.error("No period selected");
      return;
    }
    setGenerating(true);
    try {
      const readiness = await checkPeriodReadiness(periodId);
      if (!readiness?.ok) {
        const blockers = (readiness?.issues || [])
          .filter((i) => i.severity === "required")
          .map((i) => i.msg)
          .join(" · ");
        toast.error(blockers ? `Cannot publish: ${blockers}` : "Period is not ready to publish.");
        return;
      }
      const publishResult = await publishPeriod(periodId);
      if (publishResult && publishResult.ok === false) {
        toast.error("Failed to publish period.");
        return;
      }
      const token = await generateEntryToken(periodId);
      setEntryToken(token);
      // Stamp organizations.setup_completed_at — wizard auto-redirect, sidebar
      // Setup link, and direct /admin/setup access all key off this flag.
      // Non-blocking: token is already issued; the migration backfill will
      // catch any failure on next admin login.
      if (organizationId) {
        try {
          await onMarkSetupComplete?.(organizationId);
        } catch (e) {
          console.warn("markSetupComplete failed (non-blocking):", e);
        }
      }
      toast.success("Period published — entry token ready.");
      onPublished?.();
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("period_not_published")) {
        toast.error("Period must be published before generating a token.");
      } else {
        toast.error("Failed to generate token: " + msg);
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      <div className="sw-card sw-completion sw-fade-in">
        <div className="sw-completion-icon">
          <Check size={36} strokeWidth={2.5} />
        </div>
        <h2 className="sw-card-title">Setup complete!</h2>
        <p className="sw-card-desc">
          All steps are done. Generate the entry token to make your evaluation live — jurors will use it to access the gate.
        </p>

        <div className="sw-token">
          <div className="sw-token-head">
            <QrCode size={15} />
            <span>Entry Token</span>
          </div>

          {entryToken ? (
            <>
              <div className="sw-token-desc">
                Share this link with jurors. They'll use it to access the evaluation gate.
              </div>
              <div className="sw-token-card">
                <div className="sw-token-qr-wrap">
                  <div className="sw-token-qr" ref={qrRef} />
                  <button type="button" className="sw-qr-download" onClick={handleDownloadQr}>
                    <Download size={11} strokeWidth={2} />
                    Download
                  </button>
                </div>
                <div className="sw-token-body">
                  <div className="sw-token-status">
                    <span className="sw-token-status-dot" />
                    Active
                  </div>
                  <div className="sw-token-url">
                    <span className="sw-token-url-text">{entryUrl}</span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={`sw-token-copy${copied ? " is-copied" : ""}`}
                      aria-label={copied ? "Copied" : "Copy entry URL"}
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 size={13} strokeWidth={2.25} />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={13} strokeWidth={2} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="sw-token-note">
                    Expires in {qrTtlLabel} · Scan to open on mobile
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="sw-token-desc">
                Jurors use this link to access your evaluation at the entry gate. Generate it to make your evaluation live.
              </div>
              {readinessIssues.length > 0 && (
                <div className="sw-readiness-block">
                  <FbAlert variant="danger" title="Cannot publish yet">
                    <ul className="sw-readiness-list">
                      {readinessIssues.map((issue, idx) => {
                        const step = readinessCheckToStep(issue.check);
                        return (
                          <li key={idx}>
                            <span>{issue.msg}</span>
                            {step && onNavigateStep && (
                              <button
                                type="button"
                                className="sw-readiness-fix"
                                onClick={() => onNavigateStep(step)}
                              >
                                Fix now <ArrowRight size={12} />
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </FbAlert>
                </div>
              )}
              <div className="sw-token-generate">
                <button
                  className="sw-btn sw-btn-primary"
                  onClick={handleGenerate}
                  disabled={generating || readinessIssues.length > 0}
                >
                  {generating ? (
                    <><Loader2 size={15} className="sw-btn-spinner" /> Generating…</>
                  ) : (
                    <>Publish & Generate Entry Token <Zap size={15} /></>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="sw-completion-actions">
          <button className="sw-btn sw-btn-ghost" onClick={onDashboard}>
            Go to Dashboard <ArrowRight size={15} />
          </button>
        </div>
      </div>
      <canvas
        ref={confettiRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 9999,
        }}
      />
    </>
  );
}

// ============================================================
// Main SetupWizardPage Component
// ============================================================
export default function SetupWizardPage() {
  const {
    activeOrganization,
    sortedPeriods,
    criteriaConfig,
    frameworks,
    allJurors,
    summaryData,
    navigateTo,
    fetchData,
    reloadCriteriaAndOutcomes,
    selectedPeriodId,
    setSelectedPeriodId,
    isDemoMode,
  } = useAdminContext();
  const { refreshMemberships, isSuper } = useAuth();

  const {
    currentStep,
    completedSteps,
    goToStep,
    nextStep,
    prevStep,
    wizardData,
    setWizardData,
  } = useSetupWizard({
    orgId: activeOrganization?.id,
    periods: sortedPeriods || [],
    criteriaConfig: criteriaConfig || [],
    frameworks: frameworks || [],
    jurors: allJurors || [],
    projects: summaryData || [],
    hasEntryToken: false,
  });

  const [loading, setLoading] = useState(false);
  // Restore completion screen on remount so that navigating away and back still
  // shows "Your evaluation is ready!" instead of dumping the user back onto
  // step 7 (which reactive derivation would do once all data is in place).
  // Source of truth is now the DB-backed organizations.setup_completed_at flag
  // — the legacy sw_done_<orgId> sessionStorage key has been removed.
  const [showCompletion, setShowCompletion] = useState(
    () => !!activeOrganization?.setupCompletedAt
  );

  // If activeOrganization arrives asynchronously (or refreshMemberships fires
  // mid-flow), keep the completion view in sync with the DB flag.
  useEffect(() => {
    if (activeOrganization?.setupCompletedAt) setShowCompletion(true);
  }, [activeOrganization?.setupCompletedAt]);

  const periodId = wizardData.periodId;

  // Refresh shared context data on mount so that any external changes
  // (e.g. a period deleted from the Periods page, or criteria/outcomes
  // edited on the Criteria page) are reflected before the wizard validates
  // its state. AdminRouteLayout's criteria/outcome effect only re-fires on
  // period/org change, so we force a reload here to catch same-period edits.
  useEffect(() => {
    fetchData();
    reloadCriteriaAndOutcomes?.();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reconcile wizard ↔ admin on the currently-active period.
  //
  // First render only: prefer the admin's selectedPeriodId over wizard's
  // persisted periodId. sessionStorage may hold a stale period from an old
  // wizard session, and without this reconciliation the old periodId
  // hijacks the admin context and the wizard generates tokens / publishes
  // against the wrong period.
  //
  // After the first render: keep admin's selectedPeriodId synced to the
  // wizard's period so allJurors/summaryData (scoped to selectedPeriodId)
  // reflect the wizard period during normal use (e.g. after step 2 creates
  // a brand-new period).
  const mountReconcileDone = useRef(false);
  useEffect(() => {
    if (!Array.isArray(sortedPeriods) || sortedPeriods.length === 0) return;

    if (!mountReconcileDone.current) {
      mountReconcileDone.current = true;
      if (selectedPeriodId && selectedPeriodId !== periodId) {
        const adminValid = sortedPeriods.some((p) => p.id === selectedPeriodId);
        if (adminValid) {
          setWizardData({ periodId: selectedPeriodId });
          // Reset step — useSetupWizard's reactive effect only advances (Math.max),
          // so without this the wizard would stay on a step appropriate to the OLD
          // period (e.g. step 7/Completion for a fully-set-up old period) even
          // though the newly-targeted period is still at step 2.
          goToStep(1);
          return;
        }
      }
    }

    if (periodId && periodId !== selectedPeriodId) {
      setSelectedPeriodId(periodId);
    }
  }, [sortedPeriods, periodId, selectedPeriodId, setSelectedPeriodId, setWizardData, goToStep]);

  // Build a stable set of period IDs from current context data so we can
  // detect when the period the wizard was working on has been deleted externally.
  const periodIdSet = useMemo(
    () => new Set((sortedPeriods || []).map((p) => p.id)),
    [sortedPeriods]
  );

  // If the wizard holds a periodId that no longer exists, or all periods were
  // deleted, reset to step 1 so the user is prompted to create a new period.
  useEffect(() => {
    // sortedPeriods === undefined means still loading — don't act yet
    if (!Array.isArray(sortedPeriods)) return;
    // All periods gone (e.g. deleted externally): wizardData init already cleared
    // periodId, so the !periodId guard below would skip — handle it here.
    if (sortedPeriods.length === 0) {
      setWizardData({ periodId: null });
      goToStep(1);
      return;
    }
    if (!periodId) return;
    if (!periodIdSet.has(periodId)) {
      setWizardData({ periodId: null });
      goToStep(1);
    }
  }, [periodId, periodIdSet, sortedPeriods, setWizardData, goToStep]);

  const handleStep2Continue = useCallback(
    async (periodId) => {
      setWizardData({ periodId });
      await fetchData();
      // Don't call nextStep() here — the reactive effect in useSetupWizard advances
      // step 2→3 once fetchData() updates sortedPeriods with the new period.
      // Calling nextStep() here would double-count: reactive effect → 3, nextStep() → 4.
    },
    [setWizardData, fetchData]
  );

  // Step 3: Criteria+Framework — save frameworkId if chosen, then advance to Projects
  const handleStep3Continue = useCallback(
    (frameworkId) => {
      if (frameworkId) setWizardData({ frameworkId });
      nextStep();
    },
    [nextStep, setWizardData]
  );

  const handleStep4Continue = useCallback(() => {
    nextStep();
  }, [nextStep]);

  const clearWizardStorage = useCallback(() => {
    if (!activeOrganization?.id) return;
    try {
      sessionStorage.removeItem(`sw_step_${activeOrganization.id}`);
      sessionStorage.removeItem(`sw_data_${activeOrganization.id}`);
    } catch {}
  }, [activeOrganization?.id]);

  // Surfaces the CompletionScreen when the user clicks "Complete Setup" on the
  // Review step. The DB flag is stamped later, inside CompletionScreen's
  // handleGenerate, after publishPeriod + generateEntryToken succeed.
  const handleCompletion = useCallback(() => {
    clearWizardStorage();
    setShowCompletion(true);
  }, [clearWizardStorage]);

  // Token generated → DB flag stamped → refresh AuthProvider so the sidebar
  // Setup link disappears and direct /admin/setup access starts bouncing.
  const handleMarkSetupComplete = useCallback(async (organizationId) => {
    await markSetupComplete(organizationId);
    // refreshMemberships is deferred to onDashboard so the redirect effect in
    // AdminRouteLayout doesn't fire while the completion screen is still visible.
  }, []);

  const handleSkip = useCallback(() => {
    clearWizardStorage();
    if (activeOrganization?.id) {
      try { sessionStorage.setItem(KEYS.SETUP_SKIP_PREFIX + activeOrganization.id, "1"); } catch {}
    }
    navigateTo("overview");
  }, [navigateTo, clearWizardStorage, activeOrganization?.id]);

  if (showCompletion) {
    return (
      <CompletionScreen
        periodId={periodId}
        organizationId={activeOrganization?.id}
        isDemoMode={isDemoMode}
        onDashboard={async () => {
          if (activeOrganization?.id && !activeOrganization?.setupCompletedAt) {
            try { await markSetupComplete(activeOrganization.id); } catch {}
          }
          await refreshMemberships?.();
          navigateTo("overview");
        }}
        onPublished={() => fetchData()}
        onMarkSetupComplete={handleMarkSetupComplete}
        onNavigateStep={(step) => {
          setShowCompletion(false);
          goToStep(step);
        }}
      />
    );
  }

  return (
    <>
      <WizardStepper
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={goToStep}
      />

      {currentStep === 1 && (
        <StepWelcome
          onContinue={() => nextStep()}
          onSkip={handleSkip}
        />
      )}

      {currentStep === 2 && (
        <StepCreatePeriod
          onContinue={handleStep2Continue}
          onBack={prevStep}
          onCreateNew={() => setWizardData({ periodId: null })}
          loading={loading}
          existingPeriods={sortedPeriods || []}
          wizardPeriodId={periodId}
        />
      )}

      {currentStep === 3 && (
        <StepCriteriaAndFramework
          periodId={periodId}
          frameworks={frameworks || []}
          onContinue={handleStep3Continue}
          onBack={prevStep}
        />
      )}

      {currentStep === 4 && (
        <StepProjects
          periodId={periodId}
          onContinue={handleStep4Continue}
          onBack={prevStep}
          loading={loading}
        />
      )}

      {currentStep === 5 && (
        <StepJurors
          periodId={periodId}
          onContinue={() => fetchData()}
          onBack={prevStep}
          onLaunch={handleCompletion}
          loading={loading}
        />
      )}
    </>
  );
}
