import { describe, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";
import StepperBar from "../StepperBar";

describe("StepperBar", () => {
  qaTest("coverage.stepper-bar.displays-all-five-step-labels", () => {
    render(<StepperBar step="identity" />);
    expect(screen.getByText("Identity")).toBeInTheDocument();
    expect(screen.getByText("PIN")).toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
    expect(screen.getByText("Scoring")).toBeInTheDocument();
    expect(screen.getByText("Summary")).toBeInTheDocument();
  });

  qaTest("coverage.stepper-bar.marks-active", () => {
    const { container } = render(<StepperBar step="eval" />);
    const activeSteps = container.querySelectorAll(".dj-stepper-step.active");
    expect(activeSteps).toHaveLength(1);
    expect(activeSteps[0]).toHaveTextContent("Scoring");
  });
});
