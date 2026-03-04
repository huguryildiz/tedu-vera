// src/jury/InfoStep.jsx
// ============================================================
// Step 1 — Juror identity form.
//
// The juror enters their name and department, then clicks
// "Start Evaluation". All cloud-state feedback (saved progress,
// already submitted) is handled by SheetsProgressDialog which
// is rendered as an overlay in JuryForm after PIN verification.
//
// This component is intentionally simple: it collects identity
// and delegates everything else downstream.
// ============================================================

import { InfoIcon, UserRoundCheckIcon, AlertCircleIcon } from "../shared/Icons";

export default function InfoStep({
  juryName, setJuryName,
  juryDept, setJuryDept,
  activeSemester,
  onStart,
  onBack,
  error,
}) {
  const canStart = juryName.trim().length > 0 && juryDept.trim().length > 0;
  const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    const pad = (v) => String(v).padStart(2, "0");
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  };
  const semesterLabel = activeSemester?.name || "";
  const hasSemesterMeta = Boolean(semesterLabel);

  return (
    <div className="premium-screen">
      <div className="premium-card">
        <div className="premium-header">
          <div className="premium-icon-square" aria-hidden="true"><UserRoundCheckIcon /></div>
          <div className="premium-title">Jury Information</div>
          <div className="premium-subtitle">EE 492 — Senior Project Evaluation</div>
          {hasSemesterMeta && (
            <div className="premium-semester-meta">
              <span className="premium-semester-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M8 2v4" />
                  <path d="M16 2v4" />
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <path d="M3 10h18" />
                  <path d="M8 14h.01" />
                  <path d="M12 14h.01" />
                  <path d="M16 14h.01" />
                  <path d="M8 18h.01" />
                  <path d="M12 18h.01" />
                  <path d="M16 18h.01" />
                </svg>
              </span>
              <span>
                {semesterLabel} · {formatDate(activeSemester?.starts_on)} → {formatDate(activeSemester?.ends_on)}
              </span>
            </div>
          )}
        </div>

        <div className="premium-info-strip">
          <span className="info-strip-icon" aria-hidden="true"><InfoIcon /></span>
          <span>Your information cannot be changed once you start the evaluation.</span>
        </div>

        {error && (
          <div className="premium-error-banner" role="alert">
            <AlertCircleIcon />
            <div>
              <div className="premium-error-title">Could not continue</div>
              <div className="premium-error-detail">{error}</div>
            </div>
          </div>
        )}

        <div className="info-form">
          <div className="field">
            <label htmlFor="jury-name">Full Name <span className="req">*</span></label>
            <input
              id="jury-name"
              value={juryName}
              onChange={(e) => setJuryName(e.target.value)}
              placeholder="e.g. Prof. Dr. Jane Smith"
              autoComplete="name"
              autoFocus
              className="premium-input"
            />
          </div>

          <div className="field">
            <label htmlFor="jury-dept">Department or Institution <span className="req">*</span></label>
            <input
              id="jury-dept"
              value={juryDept}
              onChange={(e) => setJuryDept(e.target.value)}
              placeholder="e.g. EEE Dept. / TED University"
              onKeyDown={(e) => { if (e.key === "Enter" && canStart) onStart(); }}
              className="premium-input"
            />
          </div>
        </div>

        <button
          className="premium-btn-primary"
          disabled={!canStart}
          onClick={onStart}
        >
          Start Evaluation →
        </button>
        <button className="premium-btn-link" onClick={onBack} type="button">
          <span aria-hidden="true">←</span>
          Back to Home
        </button>
      </div>
    </div>
  );
}
