// src/admin/__tests__/ScoreDetails.filter.test.jsx
// ============================================================
// Phase A safety tests — lock ScoreDetails filter pipeline behavior.
// ============================================================

import { beforeAll, beforeEach, describe, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("../../shared/auth", () => ({
  useAuth: () => ({ activeOrganization: null }),
}));

import ScoreDetails from "../ScoreDetails";
import { qaTest } from "../../test/qaTest.js";

function setDesktopViewport() {
  Object.defineProperty(window, "innerWidth", { value: 1440, writable: true });
  Object.defineProperty(window, "innerHeight", { value: 900, writable: true });
  window.dispatchEvent(new Event("resize"));
}

function createMatchMedia() {
  return vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// Three rows across three different groups, with different score statuses.
// Row A (group 1) — fully scored → effectiveStatus "scored"
// Row B (group 2) — partially scored → effectiveStatus "partial"
// Row C (group 3) — not scored at all → effectiveStatus "empty"
function makeMultiGroupData() {
  return [
    {
      period: "2026 Spring",
      jurorId: "j1",
      juryName: "Alice",
      affiliation: "EE",
      projectId: "p1",
      groupNo: 1,
      projectName: "Project Alpha",
      students: "A Student",
      technical: 25,
      design: 25,
      delivery: 20,
      teamwork: 8,
      total: 78,
      comments: "good",
      updatedAt: "2026-03-10T10:00:00.000Z",
      updatedMs: new Date("2026-03-10T10:00:00.000Z").getTime(),
      finalSubmittedAt: "2026-03-10T11:00:00.000Z",
      finalSubmittedMs: new Date("2026-03-10T11:00:00.000Z").getTime(),
    },
    {
      period: "2026 Spring",
      jurorId: "j2",
      juryName: "Bob",
      affiliation: "EE",
      projectId: "p2",
      groupNo: 2,
      projectName: "Project Beta",
      students: "B Student",
      technical: 20,
      design: null,
      delivery: null,
      teamwork: null,
      total: null,
      comments: "",
      updatedAt: "2026-03-11T09:00:00.000Z",
      updatedMs: new Date("2026-03-11T09:00:00.000Z").getTime(),
      finalSubmittedAt: "",
      finalSubmittedMs: 0,
    },
    {
      period: "2026 Spring",
      jurorId: "j3",
      juryName: "Cara",
      affiliation: "EE",
      projectId: "p3",
      groupNo: 3,
      projectName: "Project Gamma",
      students: "C Student",
      technical: null,
      design: null,
      delivery: null,
      teamwork: null,
      total: null,
      comments: "",
      updatedAt: "2026-03-12T12:00:00.000Z",
      updatedMs: new Date("2026-03-12T12:00:00.000Z").getTime(),
      finalSubmittedAt: "",
      finalSubmittedMs: 0,
    },
  ];
}

function makeJurors() {
  return [
    { key: "j1", jurorId: "j1", name: "Alice", dept: "EE", editEnabled: false },
    { key: "j2", jurorId: "j2", name: "Bob", dept: "EE", editEnabled: false },
    { key: "j3", jurorId: "j3", name: "Cara", dept: "EE", editEnabled: false },
  ];
}

function renderMultiGroupDetails() {
  const data = makeMultiGroupData();
  const jurors = makeJurors();
  return render(
    <ScoreDetails
      data={data}
      jurors={jurors}
      assignedJurors={jurors}
      groups={[]}
      periodName="2026 Spring"
      summaryData={[]}
      loading={false}
    />
  );
}

describe("ScoreDetails filter pipeline — Phase A safety", () => {
  beforeAll(() => {
    window.matchMedia = createMatchMedia();
  });

  beforeEach(() => {
    localStorage.clear();
    setDesktopViewport();
  });

  // phaseA.filter.01 — multi-select group and status filter
  qaTest("phaseA.filter.01", async () => {
    renderMultiGroupDetails();

    // Baseline: all three jurors visible before any filter
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Cara")).toBeInTheDocument();

    // Open the Group No filter popover
    fireEvent.click(screen.getByRole("button", { name: "Filter by Group No" }));

    // The popover renders checkboxes. Uncheck "All Groups" (deselects all) then
    // select only group "1". The allMode is "all", so clicking "All Groups"
    // when it is currently checked switches to an empty selection, and then
    // clicking "1" sets [1].
    fireEvent.click(screen.getByLabelText("All Groups"));
    fireEvent.click(screen.getByLabelText("1"));

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.queryByText("Bob")).toBeNull();
      expect(screen.queryByText("Cara")).toBeNull();
    });

    // Now additionally apply a Score Status filter for "Scored" only.
    // First close the group popover by opening the status popover.
    fireEvent.click(screen.getByRole("button", { name: "Filter by Score Status" }));
    fireEvent.click(screen.getByLabelText("All Statuses"));
    fireEvent.click(screen.getByLabelText("Scored"));

    await waitFor(() => {
      // Alice is in group 1 AND scored — must appear
      expect(screen.getByText("Alice")).toBeInTheDocument();
      // Bob is group 2 (filtered out by group filter) — must not appear
      expect(screen.queryByText("Bob")).toBeNull();
      // Cara is group 3 (filtered out by group filter) — must not appear
      expect(screen.queryByText("Cara")).toBeNull();
    });
  });

  // phaseA.filter.02 — no-filter baseline: all rows shown
  qaTest("phaseA.filter.02", async () => {
    renderMultiGroupDetails();

    // With no filters active all three rows must be visible
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Cara")).toBeInTheDocument();

    // The export button should reflect the full row count (3 rows)
    expect(screen.getByText("Export XLSX (3 rows)")).toBeInTheDocument();
  });

  // phaseA.filter.03 — activeFilterCount: no filter chips when no filters active
  qaTest("phaseA.filter.03", async () => {
    renderMultiGroupDetails();

    // When no filters are active there must be no individual filter chip buttons.
    // (The "Clear all filters" button may still appear due to the default sort, but
    // no column-specific filter chip should be present.)
    expect(screen.queryByRole("button", { name: /^Clear Score Status/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Clear Group No/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Clear Juror Status/ })).toBeNull();

    // All 3 rows are visible because no filter has been applied yet
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Cara")).toBeInTheDocument();

    // Apply a Score Status filter — a chip for that column must appear
    fireEvent.click(screen.getByRole("button", { name: "Filter by Score Status" }));
    fireEvent.click(screen.getByLabelText("All Statuses"));
    fireEvent.click(screen.getByLabelText("Scored"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Clear Score Status/ })).toBeInTheDocument();
    });

    // After resetting all filters the Score Status chip must disappear
    fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^Clear Score Status/ })).toBeNull();
    });
  });
});
