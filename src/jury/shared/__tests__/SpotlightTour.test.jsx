import { describe, vi, expect } from "vitest";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/SpotlightTour", () => ({
  default: () => null,
}));

import SpotlightTour from "../SpotlightTour";

describe("SpotlightTour (jury/shared re-export)", () => {
  qaTest("coverage.jury-spotlight-tour.smoke", () => {
    expect(typeof SpotlightTour).toBe("function");
  });
});
