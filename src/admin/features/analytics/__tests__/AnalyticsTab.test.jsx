import { describe, vi, expect } from "vitest";
import { qaTest } from "@/test/qaTest";

vi.mock("../AnalyticsPage", () => ({
  default: () => null,
}));

import AnalyticsTab from "../AnalyticsTab";

describe("AnalyticsTab", () => {
  qaTest("coverage.analytics-tab.smoke", () => {
    expect(typeof AnalyticsTab).toBe("function");
  });
});
