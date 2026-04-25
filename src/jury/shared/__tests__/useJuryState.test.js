import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/shared/api", () => {
  const listPeriodsMock = vi.fn();
  return {
    listPeriodsPublic:       listPeriodsMock,
    listPeriods:             listPeriodsMock,
    authenticateJuror:       vi.fn(),
    verifyJurorPin:          vi.fn(),
    listProjects:            vi.fn(),
    upsertScore:             vi.fn(),
    getJurorEditState:       vi.fn().mockResolvedValue({ edit_allowed: false, lock_active: false }),
    finalizeJurorSubmission: vi.fn(),
    listPeriodCriteria:      vi.fn().mockResolvedValue([
      { key: "technical", label: "Technical", max_score: 25 },
      { key: "design",    label: "Design",    max_score: 25 },
      { key: "delivery",  label: "Delivery",  max_score: 25 },
      { key: "teamwork",  label: "Teamwork",  max_score: 25 },
    ]),
    listPeriodOutcomes:      vi.fn().mockResolvedValue([]),
  };
});

import * as api from "@/shared/api";
import useJuryState, { isScoreFilled, normalizeScoreValue } from "../useJuryState";

const PERIOD = { id: "sem-1", name: "2024-2025 Spring", is_locked: true, closed_at: null };

const MOCK_CRITERIA_ROWS = [
  { key: "technical", label: "Technical", max_score: 25 },
  { key: "design",    label: "Design",    max_score: 25 },
  { key: "delivery",  label: "Delivery",  max_score: 25 },
  { key: "teamwork",  label: "Teamwork",  max_score: 25 },
];

const makeProjects2 = (overrides = []) => {
  const defaults = [
    {
      project_id: "p-1", group_no: 1, project_title: "Alpha", group_students: "Alice, Bob",
      scores: { technical: null, design: null, delivery: null, teamwork: null },
      comment: "", total: null, final_submitted_at: null,
      updated_at: new Date().toISOString(),
    },
    {
      project_id: "p-2", group_no: 2, project_title: "Beta", group_students: "Carol, Dave",
      scores: { technical: null, design: null, delivery: null, teamwork: null },
      comment: "", total: null, final_submitted_at: null,
      updated_at: new Date().toISOString(),
    },
  ];
  return defaults.map((d, i) => ({ ...d, ...(overrides[i] || {}) }));
};

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

async function advanceToEval2(result, projectOverrides = []) {
  const projects = makeProjects2(projectOverrides);
  api.listPeriods.mockResolvedValue([PERIOD]);
  api.authenticateJuror.mockResolvedValue({ juror_id: "j-1", needs_pin: true });
  api.listProjects.mockResolvedValue(projects);
  api.getJurorEditState.mockResolvedValue({ edit_allowed: false, lock_active: false });
  api.verifyJurorPin.mockResolvedValue({
    ok: true, juror_id: "j-1", juror_name: "Test Juror", affiliation: "EE",
    session_token: "sess-1",
  });

  act(() => {
    result.current.setJuryName("Test Juror");
    result.current.setAffiliation("EE");
  });
  await act(async () => { await result.current.handleIdentitySubmit(); });
  await waitFor(() => expect(result.current.step).toBe("pin"));
  await act(async () => { await result.current.handlePinSubmit("1234"); });
  await waitFor(() => expect(["progress_check", "eval"]).toContain(result.current.step));
  if (result.current.step === "progress_check") {
    act(() => { result.current.handleProgressContinue(); });
    await waitFor(() => expect(result.current.step).toBe("eval"));
  }
}

// ── useJuryState initial state ─────────────────────────────

describe("useJuryState initial state", () => {
  qaTest("jury.state.01", () => {
    const { result } = renderHook(() => useJuryState());
    expect(result.current.step).toBe("arrival");
  });
});

// ── period availability guards ─────────────────────────────

