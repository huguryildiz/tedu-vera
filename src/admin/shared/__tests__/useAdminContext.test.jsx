import { describe, vi, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("react-router-dom", () => ({
  useOutletContext: () => ({
    activeOrganization: { id: "org-42" },
    selectedPeriod: { name: "Spring 2024" },
    summaryData: { total: 10 },
    rawScores: [],
    matrixJurors: [],
    sortedPeriods: [],
    trendPeriodIds: [],
    setTrendPeriodIds: vi.fn(),
    frameworkThreshold: 70,
    navigateTo: vi.fn(),
    reloadFrameworks: vi.fn(),
  }),
}));

import { useAdminContext } from "../useAdminContext";

describe("useAdminContext", () => {
  qaTest("coverage.use-admin-context.derives-fields", () => {
    const { result } = renderHook(() => useAdminContext());
    expect(result.current.organizationId).toBe("org-42");
    expect(result.current.periodName).toBe("Spring 2024");
    expect(result.current.threshold).toBe(70);
  });
});
