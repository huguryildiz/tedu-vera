import { describe, expect } from "vitest";
import { qaTest } from "@/test/qaTest";
import { ADMIN_TOUR_STEPS } from "../adminTourSteps";

const VALID_PLACEMENTS = new Set(["above", "below"]);

describe("adminTourSteps", () => {
  qaTest("coverage.admin-tour.fields", () => {
    ADMIN_TOUR_STEPS.forEach((step, i) => {
      expect(step.selector, `step ${i} selector`).toBeTruthy();
      expect(step.title, `step ${i} title`).toBeTruthy();
      expect(step.body, `step ${i} body`).toBeTruthy();
      expect(step.placement, `step ${i} placement`).toBeTruthy();
    });
  });

  qaTest("coverage.admin-tour.placement", () => {
    ADMIN_TOUR_STEPS.forEach((step, i) => {
      expect(
        VALID_PLACEMENTS.has(step.placement),
        `step ${i} placement '${step.placement}' must be 'above' or 'below'`
      ).toBe(true);
    });
  });
});