describe("period availability guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getJurorEditState.mockResolvedValue({ edit_allowed: false, lock_active: false });
    api.listPeriodCriteria.mockResolvedValue(MOCK_CRITERIA_ROWS);
  });

  qaTest("jury.state.02", async () => {
    api.listPeriods.mockResolvedValue([
      { id: "sem-1", name: "2024-2025 Spring", is_locked: true, closed_at: "2026-01-15T00:00:00Z" },
    ]);

    const { result } = renderHook(() => useJuryState());
    act(() => {
      result.current.setJuryName("Test Juror");
      result.current.setAffiliation("EE");
    });

    await act(async () => { await result.current.handleIdentitySubmit(); });

    expect(result.current.step).toBe("identity");
    expect(result.current.authError).toContain("No active evaluation period");
    expect(api.authenticateJuror).not.toHaveBeenCalled();
  });
});

// ── PIN lockout → locked step ──────────────────────────────

describe("PIN lockout effect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getJurorEditState.mockResolvedValue({ edit_allowed: false, lock_active: false });
    api.listPeriodCriteria.mockResolvedValue(MOCK_CRITERIA_ROWS);
  });

  qaTest("jury.state.03", async () => {
    const future = new Date(Date.now() + 600_000).toISOString();
    api.listPeriods.mockResolvedValue([PERIOD]);
    api.authenticateJuror.mockResolvedValue({ juror_id: "j-1", needs_pin: true });
    api.verifyJurorPin.mockResolvedValue({
      ok: false, error_code: "locked", failed_attempts: 3, locked_until: future,
    });

    const { result } = renderHook(() => useJuryState());
    act(() => {
      result.current.setJuryName("Test Juror");
      result.current.setAffiliation("EE");
    });
    await act(async () => { await result.current.handleIdentitySubmit(); });
    await waitFor(() => expect(result.current.step).toBe("pin"));
    await act(async () => { await result.current.handlePinSubmit("0000"); });

    await waitFor(() => expect(result.current.step).toBe("locked"), { timeout: 3000 });
  });
});

// ── session expired redirect ────────────────────────────────

describe("session expired redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.upsertScore.mockResolvedValue({ ok: true });
    api.getJurorEditState.mockResolvedValue({ edit_allowed: false, lock_active: false });
    api.listPeriodCriteria.mockResolvedValue(MOCK_CRITERIA_ROWS);
  });

  qaTest("jury.state.04", async () => {
    const { result } = renderHook(() => useJuryState());
    await advanceToEval2(result);

    api.upsertScore.mockRejectedValue({ code: "P0401", message: "juror_session_expired" });
    act(() => { result.current.handleScore("p-1", "technical", "20"); });
    await act(async () => { result.current.handleScoreBlur("p-1", "technical"); });

    await waitFor(() => expect(result.current.step).toBe("pin"), { timeout: 3000 });
  });
});

// ── isScoreFilled ─────────────────────────────────────────

describe("isScoreFilled — pure function", () => {
  qaTest("jury.score.01", () => {
    expect(isScoreFilled("")).toBe(false);
    expect(isScoreFilled(null)).toBe(false);
    expect(isScoreFilled(undefined)).toBe(false);
    expect(isScoreFilled(0)).toBe(true);
    expect(isScoreFilled("0")).toBe(true);
  });

  qaTest("jury.score.02", () => {
    expect(isScoreFilled(25)).toBe(true);
    expect(isScoreFilled("25")).toBe(true);
    expect(isScoreFilled(100)).toBe(true);
  });
});

// ── normalizeScoreValue ───────────────────────────────────

