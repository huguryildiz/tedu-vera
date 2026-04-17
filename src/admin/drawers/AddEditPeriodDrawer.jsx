// src/admin/drawers/AddEditPeriodDrawer.jsx
// Drawer: add or edit an evaluation period.
//
// Props:
//   open        — boolean
//   onClose     — () => void
//   period      — null (add) or period object (edit)
//   onSave      — (data) => Promise<void>
//   allPeriods  — array of all periods (for duplicate-name check in edit mode)

import { useState, useEffect } from "react";
import { AlertCircle, Check, CirclePlus, Pencil, X } from "lucide-react";
import Drawer from "@/shared/ui/Drawer";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import CustomSelect from "@/shared/ui/CustomSelect";
import FbAlert from "@/shared/ui/FbAlert";
import { getPeriodCounts } from "@/shared/api";
import useShakeOnError from "@/shared/hooks/useShakeOnError";
import { formatDate } from "@/shared/lib/dateUtils";


const LOCK_OPTIONS = [
  { value: "open", label: "Open — scoring enabled" },
  { value: "locked", label: "Locked — scores finalized" },
];

const VISIBILITY_OPTIONS = [
  { value: "visible", label: "Visible to all admins" },
  { value: "hidden", label: "Hidden (archived)" },
];

export default function AddEditPeriodDrawer({
  open,
  onClose,
  period,
  onSave,
  allPeriods = [],
}) {
  const isEdit = !!period;

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formIsLocked, setFormIsLocked] = useState("open");
  const [formIsVisible, setFormIsVisible] = useState("visible");

  const [counts, setCounts] = useState(null);
  const [countsLoading, setCountsLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    if (!open) return;
    setFormName(period?.name ?? "");
    setFormDescription(period?.description ?? "");
    setFormStartDate(period?.start_date ? period.start_date.slice(0, 10) : "");
    setFormEndDate(period?.end_date ? period.end_date.slice(0, 10) : "");
    setFormIsLocked(period?.is_locked ? "locked" : "open");
    setFormIsVisible(period?.is_visible === false ? "hidden" : "visible");
    setSaveError("");
    setNameError("");
    setSaving(false);
    setCounts(null);

    if (isEdit && period?.id) {
      setCountsLoading(true);
      getPeriodCounts(period.id)
        .then(setCounts)
        .catch(() => setCounts(null))
        .finally(() => setCountsLoading(false));
    }
  }, [open, period?.id]);

  // Name uniqueness check (edit mode)
  useEffect(() => {
    if (!isEdit || !formName.trim()) { setNameError(""); return; }
    const dup = allPeriods.some(
      (p) => p.id !== period?.id && p.name.trim().toLowerCase() === formName.trim().toLowerCase()
    );
    setNameError(dup ? "Period name already exists." : "");
  }, [formName, allPeriods, isEdit, period?.id]);


  const handleSave = async () => {
    if (!formName.trim() || nameError) return;
    setSaveError("");
    setSaving(true);
    try {
      await onSave?.({
        name: formName.trim(),
        description: formDescription.trim() || null,
        start_date: formStartDate || null,
        end_date: formEndDate || null,
        is_locked: formIsLocked === "locked",
        is_visible: formIsVisible === "visible",
      });
      onClose();
    } catch (e) {
      setSaveError(e?.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const canSave = formName.trim() && !nameError && !saving;
  const saveBtnRef = useShakeOnError(saveError);

  return (
    <Drawer open={open} onClose={onClose}>
      {/* ── Header ── */}
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="fs-icon muted" aria-hidden="true">
              {isEdit ? <Pencil size={17} strokeWidth={2} /> : <CirclePlus size={17} strokeWidth={2} />}
            </span>
            <div className="fs-title-group">
              <div className="fs-title">{isEdit ? `Edit Period — ${period.name}` : "Add Evaluation Period"}</div>
              <div className="fs-subtitle">
                {isEdit ? "Update period details and evaluation settings." : "Create a new evaluation period for this organization."}
              </div>
            </div>
          </div>
          <button className="fs-close" type="button" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      {/* ── Body ── */}
      <div className="fs-drawer-body">
        {saveError && (
          <div className="fs-alert danger" style={{ marginBottom: 14 }}>
            <div className="fs-alert-icon"><AlertCircle size={15} /></div>
            <div className="fs-alert-body">{saveError}</div>
          </div>
        )}

        {/* ── PERIOD DETAILS ── */}
        <div className="fs-section">
          <div className="fs-section-header">
            <div className="fs-section-title">Period Details</div>
          </div>

          <div className="fs-field">
            <label className="fs-field-label">
              Period Name <span className="fs-field-req">*</span>
            </label>
            <input
              className={`fs-input${nameError ? " fs-input-error" : ""}`}
              type="text"
              placeholder="e.g. Spring 2026"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              disabled={saving}
              autoFocus
            />
            {nameError && (
              <div className="fs-field-helper" style={{ color: "var(--danger, #ef4444)" }}>
                <AlertCircle size={11} style={{ verticalAlign: "-1px" }} /> {nameError}
              </div>
            )}
            {!nameError && formName.trim() && (
              <div className="fs-field-helper" style={{ color: "var(--success, #22c55e)" }}>
                <Check size={11} strokeWidth={2.5} style={{ verticalAlign: "-1px" }} />
                {" "}Looks good
              </div>
            )}
          </div>

          <div className="fs-field">
            <label className="fs-field-label">
              Description <span className="fs-field-opt">(optional)</span>
            </label>
            <textarea
              className="fs-textarea"
              rows={2}
              placeholder="Brief description of this evaluation period…"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              disabled={saving}
              style={{ resize: "vertical", minHeight: 60 }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="fs-field" style={{ margin: 0 }}>
              <label className="fs-field-label">
                Start Date <span className="fs-field-opt">(optional)</span>
              </label>
              <input
                className="fs-input"
                type="date"
                value={formStartDate}
                onChange={(e) => setFormStartDate(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="fs-field" style={{ margin: 0 }}>
              <label className="fs-field-label">
                End Date <span className="fs-field-opt">(optional)</span>
              </label>
              <input
                className="fs-input"
                type="date"
                value={formEndDate}
                onChange={(e) => setFormEndDate(e.target.value)}
                min={formStartDate || undefined}
                disabled={saving}
              />
            </div>
          </div>
        </div>


        {/* ── EDIT MODE: EVALUATION SETTINGS ── */}
        {isEdit && (
          <div className="fs-section">
            <div className="fs-section-header">
              <div className="fs-section-title">Evaluation Settings</div>
            </div>

            <div className="fs-field">
              <label className="fs-field-label">Evaluation Lock</label>
              <CustomSelect
                value={formIsLocked}
                onChange={setFormIsLocked}
                options={LOCK_OPTIONS}
                disabled={saving}
                ariaLabel="Evaluation lock"
              />
              <div className="fs-field-helper hint">
                {formIsLocked === "locked"
                  ? "Scoring is closed — scores are finalized and read-only."
                  : "Scoring is open — jurors can submit and edit evaluations."}
              </div>
            </div>

            <div className="fs-field">
              <label className="fs-field-label">Visibility</label>
              <CustomSelect
                value={formIsVisible}
                onChange={setFormIsVisible}
                options={VISIBILITY_OPTIONS}
                disabled={saving}
                ariaLabel="Visibility"
              />
            </div>
          </div>
        )}



        {/* ── EDIT MODE: OVERVIEW ── */}
        {isEdit && (
          <div className="fs-section">
            <div className="fs-section-header">
              <div className="fs-section-title">Overview</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Project Groups", value: countsLoading ? "…" : (Number(counts?.project_count) > 0 ? counts.project_count : "—") },
                { label: "Jurors", value: countsLoading ? "…" : counts?.juror_count ?? "—" },
                { label: "Scores Recorded", value: countsLoading ? "…" : counts?.score_count ?? "—" },
                { label: "Created", value: formatDate(period?.created_at) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  style={{
                    padding: "10px 12px",
                    background: "var(--surface-1)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--mono)", letterSpacing: "-0.02em", color: "var(--text-primary)" }}>
                    {value}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontWeight: 500 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
      {/* ── Footer ── */}
      <div className="fs-drawer-footer">
        <button className="fs-btn fs-btn-secondary" type="button" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button
          ref={saveBtnRef}
          className="fs-btn fs-btn-primary"
          type="button"
          onClick={handleSave}
          disabled={!canSave}
        >
          <AsyncButtonContent loading={saving} loadingText="Saving…">
            {isEdit ? "Save Changes" : "Create Period"}
          </AsyncButtonContent>
        </button>
      </div>
    </Drawer>
  );
}
