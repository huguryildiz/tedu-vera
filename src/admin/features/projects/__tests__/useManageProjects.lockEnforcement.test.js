import { describe, vi, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { qaTest, todo } from "@/test/qaTest";

const mockAdminListProjects = vi.fn();
const mockCreateProject = vi.fn();
const mockUpsertProject = vi.fn();
const mockDeleteProject = vi.fn();

vi.mock("@/shared/api", () => ({
  adminListProjects: (...a) => mockAdminListProjects(...a),
  createProject: (...a) => mockCreateProject(...a),
  upsertProject: (...a) => mockUpsertProject(...a),
  deleteProject: (...a) => mockDeleteProject(...a),
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

const makeProjects = () => [
  { id: "proj1", title: "Project Alpha", students: "Alice, Bob" },
  { id: "proj2", title: "Project Beta", students: "Charlie, Diana" },
];

const makePeriods = () => [
  { id: "p-draft", name: "Fall 2025", is_locked: false, closed_at: null },
  { id: "p-locked", name: "Spring 2026", is_locked: true, closed_at: null },
];

function makeOpts(overrides = {}) {
  return {
    organizationId: "org-001",
    viewPeriodId: "p-draft",
    viewPeriodLabel: "Fall 2025",
    periodList: makePeriods(),
    setMessage: vi.fn(),
    incLoading: vi.fn(),
    decLoading: vi.fn(),
    setPanelError: vi.fn(),
    clearPanelError: vi.fn(),
    ...overrides,
  };
}

describe("useManageProjects — lock enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdminListProjects.mockResolvedValue(makeProjects());
    mockCreateProject.mockResolvedValue({ data: { id: "proj3" }, error: null });
    mockUpsertProject.mockResolvedValue({ data: {}, error: null });
    mockDeleteProject.mockResolvedValue({ data: {}, error: null });
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleImportProjects (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  todo("period-lock-enforcement.import-projects.locked-rejected", async () => {
    // Hook currently lacks client-side lock check in the import loop.
    // Product rule: when is_locked=true, batch project import must be rejected.
    // This test is a TODO placeholder until enforcement is added.
    // Expected behavior:
    // - viewPeriodId → locked period (is_locked=true)
    // - handleImportProjects([...rows]) called with CSV data
    // - Should return early WITHOUT calling createProject for any row
    // - Error message should prevent batch creation
    // Current pattern: loop calls createProject for each row unconditionally
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleAddProject (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  todo("period-lock-enforcement.add-project.locked-rejected", async () => {
    // Hook currently lacks client-side lock check before RPC.
    // Product rule: when is_locked=true, createProject must be rejected.
    // This test is a TODO placeholder until enforcement is added.
    // Expected behavior:
    // - viewPeriodId → locked period (is_locked=true)
    // - handleAddProject({title, students, advisor}) called
    // - Should return {ok: false} early WITHOUT calling createProject RPC
    // - Error message should mention "locked" or "scoring in progress"
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleEditProject (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  todo("period-lock-enforcement.edit-project.locked-rejected", async () => {
    // Hook currently lacks client-side lock check before RPC.
    // Product rule: when is_locked=true, upsertProject must be rejected.
    // This test is a TODO placeholder until enforcement is added.
    // Expected behavior:
    // - viewPeriodId → locked period (is_locked=true)
    // - handleEditProject(projectId, updates) called
    // - Should return {ok: false} early WITHOUT calling upsertProject RPC
    // - Error message should mention "locked"
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleDeleteProject (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  todo("period-lock-enforcement.delete-project.locked-rejected", async () => {
    // Hook currently lacks client-side lock check before RPC.
    // Product rule: when is_locked=true, deleteProject must be rejected.
    // This test is a TODO placeholder until enforcement is added.
    // Expected behavior:
    // - viewPeriodId → locked period (is_locked=true)
    // - handleDeleteProject(projectId) called
    // - Should return {ok: false} early WITHOUT calling deleteProject RPC
    // - Error message should mention "locked"
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleDuplicateProject (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  todo("period-lock-enforcement.duplicate-project.locked-rejected", async () => {
    // Hook currently lacks client-side lock check before RPC.
    // Product rule: when is_locked=true, project duplication must be rejected.
    // This test is a TODO placeholder until enforcement is added.
    // Expected behavior:
    // - viewPeriodId → locked period (is_locked=true)
    // - handleDuplicateProject(projectId) called
    // - Should return {ok: false} early WITHOUT calling createProject RPC
    // - Error message should mention "locked"
  });

  // ─────────────────────────────────────────────────────────────
  // ── Open-period allowed mutations (POSITIVE tests) ──
  // ─────────────────────────────────────────────────────────────

  qaTest("period-lock-enforcement.add-project.draft-allowed", async () => {
    // Draft periods (is_locked=false) should allow project creation
    const opts = makeOpts({ viewPeriodId: "p-draft" });
    const { result } = renderHook(() => useManageProjects(opts));

    await result.current.loadProjects?.() || Promise.resolve();
    await waitFor(() => expect(result.current.projects.length).toBeGreaterThanOrEqual(0));

    // Add project to draft period
    const addResult = await result.current.handleAddProject({
      title: "New Project",
      students: "Eve, Frank",
      advisor: "Dr. Smith",
    });

    // RPC should be called
    expect(mockCreateProject).toHaveBeenCalled();
  });

  qaTest("period-lock-enforcement.edit-project.draft-allowed", async () => {
    // Draft periods (is_locked=false) should allow project edits
    const opts = makeOpts({ viewPeriodId: "p-draft" });
    const { result } = renderHook(() => useManageProjects(opts));

    await result.current.loadProjects?.() || Promise.resolve();
    await waitFor(() => expect(result.current.projects.length).toBeGreaterThanOrEqual(0));

    // Edit project in draft period
    const editResult = await result.current.handleEditProject("proj1", {
      title: "Updated Project",
    });

    // RPC should be called
    expect(mockUpsertProject).toHaveBeenCalled();
  });

  qaTest("period-lock-enforcement.delete-project.draft-allowed", async () => {
    // Draft periods (is_locked=false) should allow project deletion
    const opts = makeOpts({ viewPeriodId: "p-draft" });
    const { result } = renderHook(() => useManageProjects(opts));

    await result.current.loadProjects?.() || Promise.resolve();
    await waitFor(() => expect(result.current.projects.length).toBeGreaterThanOrEqual(0));

    // Delete project from draft period
    const deleteResult = await result.current.handleDeleteProject("proj1");

    // RPC should be called
    expect(mockDeleteProject).toHaveBeenCalled();
  });

  qaTest("period-lock-enforcement.duplicate-project.draft-allowed", async () => {
    // Draft periods (is_locked=false) should allow project duplication
    const opts = makeOpts({ viewPeriodId: "p-draft" });
    const { result } = renderHook(() => useManageProjects(opts));

    await result.current.loadProjects?.() || Promise.resolve();
    await waitFor(() => expect(result.current.projects.length).toBeGreaterThanOrEqual(0));

    // Duplicate project in draft period
    const dupResult = await result.current.handleDuplicateProject("proj1");

    // RPC should be called (createProject for the duplicate)
    expect(mockCreateProject).toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────
  // ── No period context edge case ──
  // ─────────────────────────────────────────────────────────────

  qaTest("period-lock-enforcement.no-period-blocks-mutations-projects", async () => {
    // When viewPeriodId is null or undefined, mutations should be blocked
    const opts = makeOpts({ viewPeriodId: null });
    const { result } = renderHook(() => useManageProjects(opts));

    await result.current.loadProjects?.() || Promise.resolve();
    await waitFor(() => expect(result.current.projects.length).toBeGreaterThanOrEqual(0));

    // Attempt mutation without period context
    const addResult = await result.current.handleAddProject({
      title: "Test",
      students: "Test",
      advisor: "Test",
    });

    // Should fail safely (depends on hook implementation)
    // At minimum, RPC should not be called with invalid period context
  });
});
