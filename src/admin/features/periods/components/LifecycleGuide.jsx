import { useState } from "react";
import { FileEdit, Send, Play, Archive, ArrowRight, ChevronDown, ChevronUp, Workflow } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";

// LifecycleGuide: collapsible explanatory block shown between the KPI strip
// and the LifecycleBar. Teaches admins what each stage means and what action
// is required to advance. Collapse state is persisted to localStorage so
// experienced admins can permanently dismiss it.
const GUIDE_KEY = "vera_periods_lifecycle_guide_open";

export default function LifecycleGuide() {
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(GUIDE_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(GUIDE_KEY, String(next)); } catch { /* noop */ }
      return next;
    });
  }

  const stages = [
    {
      key: "draft",
      icon: <FileEdit size={12} strokeWidth={2.2} />,
      label: "Draft",
      desc: "Set up criteria, projects & jurors",
      action: "Publish →",
    },
    {
      key: "published",
      icon: <Send size={12} strokeWidth={2.2} />,
      label: "Published",
      desc: "Jurors can join via QR or entry link",
      action: "Scores arrive →",
    },
    {
      key: "live",
      icon: <Play size={12} strokeWidth={2.2} />,
      label: "Live",
      desc: "Evaluation in progress, scores incoming",
      action: "Close →",
    },
    {
      key: "closed",
      icon: <Archive size={12} strokeWidth={2.2} />,
      label: "Closed",
      desc: "Rankings archived, period complete",
      action: null,
    },
  ];

  return (
    <div className="periods-lifecycle-guide">
      <div
        className="periods-lifecycle-guide-header"
        onClick={toggle}
        role="button"
        aria-expanded={open}
        aria-controls="periods-lifecycle-guide-body"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
      >
        <div className="periods-lifecycle-guide-left">
          <div className="periods-lifecycle-guide-icon">
            <Workflow size={14} strokeWidth={2} />
          </div>
          <div>
            <div className="periods-lifecycle-guide-title">Period Lifecycle</div>
            <div className="periods-lifecycle-guide-sub">How a period progresses from setup to completion</div>
          </div>
        </div>
        <button
          type="button"
          className="periods-lifecycle-guide-collapse-btn"
          aria-label={open ? "Collapse lifecycle guide" : "Expand lifecycle guide"}
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); toggle(); }}
        >
          {open ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}
        </button>
      </div>

      {open && (
        <div className="periods-lifecycle-guide-body" id="periods-lifecycle-guide-body">
          <div className="periods-lifecycle-guide-flow">
            {stages.map((stage, idx) => (
              <div key={stage.key} className="periods-lifecycle-guide-step">
                <div className="periods-lifecycle-guide-stage">
                  <span className={`periods-lifecycle-guide-pill ${stage.key}`}>
                    {stage.icon}
                    {stage.label}
                  </span>
                  <span className="periods-lifecycle-guide-stage-desc">{stage.desc}</span>
                  {stage.action && (
                    <span className="periods-lifecycle-guide-action-label">{stage.action}</span>
                  )}
                </div>
                {idx < stages.length - 1 && (
                  <div className="periods-lifecycle-guide-arrow">
                    <ArrowRight size={13} strokeWidth={1.8} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <FbAlert variant="info" style={{ marginTop: 12 }}>
            Each transition requires an explicit admin action. Closed periods are permanent and cannot be re-opened.
          </FbAlert>
        </div>
      )}
    </div>
  );
}
