import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Icons", () => ({
  HistoryIcon: () => <span data-testid="history-icon" />,
}));

vi.mock("@/admin/utils/adminUtils", () => ({
  formatTs: (v) => (v ? "Jan 1, 2024" : null),
}));

import LastActivity from "../LastActivity";

describe("LastActivity", () => {
  qaTest("coverage.last-activity.renders-value", () => {
    render(<LastActivity value="2024-01-01T00:00:00Z" />);
    expect(screen.getByText("Jan 1, 2024")).toBeInTheDocument();
  });

  qaTest("coverage.last-activity.null-on-empty", () => {
    const { container } = render(<LastActivity value={null} />);
    expect(container.firstChild).toBeNull();
  });
});
