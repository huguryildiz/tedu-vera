// src/admin/modals/EnableEditingModal.jsx
// Modal: confirm enable-editing-mode for a completed juror.
//
// Props:
//   open             — boolean
//   onClose          — () => void  (resets form)
//   juror            — { name, affiliation } | null
//   onEnable         — ({ reason, durationMinutes }) => Promise<void>

import { useState } from "react";
import { LockOpen, Info } from "lucide-react";
import Modal from "@/shared/ui/Modal";

const UNIT_CLAMP = { minutes: [1, 240], hours: [1, 48] };

export default function EnableEditingModal({ open, onClose, juror, onEnable }) {
  const [durationValue, setDurationValue] = useState("30");
  const [durationUnit, setDurationUnit] = useState("minutes");
  const [reason, setReason] = useState("");
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    if (enabling) return;
    setDurationValue("30");
    setDurationUnit("minutes");
    setReason("");
    setError("");
    onClose();
  };

  const parsedDuration = parseInt(durationValue, 10);
  const [min, max] = UNIT_CLAMP[durationUnit];
  const durationValid = !isNaN(parsedDuration) && parsedDuration >= min && parsedDuration <= max;
  const reasonValid = reason.trim().length >= 5;
  const canEnable = durationValid && reasonValid && !enabling;

  const durationMinutes =
    durationUnit === "hours" ? parsedDuration * 60 : parsedDuration;

  const handleEnable = async () => {
    if (!canEnable) return;
    setEnabling(true);
    setError("");
    try {
      await onEnable({ reason: reason.trim(), durationMinutes });
      // Success — parent closes modal via setEditModeJuror(null)
    } catch (e) {
      setError(e?.message || "Could not enable editing mode. Please try again.");
    } finally {
      setEnabling(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} size="sm" centered>
      <div className="fs-modal-header">
        <div className="fs-modal-icon">
          <LockOpen size={20} />
        </div>
        <div className="fs-title" style={{ textAlign: "center" }}>Enable Editing Mode</div>
        <div className="fs-subtitle" style={{ textAlign: "center", marginTop: 4 }}>
          Temporarily allow <strong style={{ color: "var(--text-primary)" }}>{juror?.name}</strong>{" "}
          to update submitted scores.
        </div>
      </div>

      <div className="fs-modal-body">
        {/* Info banner */}
        <div
          style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "10px 12px",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            marginBottom: 16,
          }}
        >
          <Info size={15} style={{ color: "var(--text-secondary)", flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            The juror will be able to modify their submitted scores until the editing
            window expires or they resubmit.
          </span>
        </div>

        {/* Duration row */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
            Duration
          </label>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="fs-input"
              type="number"
              min={min}
              max={max}
              value={durationValue}
              onChange={(e) => setDurationValue(e.target.value)}
              disabled={enabling}
              style={{ width: 80, boxSizing: "border-box" }}
            />
            <select
              className="fs-input"
              value={durationUnit}
              onChange={(e) => {
                setDurationUnit(e.target.value);
                setDurationValue(e.target.value === "hours" ? "1" : "30");
              }}
              disabled={enabling}
              style={{ flex: 1 }}
            >
              <option value="minutes">minutes</option>
              <option value="hours">hours</option>
            </select>
          </div>
          {durationValue !== "" && !durationValid && (
            <div style={{ fontSize: 11.5, color: "var(--danger)", marginTop: 4 }}>
              {durationUnit === "minutes" ? "Enter 1–240 minutes." : "Enter 1–48 hours."}
            </div>
          )}
        </div>

        {/* Reason field */}
        <div style={{ marginBottom: error ? 12 : 0 }}>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 6 }}>
            Reason (audit log) <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <textarea
            className="fs-input"
            rows={3}
            minLength={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Correcting accidental criterion mismatch"
            disabled={enabling}
            style={{ width: "100%", boxSizing: "border-box", resize: "vertical" }}
          />
        </div>

        {/* Inline error */}
        {error && (
          <div className="fs-alert danger" style={{ margin: 0, marginTop: 10 }}>
            <div className="fs-alert-body">
              <div className="fs-alert-desc">{error}</div>
            </div>
          </div>
        )}
      </div>

      <div className="fs-modal-footer" style={{ justifyContent: "center", background: "transparent", borderTop: "none", paddingTop: 0 }}>
        <button
          type="button"
          className="fs-btn fs-btn-secondary"
          onClick={handleClose}
          disabled={enabling}
          style={{ flex: 1 }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="fs-btn fs-btn-primary"
          onClick={handleEnable}
          disabled={!canEnable}
          style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        >
          {enabling ? (
            <>
              <span className="fs-spinner" style={{ width: 13, height: 13 }} />
              Enabling…
            </>
          ) : (
            <>
              <LockOpen size={13} />
              Enable
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}
