// src/shared/ConfirmDialog.jsx
// ============================================================
// General-purpose in-app confirmation dialog.
//
// Follows the same visual language as the former DeleteConfirmDialog —
// modal overlay, rounded card, icon header, warning callout,
// and branded buttons.
//
// Use this instead of window.confirm() for any product UI flow.
// See CLAUDE.md "UI/UX Conventions" for the project rule.
//
// Props:
//   open                    — boolean, whether the dialog is visible
//   onOpenChange            — (open: boolean) => void, close callback
//   title                   — dialog heading string
//   body                    — main message string or ReactNode
//   warning                 — optional caution callout text (string or ReactNode)
//   confirmLabel            — confirm button label (default: "Confirm")
//   cancelLabel             — cancel button label (default: "Cancel")
//   onConfirm               — () => void | Promise<void>, called when the user confirms
//   tone                    — "caution" or "danger" (affects icon/button styling)
//   icon                    — "auto", "alert", or none (controls icon display)
//   typedConfirmation       — when set, requires exact text match to enable confirm
//   typedConfirmationLabel  — custom label (ReactNode); auto-generated if omitted
// ============================================================

import { useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/utils";
import { TrashIcon, TriangleAlertLucideIcon } from "./Icons";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import AlertCard from "./AlertCard";

export default function ConfirmDialog({
  open,
  onOpenChange,
  title = "Are you sure?",
  body,
  warning,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  tone = "caution",
  icon = "auto",
  typedConfirmation,
  typedConfirmationLabel,
}) {
  const containerRef = useRef(null);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setInputValue("");
    setError("");
    setLoading(false);
  }, [open]);

  const handleClose = () => {
    if (loading) return;
    onOpenChange?.(false);
  };

  const needsTypedMatch = typeof typedConfirmation === "string" && typedConfirmation.length > 0;
  const typedMatches = needsTypedMatch && inputValue === typedConfirmation;
  const confirmDisabled = loading || (needsTypedMatch && !typedMatches);

  const handleConfirm = async () => {
    if (confirmDisabled) return;
    setError("");
    setLoading(true);
    try {
      await onConfirm?.();
      onOpenChange?.(false);
    } catch (e) {
      setError(e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useFocusTrap({ containerRef, isOpen: open, onClose: handleClose });

  if (!open) return null;

  const showAlertIcon = icon === "alert" || (icon === "auto" && tone !== "danger");

  const defaultTypedLabel = needsTypedMatch ? (
    <>
      {"Type "}
      <strong className="confirm-dialog__typed-value">{typedConfirmation}</strong>
      {" to confirm."}
    </>
  ) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
      <div className="w-full max-w-md rounded-lg border border-destructive/20 bg-card shadow-lg" ref={containerRef}>
        <div className="delete-dialog__header">
          <span className="delete-dialog__icon" aria-hidden="true">
            {showAlertIcon ? <TriangleAlertLucideIcon /> : <TrashIcon />}
          </span>
          <div className="delete-dialog__title" id="confirm-dialog-title">{title}</div>
        </div>

        <div className="delete-dialog__body">
          {body && (
            <div className="delete-dialog__line">{body}</div>
          )}
          {warning && (
            <AlertCard variant={tone === "danger" ? "error" : "warning"}>
              {warning}
            </AlertCard>
          )}
          {needsTypedMatch && (
            <div className="delete-dialog__field">
              <label className="text-sm font-medium">
                {typedConfirmationLabel || defaultTypedLabel}
              </label>
              <input
                type="text"
                className={cn(
                  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring",
                  error && "border-destructive"
                )}
                value={inputValue}
                onChange={(e) => { setInputValue(e.target.value); setError(""); }}
                disabled={loading}
                autoComplete="off"
                placeholder={typedConfirmation}
              />
            </div>
          )}
          {error && (
            <div className="delete-dialog__field">
              <div className="text-sm text-destructive">{error}</div>
            </div>
          )}
        </div>

        <div className="delete-dialog__actions">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
            type="button"
            onClick={handleClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-50"
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
          >
            {loading ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
