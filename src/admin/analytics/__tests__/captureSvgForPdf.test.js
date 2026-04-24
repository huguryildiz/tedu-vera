import { describe, expect } from "vitest";
import { qaTest } from "@/test/qaTest";
import { captureSvgForPdf } from "../captureSvgForPdf";

describe("captureSvgForPdf", () => {
  qaTest("coverage.capture-svg-for-pdf.null-element", async () => {
    const result = await captureSvgForPdf("nonexistent-svg-xyz", {}, 0, 0, 100, 100);
    expect(result).toBe(false);
  });
});
