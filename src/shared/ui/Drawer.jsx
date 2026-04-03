// src/shared/Drawer.jsx
// Generic slide-in drawer wrapper.
// Uses the .fs-drawer / .fs-overlay design system from drawers.css.
//
// Props:
//   open        — boolean
//   onClose     — () => void
//   children    — drawer content (header + body + footer rendered by caller)

import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";

export default function Drawer({ open, onClose, children, id, className }) {
  const containerRef = useRef(null);

  useFocusTrap({ containerRef, isOpen: open, onClose });

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <div
        className={`fs-overlay${open ? " show" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        id={id}
        className={`fs-drawer${open ? " show" : ""}${className ? ` ${className}` : ""}`}
        ref={containerRef}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </>
  );
}
