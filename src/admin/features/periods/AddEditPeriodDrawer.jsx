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
import FbAlert from "@/shared/ui/FbAlert";
import useShakeOnError from "@/shared/hooks/useShakeOnError";


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

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [nameError, setNameError] = useState("");
  const [nameTouched, setNameTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFormName(period?.name ?? "");
    setFormDescription(period?.description ?? "");
    setFormStartDate(period?.start_date ? period.start_date.slice(0, 10) : "");
    setFormEndDate(period?.end_date ? period.end_date.slice(0, 10) : "");
    setSaveError("");
    setNameError("");
    setSaving(false);
    setNameTouched(false);
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
    setNameTouched(true);
    if (!formName.trim() || nameError) return;
    setSaveError("");
    setSaving(true);
    try {
      await onSave?.({
        name: formName.trim(),
        description: formDescription.trim() || null,
        start_date: formStartDate || null,
        end_date: formEndDate || null,
      });
      onClose();
    } catch (e) {
      setSaveError("Failed to save period. Please try again.");
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
                {isEdit ? "Update period details." : "Create a new evaluation period for this organization."}
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
          <FbAlert variant="danger" style={{ marginBottom: 14 }}>{saveError}</FbAlert>
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
              className={`fs-input${(nameTouched && !formName.trim()) || nameError ? " error" : ""}`}
              type="text"
              placeholder="e.g., Spring 2026"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onBlur={() => setNameTouched(true)}
              disabled={saving}
              autoFocus
              data-testid="period-drawer-name"
            />
            {nameTouched && !formName.trim() ? (
              <p className="crt-field-error"><AlertCircle size={12} strokeWidth={2} />Period name is required.</p>
            ) : nameError ? (
              <p className="crt-field-error"><AlertCircle size={12} strokeWidth={2} />{nameError}</p>
            ) : formName.trim() ? (
              <div className="fs-field-helper" style={{ color: "var(--success, #22c55e)" }}>
                <Check size={11} strokeWidth={2.5} style={{ verticalAlign: "-1px" }} />
                {" "}Looks good
              </div>
            ) : null}
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
              data-testid="period-drawer-description"
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



      </div>
      {/* ── Footer ── */}
      <div className="fs-drawer-footer">
        <button className="fs-btn fs-btn-secondary" type="button" onClick={onClose} disabled={saving} data-testid="period-drawer-cancel">
          Cancel
        </button>
        <button
          ref={saveBtnRef}
          className="fs-btn fs-btn-primary"
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          data-testid="period-drawer-save"
        >
          <AsyncButtonContent loading={saving} loadingText="Saving…">
            {isEdit ? "Save Changes" : "Create Period"}
          </AsyncButtonContent>
        </button>
      </div>
    </Drawer>
  );
}
