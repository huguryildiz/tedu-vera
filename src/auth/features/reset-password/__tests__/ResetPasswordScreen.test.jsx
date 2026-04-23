import { describe, vi, expect, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/auth/shared/AuthProvider", () => ({
  AuthContext: { _currentValue: null },
  default: ({ children }) => children,
}));

import ResetPasswordScreen from "../ResetPasswordScreen";

function renderScreen(props = {}) {
  return render(
    <MemoryRouter>
      <ResetPasswordScreen onUpdatePassword={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

describe("ResetPasswordScreen", () => {
  beforeEach(() => {
    // Set recovery token so screen shows the form (not "Invalid Reset Link")
    window.history.pushState({}, "", "?type=recovery");
  });

  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  qaTest("auth.reset.render", () => {
    renderScreen();
    expect(screen.getByPlaceholderText("Min 10 chars, upper, lower, number, symbol")).toBeInTheDocument();
  });

  qaTest("auth.reset.happy", async () => {
    const onUpdatePassword = vi.fn().mockResolvedValue(undefined);
    renderScreen({ onUpdatePassword });
    fireEvent.change(screen.getByPlaceholderText("Min 10 chars, upper, lower, number, symbol"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Re-enter your new password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.submit(
      screen.getByPlaceholderText("Min 10 chars, upper, lower, number, symbol").closest("form")
    );
    await waitFor(() => expect(onUpdatePassword).toHaveBeenCalledWith("StrongPass1!"));
  });

  qaTest("auth.reset.error", async () => {
    const onUpdatePassword = vi.fn().mockRejectedValue(new Error("Token expired"));
    renderScreen({ onUpdatePassword });
    fireEvent.change(screen.getByPlaceholderText("Min 10 chars, upper, lower, number, symbol"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Re-enter your new password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.submit(
      screen.getByPlaceholderText("Min 10 chars, upper, lower, number, symbol").closest("form")
    );
    await waitFor(() =>
      expect(screen.getByText(/token expired/i)).toBeInTheDocument()
    );
  });
});
