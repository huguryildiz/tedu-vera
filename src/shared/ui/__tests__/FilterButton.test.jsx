import { describe, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";
import { FilterButton } from "../FilterButton.jsx";

describe("ui/FilterButton", () => {
  qaTest("ui.FilterButton.01", () => {
    render(<FilterButton onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toBeTruthy();
  });

  qaTest("ui.FilterButton.02", () => {
    const { container } = render(<FilterButton activeCount={3} />);
    const badge = container.querySelector(".filter-badge");
    expect(badge).not.toBeNull();
    expect(badge.textContent).toBe("3");
  });

  qaTest("ui.FilterButton.03", () => {
    const { getByRole } = render(<FilterButton isOpen={true} />);
    expect(getByRole("button").classList.contains("active")).toBe(true);
  });
});
