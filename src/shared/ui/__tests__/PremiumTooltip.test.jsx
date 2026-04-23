import { describe, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";
import PremiumTooltip from "../PremiumTooltip.jsx";

describe("ui/PremiumTooltip", () => {
  qaTest("ui.PremiumTooltip.01", () => {
    const { container } = render(
      <PremiumTooltip><span data-testid="child">child</span></PremiumTooltip>
    );
    expect(container.querySelector(".premium-tooltip-wrap")).toBeNull();
    expect(screen.getByTestId("child")).toBeTruthy();
  });

  qaTest("ui.PremiumTooltip.02", () => {
    render(
      <PremiumTooltip text="Tip text"><span>child</span></PremiumTooltip>
    );
    const wrap = document.querySelector(".premium-tooltip-wrap");
    fireEvent.mouseEnter(wrap);
    const tooltip = document.body.querySelector('[role="tooltip"]');
    expect(tooltip).not.toBeNull();
    expect(tooltip.textContent).toContain("Tip text");
  });
});