describe("normalizeScoreValue — pure function", () => {
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

// ── PIN lockout flow ───────────────────────────────────────

describe("PIN lockout flow — useJuryState hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getJurorEditState.mockResolvedValue({ edit_allowed: false, lock_active: false });
    api.listPeriodCriteria.mockResolvedValue(MOCK_CRITERIA_ROWS);
  });

  qaTest("jury.pin.01", async () => {
    api.listPeriods.mockResolvedValue([PERIOD]);
    api.authenticateJuror.mockResolvedValue({ juror_id: "j-1", needs_pin: true });
    api.verifyJurorPin.mockResolvedValue({
      ok: false, error_code: "invalid", failed_attempts: 1,
    });

    const { result } = renderHook(() => useJuryState());
    act(() => {
      result.current.setJuryName("Test Juror");
      result.current.setAffiliation("EE");
    });
    await act(async () => { await result.current.handleIdentitySubmit(); });
    await waitFor(() => expect(result.current.step).toBe("pin"));
    await act(async () => { await result.current.handlePinSubmit("9999"); });

    expect(result.current.pinErrorCode).toBe("invalid");
    expect(result.current.pinAttemptsLeft).toBe(4); // MAX(5) - failed(1)
  });

  qaTest("jury.pin.02", async () => {
    const future = new Date(Date.now() + 600_000).toISOString();
    api.listPeriods.mockResolvedValue([PERIOD]);
    api.authenticateJuror.mockResolvedValue({ juror_id: "j-1", needs_pin: true });
    api.verifyJurorPin.mockResolvedValue({
      ok: false, error_code: "locked", failed_attempts: 3, locked_until: future,
    });

    const { result } = renderHook(() => useJuryState());
    act(() => {
      result.current.setJuryName("Test Juror");
      result.current.setAffiliation("EE");
    });
    await act(async () => { await result.current.handleIdentitySubmit(); });
    await waitFor(() => expect(result.current.step).toBe("pin"));
    await act(async () => { await result.current.handlePinSubmit("0000"); });

    expect(result.current.pinErrorCode).toBe("locked");
    expect(result.current.pinAttemptsLeft).toBe(0);
    expect(result.current.pinLockedUntil).toBeTruthy();
  });

  qaTest("jury.pin.03", async () => {
    api.listPeriods.mockResolvedValue([PERIOD]);
    api.authenticateJuror.mockResolvedValue({ juror_id: "j-1", needs_pin: true });
    api.verifyJurorPin.mockResolvedValue({
      ok: false, error_code: "invalid", failed_attempts: 2,
    });

    const { result } = renderHook(() => useJuryState());
    act(() => {
      result.current.setJuryName("Test Juror");
      result.current.setAffiliation("EE");
    });
    await act(async () => { await result.current.handleIdentitySubmit(); });
    await waitFor(() => expect(result.current.step).toBe("pin"));
    await act(async () => { await result.current.handlePinSubmit("0000"); });

    expect(result.current.pinErrorCode).toBe("invalid");
    expect(result.current.pinAttemptsLeft).toBe(3); // MAX(5) - failed(2)
  });
});

// ── jury.flow — flow mechanics ────────────────────────────

