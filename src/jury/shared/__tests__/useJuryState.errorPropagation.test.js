// src/jury/shared/__tests__/useJuryState.errorPropagation.test.js
// Error propagation, lock-state, dedup, and visibility-autosave tests for useJuryAutosave.

import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const { mockUpsertScore, mockGetActiveCriteria } = vi.hoisted(() => ({
  mockUpsertScore: vi.fn(),
  mockGetActiveCriteria: vi.fn(),
}));

vi.mock("@/shared/criteriaHelpers", () => ({
  getActiveCriteria: mockGetActiveCriteria,
}));

vi.mock("@/shared/api", () => ({
  upsertScore: mockUpsertScore,
}));

import { useJuryAutosave } from "../useJuryAutosave";

const CRITERIA = [
  { key: "c1", max: 25 },
  { key: "c2", max: 25 },
];

function makeRefs({ scores = {}, comments = {}, state = {} } = {}) {
  return {
    stateRef: {
      current: {
        jurorId: "j-1",
        jurorSessionToken: "tok-1",
        periodId: "p-1",
        criteriaConfig: [],
        current: 0,
        projects: [{ project_id: "pid-1" }],
        ...state,
      },
    },
    pendingScoresRef: { current: { "pid-1": { c1: 20, c2: 15 }, ...scores } },
    pendingCommentsRef: { current: { "pid-1": "ok", ...comments } },
  };
}

function renderAutosave(refs, overrides = {}) {
  const setGroupSynced = vi.fn();
  const setEditLockActive = vi.fn();
  const hook = renderHook(() =>
    useJuryAutosave({
      stateRef: refs.stateRef,
      pendingScoresRef: refs.pendingScoresRef,
      pendingCommentsRef: refs.pendingCommentsRef,
      editLockActive: false,
      setGroupSynced,
      setEditLockActive,
      step: "eval",
      ...overrides,
    })
  );
  return { ...hook, setGroupSynced, setEditLockActive };
}

describe("useJuryAutosave — error propagation", () => {
  beforeEach(() => {
    mockGetActiveCriteria.mockReturnValue(CRITERIA);
    mockUpsertScore.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  qaTest("jury.state.error.01", async () => {
    const err = { code: "P0401", message: "juror_session_expired" };
    mockUpsertScore.mockRejectedValue(err);
    const setEditLockActive = vi.fn();
    const { result } = renderAutosave(makeRefs(), { setEditLockActive });

    let ret;
    await act(async () => {
      ret = await result.current.writeGroup("pid-1");
    });

    expect(ret).toBe(false);
    expect(result.current.sessionExpired).toBe(true);
    expect(setEditLockActive).toHaveBeenCalledWith(true);
  });

  qaTest("jury.state.error.02", async () => {
    const err = { message: "period_locked" };
    mockUpsertScore.mockRejectedValue(err);
    const setEditLockActive = vi.fn();
    const { result } = renderAutosave(makeRefs(), { setEditLockActive });

    let ret;
    await act(async () => {
      ret = await result.current.writeGroup("pid-1");
    });

    expect(ret).toBe(false);
    // Period lock must NOT bleed into sessionExpired
    expect(result.current.sessionExpired).toBe(false);
    expect(setEditLockActive).toHaveBeenCalledWith(true);
  });

  qaTest("jury.state.error.03", async () => {
    const err = { message: "final_submit_required" };
    mockUpsertScore.mockRejectedValue(err);
    const { result } = renderAutosave(makeRefs());

    let ret;
    await act(async () => {
      ret = await result.current.writeGroup("pid-1");
    });

    // Final-submit is treated as a successful skip, not an error
    expect(ret).toBe(true);
  });

  qaTest("jury.state.error.04", async () => {
    mockUpsertScore.mockRejectedValue(new Error("network failure"));
    const { result } = renderAutosave(makeRefs());

    let ret;
    await act(async () => {
      ret = await result.current.writeGroup("pid-1");
    });

    expect(ret).toBe(false);
    expect(result.current.saveStatus).toBe("error");
  });

  qaTest("jury.state.error.05", async () => {
    mockUpsertScore.mockResolvedValue({});
    const { result } = renderAutosave(makeRefs(), { editLockActive: true });

    let ret;
    await act(async () => {
      ret = await result.current.writeGroup("pid-1");
    });

    expect(ret).toBe(false);
    expect(mockUpsertScore).not.toHaveBeenCalled();
  });

  qaTest("jury.state.error.06", async () => {
    mockUpsertScore.mockResolvedValue({});
    const refs = makeRefs({ state: { jurorSessionToken: "" } });
    const { result } = renderAutosave(refs);

    let ret;
    await act(async () => {
      ret = await result.current.writeGroup("pid-1");
    });

    expect(ret).toBe(false);
    expect(mockUpsertScore).not.toHaveBeenCalled();
  });

  qaTest("jury.state.error.07", async () => {
    mockUpsertScore.mockResolvedValue({});
    const { result } = renderAutosave(makeRefs());

    await act(async () => {
      await result.current.writeGroup("pid-1");
    });
    // Identical snapshot key → dedup skip
    await act(async () => {
      await result.current.writeGroup("pid-1");
    });

    expect(mockUpsertScore).toHaveBeenCalledTimes(1);
  });

  qaTest("jury.state.error.08", async () => {
    let resolveUpsert;
    mockUpsertScore.mockImplementation(
      () => new Promise((r) => { resolveUpsert = r; })
    );
    const { result } = renderAutosave(makeRefs());

    let secondResult;
    await act(async () => {
      // p1 runs sync part (inFlightRef.add) then suspends at await upsertScore
      const p1 = result.current.writeGroup("pid-1");
      // p2 sees inFlightRef.has(pid) === true → returns true immediately
      secondResult = await result.current.writeGroup("pid-1");
      resolveUpsert({});
      await p1;
    });

    expect(secondResult).toBe(true);
    expect(mockUpsertScore).toHaveBeenCalledTimes(1);
  });

  qaTest("jury.state.error.09", async () => {
    mockUpsertScore.mockResolvedValue({});
    renderAutosave(makeRefs(), { step: "eval" });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(mockUpsertScore).toHaveBeenCalledTimes(1);
    });
  });

  qaTest("jury.state.error.10", async () => {
    mockUpsertScore.mockResolvedValue({});
    renderAutosave(makeRefs(), { step: "pin" });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(mockUpsertScore).not.toHaveBeenCalled();
  });

  qaTest("jury.state.error.11", async () => {
    mockUpsertScore.mockRejectedValueOnce(new Error("network"));
    const { result } = renderAutosave(makeRefs(), { step: "eval" });

    // Tab hides — background save fails
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(mockUpsertScore).toHaveBeenCalledTimes(1));

    // Tab returns visible — error must be re-surfaced
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await Promise.resolve();
    });

    expect(result.current.saveStatus).toBe("error");
  });

  qaTest("jury.state.error.12", async () => {
    const err = { code: "P0401", message: "juror_session_invalid" };
    mockUpsertScore.mockRejectedValue(err);
    const setEditLockActive = vi.fn();
    const { result } = renderAutosave(makeRefs(), { setEditLockActive });

    await act(async () => {
      await result.current.writeGroup("pid-1");
    });

    // Both flags must be set together on any P0401 variant
    expect(result.current.sessionExpired).toBe(true);
    expect(setEditLockActive).toHaveBeenCalledWith(true);
  });
});
