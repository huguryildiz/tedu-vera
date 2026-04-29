// src/admin/features/reviews/ReviewsStatusGuide.jsx
// ============================================================
// Collapsible status legend used at the top of ReviewsPage.
// Open/closed state persisted in localStorage.
// ============================================================

import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, Circle, CircleCheck, CircleDotDashed, CircleSlash, Clock, Info, PencilLine, Send } from "lucide-react";

const REVIEWS_GUIDE_KEY = "vera_reviews_status_guide_open";

export default function ReviewsStatusGuide() {
  const [open, setOpen] = useState(() => {
    try {
      const stored = localStorage.getItem(REVIEWS_GUIDE_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(REVIEWS_GUIDE_KEY, String(next)); } catch { /* noop */ }
      return next;
    });
  }

  return (
    <div className="reviews-status-guide">
      <div
        className="reviews-status-guide-header"
        onClick={toggle}
        role="button"
        aria-expanded={open}
        aria-controls="reviews-status-guide-body"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } }}
      >
        <div className="reviews-status-guide-left">
          <div className="reviews-status-guide-icon">
            <Info size={14} strokeWidth={2} />
          </div>
          <div>
            <div className="reviews-status-guide-title">Status Legend</div>
            <div className="reviews-status-guide-sub">Score states and juror progress indicators explained</div>
          </div>
        </div>
        <button
          type="button"
          className="reviews-status-guide-collapse-btn"
          aria-label={open ? "Collapse status legend" : "Expand status legend"}
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); toggle(); }}
        >
          {open ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}
        </button>
      </div>

      {open && (
        <div className="reviews-status-guide-body" id="reviews-status-guide-body">
          <div className="reviews-legend-strips">
            <div>
              <div className="reviews-legend-category">Score Status</div>
              <div className="reviews-legend-strip">
                <div className="reviews-legend-item scored">
                  <div className="reviews-legend-icon-wrap scored"><Check size={13} strokeWidth={2.5} /></div>
                  <div>
                    <div className="reviews-legend-label scored">Scored</div>
                    <div className="reviews-legend-desc">All criteria evaluated for this project.</div>
                  </div>
                </div>
                <div className="reviews-legend-item partial">
                  <div className="reviews-legend-icon-wrap partial"><CircleDotDashed size={13} strokeWidth={2} /></div>
                  <div>
                    <div className="reviews-legend-label partial">Partial</div>
                    <div className="reviews-legend-desc">Some criteria scored, others still missing.</div>
                  </div>
                </div>
                <div className="reviews-legend-item empty">
                  <div className="reviews-legend-icon-wrap empty"><Circle size={13} strokeWidth={2.2} /></div>
                  <div>
                    <div className="reviews-legend-label empty">Empty</div>
                    <div className="reviews-legend-desc">No scores entered yet for this project.</div>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div className="reviews-legend-category">Juror Progress</div>
              <div className="reviews-legend-strip">
                <div className="reviews-legend-item completed">
                  <div className="reviews-legend-icon-wrap completed"><CircleCheck size={13} strokeWidth={2} /></div>
                  <div>
                    <div className="reviews-legend-label completed">Completed</div>
                    <div className="reviews-legend-desc">Final submission done, scores locked.</div>
                  </div>
                </div>
                <div className="reviews-legend-item ready">
                  <div className="reviews-legend-icon-wrap ready"><Send size={13} strokeWidth={2} /></div>
                  <div>
                    <div className="reviews-legend-label ready">Ready to Submit</div>
                    <div className="reviews-legend-desc">All groups scored, awaiting final submission.</div>
                  </div>
                </div>
                <div className="reviews-legend-item progress">
                  <div className="reviews-legend-icon-wrap progress"><Clock size={13} strokeWidth={2} /></div>
                  <div>
                    <div className="reviews-legend-label progress">In Progress</div>
                    <div className="reviews-legend-desc">Scoring started but not all groups done.</div>
                  </div>
                </div>
                <div className="reviews-legend-item not-started">
                  <div className="reviews-legend-icon-wrap not-started"><CircleSlash size={13} strokeWidth={2} /></div>
                  <div>
                    <div className="reviews-legend-label not-started">Not Started</div>
                    <div className="reviews-legend-desc">No scoring activity from this juror yet.</div>
                  </div>
                </div>
                <div className="reviews-legend-item editing">
                  <div className="reviews-legend-icon-wrap editing"><PencilLine size={13} strokeWidth={2} /></div>
                  <div>
                    <div className="reviews-legend-label editing">Editing</div>
                    <div className="reviews-legend-desc">Admin enabled editing mode for re-scoring.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
