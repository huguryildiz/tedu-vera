// src/shared/Modal.jsx
// Generic centered modal wrapper.
// Uses the .fs-modal-wrap / .fs-modal design system from modals.css.
//
// Props:
//   open        — boolean
//   onClose     — () => void
//   size        — "sm" | "md" | "lg" | "xl" (default: "md")
//   centered    — boolean, adds .fs-modal-centered for icon-header confirmations
//   children    — modal content (header + body + footer rendered by caller)

import { useRef } from "react";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";

export default function Modal({ open, onClose, size = "md", centered = false, children }) {
  const containerRef = useRef(null);

  useFocusTrap({ containerRef, isOpen: open, onClose });

  const modalClass = [
    "fs-modal",
    size,
    centered ? "fs-modal-centered" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      data-testid="modal"
      className={`fs-modal-wrap${open ? " show" : ""}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className={modalClass}
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
