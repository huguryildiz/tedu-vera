import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useDeleteConfirm } from "../useDeleteConfirm";

vi.mock("../../../shared/api", () => ({
  adminDeleteEntity: vi.fn(),
  adminDeleteCounts: vi.fn(),
  listSemesters: vi.fn(),
}));

import { adminDeleteEntity, listSemesters } from "../../../shared/api";

describe("useDeleteConfirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats semester delete as success when entity is already absent after an error", async () => {
    const onSemesterDeleted = vi.fn();
    const setMessage = vi.fn();

    adminDeleteEntity.mockRejectedValueOnce(new Error("network timeout"));
    listSemesters.mockResolvedValueOnce([{ id: "s2", name: "2026 Spring" }]);

    const { result } = renderHook(() =>
      useDeleteConfirm({
        adminPass: "admin",
        setMessage,
        clearAllPanelErrors: vi.fn(),
        onSemesterDeleted,
        onProjectDeleted: vi.fn(),
        onJurorDeleted: vi.fn(),
      })
    );

    await act(async () => {
      result.current.setDeleteTarget({
        type: "semester",
        id: "s1",
        label: "Semester 2025 Fall",
      });
    });

    await act(async () => {
      await result.current.handleConfirmDelete("delete-pass");
    });

    expect(onSemesterDeleted).toHaveBeenCalledWith("s1");
    expect(setMessage).toHaveBeenCalledWith("Semester 2025 Fall deleted");
  });
});

