import { describe, vi, expect } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

const { mockSignUp, mockCheckEmailAvailable } = vi.hoisted(() => ({
  mockSignUp: vi.fn(),
  mockCheckEmailAvailable: vi.fn().mockResolvedValue({ available: true }),
}));

vi.mock("@/auth/shared/AuthProvider", () => ({
  AuthContext: {
    _currentValue: { signUp: mockSignUp, user: null, loading: false, profileIncomplete: false, organizations: [] },
  },
  default: ({ children }) => children,
}));

vi.mock("@/shared/api", () => ({
  checkEmailAvailable: mockCheckEmailAvailable,
}));

import RegisterScreen from "../RegisterScreen";

function renderScreen(props = {}) {
  return render(
    <MemoryRouter>
      <RegisterScreen {...props} />
    </MemoryRouter>
  );
}

describe("RegisterScreen", () => {
  qaTest("auth.register.shows-registration-form-fields", () => {
    renderScreen();
    expect(screen.getByPlaceholderText("Dr. Jane Doe")).toBeInTheDocument();
  });

  qaTest("auth.register.happy", async () => {
    mockSignUp.mockResolvedValue(undefined);
    renderScreen();
    fireEvent.change(screen.getByPlaceholderText("Dr. Jane Doe"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("jane.doe@university.edu"), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\., TED University/i), {
      target: { value: "My Org" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 10 chars, upper, lower, number, symbol"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Re-enter password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.submit(screen.getByPlaceholderText("Dr. Jane Doe").closest("form"));
    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
  });

  qaTest("auth.register.error", async () => {
    mockSignUp.mockRejectedValue(new Error("org_name_taken"));
    renderScreen();
    fireEvent.change(screen.getByPlaceholderText("Dr. Jane Doe"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("jane.doe@university.edu"), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\., TED University/i), {
      target: { value: "My Org" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 10 chars, upper, lower, number, symbol"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.change(screen.getByPlaceholderText("Re-enter password"), {
      target: { value: "StrongPass1!" },
    });
    fireEvent.submit(screen.getByPlaceholderText("Dr. Jane Doe").closest("form"));
    await waitFor(() =>
      expect(screen.getByText(/organization with that name already exists/i)).toBeInTheDocument()
    );
  });
});
