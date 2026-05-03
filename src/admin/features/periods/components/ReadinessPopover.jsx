import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ArrowRight, CheckCircle2, Info, X } from "lucide-react";
import { useFloating } from "@/shared/hooks/useFloating";

// ReadinessPopover: self-contained badge + portal inspector for Draft periods.
// Uses useFloating so the panel is never clipped by ancestor overflow:hidden.
export default function ReadinessPopover({ readiness, onFix }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const { floatingRef, floatingStyle } = useFloating({
    triggerRef,
    isOpen,
    onClose: () => setIsOpen(false),
    placement: 'bottom-start',
    offset: 6,
    zIndex: 'var(--z-dropdown)',
  });

  if (!readiness) return null;

  const required = (readiness.issues || []).filter((i) => i.severity === "required");
  const optional = (readiness.issues || []).filter((i) => i.severity === "optional");
  const isReady = readiness.ok;

  const fixTargetFor = (check) => {
    if (["criteria_name_missing", "no_criteria", "weight_mismatch", "missing_rubric_bands"].includes(check)) return "criteria";
    if (check === "no_projects") return "projects";
    if (check === "no_framework" || check === "no_outcomes") return "outcomes";
    if (check === "no_jurors") return "jurors";
    return null;
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`periods-readiness-badge${isReady ? " ready" : " blocked"}`}
        onClick={() => setIsOpen((o) => !o)}
        data-testid="readiness-badge"
      >
        {isReady ? (
          <>
            <CheckCircle2 size={11} strokeWidth={2} />
            Ready
          </>
        ) : (
          <>
            <AlertCircle size={11} strokeWidth={2} />
            {required.length} issue{required.length === 1 ? "" : "s"}
          </>
        )}
      </button>
      {isOpen && createPortal(
        <div
          ref={floatingRef}
          className="periods-readiness-inspector"
          style={floatingStyle}
          onClick={(e) => e.stopPropagation()}
          data-testid="readiness-inspector"
        >
          <div className="periods-readiness-inspector-header">
            <div>
              <div className="periods-readiness-inspector-title">Publish readiness</div>
              <div className="periods-readiness-inspector-sub">
                {isReady
                  ? "All required checks pass. You can publish this period."
                  : `${required.length} required check${required.length === 1 ? "" : "s"} remaining.`}
              </div>
            </div>
            <button className="periods-readiness-inspector-close" onClick={() => setIsOpen(false)} aria-label="Close">
              <X size={13} strokeWidth={2} />
            </button>
          </div>
          {required.length > 0 && (
            <div className="periods-readiness-section">
              <div className="periods-readiness-section-label required">Required</div>
              {required.map((issue) => {
                const target = fixTargetFor(issue.check);
                return (
                  <div key={issue.check} className="periods-readiness-row required">
                    <AlertCircle size={12} strokeWidth={2} />
                    <span className="periods-readiness-msg">{issue.msg}</span>
                    {target && (
                      <button className="periods-readiness-fix" onClick={() => { onFix?.(target); setIsOpen(false); }}>
                        Fix <ArrowRight size={10} strokeWidth={2.2} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {optional.length > 0 && (
            <div className="periods-readiness-section">
              <div className="periods-readiness-section-label optional">Optional</div>
              {optional.map((issue) => {
                const target = fixTargetFor(issue.check);
                return (
                  <div key={issue.check} className="periods-readiness-row optional">
                    <Info size={12} strokeWidth={2} />
                    <span className="periods-readiness-msg">{issue.msg}</span>
                    {target && (
                      <button className="periods-readiness-fix" onClick={() => { onFix?.(target); setIsOpen(false); }}>
                        Fix <ArrowRight size={10} strokeWidth={2.2} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
}
