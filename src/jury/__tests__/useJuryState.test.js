// src/jury/__tests__/useJuryState.test.js
// ============================================================
// useJuryState — pure helper unit tests + PIN lockout hook flow.
// ============================================================

import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { qaTest } from "../../test/qaTest.js";

// ── Mocks (declared before any imports that touch the mocked modules) ─────

vi.mock("../../components/toast/useToast", () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

vi.mock("../../shared/api", () => ({
  listSemesters:               vi.fn(),
  createOrGetJurorAndIssuePin: vi.fn(),
  verifyJurorPin:              vi.fn(),
  listProjects:                vi.fn(),
  upsertScore:                 vi.fn(),
  getJurorEditState:           vi.fn().mockResolvedValue({ edit_allowed: false, lock_active: false }),
  finalizeJurorSubmission:     vi.fn(),
  getActiveSemester:           vi.fn().mockResolvedValue(null),
}));

vi.mock("../../config", () => ({
  CRITERIA: [
    { id: "technical", label: "Technical", max: 25 },
    { id: "design",    label: "Design",    max: 25 },
    { id: "delivery",  label: "Delivery",  max: 25 },
    { id: "teamwork",  label: "Teamwork",  max: 25 },
  ],
  APP_CONFIG: { maxScore: 100 },
}));

// ── Imports (after vi.mock declarations) ──────────────────────────────────

import * as api from "../../shared/api";
import { isScoreFilled, normalizeScoreValue } from "../useJuryState";
import useJuryState from "../useJuryState";

// ── Fixtures ──────────────────────────────────────────────────────────────

const SEMESTER = { id: "sem-1", name: "2024-2025 Spring", is_active: true };

const makeProject = (overrides = {}) => ({
  project_id:     "p-1",
  group_no:       1,
  project_title:  "Test Project",
  group_students: "Alice, Bob",
  scores:         { technical: 20, design: 20, delivery: 20, teamwork: 20 },
  comment:        "",
  total:          80,
  updated_at:     new Date().toISOString(),
  final_submitted_at: null,
  ...overrides,
});

// ── isScoreFilled ─────────────────────────────────────────────────────────

describe("isScoreFilled — pure function", () => {
  qaTest("jury.score.01", () => {
    // Empty / null / undefined → not filled (lower-bound guard)
    expect(isScoreFilled("")).toBe(false);
    expect(isScoreFilled(null)).toBe(false);
    expect(isScoreFilled(undefined)).toBe(false);
    // 0 is a valid score — must not be treated as empty
    expect(isScoreFilled(0)).toBe(true);
    expect(isScoreFilled("0")).toBe(true);
  });

  qaTest("jury.score.02", () => {
    // Any finite number within range → filled (upper-bound guard)
    expect(isScoreFilled(25)).toBe(true);
    expect(isScoreFilled("25")).toBe(true);
    expect(isScoreFilled(100)).toBe(true);
  });
});

// ── normalizeScoreValue ───────────────────────────────────────────────────

describe("normalizeScoreValue — pure function (clamping)", () => {
  it("clamps value below 0 to 0", () => {
    expect(normalizeScoreValue("-5", 25)).toBe(0);
    expect(normalizeScoreValue(-1, 25)).toBe(0);
  });

  it("clamps value above max to max", () => {
    expect(normalizeScoreValue("30", 25)).toBe(25);
    expect(normalizeScoreValue(100, 25)).toBe(25);
  });

  it("returns null for empty / null / undefined", () => {
    expect(normalizeScoreValue("", 25)).toBe(null);
    expect(normalizeScoreValue(null, 25)).toBe(null);
    expect(normalizeScoreValue(undefined, 25)).toBe(null);
  });

  it("returns parsed integer for valid in-range value", () => {
    expect(normalizeScoreValue("15", 25)).toBe(15);
    expect(normalizeScoreValue(0, 25)).toBe(0);
    expect(normalizeScoreValue(25, 25)).toBe(25);
  });
});

// ── PIN lockout flow (hook integration) ───────────────────────────────────

describe("PIN lockout flow — useJuryState hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: getActiveSemester returns null (identity step stays clean)
    api.getActiveSemester.mockResolvedValue(null);
    api.getJurorEditState.mockResolvedValue({ edit_allowed: false, lock_active: false });
  });

  qaTest("jury.pin.01", async () => {
    // Advance through identity → semester (auto) → pin, then submit wrong PIN
    api.listSemesters.mockResolvedValue([SEMESTER]);
    api.createOrGetJurorAndIssuePin.mockResolvedValue({
      juror_id: "j-1",
      needs_pin: true,
    });
    api.verifyJurorPin.mockResolvedValue({
      ok: false,
      error_code: "invalid",
      failed_attempts: 1,
    });

    const { result } = renderHook(() => useJuryState());

    // Set identity fields
    act(() => {
      result.current.setJuryName("Test Juror");
      result.current.setJuryDept("EE");
    });

    // Submit identity — auto-advances to "pin" (single active semester)
    await act(async () => {
      await result.current.handleIdentitySubmit();
    });

    await waitFor(() => expect(result.current.step).toBe("pin"));

    // Submit wrong PIN — 1 failed attempt → 2 remaining
    await act(async () => {
      await result.current.handlePinSubmit("9999");
    });

    expect(result.current.pinErrorCode).toBe("invalid");
    expect(result.current.pinAttemptsLeft).toBe(2); // MAX(3) − failed(1)
  });

  qaTest("jury.pin.02", async () => {
    // PIN submission with error_code="locked" → lockout state
    api.listSemesters.mockResolvedValue([SEMESTER]);
    api.createOrGetJurorAndIssuePin.mockResolvedValue({
      juror_id: "j-1",
      needs_pin: true,
    });
    const future = new Date(Date.now() + 600_000).toISOString();
    api.verifyJurorPin.mockResolvedValue({
      ok: false,
      error_code: "locked",
      failed_attempts: 3,
      locked_until: future,
    });

    const { result } = renderHook(() => useJuryState());

    act(() => {
      result.current.setJuryName("Test Juror");
      result.current.setJuryDept("EE");
    });

    await act(async () => {
      await result.current.handleIdentitySubmit();
    });

    await waitFor(() => expect(result.current.step).toBe("pin"));

    await act(async () => {
      await result.current.handlePinSubmit("0000");
    });

    expect(result.current.pinErrorCode).toBe("locked");
    expect(result.current.pinAttemptsLeft).toBe(0);
    expect(result.current.pinLockedUntil).toBeTruthy();
  });

  qaTest("jury.pin.03", async () => {
    // 2 failed attempts → 1 remaining (singular form data-level check)
    api.listSemesters.mockResolvedValue([SEMESTER]);
    api.createOrGetJurorAndIssuePin.mockResolvedValue({
      juror_id: "j-1",
      needs_pin: true,
    });
    api.verifyJurorPin.mockResolvedValue({
      ok: false,
      error_code: "invalid",
      failed_attempts: 2,
    });

    const { result } = renderHook(() => useJuryState());

    act(() => {
      result.current.setJuryName("Test Juror");
      result.current.setJuryDept("EE");
    });

    await act(async () => {
      await result.current.handleIdentitySubmit();
    });

    await waitFor(() => expect(result.current.step).toBe("pin"));

    await act(async () => {
      await result.current.handlePinSubmit("0000");
    });

    expect(result.current.pinErrorCode).toBe("invalid");
    expect(result.current.pinAttemptsLeft).toBe(1); // MAX(3) − failed(2)
  });
});

