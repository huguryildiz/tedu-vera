import { describe, vi, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";
import { useSetupWizard } from "../useSetupWizard";

beforeEach(() => {
  sessionStorage.clear();
});

describe("useSetupWizard", () => {
  qaTest("admin.setup.wizard.step.init", () => {
    const { result } = renderHook(() =>
      useSetupWizard({ orgId: "org-001", periods: [], criteriaConfig: [], frameworks: [], jurors: [], projects: [] })
    );
    expect(result.current.currentStep).toBe(1);
    expect(result.current.completionPercent).toBe(0);
  });

  qaTest("admin.setup.wizard.step.navigate", () => {
    const { result } = renderHook(() =>
      useSetupWizard({ orgId: "org-001", periods: [], criteriaConfig: [], frameworks: [], jurors: [], projects: [] })
    );
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.currentStep).toBe(2);
    act(() => {
      result.current.prevStep();
    });
    expect(result.current.currentStep).toBe(1);
  });

  qaTest("admin.setup.wizard.step.completed", () => {
    const period = { id: "p-001", criteria_name: "Standard", framework_id: "fw-001" };
    const { result } = renderHook(() =>
      useSetupWizard({
        orgId: "org-001",
        periods: [period],
        criteriaConfig: [{ id: "c-001", label: "Technical Quality" }],
        frameworks: [{ id: "fw-001", name: "MÜDEK" }],
        jurors: [],
        projects: [{ id: "pr-001" }],
      })
    );
    // With period + criteria + framework + projects, should resume at step 5
    expect(result.current.currentStep).toBe(5);
    expect(result.current.completedSteps.has(2)).toBe(true);
    expect(result.current.completedSteps.has(3)).toBe(true);
    expect(result.current.completedSteps.has(4)).toBe(true);
  });
});
