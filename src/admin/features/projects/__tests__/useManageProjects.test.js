import { describe, vi, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/api", () => ({
  adminListProjects: vi.fn().mockResolvedValue({ data: [], error: null }),
  createProject: vi.fn().mockResolvedValue({ data: {}, error: null }),
  upsertProject: vi.fn().mockResolvedValue({ data: {}, error: null }),
  deleteProject: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [], error: null }) })),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}));

vi.mock("@/admin/utils/auditUtils", () => ({
  normalizeTeamMemberNames: (names) => names,
}));

import { useManageProjects } from "../useManageProjects";

function makeOpts(overrides = {}) {
  return {
    organizationId: "org-001",
    viewPeriodId: "period-001",
    viewPeriodLabel: "Spring 2026",
    periodList: [],
    setMessage: vi.fn(),
    incLoading: vi.fn(),
    decLoading: vi.fn(),
    setPanelError: vi.fn(),
    clearPanelError: vi.fn(),
    ...overrides,
  };
}

describe("useManageProjects", () => {
  qaTest("admin.projects.hook.init", () => {
    const { result } = renderHook(() => useManageProjects(makeOpts()));
    expect(Array.isArray(result.current.projects)).toBe(true);
    expect(result.current.projects).toEqual([]);
    expect(typeof result.current.loadProjects).toBe("function");
    expect(typeof result.current.handleAddProject).toBe("function");
  });
});
