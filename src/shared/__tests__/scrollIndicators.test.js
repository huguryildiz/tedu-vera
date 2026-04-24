import { describe, vi, expect } from "vitest";
import { qaTest } from "@/test/qaTest";
import { initScrollIndicators } from "../scrollIndicators";

describe("initScrollIndicators", () => {
  qaTest("coverage.scroll-indicators.init-returns-cleanup", () => {
    const cleanup = initScrollIndicators(document);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  qaTest("coverage.scroll-indicators.no-window", () => {
    // cleanup can be called multiple times safely
    const cleanup = initScrollIndicators(document);
    expect(() => { cleanup(); cleanup(); }).not.toThrow();
  });
});
