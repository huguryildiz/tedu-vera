// src/admin/criteria/CriterionDeleteDialog.jsx

import { useRef } from "react";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import AlertCard from "@/shared/ui/AlertCard";
import { TrashIcon } from "@/shared/ui/Icons";

export default function CriterionDeleteDialog({ open, rowLabel, onOpenChange, onConfirm, saveDisabled = false }) {
  const containerRef = useRef(null);

  useFocusTrap({
    containerRef,
    isOpen: open,
    onClose: () => onOpenChange(false),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="criterion-delete-dialog-title">
      <div className="w-[min(520px,92vw)] max-w-[100vw] max-h-[90vh] rounded-2xl border bg-card shadow-lg flex flex-col gap-3 p-4.5 relative overflow-hidden" ref={containerRef}>
        <div className="flex items-center gap-2.5 text-foreground">
          <span className="inline-flex items-center justify-center size-9 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 [&_svg]:size-[18px]" aria-hidden="true">
            <TrashIcon />
          </span>
          <div className="text-lg font-bold tracking-tight" id="criterion-delete-dialog-title">
            Delete Confirmation
          </div>
        </div>
        <div className="flex flex-col gap-2.5 mt-0.5">
          <div className="text-sm leading-relaxed text-muted-foreground">
            <strong className="text-destructive animate-pulse">{rowLabel || "This criterion"}</strong>
            {" will be deleted. Are you sure?"}
          </div>
          <AlertCard variant="error">
            This action removes the criterion from the period settings. It cannot be undone.
          </AlertCard>
        </div>
        <div className="flex gap-2.5 justify-end">
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-transparent px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
            type="button"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-full bg-destructive border-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:pointer-events-none disabled:opacity-60"
            type="button"
            onClick={onConfirm}
            disabled={saveDisabled}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
