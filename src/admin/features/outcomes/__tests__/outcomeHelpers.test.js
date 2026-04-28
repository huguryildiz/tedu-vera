import { describe, expect } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

import { vi } from "vitest";
vi.mock("lucide-react", () => ({
  AlertTriangle: "AlertTriangle",
  CheckCircle: "CheckCircle",
  Circle: "Circle",
}));

import {
  coverageBadgeClass,
  coverageLabel,
  naturalCodeSort,
  COVERAGE_LEGEND,
} from "../components/outcomeHelpers.js";

describe("outcomeHelpers — coverageBadgeClass, coverageLabel, naturalCodeSort", () => {
  qaTest("outcome.helpers.01", () => {
    // ── coverageBadgeClass ────────────────────────────────────
    expect(coverageBadgeClass("direct")).toBe("acc-coverage direct");
    expect(coverageBadgeClass("indirect")).toBe("acc-coverage indirect acc-coverage-toggle");
    expect(coverageBadgeClass("none")).toBe("acc-coverage none acc-coverage-toggle");
    expect(coverageBadgeClass("other")).toBe("acc-coverage none acc-coverage-toggle");
    expect(coverageBadgeClass(undefined)).toBe("acc-coverage none acc-coverage-toggle");

    // ── coverageLabel ─────────────────────────────────────────
    expect(coverageLabel("direct")).toBe("Direct");
    expect(coverageLabel("indirect")).toBe("Indirect");
    expect(coverageLabel("none")).toBe("Unmapped");
    expect(coverageLabel("other")).toBe("Unmapped");
    expect(coverageLabel(undefined)).toBe("Unmapped");

    // ── naturalCodeSort ───────────────────────────────────────
    // Sorts numerically, not lexicographically
    const codes = [
      { code: "PO10" },
      { code: "PO2" },
      { code: "PO1" },
    ];
    const sorted = [...codes].sort(naturalCodeSort);
    expect(sorted[0].code).toBe("PO1");
    expect(sorted[1].code).toBe("PO2");
    expect(sorted[2].code).toBe("PO10");

    // Multi-level codes (e.g., 1.1, 1.2, 2.1)
    const multiLevel = [
      { code: "PO2.1" },
      { code: "PO1.2" },
      { code: "PO1.1" },
    ];
    const mlSorted = [...multiLevel].sort(naturalCodeSort);
    expect(mlSorted[0].code).toBe("PO1.1");
    expect(mlSorted[1].code).toBe("PO1.2");
    expect(mlSorted[2].code).toBe("PO2.1");

    // (copy) suffix comes after the original
    const withCopy = [
      { code: "PO1 (copy)" },
      { code: "PO1" },
    ];
    const copySorted = [...withCopy].sort(naturalCodeSort);
    expect(copySorted[0].code).toBe("PO1");
    expect(copySorted[1].code).toBe("PO1 (copy)");

    // Equal codes with no copy → stable (no swap)
    const equal = [{ code: "PO1" }, { code: "PO1" }];
    const eqSorted = [...equal].sort(naturalCodeSort);
    expect(eqSorted[0].code).toBe("PO1");
  });

  qaTest("component.outcome-legend.unmapped-outcome-warning", () => {
    // unmapped outcome warning: COVERAGE_LEGEND must include a 'none' entry
    const unmappedEntry = COVERAGE_LEGEND.find((e) => e.key === "none");
    expect(unmappedEntry).toBeDefined();
    expect(unmappedEntry.label).toBe("Unmapped");
    // coverageLabel returns "Unmapped" for any unrecognised coverage type (unmapped outcome)
    expect(coverageLabel("none")).toBe("Unmapped");
    expect(coverageLabel(undefined)).toBe("Unmapped");
  });
});
