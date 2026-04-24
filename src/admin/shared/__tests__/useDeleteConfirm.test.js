import { describe, vi, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const mockGetDeleteCounts = vi.fn();
const mockDeleteEntity = vi.fn();

vi.mock("@/shared/api", () => ({
  getDeleteCounts: (...a) => mockGetDeleteCounts(...a),
  deleteEntity: (...a) => mockDeleteEntity(...a),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));

import { useDeleteConfirm, buildCountSummary } from "../useDeleteConfirm";

function makeOpts(overrides = {}) {
  return {
    organizationId: "org-001",
    setMessage: vi.fn(),
    clearAllPanelErrors: vi.fn(),
    onPeriodDeleted: vi.fn(),
    onProjectDeleted: vi.fn(),
    onJurorDeleted: vi.fn(),
    ...overrides,
  };
}

describe("useDeleteConfirm", () => {
  beforeEach(() => {
    mockGetDeleteCounts.mockResolvedValue({ active_semesters: 0, juror_auths: 0, projects: 0, scores: 0 });
    mockDeleteEntity.mockResolvedValue(true);
  });

  qaTest("admin.shared.deleteConfirm.01", async () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useDeleteConfirm(opts));

    await act(async () => {
      await result.current.handleRequestDelete({ type: "project", id: "p1", name: "Alpha" });
    });

    expect(result.current.deleteTarget).not.toBeNull();
    expect(result.current.deleteTarget.id).toBe("p1");
    expect(result.current.deleteTarget.type).toBe("project");
    expect(typeof result.current.deleteTarget.typedConfirmation).toBe("string");
    expect(mockGetDeleteCounts).toHaveBeenCalledWith("project", "p1");
  });

  qaTest("admin.shared.deleteConfirm.02", async () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useDeleteConfirm(opts));

    await act(async () => {
      await result.current.handleRequestDelete({ type: "project", id: "p1", label: "Alpha" });
    });
    await act(async () => {
      await result.current.handleConfirmDelete();
    });

    expect(mockDeleteEntity).toHaveBeenCalledWith({ targetType: "project", targetId: "p1" });
    expect(opts.onProjectDeleted).toHaveBeenCalledWith("p1");
    expect(opts.setMessage).toHaveBeenCalledWith(expect.stringContaining("deleted"));
  });

  qaTest("admin.shared.deleteConfirm.03", () => {
    const opts = makeOpts();
    const { result } = renderHook(() => useDeleteConfirm(opts));

    const mapErr = result.current.mapDeleteError;
    expect(mapErr({ message: "not_found" })).toMatch(/not found/i);
    expect(mapErr({ message: "semester_locked" })).toMatch(/locked/i);
    expect(mapErr({ message: "project_has_scored_data" })).toMatch(/scored data/i);
    expect(mapErr({ message: "unexpected" })).toMatch(/try again/i);
  });

  qaTest("admin.shared.deleteConfirm.04", () => {
    expect(buildCountSummary(null)).toBeNull();
    expect(buildCountSummary({ active_semesters: 0, juror_auths: 0, projects: 0, scores: 0 })).toBeNull();

    const result1 = buildCountSummary({ active_semesters: 2, scores: 5, juror_auths: 0, projects: 0 });
    expect(result1).toContain("2 periods");
    expect(result1).toContain("5 completed evaluation");

    const result2 = buildCountSummary({ active_semesters: 0, juror_auths: 3, scores: 0, projects: 1 });
    expect(result2).toContain("3 period");
    expect(result2).toContain("1 group project");

    const result3 = buildCountSummary({ active_semesters: 0, juror_auths: 0, projects: 0, scores: 4 });
    expect(result3).toContain("4 completed evaluation");
  });
});
