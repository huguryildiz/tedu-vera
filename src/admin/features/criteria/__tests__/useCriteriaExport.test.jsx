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
  exportCriteriaXLSX: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/admin/utils/downloadTable", () => ({
  downloadTable: vi.fn().mockResolvedValue(undefined),
  generateTableBlob: vi.fn().mockResolvedValue(new Blob()),
}));

import { useCriteriaExport } from "../useCriteriaExport";

describe("useCriteriaExport", () => {
  qaTest("coverage.use-criteria-export.returns-handlers", () => {
    const { result } = renderHook(() =>
      useCriteriaExport({ criteria: [], periodName: "Spring 2024" })
    );
    expect(typeof result.current.generateFile).toBe("function");
    expect(typeof result.current.handleExport).toBe("function");
  });
});
