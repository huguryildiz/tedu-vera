// src/admin/settings/PinResetDialog.jsx
import { useRef } from "react";
import { KeyRoundIcon, TriangleAlertIcon } from "../../shared/Icons";
import { useFocusTrap } from "../../shared/useFocusTrap";
import AlertCard from "../../shared/AlertCard";

export default function PinResetDialog({
  pinResetTarget,
  resetPinInfo,
  pinResetLoading,
  pinCopied,
  viewPeriodLabel,
  onCopyPin,
  onClose,
  onConfirmReset,
}) {
  const containerRef = useRef(null);
  useFocusTrap({ containerRef, isOpen: !!pinResetTarget, onClose });

  if (!pinResetTarget) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="pin-reset-dialog-title">
      <div className="w-full max-w-md rounded-lg border border-destructive/20 bg-card shadow-lg" ref={containerRef}>
        <div className="delete-dialog__header">
          <span className="delete-dialog__icon delete-dialog__icon--pin-reset" aria-hidden="true"><KeyRoundIcon /></span>
          <div className="delete-dialog__title" id="pin-reset-dialog-title">
            {resetPinInfo?.pin_plain_once ? "New Juror PIN" : "Reset Juror PIN"}
          </div>
        </div>
        <div className="delete-dialog__body delete-dialog__body--pin-flow">
          {resetPinInfo?.pin_plain_once ? (
            <div className="pin-reset-step pin-reset-step--result">
              <div className="delete-dialog__line pin-reset-detail-line">
                <span className="pin-reset-detail-label">Juror:</span>
                <span className="pin-reset-target-highlight">
                  {pinResetTarget?.juror_name || pinResetTarget?.juryName || "this juror"}
                </span>
              </div>
              <div className="delete-dialog__line">New PIN generated. Share it securely with the juror.</div>
              <div className="pin-code">
                {String(resetPinInfo.pin_plain_once || "").padStart(4, "0").slice(0, 4)}
              </div>
            </div>
          ) : (
            <div className="pin-reset-step pin-reset-step--confirm">
              <div className="pin-reset-copy">
                <div className="delete-dialog__line">
                  <span className="pin-reset-target-prefix">Generate a new PIN?</span>
                </div>
                <div className="delete-dialog__line pin-reset-detail-line">
                  <span className="pin-reset-detail-label">Juror:</span>
                  <span className="pin-reset-target-highlight">
                    {pinResetTarget.juror_name || pinResetTarget.juryName || "this juror"}
                  </span>
                  {(pinResetTarget.affiliation || pinResetTarget.affiliation)
                    ? (
                      <span className="pin-reset-target-highlight pin-reset-target-highlight--inst">
                        {" ("}
                        {pinResetTarget.affiliation || pinResetTarget.affiliation}
                        {")"}
                      </span>
                    )
                    : ""}
                </div>
                <div className="delete-dialog__line pin-reset-detail-line">
                  <span className="pin-reset-detail-label">Period:</span>
                  <span className="pin-reset-target-highlight pin-reset-target-highlight--period">
                    {viewPeriodLabel}
                  </span>
                </div>
              </div>
              <AlertCard variant="error">The previous PIN will stop working immediately.</AlertCard>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 border-t px-6 py-4">
          {resetPinInfo?.pin_plain_once ? (
            <>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                type="button"
                onClick={onCopyPin}
              >
                {pinCopied ? "Copied!" : "Copy PIN"}
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                type="button"
                onClick={onClose}
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                type="button"
                disabled={pinResetLoading}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50"
                type="button"
                disabled={pinResetLoading}
                onClick={onConfirmReset}
              >
                {pinResetLoading ? "Resetting…" : "Reset PIN"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
