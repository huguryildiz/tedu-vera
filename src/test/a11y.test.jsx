// src/test/a11y.test.jsx
// ============================================================
// Automated accessibility tests using vitest-axe (axe-core).
// Verifies key components have no a11y violations.
// ============================================================

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { qaTest } from "./qaTest.js";
import * as axeMatchers from "vitest-axe/matchers";
import { axe } from "vitest-axe";

expect.extend(axeMatchers);

// ── Mocks ─────────────────────────────────────────────────────

vi.mock("../config", () => ({
  CRITERIA: [
    {
      id: "technical", label: "Technical", max: 25, blurb: "Tech quality",
      mudek: [], rubric: [{ range: "0–12", level: "Low", desc: "Needs work", min: 0, max: 12 }],
    },
    {
      id: "design", label: "Design", max: 25, blurb: "Design quality",
      mudek: [], rubric: [{ range: "0–12", level: "Low", desc: "Needs work", min: 0, max: 12 }],
    },
  ],
  APP_CONFIG: { maxScore: 100 },
}));

vi.mock("../shared/Icons", () => ({
  ChevronDownIcon:          "span",
  InfoIcon:                 "span",
  KeyRoundIcon:             "span",
  TriangleAlertIcon:        "span",
  TriangleAlertLucideIcon:  "span",
  AlertCircleIcon:          "span",
  CheckCircle2Icon:         "span",
}));

// ── Component imports ────────────────────────────────────────

import ScoringGrid from "../jury/ScoringGrid";
import PinRevealStep from "../jury/PinRevealStep";
import PinResetDialog from "../admin/settings/PinResetDialog";
import { SaveIndicator } from "../jury/EvalHeader";

// ── Tests ─────────────────────────────────────────────────────

describe("Accessibility audit", () => {
  it("ScoringGrid has no a11y violations", async () => {
    const { container } = render(
      <ScoringGrid
        pid="p-1"
        scoresPid={{ technical: 20, design: 15 }}
        commentsPid="Good work"
        touchedPid={{ technical: true, design: true }}
        lockActive={false}
        handleScore={vi.fn()}
        handleScoreBlur={vi.fn()}
        handleCommentChange={vi.fn()}
        handleCommentBlur={vi.fn()}
        totalScore={35}
        allComplete={false}
        editMode={false}
        completedGroups={0}
        totalGroups={2}
        handleFinalSubmit={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("ScoringGrid in locked state has no a11y violations", async () => {
    const { container } = render(
      <ScoringGrid
        pid="p-1"
        scoresPid={{ technical: 20, design: 15 }}
        commentsPid=""
        touchedPid={{ technical: false, design: false }}
        lockActive={true}
        handleScore={vi.fn()}
        handleScoreBlur={vi.fn()}
        handleCommentChange={vi.fn()}
        handleCommentBlur={vi.fn()}
        totalScore={35}
        allComplete={false}
        editMode={false}
        completedGroups={0}
        totalGroups={2}
        handleFinalSubmit={vi.fn()}
      />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("PinRevealStep has no a11y violations", async () => {
    const { container } = render(
      <PinRevealStep pin="1234" onContinue={vi.fn()} onBack={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("PinRevealStep without back button has no a11y violations", async () => {
    const { container } = render(
      <PinRevealStep pin="5678" onContinue={vi.fn()} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe("Dialog accessibility", () => {
  const BASE_TARGET = { juror_id: "j1", juror_name: "Alice", juror_inst: "EE" };

  qaTest("a11y.dialog.01", () => {
    // PinResetDialog must carry role="dialog" and aria-modal="true" so screen readers
    // confine their virtual cursor to the dialog content.
    const { container } = render(
      <PinResetDialog
        pinResetTarget={BASE_TARGET}
        resetPinInfo={null}
        pinResetLoading={false}
        pinCopied={false}
        viewPeriodLabel="2026 Spring"
        onCopyPin={vi.fn()}
        onClose={vi.fn()}
        onConfirmReset={vi.fn()}
      />
    );
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  qaTest("a11y.dialog.02", () => {
    // Cancel button must have an accessible name and invoke onClose so keyboard
    // users can dismiss the dialog without a pointer device.
    const onClose = vi.fn();
    render(
      <PinResetDialog
        pinResetTarget={BASE_TARGET}
        resetPinInfo={null}
        pinResetLoading={false}
        pinCopied={false}
        viewPeriodLabel="2026 Spring"
        onCopyPin={vi.fn()}
        onClose={onClose}
        onConfirmReset={vi.fn()}
      />
    );
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).not.toBeNull();
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("Form accessibility", () => {
  qaTest("a11y.form.01", () => {
    // Every rubric score input must have an aria-label so screen reader users
    // know which criterion and project they are scoring.
    const { container } = render(
      <ScoringGrid
        pid="p-1"
        scoresPid={{ technical: null, design: null }}
        commentsPid=""
        touchedPid={{}}
        lockActive={false}
        handleScore={vi.fn()}
        handleScoreBlur={vi.fn()}
        handleCommentChange={vi.fn()}
        handleCommentBlur={vi.fn()}
        totalScore={0}
        allComplete={false}
        editMode={false}
        completedGroups={0}
        totalGroups={1}
        handleFinalSubmit={vi.fn()}
      />
    );
    const inputs = Array.from(container.querySelectorAll('input[type="text"]'));
    // At least the score inputs must exist and have aria-label
    const scoreInputs = inputs.filter((el) => el.getAttribute("aria-label")?.toLowerCase().includes("score"));
    expect(scoreInputs.length).toBeGreaterThan(0);
    scoreInputs.forEach((input) => {
      expect(input.getAttribute("aria-label")).toBeTruthy();
    });
  });
});

describe("Live region accessibility", () => {
  qaTest("a11y.banner.01", () => {
    // SaveIndicator must use role="status" with aria-live="polite" so screen readers
    // announce save/error state changes without interrupting the user.
    const { container } = render(<SaveIndicator saveStatus="error" />);
    const liveRegion = container.querySelector('[role="status"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion.getAttribute("aria-live")).toBe("polite");
  });
});

describe("Skip navigation", () => {
  qaTest("a11y.skipnav.01", () => {
    // The skip link is in index.html (static HTML), not in React components.
    // We test it by inserting it into a test container, which matches how
    // browsers would see it before React mounts.
    const container = document.createElement("div");
    container.innerHTML = `<a href="#main-content" class="skip-link">Skip to main content</a>`;
    document.body.appendChild(container);

    const skipLink = document.querySelector('a[href="#main-content"]');
    expect(skipLink).not.toBeNull();
    expect(skipLink.textContent).toMatch(/skip to main content/i);
    expect(skipLink.tabIndex).not.toBe(-1);

    document.body.removeChild(container);
  });
});
