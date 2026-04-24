import { describe, vi, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/auth", () => ({
  useAuth: () => ({ activeOrganization: { id: "org-1", code: "TU", name: "Test Uni" } }),
}));

vi.mock("@/shared/api", () => ({
  logExportInitiated: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/admin/utils/exportXLSX", () => ({
  exportGridXLSX: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/admin/utils/downloadTable", () => ({
  downloadTable: vi.fn().mockResolvedValue(undefined),
}));

import { useGridExport } from "../useGridExport";

describe("useGridExport", () => {
  qaTest("coverage.use-grid-export.returns-callback", () => {
    const { result } = renderHook(() =>
      useGridExport({
        buildExportRows: () => [],
        groups: [],
        periodName: "Spring 2024",
        visibleJurors: [],
        lookup: {},
        activeCriteria: [],
      })
    );
    expect(typeof result.current.requestExport).toBe("function");
  });
});
