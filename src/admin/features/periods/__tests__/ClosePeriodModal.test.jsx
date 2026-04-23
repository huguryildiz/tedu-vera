import { describe, vi, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Modal", () => ({
  default: ({ open, children }) => (open ? <div>{children}</div> : null),
}));
vi.mock("@/shared/ui/FbAlert", () => ({
  default: ({ children }) => <div data-testid="fb-alert">{children}</div>,
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => <span>{children}</span>,
}));

import ClosePeriodModal from "../ClosePeriodModal";

const PERIOD = { id: "period-001", name: "Spring 2026" };

describe("ClosePeriodModal", () => {
  qaTest("admin.periods.close.confirm", () => {
    render(
      <ClosePeriodModal
        open
        onClose={vi.fn()}
        period={PERIOD}
        onCloseAction={vi.fn()}
      />
    );

    expect(screen.getByText("Close Evaluation Period?")).toBeInTheDocument();

    const closeBtn = screen.getByRole("button", { name: /close period/i });
    expect(closeBtn).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Type Spring 2026 to confirm/i), {
      target: { value: "Spring 2026" },
    });

    expect(closeBtn).not.toBeDisabled();
  });
});
