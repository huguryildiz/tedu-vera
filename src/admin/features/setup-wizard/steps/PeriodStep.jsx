import { useState } from "react";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { useToast } from "@/shared/hooks/useToast";
import { createPeriod } from "@/shared/api";
import {
  CalendarRange,
  Check,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";

function getSuggestedSeason() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  if (month >= 1 && month <= 5) return `Spring ${year}`;
  if (month >= 6 && month <= 8) return `Summer ${year}`;
  return `Fall ${year}`;
}

export default function PeriodStep({ onContinue, onBack, onCreateNew, existingPeriods = [], wizardPeriodId }) {
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
          <button className="sw-btn-link" onClick={onBack} data-testid="wizard-period-back">← Back</button>
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
          data-testid="wizard-period-name"
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
          data-testid="wizard-period-create"
        >
          {saving ? <><Loader2 size={16} className="sw-btn-spinner" /> Creating…</> : <>Create Period & Continue <ArrowRight size={16} /></>}
        </button>
      </div>

      <div className="sw-footer">
        <button className="sw-btn-link" onClick={onBack} data-testid="wizard-period-back">
          ← Back
        </button>
      </div>
    </div>
  );
}
