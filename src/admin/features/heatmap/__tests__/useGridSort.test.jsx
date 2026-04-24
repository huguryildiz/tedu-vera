import { describe, vi, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/utils/persist", () => ({
  readSection: () => ({}),
  writeSection: vi.fn(),
}));

vi.mock("@/admin/utils/scoreHelpers", () => ({
  getCellState: () => "scored",
}));

vi.mock("@/admin/utils/adminUtils", () => ({
  cmp: (a, b) => (a < b ? -1 : a > b ? 1 : 0),
}));

import { useGridSort } from "../useGridSort";

const JURORS = Object.freeze([
  { key: "j1", name: "Alice" },
  { key: "j2", name: "Bob" },
]);

describe("useGridSort", () => {
  qaTest("coverage.use-grid-sort.initial-state", () => {
    const { result } = renderHook(() => useGridSort(JURORS, [], {}, 100, []));
    expect(result.current.sortMode).toBe("none");
    expect(result.current.sortGroupId).toBeNull();
    expect(result.current.visibleJurors).toHaveLength(2);
  });

  qaTest("coverage.use-grid-sort.toggles-direction", () => {
    const { result } = renderHook(() => useGridSort(JURORS, [], {}, 100, []));
    act(() => result.current.toggleJurorSort());
    expect(result.current.sortMode).toBe("juror");
    act(() => result.current.toggleJurorSort());
    expect(result.current.sortJurorDir).toBe("desc");
  });
});
