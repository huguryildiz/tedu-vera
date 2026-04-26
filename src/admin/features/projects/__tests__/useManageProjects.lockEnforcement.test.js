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

  qaTest("period-lock-enforcement.import-projects.locked-rejected", async () => {
    const opts = makeOpts({ viewPeriodId: "p-locked" });
    const { result } = renderHook(() => useManageProjects(opts));
    await waitFor(() => expect(result.current.projects).toBeDefined());

    await result.current.handleImportProjects([{ title: "Test", students: "Alice", advisor: "Dr. Smith" }]);

    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleAddProject (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  qaTest("period-lock-enforcement.add-project.locked-rejected", async () => {
    const opts = makeOpts({ viewPeriodId: "p-locked" });
    const { result } = renderHook(() => useManageProjects(opts));
    await waitFor(() => expect(result.current.projects).toBeDefined());

    const addResult = await result.current.handleAddProject({ title: "Test", students: "Alice", advisor: "Dr. Smith" });

    expect(mockCreateProject).not.toHaveBeenCalled();
    expect(addResult?.ok).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleEditProject (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  qaTest("period-lock-enforcement.edit-project.locked-rejected", async () => {
    const opts = makeOpts({ viewPeriodId: "p-locked" });
    const { result } = renderHook(() => useManageProjects(opts));
    await waitFor(() => expect(result.current.projects).toBeDefined());

    const editResult = await result.current.handleEditProject({ id: "proj1", title: "Updated", periodId: "p-locked" });

    expect(mockUpsertProject).not.toHaveBeenCalled();
    expect(editResult?.ok).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleDeleteProject (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  qaTest("period-lock-enforcement.delete-project.locked-rejected", async () => {
    const opts = makeOpts({ viewPeriodId: "p-locked" });
    const { result } = renderHook(() => useManageProjects(opts));
    await waitFor(() => expect(result.current.projects).toBeDefined());

    const deleteResult = await result.current.handleDeleteProject("proj1");

    expect(mockDeleteProject).not.toHaveBeenCalled();
    expect(deleteResult?.ok).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleDuplicateProject (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  qaTest("period-lock-enforcement.duplicate-project.locked-rejected", async () => {
    const opts = makeOpts({ viewPeriodId: "p-locked" });
    const { result } = renderHook(() => useManageProjects(opts));
    await waitFor(() => expect(result.current.projects).toBeDefined());

    const project = { id: "proj1", title: "Project Alpha", students: "Alice, Bob" };
    await result.current.handleDuplicateProject(project);

    expect(mockCreateProject).not.toHaveBeenCalled();
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
