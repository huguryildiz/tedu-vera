import { describe, vi, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const mockListPeriods = vi.fn();
const mockSavePeriodCriteria = vi.fn();
const mockUpdatePeriodOutcomeConfig = vi.fn();
const mockDuplicatePeriod = vi.fn();

vi.mock("@/shared/api", () => ({
  listPeriods: (...a) => mockListPeriods(...a),
  createPeriod: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updatePeriod: vi.fn().mockResolvedValue({ data: {}, error: null }),
  deletePeriod: vi.fn().mockResolvedValue({ data: {}, error: null }),
  setEvalLock: vi.fn().mockResolvedValue({ data: {}, error: null }),
  getCriteriaConfig: vi.fn().mockResolvedValue({ data: null, error: null }),
  getOutcomeConfig: vi.fn().mockResolvedValue({ data: null, error: null }),
  getPeriodCriteriaSnapshot: vi.fn().mockResolvedValue({ data: null, error: null }),
  getPeriodCriteriaConfig: vi.fn().mockResolvedValue({ data: null, error: null }),
  getPeriodOutcomeConfig: vi.fn().mockResolvedValue({ data: null, error: null }),
  listPeriodCriteria: vi.fn().mockResolvedValue({ data: [], error: null }),
  savePeriodCriteria: (...a) => mockSavePeriodCriteria(...a),
  updatePeriodOutcomeConfig: (...a) => mockUpdatePeriodOutcomeConfig(...a),
  duplicatePeriod: (...a) => mockDuplicatePeriod(...a),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [], error: null }) })),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}));

vi.mock("@/admin/shared/usePageRealtime", () => ({
  usePageRealtime: () => null,
}));

vi.mock("@/shared/storage/adminStorage", () => ({
  getAdminViewPeriod: vi.fn().mockReturnValue(null),
  setAdminViewPeriod: vi.fn(),
  getPersistedCriteriaDraft: vi.fn().mockReturnValue(null),
  setPersistedCriteriaDraft: vi.fn(),
  clearPersistedCriteriaDraft: vi.fn(),
  getReadyToApplyBanner: vi.fn().mockReturnValue(null),
  setReadyToApplyBanner: vi.fn(),
  clearReadyToApplyBanner: vi.fn(),
}));

vi.mock("@/shared/criteria/criteriaHelpers", () => ({
  getActiveCriteria: () => [],
}));

vi.mock("@/shared/periodSort", () => ({
  sortPeriodsByStartDateDesc: (arr) => arr,
}));

vi.mock("@/jury/shared/periodSelection", () => ({
  pickDefaultPeriod: (arr) => arr?.[0] ?? null,
}));

vi.mock("@/shared/dateBounds", () => ({
  APP_DATE_MIN_DATE: "2000-01-01",
  APP_DATE_MAX_DATE: "2100-12-31",
  APP_DATE_MIN_YEAR: 2000,
  APP_DATE_MAX_YEAR: 2100,
  APP_DATE_MIN_DATETIME: "2000-01-01T00:00",
  APP_DATE_MAX_DATETIME: "2100-12-31T23:59",
  isIsoDateWithinBounds: () => true,
  isValidDateParts: () => true,
  clampDate: (d) => d,
  formatForInput: (d) => d,
  buildDateBoundsFromSettings: () => ({}),
}));

import { useManagePeriods } from "../useManagePeriods";

const makePeriods = () => [
  { id: "p1", name: "Fall 2025", status: "draft_incomplete", is_locked: false, closed_at: null },
  { id: "p2", name: "Spring 2026", status: "live", is_locked: true, closed_at: null },
];

function makeOpts(overrides = {}) {
  return {
    organizationId: "org-001",
    selectedPeriodId: "p1",
    setMessage: vi.fn(),
    incLoading: vi.fn(),
    decLoading: vi.fn(),
    setPanelError: vi.fn(),
    clearPanelError: vi.fn(),
    bgRefresh: { current: null },
    ...overrides,
  };
}

