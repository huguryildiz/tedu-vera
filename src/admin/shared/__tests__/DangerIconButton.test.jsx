import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Icons", () => ({
  TrashIcon: () => <span data-testid="trash-icon" />,
}));

vi.mock("@/shared/ui/PremiumTooltip", () => ({
  default: ({ children }) => <>{children}</>,
}));

import DangerIconButton from "../DangerIconButton";

describe("DangerIconButton", () => {
  qaTest("coverage.danger-icon-button.renders-with-aria-label", () => {
    render(<DangerIconButton ariaLabel="Delete item" onClick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Delete item" })).toBeInTheDocument();
  });

  qaTest("coverage.danger-icon-button.disabled", () => {
    render(<DangerIconButton ariaLabel="Delete item" onClick={vi.fn()} disabled={true} />);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
