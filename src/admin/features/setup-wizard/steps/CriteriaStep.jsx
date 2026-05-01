import { useState, useEffect } from "react";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { useToast } from "@/shared/hooks/useToast";
import { KEYS } from "@/shared/storage/keys";
import {
  savePeriodCriteria,
  listPeriodOutcomes,
  listPeriodCriteriaForMapping,
  upsertPeriodCriterionOutcomeMap,
  assignFrameworkToPeriod,
  getVeraStandardCriteria,
  setPeriodCriteriaName,
} from "@/shared/api";
import { CRITERIA } from "@/shared/constants";
import FbAlert from "@/shared/ui/FbAlert";
import {
  ClipboardCheck,
  BookOpen,
  Star,
  Plus,
  Check,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";

// Helper: Build criteria payload for savePeriodCriteria fallback.
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
// Step 3: Criteria + Framework wrapper
// ============================================================
// Phase 1 = criteria setup, Phase 2 = (optional) framework selection.
// After criteria are saved the wizard automatically transitions to the framework
// phase. Framework is optional — skipping it advances to step 4 (Projects).
export default function CriteriaStep({ periodId, frameworks, onContinue, onBack }) {
  const { criteriaConfig, sortedPeriods } = useAdminContext();

  const currentPeriod = (sortedPeriods || []).find((p) => p.id === periodId) ?? null;
  const assignedFramework = currentPeriod?.framework_id
    ? (frameworks || []).find((fw) => fw.id === currentPeriod.framework_id) ?? null
    : null;

  // Scope hasCriteria to the CURRENT period via criteria_name — criteriaConfig may
  // transiently hold stale data from a previous period before fetchData completes.
  const hasCriteria = !!currentPeriod?.criteria_name
    && Array.isArray(criteriaConfig) && criteriaConfig.length > 0;

  const [phase, setPhase] = useState(hasCriteria ? "framework" : "criteria");

  useEffect(() => {
    setPhase(hasCriteria ? "framework" : "criteria");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodId]);

  useEffect(() => {
    if (hasCriteria && phase === "criteria") setPhase("framework");
  }, [hasCriteria, phase]);

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
                <div className="sw-criteria-label">
                  <div className="sw-criteria-dot" style={{ backgroundColor: c.color }} />
                  <div className="sw-criteria-name">{c.label}</div>
                </div>
                <div className="sw-criteria-meta">
                  <div className="sw-criteria-pts">{c.max} pts</div>
                  <div className="sw-criteria-bar">
                    <div className="sw-criteria-bar-fill" style={{
                      backgroundColor: c.color,
                      width: `${(fillPct / maxPct) * 100}%`,
                    }} />
                  </div>
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
      <CriteriaPhase
        periodId={periodId}
        onContinue={() => setPhase("framework")}
        onBack={onBack}
      />
    );
  }

  return (
    <FrameworkPhase
      periodId={periodId}
      frameworks={frameworks}
      onContinue={onContinue}
      onBack={() => setPhase("criteria")}
    />
  );
}

// ============================================================
// Framework phase (internal)
// ============================================================
function FrameworkPhase({ periodId, frameworks = [], onContinue, onBack }) {
  const toast = useToast();
  const { navigateTo, setSelectedPeriodId, fetchData, reloadCriteriaAndOutcomes, sortedPeriods, organizationId } = useAdminContext();
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
      toast.error("Failed to assign framework");
      setSelected(null);
    } finally {
      setSaving(false);
    }
  };

  const BADGES = { MÜDEK: { label: "MÜDEK", color: "#2563eb" }, ABET: { label: "ABET", color: "#16a34a" } };
  const getBadge = (name = "") => Object.entries(BADGES).find(([k]) => name.toUpperCase().includes(k))?.[1];

  // Wizard only surfaces canonical platform-level accreditation standards
  // (organization_id === null means global/built-in, not a tenant clone).
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
          try { sessionStorage.setItem(KEYS.SETUP_SKIP_PREFIX + organizationId, "1"); } catch { /* ignore */ }
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
// Criteria phase (internal)
// ============================================================
function CriteriaPhase({ periodId, onContinue, onBack, loading }) {
  const toast = useToast();
  const { fetchData, navigateTo, setSelectedPeriodId, reloadCriteriaAndOutcomes, criteriaConfig, criteriaLoading, sortedPeriods, organizationId } = useAdminContext();
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
      toast.error("Failed to apply criteria");
    }
  };

  const handleBuildCustom = () => {
    if (periodId) setSelectedPeriodId(periodId);
    // Set the skip flag so the setup-redirect guard doesn't bounce us back.
    // The progress banner will remain visible on the criteria page.
    try { sessionStorage.setItem(KEYS.SETUP_SKIP_PREFIX + organizationId, "1"); } catch { /* ignore */ }
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
                <div className="sw-criteria-label">
                  <div className="sw-criteria-dot" style={{ backgroundColor: c.color }} />
                  <div className="sw-criteria-name">{c.label}</div>
                </div>
                <div className="sw-criteria-meta">
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
            data-testid="wizard-step-criteria-next"
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
                  toast.error("Failed to save name");
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
                  <div className="sw-criteria-label">
                    <div
                      className="sw-criteria-dot"
                      style={{ backgroundColor: c.color }}
                    />
                    <div className="sw-criteria-name">{c.label}</div>
                  </div>
                  <div className="sw-criteria-meta">
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
            data-testid="wizard-step-criteria-apply-template"
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
