// src/admin/drawers/EditJurorDrawer.jsx
// Drawer: view/edit juror identity, evaluation progress, security & access.
//
// Props:
//   open           — boolean
//   onClose        — () => void
//   juror          — { id, name, affiliation, email, progress: { scored, total },
//                      lastActive, overviewStatus }
//   onSave         — (id, { name, affiliation, email }) => Promise<void>
//   onResetPin     — (juror) => void
//   onRemove       — (juror) => void
//   error          — string | null

import { useState, useEffect } from "react";
import { Icon } from "lucide-react";
import Drawer from "@/shared/ui/Drawer";
import FbAlert from "@/shared/ui/FbAlert";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";
import useShakeOnError from "@/shared/hooks/useShakeOnError";

function formatRelative(ts) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) {
    const m = Math.floor(diff / 60_000);
    return `${m}m ago`;
  }
  if (diff < 86_400_000) {
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
  }
  return `${Math.floor(diff / 86_400_000)}d ago`;
}


export default function EditJurorDrawer({ open, onClose, juror, onSave, onResetPin, onRemove, error }) {
  const [form, setForm] = useState({ name: "", affiliation: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [pinCopied, setPinCopied] = useState(false);

  useEffect(() => {
    if (open && juror) {
      setForm({ name: juror.name ?? "", affiliation: juror.affiliation ?? "", email: juror.email ?? "" });
      setSaveError("");
      setSaving(false);
      setPinCopied(false);
    }
  }, [open, juror?.id]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    setSaveError("");
    setSaving(true);
    try {
      await onSave?.(juror.id, {
        name: form.name.trim(),
        affiliation: form.affiliation.trim(),
        email: form.email.trim() || null,
      });
      onClose();
    } catch (e) {
      setSaveError("Failed to save juror. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const displayError = saveError || error;
  const saveBtnRef = useShakeOnError(displayError);
  const progress = juror?.progress;
  const scored = progress?.scored ?? 0;
  const total = progress?.total ?? 0;
  const allDone = total > 0 && scored >= total;

  return (
    <Drawer open={open} onClose={onClose}>
      {/* ── Header ── */}
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="fs-icon" style={{ background: "var(--surface-2)" }}>
              <Icon
                iconNode={[]}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
              </Icon>
            </div>
            <div className="fs-title-group">
              <div className="fs-title">Juror Profile</div>
              <div className="fs-subtitle">View and update juror details for the active evaluation period.</div>
            </div>
          </div>
          <button className="fs-close" type="button" onClick={onClose} aria-label="Close">
            <Icon
              iconNode={[]}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5">
              <path d="M18 6 6 18M6 6l12 12" />
            </Icon>
          </button>
        </div>
      </div>
      <div className="fs-drawer-body">
        {displayError && (
          <FbAlert variant="danger" style={{ marginBottom: 14 }} data-testid="jurors-edit-drawer-error">{displayError}</FbAlert>
        )}

        {/* ── Identity ── */}
        <div className="fs-section">
          <div className="fs-section-header">
            <span className="fs-section-title">Identity</span>
          </div>

          <div className="fs-field">
            <label className="fs-field-label">Full Name <span className="fs-field-req">*</span></label>
            <input
              className="fs-input"
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={saving}
              data-testid="jurors-edit-drawer-name"
            />
          </div>

          <div className="fs-field">
            <label className="fs-field-label">Affiliation <span className="fs-field-req">*</span></label>
            <input
              className="fs-input"
              type="text"
              value={form.affiliation}
              onChange={(e) => set("affiliation", e.target.value)}
              disabled={saving}
              data-testid="jurors-edit-drawer-affiliation"
            />
          </div>

          <div className="fs-field">
            <label className="fs-field-label">
              Email <span className="fs-field-opt">(optional)</span>
            </label>
            <input
              className="fs-input"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="juror@university.edu"
              disabled={saving}
              data-testid="jurors-edit-drawer-email"
            />
            <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 5, color: "var(--text-tertiary)", fontSize: 11 }}>
              <Icon
                iconNode={[]}
                viewBox="0 0 24 24"
                width="11"
                height="11"
                fill="none"
                stroke="currentColor"
                strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
              </Icon>
              Used to send PIN and evaluation QR code via email.
            </div>
          </div>
        </div>

        {/* ── Evaluation Progress ── */}
        {progress && (
          <div className="fs-section">
            <div className="fs-section-header">
              <span className="fs-section-title">Evaluation Progress</span>
            </div>

            <div className="fs-info-row">
              <span className="fs-info-row-label">Progress</span>
              <span className="fs-info-row-value">
                <span
                  style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: allDone ? "rgba(16,185,129,0.12)" : "var(--surface-2)",
                    color: allDone ? "var(--success)" : "var(--text-secondary)",
                    border: `1px solid ${allDone ? "rgba(16,185,129,0.25)" : "var(--border)"}`,
                  }}
                >
                  {scored} / {total} groups scored
                </span>
              </span>
            </div>

            {juror?.lastActive && (
              <div className="fs-info-row">
                <span className="fs-info-row-label">Last Activity</span>
                <span className="fs-info-row-value">{formatRelative(juror.lastActive)}</span>
              </div>
            )}
          </div>
        )}


      </div>
      <div className="fs-drawer-footer">
        <button
          className="fs-btn fs-btn-secondary"
          type="button"
          onClick={onClose}
          disabled={saving}
          data-testid="jurors-edit-drawer-cancel"
        >
          Cancel
        </button>
        <button
          ref={saveBtnRef}
          className="fs-btn fs-btn-primary"
          type="button"
          onClick={handleSave}
          disabled={saving || !form.name.trim() || !form.affiliation.trim()}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          data-testid="jurors-edit-drawer-save"
        >
          <span className="btn-loading-content">
            <AsyncButtonContent loading={saving} loadingText="Saving…">Save Changes</AsyncButtonContent>
          </span>
        </button>
      </div>
    </Drawer>
  );
}
