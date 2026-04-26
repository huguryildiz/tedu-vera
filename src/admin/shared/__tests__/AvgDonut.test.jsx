import { describe, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";
import AvgDonut from "../AvgDonut";

describe("AvgDonut", () => {
  qaTest("coverage.avg-donut.displays-numeric-value-in-aria-label", () => {
    render(<AvgDonut value={72.456} max={100} />);
    const el = screen.getByRole("img");
    expect(el.getAttribute("aria-label")).toContain("72.5");
  });

  qaTest("coverage.avg-donut.no-value", () => {
    render(<AvgDonut value={null} max={100} />);
    const el = screen.getByRole("img");
    expect(el.getAttribute("aria-label")).toBe("Average not available");
  });
});
