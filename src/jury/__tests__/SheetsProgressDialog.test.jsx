// src/jury/__tests__/SheetsProgressDialog.test.jsx
// ============================================================
// SheetsProgressDialog — juror status chip + SemesterStep auto-advance.
// ============================================================

import { render, screen } from "@testing-library/react";
import { waitFor } from "@testing-library/react";
import { describe, expect, vi } from "vitest";
import { qaTest } from "../../test/qaTest.js";

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("../../shared/Icons", () => ({
  BadgeCheckIcon:  "span",
  SaveIcon:        "span",
  ChevronDownIcon: "span",
  LoaderIcon:      "span",
  HistoryIcon:     "span",
  InfoIcon:        "span",
  ClockIcon:       "span",
}));

vi.mock("../../admin/scoreHelpers", () => ({
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
  GroupLabel:   ({ text }) => text,
  ProjectTitle: ({ text }) => text,
  StudentNames: () => null,
}));

vi.mock("../../shared/MinimalLoaderOverlay", () => ({ default: () => null }));

// ── Imports (after mocks) ─────────────────────────────────────────────────

import SheetsProgressDialog from "../SheetsProgressDialog";
import SemesterStep from "../SemesterStep";

// ── Fixtures ──────────────────────────────────────────────────────────────

const noop = vi.fn();

const BASE_PROGRESS = {
  rows:                 [],
  filledCount:          0,
  totalCount:           3,
  criteriaFilledCount:  0,
  criteriaTotalCount:   12,
  allSubmitted:         false,
  editAllowed:          false,
  loading:              false,
};

// ── SheetsProgressDialog tests ────────────────────────────────────────────

describe("SheetsProgressDialog — juror status chip", () => {
  qaTest("jury.progress.01", () => {
    // allSubmitted=true → jurorStatusChip resolves to "completed" → "Completed" label
    render(
      <SheetsProgressDialog
        progress={{ ...BASE_PROGRESS, allSubmitted: true, filledCount: 3 }}
        projects={[]}
        onConfirm={noop}
        onFresh={noop}
      />
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  qaTest("jury.progress.02", () => {
    // hasData (rows.length > 0), filledCount < totalCount → "In Progress"
    const rows = [
      { projectId: "p-1", status: "in_progress", scoreStatus: "partial", total: null, partialTotal: 40, timestamp: "" },
    ];
    render(
      <SheetsProgressDialog
        progress={{ ...BASE_PROGRESS, rows, filledCount: 1, totalCount: 3 }}
        projects={[]}
        onConfirm={noop}
        onFresh={noop}
      />
    );
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });
});

// ── SemesterStep auto-advance ─────────────────────────────────────────────

describe("SemesterStep — single semester auto-advance", () => {
  qaTest("jury.semester.01", async () => {
    const semester = { id: "sem-1", name: "2024-2025 Spring", is_active: true };
    const onSelect = vi.fn();

    render(
      <SemesterStep semesters={[semester]} onSelect={onSelect} onBack={noop} />
    );

    await waitFor(() => expect(onSelect).toHaveBeenCalledWith(semester));
  });
});
