import { describe, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";
import { usePagination } from "../use-pagination.js";

describe("hooks/usePagination", () => {
  qaTest("hooks.usePagination.01", () => {
    const { result } = renderHook(() =>
      usePagination({ currentPage: 1, totalPages: 5, paginationItemsToDisplay: 7 })
    );
    expect(result.current.pages).toEqual([1, 2, 3, 4, 5]);
    expect(result.current.showLeftEllipsis).toBe(false);
    expect(result.current.showRightEllipsis).toBe(false);
  });

  qaTest("hooks.usePagination.02", () => {
    const { result } = renderHook(() =>
      usePagination({ currentPage: 10, totalPages: 10, paginationItemsToDisplay: 5 })
    );
    expect(result.current.pages[result.current.pages.length - 1]).toBe(10);
    expect(result.current.showRightEllipsis).toBe(false);
  });

  qaTest("hooks.usePagination.03", () => {
    const { result } = renderHook(() =>
      usePagination({ currentPage: 5, totalPages: 20, paginationItemsToDisplay: 5 })
    );
    expect(result.current.showLeftEllipsis).toBe(true);
    expect(result.current.showRightEllipsis).toBe(true);
  });
});
