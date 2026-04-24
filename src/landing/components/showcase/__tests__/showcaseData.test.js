import { describe, expect } from "vitest";
import { qaTest } from "@/test/qaTest";
import { PROJECTS, JURORS, CRITERIA } from "../showcaseData";

describe("showcaseData", () => {
  qaTest("coverage.showcase-data.shape", () => {
    expect(Array.isArray(PROJECTS)).toBe(true);
    expect(PROJECTS[0]).toHaveProperty("code");
    expect(PROJECTS[0]).toHaveProperty("score");

    expect(Array.isArray(JURORS)).toBe(true);
    expect(JURORS[0]).toHaveProperty("name");

    expect(Array.isArray(CRITERIA)).toBe(true);
    expect(CRITERIA[0]).toHaveProperty("key");
    expect(CRITERIA[0]).toHaveProperty("max");
  });
});
