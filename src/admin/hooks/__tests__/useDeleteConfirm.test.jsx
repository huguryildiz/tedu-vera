import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDeleteConfirm } from "../useDeleteConfirm";

vi.mock("../../../shared/api", () => ({
  deleteEntity:    vi.fn(),
  getDeleteCounts: vi.fn(),
}));

import { deleteEntity } from "../../../shared/api";

describe("useDeleteConfirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onSemesterDeleted and sets toast message on successful delete", async () => {
    const onSemesterDeleted = vi.fn();
    const setMessage = vi.fn();

    deleteEntity.mockResolvedValueOnce(true);

    const { result } = renderHook(() =>
      useDeleteConfirm({
        organizationId: "test-org-id",
        setMessage,
        clearAllPanelErrors: vi.fn(),
        onSemesterDeleted,
        onProjectDeleted: vi.fn(),
        onJurorDeleted: vi.fn(),
      })
    );

    await act(async () => {
      result.current.setDeleteTarget({
        type: "period",
        id: "s1",
        label: "Period 2025 Fall",
      });
    });

    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    expect(onSemesterDeleted).toHaveBeenCalledWith("s1");
    expect(setMessage).toHaveBeenCalledWith("Period 2025 Fall deleted");
  });
});
