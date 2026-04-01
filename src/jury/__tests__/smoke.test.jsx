// src/jury/__tests__/smoke.test.jsx
// ============================================================
// Smoke tests — every jury step component renders without crash.
// ============================================================

import { render } from "@testing-library/react";
import { describe, expect, vi } from "vitest";
import { qaTest } from "../../test/qaTest.js";

// ── Shared mocks ─────────────────────────────────────────────
vi.mock("../../shared/Icons", () => ({
  KeyRoundIcon:       "span", AlertCircleIcon: "span", LockIcon: "span",
  ClockIcon:          "span", InfoIcon:        "span", UserRoundCheckIcon: "span",
  HomeIcon:           "span", ChevronDownIcon: "span", PencilIcon: "span",
  HistoryIcon:        "span", BadgeCheckIcon:  "span", SaveIcon: "span",
  LoaderIcon:         "span", CheckCircle2Icon: "span", CheckIcon: "span",
  SendIcon:           "span", Clock3Icon:      "span", CircleIcon: "span",
  CircleDotDashedIcon: "span",
}));

vi.mock("../../config", () => ({
  CRITERIA: [
    { id: "technical", label: "Technical", max: 25 },
    { id: "design",    label: "Design",    max: 25 },
    { id: "delivery",  label: "Delivery",  max: 25 },
    { id: "teamwork",  label: "Teamwork",  max: 25 },
  ],
  APP_CONFIG: { maxScore: 100 },
}));

vi.mock("../../admin/scoreHelpers", () => ({
  getCellState:    () => "empty",
  getPartialTotal: () => 0,
  jurorStatusMeta: {
    completed:       { label: "Completed",       icon: "span", colorClass: "status-green" },
    ready_to_submit: { label: "Ready to Submit", icon: "span", colorClass: "status-blue" },
    in_progress:     { label: "In Progress",     icon: "span", colorClass: "status-amber" },
    not_started:     { label: "Not Started",     icon: "span", colorClass: "status-gray" },
    editing:         { label: "Editing",         icon: "span", colorClass: "status-purple" },
    scored:          { label: "Scored",          icon: "span", colorClass: "status-green-soft" },
    partial:         { label: "Partial",         icon: "span", colorClass: "status-amber" },
    empty:           { label: "Empty",           icon: "span", colorClass: "status-gray" },
  },
}));

vi.mock("../../admin/utils", () => ({ formatTs: () => "—" }));

vi.mock("../../components/EntityMeta", () => ({
  GroupLabel:    ({ text })  => text,
  ProjectTitle:  ({ text })  => text,
  StudentNames:  () => null,
}));

vi.mock("../../shared/MinimalLoaderOverlay", () => ({ default: () => null }));

// ── Imports (after mocks) ─────────────────────────────────────
import PinStep              from "../PinStep";
import PeriodStep           from "../PeriodStep";
import InfoStep             from "../InfoStep";
import DoneStep             from "../DoneStep";
import SheetsProgressDialog from "../SheetsProgressDialog";

const noop = vi.fn();

const PROGRESS_EMPTY = {
  rows: [], filledCount: 0, totalCount: 0,
  criteriaFilledCount: 0, criteriaTotalCount: 0,
  allSubmitted: false, editAllowed: false, loading: false,
};

describe("Jury step components — smoke renders", () => {
  qaTest("jury.smoke.01", () => {
    expect(() =>
      render(<PinStep
        pinError="" pinErrorCode="" pinAttemptsLeft={3} pinLockedUntil=""
        onPinSubmit={noop} onBack={noop}
      />)
    ).not.toThrow();

    expect(() =>
      render(<PeriodStep periods={[]} onSelect={noop} onBack={noop} />)
    ).not.toThrow();

    expect(() =>
      render(<InfoStep
        juryName="" setJuryName={noop} affiliation="" setAffiliation={noop}
        currentPeriod={null} activeProjectCount={null}
        onStart={noop} onBack={noop} error=""
      />)
    ).not.toThrow();

    expect(() =>
      render(<DoneStep
        juryName="Test" doneScores={{}} scores={{}} projects={[]} onBack={noop}
      />)
    ).not.toThrow();

    expect(() =>
      render(<SheetsProgressDialog
        progress={PROGRESS_EMPTY} projects={[]} onConfirm={noop} onFresh={noop}
      />)
    ).not.toThrow();
  });
});
