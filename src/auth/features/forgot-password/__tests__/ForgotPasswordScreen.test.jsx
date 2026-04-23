import { describe, vi, expect, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/auth/shared/AuthProvider", () => ({
  AuthContext: { _currentValue: null },
  default: ({ children }) => children,
}));

import ForgotPasswordScreen from "../ForgotPasswordScreen";

function renderScreen(props = {}) {
  return render(
    <MemoryRouter>
      <ForgotPasswordScreen {...props} />
    </MemoryRouter>
  );
}

describe("ForgotPasswordScreen", () => {
  qaTest("auth.forgot.render", () => {
    renderScreen({ onResetPassword: vi.fn() });
    expect(screen.getByPlaceholderText("you@university.edu")).toBeInTheDocument();
  });

  qaTest("auth.forgot.happy", async () => {
    const onResetPassword = vi.fn().mockResolvedValue(undefined);
    renderScreen({ onResetPassword });
    fireEvent.change(screen.getByPlaceholderText("you@university.edu"), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByPlaceholderText("you@university.edu").closest("form"));
    await waitFor(() => expect(onResetPassword).toHaveBeenCalledWith("user@example.com"));
  });

  qaTest("auth.forgot.error", async () => {
    const onResetPassword = vi.fn().mockRejectedValue(new Error("Server error"));
    renderScreen({ onResetPassword });
    fireEvent.change(screen.getByPlaceholderText("you@university.edu"), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByPlaceholderText("you@university.edu").closest("form"));
    await waitFor(() => expect(screen.getByText(/server error/i)).toBeInTheDocument());
  });
});
