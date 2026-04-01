// src/admin/__tests__/PinResetDialog.test.jsx
// ============================================================
// PinResetDialog — confirmation step period context (TC-020)
//                  and result step juror context (TC-021).
// ============================================================

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, vi } from "vitest";
import { qaTest } from "../../test/qaTest.js";
import PinResetDialog from "../settings/PinResetDialog";

vi.mock("../../shared/Icons", () => ({
  KeyRoundIcon:            "span",
  TriangleAlertIcon:       "span",
  TriangleAlertLucideIcon: "span",
  AlertCircleIcon:         "span",
  CheckCircle2Icon:        "span",
  InfoIcon:                "span",
}));

const BASE_TARGET = { juror_id: "j1", juror_name: "Alice", affiliation: "EE" };

function renderDialog(overrides = {}) {
  const defaults = {
    pinResetTarget: BASE_TARGET,
    resetPinInfo: null,
    pinResetLoading: false,
    pinCopied: false,
    viewPeriodLabel: "2026 Spring",
    onCopyPin: vi.fn(),
    onClose: vi.fn(),
    onConfirmReset: vi.fn(),
  };
  return render(<PinResetDialog {...defaults} {...overrides} />);
}

describe("PinResetDialog — confirmation step", () => {
  qaTest("pin.reset.01", () => {
    renderDialog();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  qaTest("pin.reset.02", () => {
    renderDialog({ viewPeriodLabel: "2026 Spring" });
    expect(screen.getByText("2026 Spring")).toBeInTheDocument();
  });

  qaTest("pin.reset.03", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reset pin/i })).toBeInTheDocument();
  });
});

describe("PinResetDialog — result step", () => {
  qaTest("pin.reset.04", () => {
    renderDialog({ resetPinInfo: { pin_plain_once: "4729" } });
    expect(screen.getByText("4729")).toBeInTheDocument();
  });

  qaTest("pin.reset.05", () => {
    renderDialog({ resetPinInfo: { pin_plain_once: "4729" } });
    // After code change: result step shows juror name for context
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });
});

describe("PinResetDialog — loading and stale state", () => {
  qaTest("pin.reset.06", () => {
    // During reset loading, button must show "Resetting…" and be disabled
    renderDialog({ pinResetLoading: true });
    const btn = screen.getByRole("button", { name: /resetting/i });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  qaTest("pin.reset.07", () => {
    // Second reset: when resetPinInfo updates to a new PIN, the new PIN is displayed
    const { rerender } = renderDialog({ resetPinInfo: { pin_plain_once: "1111" } });
    expect(screen.getByText("1111")).toBeInTheDocument();

    rerender(
      <PinResetDialog
        pinResetTarget={BASE_TARGET}
        resetPinInfo={{ pin_plain_once: "9999" }}
        pinResetLoading={false}
        pinCopied={false}
        viewPeriodLabel="2026 Spring"
        onCopyPin={vi.fn()}
        onClose={vi.fn()}
        onConfirmReset={vi.fn()}
      />
    );
    expect(screen.getByText("9999")).toBeInTheDocument();
    expect(screen.queryByText("1111")).toBeNull();
  });

  qaTest("pin.reset.08", () => {
    // Reopening dialog for a different juror shows the new juror's name
    const { rerender } = renderDialog({ pinResetTarget: BASE_TARGET });
    expect(screen.getByText("Alice")).toBeInTheDocument();

    rerender(
      <PinResetDialog
        pinResetTarget={{ juror_id: "j2", juror_name: "Carol", affiliation: "CS" }}
        resetPinInfo={null}
        pinResetLoading={false}
        pinCopied={false}
        viewPeriodLabel="2026 Spring"
        onCopyPin={vi.fn()}
        onClose={vi.fn()}
        onConfirmReset={vi.fn()}
      />
    );
    expect(screen.getByText("Carol")).toBeInTheDocument();
    expect(screen.queryByText("Alice")).toBeNull();
  });
});
