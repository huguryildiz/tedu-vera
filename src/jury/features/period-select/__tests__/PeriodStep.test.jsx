import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/lib/dateUtils", () => ({
  formatDate: (d) => String(d),
}));

import PeriodStep from "../PeriodStep";

function makeState(overrides = {}) {
  return {
    handlePeriodSelect: vi.fn(),
    periods: [
      { id: "p1", name: "Spring 2026", start_date: "2026-02-01" },
      { id: "p2", name: "Fall 2025", start_date: "2025-09-01" },
    ],
    periodId: null,
    ...overrides,
  };
}

describe("PeriodStep", () => {
  qaTest("jury.step.period.01", () => {
    const state = makeState();
    render(<PeriodStep state={state} onBack={vi.fn()} />);
    expect(screen.getByText("Spring 2026")).toBeInTheDocument();
    expect(screen.getByText("Fall 2025")).toBeInTheDocument();
  });

  qaTest("jury.step.period.02", () => {
    const state = makeState();
    render(<PeriodStep state={state} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText("Spring 2026"));
    expect(state.handlePeriodSelect).toHaveBeenCalledWith("p1");
  });
});
