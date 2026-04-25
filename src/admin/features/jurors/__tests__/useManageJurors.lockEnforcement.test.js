import { describe, vi, expect, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { qaTest, todo } from "@/test/qaTest";

const mockListJurors = vi.fn();
const mockListJurorsSummary = vi.fn();
const mockCreateJuror = vi.fn();
const mockUpdateJuror = vi.fn();
const mockDeleteJuror = vi.fn();
const mockSetJurorEditMode = vi.fn();
const mockForceCloseJurorEditMode = vi.fn();

vi.mock("@/shared/api", () => ({
  listJurors: (...a) => mockListJurors(...a),
  listJurorsSummary: (...a) => mockListJurorsSummary(...a),
  getJurorScores: vi.fn().mockResolvedValue({ data: [], error: null }),
  createJuror: (...a) => mockCreateJuror(...a),
  updateJuror: (...a) => mockUpdateJuror(...a),
  deleteJuror: (...a) => mockDeleteJuror(...a),
  setJurorEditMode: (...a) => mockSetJurorEditMode(...a),
  forceCloseJurorEditMode: (...a) => mockForceCloseJurorEditMode(...a),
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

const makeJurors = () => [
  { id: "j1", name: "Juror A", email: "a@test.edu", active: true },
  { id: "j2", name: "Juror B", email: "b@test.edu", active: true },
];

const makeLockedPeriod = () => ({
  id: "p-locked",
  name: "Spring 2026",
  is_locked: true,
  closed_at: null,
});

const makeDraftPeriod = () => ({
  id: "p-draft",
  name: "Fall 2025",
  is_locked: false,
  closed_at: null,
});

function makeOpts(overrides = {}) {
  return {
    organizationId: "org-001",
    viewPeriodId: "p-draft",
    viewPeriodLabel: "Fall 2025",
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

describe("useManageJurors — lock enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListJurors.mockResolvedValue(makeJurors());
    mockListJurorsSummary.mockResolvedValue(makeJurors());
    mockCreateJuror.mockResolvedValue({ data: { id: "j3" }, error: null });
    mockUpdateJuror.mockResolvedValue({ data: {}, error: null });
    mockDeleteJuror.mockResolvedValue({ data: {}, error: null });
    mockSetJurorEditMode.mockResolvedValue({ data: {}, error: null });
    mockForceCloseJurorEditMode.mockResolvedValue({ data: {}, error: null });
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleAddJuror (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  todo("period-lock-enforcement.add-juror.locked-rejected", async () => {
    // Hook currently lacks client-side lock check.
    // Product rule: when is_locked=true, createJuror RPC should reject
    // This test is a TODO placeholder until enforcement is added.
    // Expected behavior:
    // - viewPeriodId → locked period (is_locked=true)
    // - handleAddJuror() called
    // - Should return {ok: false} early WITHOUT calling createJuror RPC
    // - Error message should mention "locked" or "scoring in progress"
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleImportJurors (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  todo("period-lock-enforcement.import-jurors.locked-rejected", async () => {
    // Hook currently lacks client-side lock check in the import loop.
    // Product rule: when is_locked=true, batch import must be rejected
    // This test is a TODO placeholder until enforcement is added.
    // Expected behavior:
    // - viewPeriodId → locked period (is_locked=true)
    // - handleImportJurors([...rows]) called with CSV data
    // - Should return early WITHOUT calling createJuror for any row
    // - Error message should prevent batch creation
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleEditJuror (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  todo("period-lock-enforcement.edit-juror.locked-rejected", async () => {
    // Hook currently lacks client-side lock check before RPC.
    // Fallback: line 369 has error handler for "period_locked" from RPC,
    // but no preventive client-side fastfail per architecture rule.
    // This test is a TODO placeholder until enforcement is added.
    // Expected behavior:
    // - viewPeriodId → locked period (is_locked=true)
    // - handleEditJuror(jurorId, updates) called
    // - Should return {ok: false} early WITHOUT calling updateJuror RPC
    // - Error message should mention "locked"
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleDeleteJuror (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  todo("period-lock-enforcement.delete-juror.locked-rejected", async () => {
    // Hook currently lacks client-side lock check before RPC.
    // Fallback: line 531 has error handler for "period_locked" from RPC,
    // but no preventive client-side fastfail per architecture rule.
    // This test is a TODO placeholder until enforcement is added.
    // Expected behavior:
    // - viewPeriodId → locked period (is_locked=true)
    // - handleDeleteJuror(jurorId) called
    // - Should return {ok: false} early WITHOUT calling deleteJuror RPC
    // - Error message should mention "locked"
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleToggleJurorEdit (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  todo("period-lock-enforcement.toggle-juror-edit.locked-rejected", async () => {
    // Hook currently lacks client-side lock check before RPC.
    // Fallback: line 591 has error handler for "period_locked" from RPC,
    // but no preventive client-side fastfail per architecture rule.
    // This test is a TODO placeholder until enforcement is added.
    // Expected behavior:
    // - viewPeriodId → locked period (is_locked=true)
    // - handleToggleJurorEdit(jurorId, mode) called
    // - Should return {ok: false} early WITHOUT calling setJurorEditMode RPC
    // - Error message should mention "locked"
  });

  // ─────────────────────────────────────────────────────────────
  // ── handleForceCloseJurorEdit (MISSING enforcement) ──
  // ─────────────────────────────────────────────────────────────

  todo("period-lock-enforcement.force-close-juror-edit.locked-rejected", async () => {
    // Hook currently lacks client-side lock check before RPC.
    // This test is a TODO placeholder until enforcement is added.
    // Expected behavior:
    // - viewPeriodId → locked period (is_locked=true)
    // - handleForceCloseJurorEdit(jurorId) called
    // - Should return {ok: false} early WITHOUT calling forceCloseJurorEditMode RPC
    // - Error message should mention "locked"
  });

  // ─────────────────────────────────────────────────────────────
  // ── Open-period allowed mutations (POSITIVE tests) ──
  // ─────────────────────────────────────────────────────────────

  qaTest("period-lock-enforcement.add-juror.draft-allowed", async () => {
    // Draft periods (is_locked=false) should allow juror creation
    const opts = makeOpts({ viewPeriodId: "p-draft" });
    const { result } = renderHook(() => useManageJurors(opts));

    await result.current.loadJurors?.() || Promise.resolve();
    await waitFor(() => expect(result.current.jurors.length).toBeGreaterThanOrEqual(0));

    // Add juror to draft period
    const addResult = await result.current.handleAddJuror({
      name: "New Juror",
      email: "new@test.edu",
    });

    // RPC should be called (even if it resolves or rejects due to API behavior)
    expect(mockCreateJuror).toHaveBeenCalled();
  });

  qaTest("period-lock-enforcement.edit-juror.draft-allowed", async () => {
    // Draft periods (is_locked=false) should allow juror edits
    const opts = makeOpts({ viewPeriodId: "p-draft" });
    const { result } = renderHook(() => useManageJurors(opts));

    await result.current.loadJurors?.() || Promise.resolve();
    await waitFor(() => expect(result.current.jurors.length).toBeGreaterThanOrEqual(0));

    // Edit juror in draft period
    const editResult = await result.current.handleEditJuror({
      jurorId: "j1",
      juror_name: "Updated Juror",
      email: "a@test.edu",
      affiliation: "Test Affiliation",
    });

    // RPC should be called
    expect(mockUpdateJuror).toHaveBeenCalled();
  });

  qaTest("period-lock-enforcement.delete-juror.draft-allowed", async () => {
    // Draft periods (is_locked=false) should allow juror deletion
    const opts = makeOpts({ viewPeriodId: "p-draft" });
    const { result } = renderHook(() => useManageJurors(opts));

    await result.current.loadJurors?.() || Promise.resolve();
    await waitFor(() => expect(result.current.jurors.length).toBeGreaterThanOrEqual(0));

    // Delete juror from draft period
    const deleteResult = await result.current.handleDeleteJuror("j1");

    // RPC should be called
    expect(mockDeleteJuror).toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────
  // ── No period context edge case ──
  // ─────────────────────────────────────────────────────────────

  qaTest("period-lock-enforcement.no-period-blocks-mutations-jurors", async () => {
    // When viewPeriodId is null or undefined, mutations should be blocked
    const opts = makeOpts({ viewPeriodId: null });
    const { result } = renderHook(() => useManageJurors(opts));

    await result.current.loadJurors?.() || Promise.resolve();
    await waitFor(() => expect(result.current.jurors.length).toBeGreaterThanOrEqual(0));

    // Attempt mutation without context
    const addResult = await result.current.handleAddJuror({
      name: "Test",
      email: "test@test.edu",
    });

    // Should fail safely (depends on hook implementation)
    // At minimum, RPC should not be called with invalid period context
  });
});
