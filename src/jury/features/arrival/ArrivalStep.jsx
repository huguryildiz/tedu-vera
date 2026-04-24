// src/jury/features/arrival/ArrivalStep.jsx
// ============================================================
// Jury flow arrival screen — shown once between the /eval QR
// entry-token verification and the Jury Information (identity)
// form. Closes the loop on the physical QR scan with a
// lock-in animation, then introduces the session.
// ============================================================

import { ArrowRight, Check } from "lucide-react";
import veraLogoDark from "../../../assets/vera_logo_dark.png";
import veraLogoWhite from "../../../assets/vera_logo_white.png";
import "./ArrivalStep.css";

// 7×7 QR-like pattern. true = filled pixel, false = blank.
// Three corners are replaced with finder-pattern blocks.
const QR_PATTERN = [
  [0, 1, 0, 1, 1, 0, 0],
  [1, 0, 1, 0, 0, 1, 1],
  [0, 1, 1, 1, 0, 1, 0],
  [1, 0, 0, 1, 1, 0, 1],
  [0, 1, 0, 0, 1, 1, 0],
  [1, 0, 1, 1, 0, 0, 1],
  [0, 1, 0, 1, 0, 1, 0],
];

export default function ArrivalStep({ state, onBack }) {
  const period = state.currentPeriodInfo;
  const orgName = period?.organizations?.name || state.orgName || "";
  const periodName = period?.name || "";
  const projectCount = Number(state.activeProjectCount || 0);

  const handleContinue = () => {
    state.setStep("identity");
  };

  return (
    <div className="jury-step ja-step">
      <div className="ja-stack">

        {/* ── QR lock-in hero ─────────────────────────── */}
        <div className="ja-qr-wrap">
          <span className="ja-bracket tl" aria-hidden="true" />
          <span className="ja-bracket tr" aria-hidden="true" />
          <span className="ja-bracket bl" aria-hidden="true" />
          <span className="ja-bracket br" aria-hidden="true" />

          <div className="ja-qr-grid" aria-hidden="true">
            {QR_PATTERN.flatMap((row, r) =>
              row.map((cell, c) => (
                <span
                  key={`${r}-${c}`}
                  className={`ja-qr-cell${cell ? "" : " blank"}`}
                  style={{ "--i": r * 7 + c }}
                />
              ))
            )}
          </div>

          <div className="ja-finder tl" aria-hidden="true" />
          <div className="ja-finder tr" aria-hidden="true" />
          <div className="ja-finder bl" aria-hidden="true" />

          <div className="ja-laser" aria-hidden="true" />

          <div className="ja-check" aria-hidden="true">
            <div className="ja-check-disc">
              <Check size={28} strokeWidth={2.8} />
            </div>
          </div>
          <div className="ja-burst" aria-hidden="true" />
        </div>

        {/* ── Content ─────────────────────────────────── */}
        <div className="ja-content">
          <div className="ja-logo">
            <img src={veraLogoDark} alt="VERA" className="jg-logo-dark" />
            <img src={veraLogoWhite} alt="VERA" className="jg-logo-light" />
          </div>

          <div className="ja-stamp">
            <span className="ja-dot" />
            <span>
              {periodName ? `${periodName} · ` : ""}Jury Session
            </span>
          </div>

          <h1 className="ja-hero">
            You're <em>in.</em>
          </h1>

<div className="ja-actions">
            <button
              type="button"
              className="ja-cta"
              data-testid="jury-arrival-begin"
              onClick={handleContinue}
              autoFocus
            >
              <span>Begin jury session</span>
              <span className="ja-cta-arrow">
                <ArrowRight size={13} strokeWidth={2.5} />
              </span>
            </button>
            <button type="button" className="ja-back" onClick={onBack}>
              &larr; Return Home
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