describe("jury.flow — flow mechanics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.upsertScore.mockResolvedValue({ ok: true });
    api.getJurorEditState.mockResolvedValue({ edit_allowed: false, lock_active: false });
    api.listPeriodCriteria.mockResolvedValue(MOCK_CRITERIA_ROWS);
  });

  qaTest("jury.flow.01", async () => {
    const { result } = renderHook(() => useJuryState());
    await advanceToEval2(result);

    act(() => { result.current.handleScore("p-1", "technical", "20"); });
    await act(async () => { result.current.handleScoreBlur("p-1", "technical"); });

    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.confirmingSubmit).toBe(false);
  });

  qaTest("jury.flow.02", async () => {
    const { result } = renderHook(() => useJuryState());
    await advanceToEval2(result);

    const criteria = ["technical", "design", "delivery", "teamwork"];
    for (const pid of ["p-1", "p-2"]) {
      for (const cid of criteria) {
        act(() => { result.current.handleScore(pid, cid, "20"); });
        await act(async () => { result.current.handleScoreBlur(pid, cid); });
      }
    }

    await waitFor(() => expect(result.current.allComplete).toBe(true), { timeout: 3000 });
    expect(result.current.confirmingSubmit).toBe(false);

    await act(async () => { await result.current.handleRequestSubmit(); });
    await waitFor(() => expect(result.current.confirmingSubmit).toBe(true), { timeout: 3000 });
  });

  qaTest("jury.flow.03", async () => {
    const fullScores = { technical: 20, design: 20, delivery: 20, teamwork: 20 };
    const submitted = new Date().toISOString();

    api.listPeriods.mockResolvedValue([PERIOD]);
    api.authenticateJuror.mockResolvedValue({ juror_id: "j-1", needs_pin: true });
    api.listProjects.mockResolvedValue([{
      project_id: "p-1", group_no: 1, project_title: "Alpha", group_students: "Alice",
      scores: fullScores, comment: "Well done",
      total: 80, final_submitted_at: submitted, updated_at: submitted,
    }]);
    api.getJurorEditState.mockResolvedValue({
      edit_allowed: true, lock_active: false, final_submitted_at: submitted,
    });
    api.verifyJurorPin.mockResolvedValue({
      ok: true, juror_id: "j-1", juror_name: "Test Juror", affiliation: "EE",
      session_token: "sess-1",
    });

    const { result } = renderHook(() => useJuryState());
    act(() => {
      result.current.setJuryName("Test Juror");
      result.current.setAffiliation("EE");
    });
    await act(async () => { await result.current.handleIdentitySubmit(); });
    await waitFor(() => expect(result.current.step).toBe("pin"));
    await act(async () => { await result.current.handlePinSubmit("1234"); });
    await waitFor(() => expect(result.current.step).toBe("done"));

    act(() => { result.current.handleEditScores(); });

    expect(result.current.step).toBe("eval");
    expect(result.current.editMode).toBe(true);
    expect(result.current.scores["p-1"].technical).toBe(20);
    expect(result.current.scores["p-1"].design).toBe(20);
    expect(result.current.comments["p-1"]).toBe("Well done");
    expect(result.current.groupSynced["p-1"]).toBe(true);
  });

  qaTest("jury.flow.04", async () => {
    const { result } = renderHook(() => useJuryState());
    await advanceToEval2(result);

    act(() => { result.current.handleScore("p-1", "technical", "15"); });
    await act(async () => { result.current.handleScoreBlur("p-1", "technical"); });

    const scoresBefore = result.current.scores["p-1"].technical;

    await act(async () => { await result.current.handleNavigate(1); });

    expect(result.current.scores["p-1"].technical).toBe(scoresBefore);
  });
});

// ── resume flow guard ──────────────────────────────────────

describe("resume flow guard — no implicit submit modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getJurorEditState.mockResolvedValue({ edit_allowed: false, lock_active: false });
    api.listPeriodCriteria.mockResolvedValue(MOCK_CRITERIA_ROWS);
  });

  qaTest("jury.resume.01", async () => {
    api.listPeriods.mockResolvedValue([PERIOD]);
    api.authenticateJuror.mockResolvedValue({ juror_id: "j-1", needs_pin: true });
    api.listProjects.mockResolvedValue([makeProject({
      scores: { technical: 20, design: 20, delivery: 20, teamwork: 20 },
      total: null, final_submitted_at: null,
    })]);
    api.verifyJurorPin.mockResolvedValue({
      ok: true, juror_id: "j-1", juror_name: "Test Juror", affiliation: "EE",
      session_token: "sess-1",
    });

    const { result } = renderHook(() => useJuryState());
    act(() => {
      result.current.setJuryName("Test Juror");
      result.current.setAffiliation("EE");
    });
    await act(async () => { await result.current.handleIdentitySubmit(); });
    await waitFor(() => expect(result.current.step).toBe("pin"));
    await act(async () => { await result.current.handlePinSubmit("1234"); });
    await waitFor(() =>
      expect(["progress_check", "eval"]).toContain(result.current.step)
    );

    expect(result.current.confirmingSubmit).toBe(false);
  });
});

// ── Partial-failure scenarios — error resilience ────────────

