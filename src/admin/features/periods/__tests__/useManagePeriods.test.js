import { describe, vi, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/api", () => ({
  listSemesters: vi.fn().mockResolvedValue({ data: [], error: null }),
  createSemester: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updateSemester: vi.fn().mockResolvedValue({ data: {}, error: null }),
  deleteSemester: vi.fn().mockResolvedValue({ data: {}, error: null }),
  setEvalLock: vi.fn().mockResolvedValue({ data: {}, error: null }),
  getCriteriaConfig: vi.fn().mockResolvedValue({ data: null, error: null }),
  getOutcomeConfig: vi.fn().mockResolvedValue({ data: null, error: null }),
  getSemesterCriteriaSnapshot: vi.fn().mockResolvedValue({ data: null, error: null }),
  getPeriodCriteriaConfig: vi.fn().mockResolvedValue({ data: null, error: null }),
  getPeriodOutcomeConfig: vi.fn().mockResolvedValue({ data: null, error: null }),
  duplicatePeriod: vi.fn().mockResolvedValue({ data: { id: "new-001" }, error: null }),
  createPeriod: vi.fn().mockResolvedValue({ data: { id: "new-001" }, error: null }),
  updatePeriod: vi.fn().mockResolvedValue({ data: {}, error: null }),
  deletePeriod: vi.fn().mockResolvedValue({ data: {}, error: null }),
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

function makeOpts(overrides = {}) {
  return {
    organizationId: "org-001",
    selectedPeriodId: null,
    setMessage: vi.fn(),
    incLoading: vi.fn(),
    decLoading: vi.fn(),
    setPanelError: vi.fn(),
    clearPanelError: vi.fn(),
    bgRefresh: { current: null },
    ...overrides,
  };
}

describe("useManagePeriods", () => {
  qaTest("admin.periods.hook.load", () => {
    const { result } = renderHook(() => useManagePeriods(makeOpts()));
    expect(Array.isArray(result.current.periodList)).toBe(true);
    expect(result.current.periodList).toEqual([]);
    expect(typeof result.current.loadPeriods).toBe("function");
  });
});
