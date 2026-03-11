// src/admin/components.jsx
// ============================================================
// Shared JSX components for admin tab modules.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { jurorStatusMeta } from "./scoreHelpers";
export { HomeIcon, RefreshIcon } from "../shared/Icons";
// ============================================================

// ── Outside click / tap (pointerdown) ────────────────────────
// Closes on pointerdown outside of provided target(s).
export function useOutsidePointerDown(isOpen, targets, onClose) {
  useEffect(() => {
    if (!isOpen) return;
    const handle = (e) => {
      const list = Array.isArray(targets) ? targets : [targets];
      for (const t of list) {
        const el = t?.current ?? t;
        if (!el) continue;
        if (el === e.target || (el.contains && el.contains(e.target))) return;
      }
      onClose?.();
    };
    document.addEventListener("pointerdown", handle, { capture: true });
    return () => document.removeEventListener("pointerdown", handle, { capture: true });
  }, [isOpen, targets, onClose]);
}

// ── Filter popover portal ─────────────────────────────────────
// Renders a floating popover anchored to a button rect.
// mode="anchor" → positioned below the anchor element.
// mode="center" → fixed to viewport center (used by date range picker).
export function FilterPopoverPortal({
  open,
  anchorRect,
  anchorEl,
  onClose,
  className,
  contentKey,
  id,
  mode = "anchor",
  trapFocus = mode === "center",
  closeOnEscape = true,
  children,
}) {
  const popRef = useRef(null);
  const [style, setStyle] = useState({ left: 0, top: 0, visibility: "hidden" });

  useOutsidePointerDown(open, [popRef, anchorEl], onClose);

  useEffect(() => {
    if (!open) return;
    const getFocusables = () => {
      const root = popRef.current;
      if (!root) return [];
      return Array.from(
        root.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && closeOnEscape) {
        onClose?.();
        return;
      }
      if (!trapFocus || e.key !== "Tab") return;
      const focusables = getFocusables();
      if (!focusables.length) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    if (trapFocus) {
      const focusables = getFocusables();
      if (focusables.length && !popRef.current?.contains(document.activeElement)) {
        focusables[0].focus();
      }
    }

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, trapFocus, closeOnEscape, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useLayoutEffect(() => {
    if (!open || !popRef.current) return;
    const pop = popRef.current;
    const measureAndPlace = () => {
      if (mode === "center") {
        setStyle({ left: "50%", top: "50%", transform: "translate(-50%, -50%)", visibility: "visible" });
        return;
      }
      if (!anchorRect) return;
      const margin = 8;
      const popW = pop.offsetWidth;
      const popH = pop.offsetHeight;
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      let left = anchorRect.left;
      left = Math.min(left, viewportW - popW - margin);
      left = Math.max(margin, left);
      let top = anchorRect.bottom + 6;
      if (top + popH + margin > viewportH) {
        const above = anchorRect.top - popH - 6;
        if (above >= margin) top = above;
        else top = Math.max(margin, viewportH - popH - margin);
      }
      setStyle({ left, top, transform: "none", visibility: "visible" });
    };
    measureAndPlace();
    window.addEventListener("resize", measureAndPlace);
    window.addEventListener("orientationchange", measureAndPlace);
    return () => {
      window.removeEventListener("resize", measureAndPlace);
      window.removeEventListener("orientationchange", measureAndPlace);
    };
  }, [open, anchorRect, contentKey, mode]);

  if (!open || (mode !== "center" && !anchorRect)) return null;

  return createPortal(
    <div
      ref={popRef}
      id={id}
      className={className}
      style={style}
      role="dialog"
      aria-modal={mode === "center" ? "true" : "false"}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

// ── Status badge ──────────────────────────────────────────────
// Renders a badge for any juror workflow state or cell state.
// Uses jurorStatusMeta for all label/icon/color lookups.
export function StatusBadge({ status, editingFlag, variant, icon, children }) {
  if (variant || icon || children) {
    return (
      <span className={`status-badge${variant ? ` ${variant}` : ""}`}>
        {icon}
        {children}
      </span>
    );
  }
  const key = editingFlag === "editing" ? "editing" : (status ?? "not_started");
  const meta = jurorStatusMeta[key] ?? jurorStatusMeta.not_started;
  const Icon = meta.icon;
  return (
    <span className={`status-badge ${meta.colorClass}`}>
      <Icon />{meta.label}
    </span>
  );
}
