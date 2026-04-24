import { describe, vi, expect } from "vitest";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/utils/scoreHelpers", () => ({ getCellState: vi.fn() }));
vi.mock("@/admin/utils/adminUtils", () => ({ rowKey: vi.fn() }));

import { buildExportFilename } from "../exportXLSX";

describe("exportXLSX", () => {
  qaTest("coverage.export-xlsx.build-filename", () => {
    const filename = buildExportFilename("Scores", "Spring 2024", "xlsx", "TU");
    expect(filename).toMatch(/^VERA_Scores_TU_Spring-2024_\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
