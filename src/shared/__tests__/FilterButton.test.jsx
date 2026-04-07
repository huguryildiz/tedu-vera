// src/shared/__tests__/FilterButton.test.jsx
import { describe, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterButton } from "../ui/FilterButton.jsx";
import { qaTest } from "../../test/qaTest.js";

describe("FilterButton", () => {
  qaTest("ui.filter-btn.01", () => {
    render(<FilterButton activeCount={0} isOpen={false} onClick={() => {}} />);
    expect(screen.queryByText(/^\d+$/)).toBeNull();
  });

  qaTest("ui.filter-btn.02", () => {
    render(<FilterButton activeCount={3} isOpen={false} onClick={() => {}} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("3").className).toContain("filter-badge");
  });

  qaTest("ui.filter-btn.03", () => {
    render(<FilterButton activeCount={0} isOpen={true} onClick={() => {}} />);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("active");
  });

  qaTest("ui.filter-btn.04", () => {
    const handler = vi.fn();
    render(<FilterButton activeCount={0} isOpen={false} onClick={handler} />);
    fireEvent.click(screen.getByRole("button"));
    expect(handler).toHaveBeenCalledOnce();
  });
});
