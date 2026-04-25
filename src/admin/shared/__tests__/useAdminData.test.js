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

  // ── Partial-failure scenarios ──────────────────────────────

  qaTest("admin.shared.adminData.07", async () => {
    // Partial failure A: getScores succeeds, getProjectSummary rejects with RLS error
    // Hook catches Promise.all rejection and clears all data (fail-safe strategy)
    const rpcError = new Error("RLS policy denies select");
    rpcError.code = "42501";
    mockGetProjectSummary.mockRejectedValue(rpcError);

    const opts = makeOpts();
    const { result } = renderHook(() => useAdminData(opts), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // When Promise.all rejects, hook clears both scores and summary (fail-safe)
    expect(result.current.rawScores).toEqual([]);
    expect(result.current.summaryData).toEqual([]);
    // Error message should be set
    expect(result.current.loadError).toMatch(/Could not load/);
    // onInitialLoadDone should still be called even on error
    expect(opts.onInitialLoadDone).toHaveBeenCalled();
  });

  qaTest("admin.shared.adminData.08", async () => {
    // Partial failure B: listPeriods succeeds, getScores rejects
    // Hook should surface error immediately and NOT call getProjectSummary
    const scoreError = new Error("Permission denied");
    mockGetScores.mockRejectedValue(scoreError);
    mockGetProjectSummary.mockResolvedValue([{ id: "proj1", students: "Alice, Bob" }]);

    const opts = makeOpts();
    const { result } = renderHook(() => useAdminData(opts), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Scores should be empty due to failure
    expect(result.current.rawScores).toEqual([]);
    // Summary should be empty (not called after getScores failed)
    expect(result.current.summaryData).toEqual([]);
    // Error should be set
    expect(result.current.loadError).toMatch(/Could not load/);
    // getScores was called once (from listPeriods flow), getProjectSummary called once in Promise.all
    // but the error in getScores means the Promise.all rejects immediately
    expect(mockGetScores).toHaveBeenCalled();
  });

  qaTest("admin.shared.adminData.09", async () => {
    // Empty-state distinction: all succeed but return empty arrays
    // Hook should distinguish "no data" (empty arrays) from "not loaded yet" (loading=true)
    mockGetScores.mockResolvedValue([]);
    mockGetProjectSummary.mockResolvedValue([]);
    mockListJurorsSummary.mockResolvedValue([]);

    const opts = makeOpts();
    const { result } = renderHook(() => useAdminData(opts), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // All data should be empty arrays, not undefined
    expect(result.current.rawScores).toEqual([]);
    expect(result.current.summaryData).toEqual([]);
    expect(result.current.allJurors).toEqual([]);
    // Loading should be false (not stuck in loading)
    expect(result.current.loading).toBe(false);
    // No error should be set
    expect(result.current.loadError).toBe("");
  });

  qaTest("admin.shared.adminData.10", async () => {
    // listJurorsSummary degrades gracefully (non-fatal)
    // Per the code, this RPC failure is caught and defaults to []
    const jurorError = new Error("RPC not deployed");
    mockListJurorsSummary.mockRejectedValue(jurorError);

    const opts = makeOpts();
    const { result } = renderHook(() => useAdminData(opts), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Scores and summary should be populated
    expect(result.current.rawScores).toEqual(makeScores());
    expect(result.current.summaryData).toHaveLength(1);
    // Jurors should be empty (degraded gracefully)
    expect(result.current.allJurors).toEqual([]);
    // No error should be set (it's non-fatal)
    expect(result.current.loadError).toBe("");
  });
});
