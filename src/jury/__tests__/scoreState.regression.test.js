// src/jury/__tests__/scoreState.regression.test.js
// ============================================================
// Phase 9 regression tests — scoreState pure helpers.
// Tests: scorestate.criteria.01, scorestate.safety.01
// ============================================================

import { describe, expect } from "vitest";
import { qaTest } from "../../test/qaTest.js";
import {
  isAllFilled,
  isAllComplete,
  countFilled,
  makeEmptyScores,
  getProjectStatus,
  countFilledForProject,
} from "../shared/scoreState";

// ── Fixtures ──────────────────────────────────────────────────

const CUSTOM_CRITERIA = [
  { key: "design",      max: 40 },
  { key: "innovation",  max: 30 },
  { key: "impact",      max: 30 },
];

const PROJECTS = [
  { project_id: "p1" },
  { project_id: "p2" },
];

describe("scoreState — regression (Phase 9)", () => {
  // ── scorestate.criteria.01 ───────────────────────────────

  qaTest("scorestate.criteria.01", () => {
    // Build a fresh empty scores map, then fill all fields for p1.
    const scores = makeEmptyScores(PROJECTS, CUSTOM_CRITERIA);

    // Nothing filled yet — allComplete should be false.
    expect(isAllComplete(scores, PROJECTS, CUSTOM_CRITERIA)).toBe(false);
    expect(countFilled(scores, PROJECTS, CUSTOM_CRITERIA)).toBe(0);

    // Fill all criteria for p1.
    scores["p1"]["design"]     = 35;
    scores["p1"]["innovation"] = 25;
    scores["p1"]["impact"]     = 20;

    // p2 still empty → allComplete false but progress advances.
    expect(isAllComplete(scores, PROJECTS, CUSTOM_CRITERIA)).toBe(false);
    expect(countFilled(scores, PROJECTS, CUSTOM_CRITERIA)).toBe(3); // 3/6

    // Fill all criteria for p2.
    scores["p2"]["design"]     = 30;
    scores["p2"]["innovation"] = 20;
    scores["p2"]["impact"]     = 15;

    // All done.
    expect(isAllComplete(scores, PROJECTS, CUSTOM_CRITERIA)).toBe(true);
    expect(countFilled(scores, PROJECTS, CUSTOM_CRITERIA)).toBe(6); // 6/6
  });

  // ── scorestate.safety.01 ─────────────────────────────────

  qaTest("scorestate.safety.01", () => {
    const scores = { p1: { design: 10 } };

    // isAllFilled with undefined criteria must throw — not silently return true/false.
    expect(() => isAllFilled(scores, "p1", undefined)).toThrow();

    // countFilled with undefined criteria must throw.
    expect(() => countFilled(scores, PROJECTS, undefined)).toThrow();
  });
});

describe("scoreState — project status helpers", () => {
  qaTest("scorestate.status.01", () => {
    const scores = makeEmptyScores(PROJECTS, CUSTOM_CRITERIA);
    expect(getProjectStatus(scores, "p1", CUSTOM_CRITERIA)).toBe("empty");
    scores.p1.design = 30;
    expect(getProjectStatus(scores, "p1", CUSTOM_CRITERIA)).toBe("partial");
    scores.p1.innovation = 20;
    scores.p1.impact = 25;
    expect(getProjectStatus(scores, "p1", CUSTOM_CRITERIA)).toBe("scored");
    expect(getProjectStatus(scores, "p2", CUSTOM_CRITERIA)).toBe("empty");
  });

  qaTest("scorestate.status.02", () => {
    const scores = makeEmptyScores(PROJECTS, CUSTOM_CRITERIA);
    expect(countFilledForProject(scores, "p1", CUSTOM_CRITERIA)).toBe(0);
    scores.p1.design = 30;
    expect(countFilledForProject(scores, "p1", CUSTOM_CRITERIA)).toBe(1);
    scores.p1.innovation = 20;
    scores.p1.impact = 25;
    expect(countFilledForProject(scores, "p1", CUSTOM_CRITERIA)).toBe(3);
  });
});
