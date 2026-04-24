import { describe, expect } from "vitest";
import { qaTest } from "@/test/qaTest";
import { deriveScoreStatus } from "../scoreSelectors";

describe("deriveScoreStatus", () => {
  qaTest("coverage.score-selectors.completed", () => {
    expect(deriveScoreStatus({ final_submitted_at: "2024-01-01T00:00:00Z" })).toBe("completed");
  });

  qaTest("coverage.score-selectors.submitted", () => {
    expect(
      deriveScoreStatus({ criteria_scores: { c1: 80, c2: 90 } })
    ).toBe("submitted");
  });

  qaTest("coverage.score-selectors.not-started", () => {
    expect(deriveScoreStatus({ criteria_scores: {}, comment: null })).toBe("not_started");
  });

  qaTest("coverage.score-selectors.in-progress", () => {
    expect(
      deriveScoreStatus({ criteria_scores: { c1: 80, c2: null } })
    ).toBe("in_progress");
  });
});
