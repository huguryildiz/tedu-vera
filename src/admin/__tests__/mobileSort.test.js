import { describe, expect } from "vitest";
import { qaTest } from "../../test/qaTest.js";
import { sortMobileJurors, MOBILE_SORT_KEYS } from "../pages/mobileSort.js";

const jurors = [
  { key: "a", name: "Zeynep Ak",  dept: "EE"      },
  { key: "b", name: "Alper Bal",  dept: "Physics" },
  { key: "c", name: "Bora Can",   dept: "CS"      },
];

const rowAvgs = new Map([
  ["a", 88.0],
  ["b", 72.5],
  ["c", null],   // no scored cells
]);

const workflow = new Map([
  ["a", "completed"],
  ["b", "in_progress"],
  ["c", "not_started"],
]);

describe("sortMobileJurors", () => {
  qaTest("heatmap.mobile.sort.01", () => {
    const out = sortMobileJurors(jurors, "avg_desc", { rowAvgs, workflow });
    expect(out.map(j => j.key)).toEqual(["a", "b", "c"]);
  });

  qaTest("heatmap.mobile.sort.02", () => {
    const out = sortMobileJurors(jurors, "avg_asc", { rowAvgs, workflow });
    expect(out.map(j => j.key)).toEqual(["b", "a", "c"]);
  });

  qaTest("heatmap.mobile.sort.03", () => {
    const out = sortMobileJurors(jurors, "name_asc", { rowAvgs, workflow });
    expect(out.map(j => j.key)).toEqual(["b", "c", "a"]);
  });

  qaTest("heatmap.mobile.sort.04", () => {
    const out = sortMobileJurors(jurors, "status", { rowAvgs, workflow });
    expect(out.map(j => j.key)).toEqual(["a", "b", "c"]);
  });

  qaTest("heatmap.mobile.sort.05", () => {
    const out = sortMobileJurors(jurors, "bogus", { rowAvgs, workflow });
    expect(out.map(j => j.key)).toEqual(["b", "c", "a"]);
  });

  qaTest("heatmap.mobile.sort.06", () => {
    expect(MOBILE_SORT_KEYS.map(o => o.value)).toEqual([
      "avg_desc", "avg_asc", "name_asc", "name_desc", "status",
    ]);
  });
});
