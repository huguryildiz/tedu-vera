import { describe, vi, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("../showcase/showcaseData", () => ({
  SLIDES: [
    {
      theme: "overview",
      eyebrow: "Overview",
      title: "Slide A",
      desc: "desc A",
      color: "#3b82f6",
      image: { light: "a-light.png", dark: "a-dark.png" },
    },
    {
      theme: "juryflow",
      eyebrow: "Jury",
      title: "Slide B",
      desc: "desc B",
      color: "#22c55e",
      image: { light: "b-light.png", dark: "b-dark.png" },
    },
  ],
}));

vi.mock("@/shared/theme/ThemeProvider", () => ({
  useTheme: () => ({ theme: "light" }),
}));

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
