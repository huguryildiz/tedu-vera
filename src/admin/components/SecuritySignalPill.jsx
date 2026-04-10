// src/admin/components/SecuritySignalPill.jsx
// ============================================================
// Data-driven pill for the Security & Sessions card.
// Three states: secure | review | risk.
// Opens a verdict-first popover on click. Footer action links
// to the View Sessions drawer via onReviewSessions callback.
// ============================================================

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

const STATE_META = {
  loading: {
    label: "—",
    tone: "neutral",
    ariaLabel: "Security signal: loading",
  },
  secure: {
    label: "Secure",
    tone: "success",
    ariaLabel: "Security signal: Secure. Click to see details.",
  },
  review: {
    label: "Review",
    tone: "warning",
    ariaLabel: "Security signal: Review. Click to see details.",
  },
  risk: {
    label: "At Risk",
    tone: "danger",
    ariaLabel: "Security signal: At Risk. Click to see details.",
  },
};

const FACTOR_ORDER = [
  { key: "sessionCount", label: "Active sessions", tag: { ok: "ok", warn: "high", bad: "very high" }, format: (v) => `${v}` },
  { key: "countryDiversity", label: "Countries", tag: { ok: "ok", warn: "mixed", bad: "mixed" }, format: (v) => `${v || 0}` },
  { key: "lastLoginFreshness", label: "Last login", tag: { ok: "ok", warn: "stale", bad: "inactive" }, format: (v) => (v == null ? "—" : `${v}d`) },
  { key: "expiredSessions", label: "Expired sessions", tag: { ok: "ok", warn: "some", bad: "many" }, format: (v) => `${v}` },
];

const TONE_CLASS = {
  success: "sec-pill--success",
  warning: "sec-pill--warning",
  danger: "sec-pill--danger",
  neutral: "sec-pill--neutral",
};

export default function SecuritySignalPill({ signal, onReviewSessions }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const dialogId = useId();

  const state = signal?.state || "loading";
  const meta = STATE_META[state] || STATE_META.loading;
  const isLoading = state === "loading";

  const handleToggle = useCallback(() => {
    if (isLoading) return;
    setOpen((prev) => !prev);
  }, [isLoading]);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Return focus to the button for keyboard users
    if (buttonRef.current) buttonRef.current.focus();
  }, []);

  const handleReview = useCallback(() => {
    if (typeof onReviewSessions === "function") onReviewSessions();
    setOpen(false);
  }, [onReviewSessions]);

  // Outside click + Escape handling
  useEffect(() => {
    if (!open) return undefined;

    function onDocClick(e) {
      const pop = popoverRef.current;
      const btn = buttonRef.current;
      if (!pop || !btn) return;
      if (pop.contains(e.target) || btn.contains(e.target)) return;
      setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
      }
    }

    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, handleClose]);

  return (
    <div className="sec-pill-wrap" style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={buttonRef}
        type="button"
        className={`sec-pill ${TONE_CLASS[meta.tone] || TONE_CLASS.neutral}`}
        aria-label={meta.ariaLabel}
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={handleToggle}
        disabled={isLoading}
      >
        <span className="sec-pill-dot" aria-hidden="true" />
        <span className="sec-pill-label">{meta.label}</span>
        <ChevronDown className="sec-pill-chev" aria-hidden="true" />
      </button>

      {open && signal && (
        <div
          ref={popoverRef}
          id={dialogId}
          className={`sec-popover sec-popover--${meta.tone}`}
          role="dialog"
          aria-labelledby={`${dialogId}-title`}
        >
          {state === "secure" ? (
            <div className="sec-popover-clear">
              <div className="sec-popover-clear-icon" aria-hidden="true">
                <Check size={12} />
              </div>
              <span id={`${dialogId}-title`} className="sec-popover-clear-text">
                All security signals are clear.
              </span>
            </div>
          ) : (
            <div className="sec-popover-banner">
              <div id={`${dialogId}-title`} className="sec-popover-verdict">
                {signal.verdict?.title}
              </div>
              {signal.verdict?.reason && (
                <div className="sec-popover-reason">{signal.verdict.reason}</div>
              )}
            </div>
          )}

          <div className="sec-popover-body">
            {FACTOR_ORDER.map((factor) => {
              const s = signal.signals?.[factor.key];
              if (!s) return null;
              const tag = factor.tag[s.severity] || s.severity;
              return (
                <div key={factor.key} className="sec-factor-row">
                  <div className="sec-factor-label">{factor.label}</div>
                  <div className={`sec-factor-value sec-factor-value--${s.severity}`}>
                    {factor.format(s.value)} · {tag}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sec-popover-footer">
            <button
              type="button"
              className="sec-popover-action"
              onClick={handleReview}
            >
              Review sessions →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
