import { describe, vi, expect } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const { mockSendEmailVerification } = vi.hoisted(() => ({
  mockSendEmailVerification: vi.fn(),
}));

vi.mock("@/shared/api", () => ({
  sendEmailVerification: mockSendEmailVerification,
}));

import GraceLockScreen from "../GraceLockScreen";

const mockUser = { email: "user@example.com" };

function renderScreen(props = {}) {
  return render(<GraceLockScreen user={mockUser} onSignOut={vi.fn()} {...props} />);
}

describe("GraceLockScreen", () => {
  qaTest("auth.grace.shows-warning-title-and-resend-email-button", () => {
    renderScreen();
    expect(screen.getByText(/account pending deletion/i)).toBeInTheDocument();
  });

  qaTest("auth.grace.happy", async () => {
    mockSendEmailVerification.mockResolvedValue(undefined);
    renderScreen();
    fireEvent.click(screen.getByText(/resend verification link/i));
    await waitFor(() =>
      expect(screen.getByText(/verification link sent/i)).toBeInTheDocument()
    );
  });

  qaTest("auth.grace.error", async () => {
    mockSendEmailVerification.mockRejectedValue(new Error("Network error"));
    renderScreen();
    fireEvent.click(screen.getByText(/resend verification link/i));
    await waitFor(() =>
      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    );
  });
});