describe("jury.state — partial-failure scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getJurorEditState.mockResolvedValue({ edit_allowed: false, lock_active: false });
    api.listPeriodCriteria.mockResolvedValue(MOCK_CRITERIA_ROWS);
  });

  qaTest("jury.state.05", async () => {
    // Network error during upsertScore → saveStatus="error", in-memory scores preserved
    const { result } = renderHook(() => useJuryState());
    await advanceToEval2(result);

    // Mock upsertScore to fail with a transient network error
    api.upsertScore.mockRejectedValue(new Error("Network timeout"));

    // User enters a score and blurs to trigger write
    act(() => { result.current.handleScore("p-1", "technical", "18"); });
    await act(async () => { result.current.handleScoreBlur("p-1", "technical"); });

    // Give the async upsertScore call time to fail
    await new Promise((r) => setTimeout(r, 100));

    // saveStatus should show error state
    expect(result.current.saveStatus).toBe("error");
    // BUT in-memory score is preserved (not cleared on error)
    expect(result.current.scores["p-1"].technical).toBe(18);
    // Step should still be "eval" (not redirected)
    expect(result.current.step).toBe("eval");
    // groupSynced should NOT mark as synced (write failed)
    expect(result.current.groupSynced["p-1"]).not.toBe(true);
  });

  qaTest("jury.state.06", async () => {
    // Session expired during eval → redirects to PIN step with error message
    const { result } = renderHook(() => useJuryState());
    await advanceToEval2(result);

    const sessionExpiredErr = {
      code: "P0401",
      message: "juror_session_expired",
    };
    api.upsertScore.mockRejectedValue(sessionExpiredErr);

    act(() => { result.current.handleScore("p-2", "design", "22"); });
    await act(async () => { result.current.handleScoreBlur("p-2", "design"); });

    // Wait for the async error to be caught and processed
    await waitFor(
      () => expect(result.current.step).toBe("pin"),
      { timeout: 3000 }
    );

    // Verify PIN error is set with session expired message
    expect(result.current.pinError).toContain("session has expired");
    // In-memory score should be preserved
    expect(result.current.scores["p-2"].design).toBe(22);
  });

  qaTest("jury.state.07", async () => {
    // Period lock error during eval → editLockActive=true, saves blocked, UI error shown
    const { result } = renderHook(() => useJuryState());
    await advanceToEval2(result);

    // Use the exact message format that the DB returns
    const periodLockErr = Object.assign(new Error("period_locked"), { code: "P0001" });
    api.upsertScore.mockRejectedValue(periodLockErr);

    act(() => { result.current.handleScore("p-1", "delivery", "15"); });
    await act(async () => { result.current.handleScoreBlur("p-1", "delivery"); });

    // Wait for error to set editLockActive
    await new Promise((r) => setTimeout(r, 100));

    // editLockActive should prevent further writes
    expect(result.current.editLockActive).toBe(true);
    // saveStatus should show error
    expect(result.current.saveStatus).toBe("error");
    // In-memory score is still there
    expect(result.current.scores["p-1"].delivery).toBe(15);
    // Step is still eval (not redirected for lock errors)
    expect(result.current.step).toBe("eval");
  });

  qaTest("jury.state.08", async () => {
    // Subsequent write after first write succeeds → in-memory state remains valid
    const { result } = renderHook(() => useJuryState());
    await advanceToEval2(result);

    api.upsertScore.mockResolvedValue({ ok: true });

    // First project: fill all criteria to trigger groupSynced
    const criteria = ["technical", "design", "delivery", "teamwork"];
    for (const crit of criteria) {
      act(() => { result.current.handleScore("p-1", crit, "20"); });
      await act(async () => { result.current.handleScoreBlur("p-1", crit); });
    }

    // Wait for the last async write to complete and groupSynced to be set
    await waitFor(
      () => expect(result.current.groupSynced["p-1"]).toBe(true),
      { timeout: 3000 }
    );
    expect(result.current.saveStatus).toBe("saved");

    // Now mock a failure for second project
    api.upsertScore.mockRejectedValue(new Error("Network failure"));

    act(() => { result.current.handleScore("p-2", "technical", "19"); });
    await act(async () => { result.current.handleScoreBlur("p-2", "technical"); });

    // Wait for the error to be processed
    await new Promise((r) => setTimeout(r, 150));

    // First project is still synced and valid
    expect(result.current.scores["p-1"].technical).toBe(20);
    expect(result.current.groupSynced["p-1"]).toBe(true);
    // Second project has the score in memory but not synced
    expect(result.current.scores["p-2"].technical).toBe(19);
    expect(result.current.groupSynced["p-2"]).not.toBe(true);
    // Overall saveStatus is error (most recent operation failed)
    expect(result.current.saveStatus).toBe("error");
  });
});
