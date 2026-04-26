import { describe, vi, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("../showcase/showcaseData", () => ({
  SLIDES: [
    { theme: "analytics", eyebrow: "Analytics", title: "Slide A", desc: "desc A", color: "#3b82f6" },
    { theme: "juryflow", eyebrow: "Jury", title: "Slide B", desc: "desc B", color: "#22c55e" },
  ],
}));

vi.mock("../showcase/SlideAnalytics", () => ({ default: () => <div>analytics-visual</div> }));
vi.mock("../showcase/SlideJuryFlow", () => ({ default: () => <div>juryflow-visual</div> }));
vi.mock("../showcase/SlideEntryControl", () => ({ default: () => null }));
vi.mock("../showcase/SlideCriteria", () => ({ default: () => null }));
vi.mock("../showcase/SlideManagement", () => ({ default: () => null }));
vi.mock("@/styles/showcase-slides.css", () => ({}));

import ProductShowcase from "../ProductShowcase";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("ProductShowcase", () => {
  qaTest("coverage.product-showcase.has-slides", () => {
    render(<ProductShowcase />);
    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.getByLabelText("Previous slide")).toBeInTheDocument();
    expect(screen.getByLabelText("Next slide")).toBeInTheDocument();
  });
});
