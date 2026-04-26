import { describe, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

import SetupProgressBanner from "../SetupProgressBanner";

const steps = [
  { id: "periods", label: "Periods", done: true },
  { id: "criteria", label: "Criteria", done: false },
  { id: "projects", label: "Projects", done: false },
];

describe("SetupProgressBanner", () => {
  qaTest("coverage.setup-progress-banner.displays-step-count", () => {
    render(
      <MemoryRouter>
        <SetupProgressBanner basePath="/admin" steps={steps} />
      </MemoryRouter>
    );
    expect(screen.getByText("Continue Setup")).toBeInTheDocument();
    expect(screen.getByText("Periods")).toBeInTheDocument();
    expect(screen.getByText("Criteria")).toBeInTheDocument();
  });
});
