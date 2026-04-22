// src/admin/criteria/OutcomePillSelector.jsx

import { Check } from "lucide-react";


export default function OutcomePillSelector({ selected, outcomeConfig, onChange, disabled }) {
  const options = outcomeConfig || [];
  const outcomeByCode = new Map(options.map((o) => [o.code, o]));

  const validSelected = selected.filter((code) => outcomeByCode.has(code));
  const getOutcomeDescription = (outcome) => {
    if (!outcome) return "";
    const preferred =
      outcome.description ||
      outcome.desc_tr ||
      outcome.desc_en ||
      "";
    if (String(preferred).trim()) return preferred;
    return (
      outcome.label ||
      ""
    );
  };

  if (options.length === 0) {
    return (
      <span className="crt-outcome-empty">
        No outcomes defined yet.
      </span>
    );
  }

  const toggle = (code) => {
    if (disabled) return;
    const next = selected.includes(code)
      ? selected.filter((c) => c !== code)
      : [...selected, code];
    onChange(next);
  };

  return (
    <div className="crt-outcome-selector">
      <div className="crt-outcome-selector-label">Select outcomes to map</div>
      <div className="crt-outcome-pills">
        {options.map((o) => {
          const isSelected = selected.includes(o.code);
          return (
            <span
              key={o.code}
              className={`crt-outcome-pill ${isSelected ? "pill-selected" : "pill-available"}`}
              onClick={() => toggle(o.code)}
              tabIndex={disabled ? -1 : 0}
              role="checkbox"
              aria-checked={isSelected}
              aria-label={o.code}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  toggle(o.code);
                }
              }}
            >
              {isSelected && <Check size={11} strokeWidth={2.5} className="pill-check" aria-hidden="true" />}
              <span className="pill-code">{o.code}</span>
            </span>
          );
        })}
      </div>
      {validSelected.length > 0 && (
        <>
          <div className="crt-outcome-selector-label">Mapped ({validSelected.length})</div>
          <div className="crt-outcome-selected-detail">
            {validSelected.map((code) => (
              <div className="crt-outcome-selected-row" key={code}>
                <div className="sel-head">
                  <span className="sel-code">{code}</span>
                  <span className="sel-tag">Mapped Outcome</span>
                </div>
                <p className="sel-text">{getOutcomeDescription(outcomeByCode.get(code))}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
