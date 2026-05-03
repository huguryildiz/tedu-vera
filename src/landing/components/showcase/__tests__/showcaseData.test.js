import { describe, expect } from "vitest";
import { qaTest } from "@/test/qaTest";
import { SLIDES } from "../showcaseData";

describe("showcaseData", () => {
  qaTest("coverage.showcase-data.shape", () => {
    expect(Array.isArray(SLIDES)).toBe(true);
    expect(SLIDES.length).toBe(6);
    for (const slide of SLIDES) {
      expect(slide).toHaveProperty("theme");
      expect(slide).toHaveProperty("title");
      expect(slide).toHaveProperty("desc");
      expect(slide).toHaveProperty("color");
      expect(slide.image).toMatchObject({
        light: expect.any(String),
        dark: expect.any(String),
      });
      expect(Array.isArray(slide.features)).toBe(true);
    }
  });
});
