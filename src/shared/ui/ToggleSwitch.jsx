import React from "react";

const TRACK_ON = "var(--accent)";
const TRACK_OFF = "#b0b8c4";

export function ToggleSwitch({ checked, onChange, label, testId }) {
  return (
    <label
      style={{ display: "inline-flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}
      data-testid={testId}
    >
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          display: "inline-block",
          width: 36,
          height: 20,
          borderRadius: 99,
          background: checked ? TRACK_ON : TRACK_OFF,
          position: "relative",
          transition: "background .2s",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: "0 1px 3px rgba(0,0,0,.25)",
            transition: "left .2s",
          }}
        />
      </span>
      {label && (
        <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>
          {label}
        </span>
      )}
    </label>
  );
}
