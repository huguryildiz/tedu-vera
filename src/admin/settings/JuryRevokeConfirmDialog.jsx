// src/admin/settings/JuryRevokeConfirmDialog.jsx
import { useRef } from "react";
import { BanIcon } from "@/shared/ui/Icons";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import AlertCard from "@/shared/ui/AlertCard";

export default function JuryRevokeConfirmDialog({
  open,
  loading,
  activeJurorCount = 0,
  onCancel,
  onConfirm,
}) {
  const containerRef = useRef(null);
  useFocusTrap({ containerRef, isOpen: !!open, onClose: onCancel });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[400] grid place-items-center bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="jury-revoke-dialog-title"
    >
      <div
        className="relative flex w-[min(520px,92vw)] max-w-[100vw] max-h-[90vh] flex-col gap-3 overflow-hidden rounded-2xl border border-destructive/20 bg-card p-5 shadow-lg"
        ref={containerRef}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center size-9 rounded-lg bg-destructive/10 text-destructive [&_svg]:h-[18px] [&_svg]:w-[18px]"
            aria-hidden="true"
          >
            <BanIcon />
          </span>
          <div
            className="text-lg font-bold tracking-tight"
            id="jury-revoke-dialog-title"
          >
            Revoke Access
          </div>
        </div>

        {/* Body */}
        <div className="mt-0.5 flex flex-col gap-2.5">
          <div className="text-sm leading-snug text-muted-foreground">
            Are you sure you want to revoke jury entry access?
          </div>
          <AlertCard variant="error" icon={BanIcon}>
            <ul style={{ margin: 0, paddingLeft: "1.2rem", textAlign: "left" }}>
              <li>New scans of the current QR code will be <strong>blocked immediately</strong>.</li>
              <li>All evaluations will be <strong>locked</strong> — active jurors will no longer be able to submit scores.</li>
            </ul>
          </AlertCard>
          {activeJurorCount > 0 && (
            <AlertCard variant="warning">
              <strong>{activeJurorCount}</strong> juror{activeJurorCount !== 1 ? "s are" : " is"} currently
              active and will be locked from further edits.
            </AlertCard>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 border-t pt-4">
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            type="button"
            disabled={loading}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50"
            type="button"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? "Revoking..." : "Revoke Access"}
          </button>
        </div>
      </div>
    </div>
  );
}
