// src/admin/drawers/PinPolicyDrawer.jsx
// Drawer: edit jury access policy — accessible to both org admin and super admin.
// Writes maxPinAttempts, pinLockCooldown, and qrTtl; other policy fields are untouched.

import { useState, useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";
import Drawer from "@/shared/ui/Drawer";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import CustomSelect from "@/shared/ui/CustomSelect";
import useShakeOnError from "@/shared/hooks/useShakeOnError";

const DEFAULT_POLICY = {
  maxPinAttempts: 5,
  pinLockCooldown: "30m",
  qrTtl: "24h",
};

const PIN_LOCK_COOLDOWN_OPTIONS = [
  { value: "5m", label: "5 minutes" },
  { value: "10m", label: "10 minutes" },
  { value: "15m", label: "15 minutes" },
  { value: "30m", label: "30 minutes" },
  { value: "60m", label: "60 minutes" },
];

const QR_TTL_OPTIONS = [
  { value: "12h", label: "12 hours" },
  { value: "24h", label: "24 hours" },
  { value: "48h", label: "48 hours" },
  { value: "7d", label: "7 days" },
];

export default function PinPolicyDrawer({ open, onClose, policy, onSave, error }) {
  const [form, setForm] = useState(DEFAULT_POLICY);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const selectedCooldownLabel =
    PIN_LOCK_COOLDOWN_OPTIONS.find((o) => o.value === form.pinLockCooldown)?.label || "30 minutes";
  const selectedQrTtlLabel =
    QR_TTL_OPTIONS.find((o) => o.value === form.qrTtl)?.label || "24 hours";

  useEffect(() => {
    if (open) {
      setForm({ ...DEFAULT_POLICY, ...policy });
      setSaveError("");
      setSaving(false);
    }
  }, [open, policy]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaveError("");
    if (!form.maxPinAttempts || form.maxPinAttempts < 1) {
      setSaveError("Max PIN attempts must be at least 1.");
      return;
    }
    setSaving(true);
    try {
      await onSave?.({ ...form });
      onClose();
    } catch (e) {
      setSaveError("Failed to save PIN policy. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const displayError = saveError || error;
  const saveBtnRef = useShakeOnError(displayError);

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                display: "grid",
                placeItems: "center",
                background: "rgba(59,130,246,0.08)",
                border: "1px solid rgba(96,165,250,0.18)",
              }}
            >
              <ShieldAlert size={17} strokeWidth={2} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Jury Access Policy</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                PIN lockout thresholds and QR code validity for jury entry
              </div>
            </div>
          </div>
          <button className="fs-close" type="button" onClick={onClose} aria-label="Close">×</button>
        </div>
      </div>

      <div className="fs-drawer-body" style={{ gap: 16 }}>
        {displayError && (
          <FbAlert variant="danger" style={{ marginBottom: 4 }}>{displayError}</FbAlert>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="fs-field">
            <label className="fs-field-label">Max PIN Attempts</label>
            <input
              className="fs-input"
              type="number"
              value={form.maxPinAttempts}
              onChange={(e) => set("maxPinAttempts", Number(e.target.value))}
              min={1}
              max={20}
              disabled={saving}
            />
            <div className="fs-field-helper hint">
              Number of failed PIN attempts before a juror is locked out.
            </div>
          </div>

          <div className="fs-field">
            <label className="fs-field-label">PIN Lockout Cooldown</label>
            <CustomSelect
              value={form.pinLockCooldown}
              onChange={(v) => set("pinLockCooldown", v)}
              disabled={saving}
              options={PIN_LOCK_COOLDOWN_OPTIONS}
              ariaLabel="PIN lock cooldown duration"
            />
            <div className="fs-field-helper hint">
              After max failed attempts, juror access is locked for {selectedCooldownLabel.toLowerCase()}.
            </div>
          </div>

          <div className="fs-field">
            <label className="fs-field-label">QR Code Validity</label>
            <CustomSelect
              value={form.qrTtl}
              onChange={(v) => set("qrTtl", v)}
              disabled={saving}
              options={QR_TTL_OPTIONS}
              ariaLabel="QR code validity duration"
            />
            <div className="fs-field-helper hint">
              Jury entry QR codes expire after {selectedQrTtlLabel.toLowerCase()} from generation.
            </div>
          </div>
        </div>
      </div>

      <div className="fs-drawer-footer">
        <button className="fs-btn fs-btn-secondary" type="button" onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button
          ref={saveBtnRef}
          className="fs-btn fs-btn-primary"
          type="button"
          onClick={handleSave}
          disabled={saving}
        >
          <AsyncButtonContent loading={saving} loadingText="Saving…">Save Policy</AsyncButtonContent>
        </button>
      </div>
    </Drawer>
  );
}