// ── justLoadedRef guard (resume flow) ────────────────────────────────────

describe("justLoadedRef guard — resume flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getActiveSemester.mockResolvedValue(null);
  });

  qaTest("jury.resume.01", async () => {
    // A fully-scored juror resuming via PIN should land on "eval" without
    // confirmingSubmit being triggered on the very first render after load.
    api.listSemesters.mockResolvedValue([SEMESTER]);
    api.createOrGetJurorAndIssuePin.mockResolvedValue({
      juror_id: "j-1",
      needs_pin: true,
    });
    // All 4 criteria filled — enough for groupSynced to be true
    const project = makeProject({
      scores: { technical: 20, design: 20, delivery: 20, teamwork: 20 },
      total: null, // no DB total → allFilled computed client-side
      final_submitted_at: null,
    });
    api.listProjects.mockResolvedValue([project]);
    api.getJurorEditState.mockResolvedValue({ edit_allowed: false, lock_active: false });
    api.verifyJurorPin.mockResolvedValue({
      ok: true,
      juror_id: "j-1",
      juror_name: "Test Juror",
      juror_inst: "EE",
    });

    const { result } = renderHook(() => useJuryState());

    act(() => {
      result.current.setJuryName("Test Juror");
      result.current.setJuryDept("EE");
    });

    await act(async () => {
      await result.current.handleIdentitySubmit();
    });

    await waitFor(() => expect(result.current.step).toBe("pin"));

    // Submit correct PIN — triggers _loadSemester which sets justLoadedRef=true
    await act(async () => {
      await result.current.handlePinSubmit("1234");
    });

    // Should land on progress_check (has data, showProgressCheck=true) or eval,
    // but crucially confirmingSubmit must remain false — justLoadedRef guards against
    // auto-submitting a fully-scored resuming juror.
    await waitFor(() =>
      expect(["progress_check", "eval"]).toContain(result.current.step)
    );

    expect(result.current.confirmingSubmit).toBe(false);
  });
});
