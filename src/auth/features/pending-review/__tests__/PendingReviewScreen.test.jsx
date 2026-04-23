import { describe, vi, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const { mockGetMyJoinRequests } = vi.hoisted(() => ({
  mockGetMyJoinRequests: vi.fn(),
}));

vi.mock("@/shared/api", () => ({
  getMyJoinRequests: mockGetMyJoinRequests,
}));

vi.mock("@/shared/lib/dateUtils", () => ({
  formatDate: (d) => d,
}));

import PendingReviewScreen from "../PendingReviewScreen";

const mockUser = { email: "user@example.com" };

function renderScreen(props = {}) {
  return render(<PendingReviewScreen user={mockUser} onSignOut={vi.fn()} {...props} />);
}

describe("PendingReviewScreen", () => {
  qaTest("auth.pending.render", async () => {
    mockGetMyJoinRequests.mockResolvedValue([]);
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText(/access required/i)).toBeInTheDocument()
    );
  });

  qaTest("auth.pending.happy", async () => {
    mockGetMyJoinRequests.mockResolvedValue([
      { id: "req-1", organization: { name: "Test Org" }, created_at: "2024-01-01" },
    ]);
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText(/join request pending/i)).toBeInTheDocument()
    );
  });

  qaTest("auth.pending.error", async () => {
    mockGetMyJoinRequests.mockRejectedValue(new Error("Network failure"));
    renderScreen();
    // On error, falls back to empty array — shows "Access Required"
    await waitFor(() =>
      expect(screen.getByText(/access required/i)).toBeInTheDocument()
    );
  });
});