describe("useManagePeriods — lock enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPeriods.mockResolvedValue(makePeriods());
    mockSavePeriodCriteria.mockResolvedValue({ data: {}, error: null });
    mockUpdatePeriodOutcomeConfig.mockResolvedValue({});
    mockDuplicatePeriod.mockResolvedValue({ data: { id: "new-p3" }, error: null });
  });

  // ── Locked-period rejection ────────────────────────────────

  qaTest("period-lock-enforcement.criteria-config.locked-rejected", async () => {
    const opts = makeOpts({ selectedPeriodId: "p2" }); // p2 is_locked=true
    const { result } = renderHook(() => useManagePeriods(opts));

    // Load periods to populate the list
    await result.current.loadPeriods();
    await waitFor(() => expect(result.current.periodList.length).toBeGreaterThan(0));

    // Attempt to update criteria config on locked period
    const updateResult = await result.current.handleUpdateCriteriaConfig("p2", {
      weights: [50, 50],
      bands: [],
    });

    // Should return early with error, RPC should NOT be called
    expect(updateResult.ok).toBe(false);
    expect(updateResult.error).toMatch(/locked/i);
    expect(mockSavePeriodCriteria).not.toHaveBeenCalled();
  });

  qaTest("period-lock-enforcement.outcome-config.locked-rejected", async () => {
    const opts = makeOpts({ selectedPeriodId: "p2" }); // p2 is_locked=true
    const { result } = renderHook(() => useManagePeriods(opts));

    await result.current.loadPeriods();
    await waitFor(() => expect(result.current.periodList.length).toBeGreaterThan(0));

    // Attempt to update outcome config on locked period
    const updateResult = await result.current.handleUpdateOutcomeConfig("p2", {
      outcomes: [],
      mappings: [],
    });

    // Should return early with error, RPC should NOT be called
    expect(updateResult.ok).toBe(false);
    expect(updateResult.error).toMatch(/locked/i);
    expect(mockUpdatePeriodOutcomeConfig).not.toHaveBeenCalled();
  });

  // ── Open-period allowed mutations ──────────────────────────

  qaTest("period-lock-enforcement.criteria-config.draft-allowed", async () => {
    const opts = makeOpts({ selectedPeriodId: "p1" }); // p1 is_locked=false
    const { result } = renderHook(() => useManagePeriods(opts));

    await result.current.loadPeriods();
    await waitFor(() => expect(result.current.periodList.length).toBeGreaterThan(0));

    // Attempt to update criteria config on draft period
    const updateResult = await result.current.handleUpdateCriteriaConfig("p1", {
      weights: [50, 50],
      bands: [],
    });

    // Should call RPC (draft periods allow mutations)
    expect(mockSavePeriodCriteria).toHaveBeenCalled();
  });

  qaTest("period-lock-enforcement.outcome-config.draft-allowed", async () => {
    const opts = makeOpts({ selectedPeriodId: "p1" }); // p1 is_locked=false
    const { result } = renderHook(() => useManagePeriods(opts));

    await result.current.loadPeriods();
    await waitFor(() => expect(result.current.periodList.length).toBeGreaterThan(0));

    // Attempt to update outcome config on draft period
    const updateResult = await result.current.handleUpdateOutcomeConfig("p1", {
      outcomes: [],
      mappings: [],
    });

    // Should call RPC (draft periods allow mutations)
    expect(mockUpdatePeriodOutcomeConfig).toHaveBeenCalled();
    // Should succeed
    expect(updateResult.ok).toBe(true);
  });

  // ── State transition re-evaluation ─────────────────────────

  qaTest("period-lock-enforcement.lock-state-change-blocks-mutation", async () => {
    const opts = makeOpts({ selectedPeriodId: "p1" });
    const { result, rerender } = renderHook(() => useManagePeriods(opts));

    await result.current.loadPeriods();
    await waitFor(() => expect(result.current.periodList.length).toBeGreaterThan(0));

    // Period p1 starts unlocked, mutation should proceed
    const firstUpdate = await result.current.handleUpdateCriteriaConfig("p1", {
      weights: [50, 50],
      bands: [],
    });
    expect(mockSavePeriodCriteria).toHaveBeenCalledTimes(1);

    // Now simulate period state change: p1 becomes locked
    const lockedPeriods = [
      { id: "p1", name: "Fall 2025", status: "live", is_locked: true, closed_at: null },
      { id: "p2", name: "Spring 2026", status: "live", is_locked: true, closed_at: null },
    ];
    mockListPeriods.mockResolvedValueOnce(lockedPeriods);

    // Re-run loadPeriods to refresh state
    await result.current.loadPeriods();
    await waitFor(() => expect(result.current.periodList).toEqual(lockedPeriods));

    // Now mutation should be blocked
    const secondUpdate = await result.current.handleUpdateCriteriaConfig("p1", {
      weights: [50, 50],
      bands: [],
    });
    expect(secondUpdate.ok).toBe(false);
    expect(secondUpdate.error).toMatch(/locked/i);
    // RPC call count should still be 1 (no second call)
    expect(mockSavePeriodCriteria).toHaveBeenCalledTimes(1);
  });

  // ── No period selected edge case ────────────────────────────

  qaTest("period-lock-enforcement.no-selected-period-blocks", async () => {
    const opts = makeOpts({ selectedPeriodId: null });
    const { result } = renderHook(() => useManagePeriods(opts));

    await result.current.loadPeriods();
    await waitFor(() => expect(result.current.periodList.length).toBeGreaterThan(0));

    // Attempt to update when no period is selected
    const updateResult = await result.current.handleUpdateCriteriaConfig(null, {
      weights: [50, 50],
      bands: [],
    });

    // Should fail safely
    expect(updateResult.ok).toBe(false);
    expect(mockSavePeriodCriteria).not.toHaveBeenCalled();
  });
});
