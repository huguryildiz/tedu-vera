import { describe, vi, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/api", () => ({
  listJurors: vi.fn().mockResolvedValue({ data: [], error: null }),
  getJurorScores: vi.fn().mockResolvedValue({ data: [], error: null }),
  createJuror: vi.fn().mockResolvedValue({ data: {}, error: null }),
  updateJuror: vi.fn().mockResolvedValue({ data: {}, error: null }),
  deleteJuror: vi.fn().mockResolvedValue({ data: {}, error: null }),
  resetJurorPin: vi.fn().mockResolvedValue({ data: {}, error: null }),
  getPeriodMaxScore: vi.fn().mockResolvedValue({ data: 100, error: null }),
  listProjects: vi.fn().mockResolvedValue({ data: [], error: null }),
  adminListProjects: vi.fn().mockResolvedValue({ data: [], error: null }),
  notifyJuror: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(() => ({ select: vi.fn().mockResolvedValue({ data: [], error: null }) })),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}));

vi.mock("@/admin/shared/usePageRealtime", () => ({
  usePageRealtime: () => null,
}));

import { useManageJurors } from "../useManageJurors";

function makeOpts(overrides = {}) {
  return {
    organizationId: "org-001",
    viewPeriodId: "period-001",
    viewPeriodLabel: "Spring 2026",
    projects: [],
    setMessage: vi.fn(),
    incLoading: vi.fn(),
    decLoading: vi.fn(),
    setPanelError: vi.fn(),
    clearPanelError: vi.fn(),
    setEvalLockError: vi.fn(),
    bgRefresh: { current: null },
    ...overrides,
  };
}

describe("useManageJurors", () => {
  qaTest("admin.jurors.hook.load", () => {
    const { result } = renderHook(() => useManageJurors(makeOpts()));
    expect(result.current.jurors).toEqual([]);
    expect(Array.isArray(result.current.scoreRows)).toBe(true);
    expect(typeof result.current.loadJurorsAndEnrich).toBe("function");
  });
});
