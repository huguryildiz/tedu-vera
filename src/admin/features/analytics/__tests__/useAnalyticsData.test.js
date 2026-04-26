import { describe, vi, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/api", () => ({
  getOutcomeTrends: vi.fn().mockResolvedValue({ data: [], error: null }),
  getOutcomeAttainmentTrends: vi.fn().mockResolvedValue({ data: [], error: null }),
}));

vi.mock("@/admin/utils/persist", () => ({
  readSection: vi.fn().mockReturnValue({ periodIds: [] }),
  writeSection: vi.fn(),
}));

import { useAnalyticsData } from "../useAnalyticsData";

describe("useAnalyticsData", () => {
  qaTest("admin.analytics.data.returns-stable-empty-state-on-mount", () => {
    const { result } = renderHook(() =>
      useAnalyticsData({
        organizationId: "org-001",
        periodList: [],
        sortedPeriods: [],
        lastRefresh: null,
      })
    );
    expect(Array.isArray(result.current.trendData)).toBe(true);
    expect(Array.isArray(result.current.outcomeTrendData)).toBe(true);
    expect(typeof result.current.setTrendPeriodIds).toBe("function");
  });
});
