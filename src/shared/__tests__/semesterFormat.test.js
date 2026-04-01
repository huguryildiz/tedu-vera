// src/shared/__tests__/semesterFormat.test.js
// ============================================================
// Unit tests for stripSlugPrefix — semester display name helper.
// ============================================================

import { describe, expect } from "vitest";
import { qaTest } from "../../test/qaTest.js";
import { stripSlugPrefix } from "../periodFormat";

describe("stripSlugPrefix", () => {
  qaTest("semesterFormat.strip.01", () => {
    // Strips slug prefix correctly
    expect(stripSlugPrefix("boun-cs Spring 2026", "boun-cs")).toBe("Spring 2026");
    expect(stripSlugPrefix("metu-ie Summer 2026", "metu-ie")).toBe("Summer 2026");

    // No match — returns unchanged
    expect(stripSlugPrefix("Spring 2026", "boun-cs")).toBe("Spring 2026");

    // Slug equals full name — falls back to full name (no empty result)
    expect(stripSlugPrefix("boun-cs", "boun-cs")).toBe("boun-cs");

    // Empty / null inputs
    expect(stripSlugPrefix("", "boun-cs")).toBe("");
    expect(stripSlugPrefix(null, "boun-cs")).toBe("");
    expect(stripSlugPrefix(undefined, "boun-cs")).toBe("");

    // No slug — returns name unchanged
    expect(stripSlugPrefix("boun-cs Spring 2026", "")).toBe("boun-cs Spring 2026");
    expect(stripSlugPrefix("boun-cs Spring 2026", null)).toBe("boun-cs Spring 2026");
  });
});
