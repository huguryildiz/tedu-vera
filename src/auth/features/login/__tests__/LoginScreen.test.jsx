import { describe, vi, expect } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/auth/shared/SecurityPolicyContext", () => ({
  useSecurityPolicy: () => ({ googleOAuth: false, emailPassword: true, rememberMe: false }),
}));

vi.mock("@/auth/shared/AuthProvider", () => ({
  AuthContext: { _currentValue: null },
  default: ({ children }) => children,
}));

import LoginScreen from "../LoginScreen";

function renderScreen(props = {}) {
  return render(
    <MemoryRouter>
      <LoginScreen onLogin={vi.fn()} onGoogleLogin={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

describe("LoginScreen", () => {
  qaTest("auth.login.shows-login-form-fields", () => {
    renderScreen();
    expect(screen.getByPlaceholderText("Enter your email address")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Enter your password")).toBeInTheDocument();
  });

  qaTest("auth.login.happy", async () => {
    const onLogin = vi.fn().mockResolvedValue(undefined);
    renderScreen({ onLogin });
    fireEvent.change(screen.getByPlaceholderText("Enter your email address"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "Password1!" },
    });
    fireEvent.submit(screen.getByPlaceholderText("Enter your email address").closest("form"));
    await waitFor(() => expect(onLogin).toHaveBeenCalled());
    const [email] = onLogin.mock.calls[0];
    expect(email).toBe("user@example.com");
  });

  qaTest("auth.login.error", async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error("Invalid login credentials"));
    renderScreen({ onLogin });
    fireEvent.change(screen.getByPlaceholderText("Enter your email address"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Enter your password"), {
      target: { value: "wrong" },
    });
    fireEvent.submit(screen.getByPlaceholderText("Enter your email address").closest("form"));
    await waitFor(() =>
      expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
    );
  });
});
