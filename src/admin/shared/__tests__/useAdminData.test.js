import { describe, vi, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

const mockListPeriods = vi.fn();
const mockGetScores = vi.fn();
const mockGetProjectSummary = vi.fn();
const mockListJurorsSummary = vi.fn();

vi.mock("@/shared/api", () => ({
  listPeriods: (...a) => mockListPeriods(...a),
  getScores: (...a) => mockGetScores(...a),
  getProjectSummary: (...a) => mockGetProjectSummary(...a),
  listJurorsSummary: (...a) => mockListJurorsSummary(...a),
}));

vi.mock("@/shared/periodSort", () => ({
  sortPeriodsByStartDateDesc: (periods) => [...periods].sort((a, b) => b.start_date?.localeCompare(a.start_date || "") || 0),
}));

vi.mock("@/jury/shared/periodSelection", () => ({
  pickDefaultPeriod: (periods) => periods.find((p) => p.status === "active") || periods[0] || null,
}));

vi.mock("../useAdminRealtime", () => ({
  useAdminRealtime: vi.fn(),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));

import { useAdminData } from "../useAdminData";

const makePeriods = () => [
  { id: "p1", name: "Fall 2025", status: "active", start_date: "2025-09-01" },
  { id: "p2", name: "Spring 2026", status: "upcoming", start_date: "2026-02-01" },
];

const makeScores = () => [{ projectId: "proj1", scores: [90] }];

const EMPTY_PERIODS = Object.freeze([]);

function makeWrapper(path = "/admin/overview") {
  return ({ children }) =>
    React.createElement(MemoryRouter, { initialEntries: [path] }, children);
}

function makeOpts(overrides = {}) {
  return {
    organizationId: "org-001",
    selectedPeriodId: "",
    onSelectedPeriodChange: vi.fn(),
    onAuthError: vi.fn(),
    onInitialLoadDone: vi.fn(),
    scoresView: "main",
    ...overrides,
  };
}

describe("useAdminData", () => {
  beforeEach(() => {
    mockListPeriods.mockResolvedValue(makePeriods());
    mockGetScores.mockResolvedValue(makeScores());
    mockGetProjectSummary.mockResolvedValue([{ id: "proj1", students: "Alice, Bob" }]);
    mockListJurorsSummary.mockResolvedValue([{ id: "j1", name: "Juror A" }]);
  });

  qaTest("admin.shared.adminData.01", async () => {
    const opts = makeOpts({ organizationId: "" });
    const { result } = renderHook(() => useAdminData(opts), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(opts.onInitialLoadDone).toHaveBeenCalled();
    expect(result.current.rawScores).toEqual([]);
  });

  qaTest("admin.shared.adminData.02", async () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useAdminData(opts), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rawScores).toEqual(makeScores());
    expect(result.current.summaryData).toHaveLength(1);
    expect(result.current.allJurors).toHaveLength(1);
    expect(result.current.periodList).toHaveLength(2);
    expect(opts.onInitialLoadDone).toHaveBeenCalled();
    expect(opts.onSelectedPeriodChange).toHaveBeenCalledWith("p1");
  });

  qaTest("admin.shared.adminData.03", async () => {
    mockListPeriods.mockResolvedValue(EMPTY_PERIODS);
    const opts = makeOpts();
    const { result } = renderHook(() => useAdminData(opts), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rawScores).toEqual([]);
    expect(opts.onSelectedPeriodChange).toHaveBeenCalledWith(null);
  });

  qaTest("admin.shared.adminData.04", async () => {
    const err = new Error("Unauthorized");
    err.unauthorized = true;
    mockListPeriods.mockRejectedValue(err);
    const opts = makeOpts();
    const { result } = renderHook(() => useAdminData(opts), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(opts.onAuthError).toHaveBeenCalled();
  });

  qaTest("admin.shared.adminData.05", async () => {
    mockListPeriods.mockRejectedValue(new Error("Network failure"));
    const opts = makeOpts();
    const { result } = renderHook(() => useAdminData(opts), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toMatch(/Could not load/);
    expect(result.current.rawScores).toEqual([]);
  });

  qaTest("admin.shared.adminData.06", async () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useAdminData(opts), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));
    const sorted = result.current.sortedPeriods;
    expect(sorted[0].start_date >= sorted[1]?.start_date || sorted.length <= 1).toBe(true);
    expect(sorted.map((p) => p.id)).toContain("p1");
  });
});
