import { describe, vi, expect } from "vitest";
import { qaTest } from "@/test/qaTest";

const mockCreateFramework = vi.fn().mockResolvedValue({ id: "fw-1" });
const mockCreateOutcome = vi.fn().mockResolvedValue({ id: "o-1" });

vi.mock("../frameworks", () => ({
  createFramework: (...args) => mockCreateFramework(...args),
  createOutcome: (...args) => mockCreateOutcome(...args),
}));

vi.mock("@/shared/constants", () => ({
  OUTCOME_DEFINITIONS: {
    "PO-01": { en: "Engineering Knowledge", tr: "Mühendislik Bilgisi" },
    "PO-02": { en: "Problem Analysis", tr: "Problem Analizi" },
  },
}));

import { applyStandardFramework } from "../wizardHelpers";

describe("wizardHelpers", () => {
  qaTest("coverage.wizard-helpers.apply-standard-framework", async () => {
    const { framework, outcomeMap } = await applyStandardFramework("org-1");
    expect(mockCreateFramework).toHaveBeenCalledWith(expect.objectContaining({ organization_id: "org-1" }));
    expect(mockCreateOutcome).toHaveBeenCalledTimes(2);
    expect(framework).toEqual({ id: "fw-1" });
    expect(outcomeMap["PO-01"]).toBeDefined();
  });
});
