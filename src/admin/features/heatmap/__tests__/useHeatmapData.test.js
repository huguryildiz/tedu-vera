import { describe, vi, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/utils/scoreHelpers", () => ({
  getJurorWorkflowState: vi.fn(() => "not_started"),
}));

vi.mock("@/admin/selectors/gridSelectors", () => ({
  buildLookup: vi.fn(() => ({})),
  buildJurorFinalMap: vi.fn(() => ({})),
  buildExportRowsData: vi.fn(() => []),
}));

import { useHeatmapData } from "../useHeatmapData";

describe("useHeatmapData", () => {
  qaTest("admin.heatmap.data.happy", () => {
    const { result } = renderHook(() =>
      useHeatmapData({
        data: [],
        jurors: [],
        groups: [],
        criteriaConfig: [],
      })
    );
    expect(result.current.lookup).toBeDefined();
    expect(result.current.jurorWorkflowMap).toBeDefined();
    expect(typeof result.current.buildExportRows).toBe("function");
  });
});
