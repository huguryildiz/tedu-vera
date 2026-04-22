import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "@/auth/shared/AuthProvider";
import RegisterScreen from "@/auth/screens/RegisterScreen";
import { qaTest } from "@/test/qaTest.js";
import { vi } from "vitest";

vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));
vi.mock("@/shared/api", () => ({
  checkEmailAvailable: vi.fn(async () => ({ available: true })),
}));
vi.mock("@/shared/hooks/useShakeOnError", () => ({
  default: () => ({ current: null }),
}));

function renderWithAuth(authOverrides = {}) {
  const auth = {
    user: null,
    loading: false,
    signUp: vi.fn(async () => ({ user: { id: "u1" }, session: { access_token: "x" } })),
    ...authOverrides,
  };
  return {
    auth,
    ...render(
      <MemoryRouter initialEntries={["/register"]}>
        <AuthContext.Provider value={auth}>
          <RegisterScreen />
        </AuthContext.Provider>
      </MemoryRouter>
    ),
  };
}

qaTest("auth.register.happy_path", async () => {
  const { auth } = renderWithAuth();

  // Fill in all fields by ID
  const nameInput = screen.getByRole("textbox", { name: /Full Name/i });
  fireEvent.change(nameInput, { target: { value: "Jane Doe" } });

  const emailInput = screen.getByRole("textbox", { name: /Institutional Email/i });
  fireEvent.change(emailInput, { target: { value: "jane@u.edu" } });
  fireEvent.blur(emailInput);

  const orgInput = screen.getByRole("textbox", { name: /Organization/i });
  fireEvent.change(orgInput, { target: { value: "Dept X" } });

  const passwordInput = document.getElementById("reg-password");
  fireEvent.change(passwordInput, { target: { value: "StrongPass1!" } });

  const confirmPasswordInput = document.getElementById("reg-confirm");
  fireEvent.change(confirmPasswordInput, { target: { value: "StrongPass1!" } });

  const submitBtn = screen.getByRole("button", { name: /Create workspace/i });
  fireEvent.click(submitBtn);

  await waitFor(() => {
    expect(auth.signUp).toHaveBeenCalledWith(
      "jane@u.edu",
      "StrongPass1!",
      { name: "Jane Doe", orgName: "Dept X" }
    );
  });
});

qaTest("auth.register.email_taken", async () => {
  const { checkEmailAvailable } = await import("@/shared/api");
  checkEmailAvailable.mockResolvedValueOnce({ available: false });

  renderWithAuth();

  const emailInput = screen.getByRole("textbox", { name: /Institutional Email/i });
  fireEvent.change(emailInput, { target: { value: "taken@u.edu" } });
  fireEvent.blur(emailInput);

  await waitFor(() => {
    expect(screen.getByText(/already registered/i)).toBeInTheDocument();
  });
});

qaTest("auth.register.org_idempotent_error", async () => {
  const error = new Error("org_creation_failed");
  error.code = "org_creation_failed";

  const { auth } = renderWithAuth({
    signUp: vi.fn(async () => { throw error; }),
  });

  // Fill in all fields by ID
  const nameInput = screen.getByRole("textbox", { name: /Full Name/i });
  fireEvent.change(nameInput, { target: { value: "Jane Doe" } });

  const emailInput = screen.getByRole("textbox", { name: /Institutional Email/i });
  fireEvent.change(emailInput, { target: { value: "jane@u.edu" } });
  fireEvent.blur(emailInput);

  const orgInput = screen.getByRole("textbox", { name: /Organization/i });
  fireEvent.change(orgInput, { target: { value: "Dept X" } });

  const passwordInput = document.getElementById("reg-password");
  fireEvent.change(passwordInput, { target: { value: "StrongPass1!" } });

  const confirmPasswordInput = document.getElementById("reg-confirm");
  fireEvent.change(confirmPasswordInput, { target: { value: "StrongPass1!" } });

  const submitBtn = screen.getByRole("button", { name: /Create workspace/i });
  fireEvent.click(submitBtn);

  await waitFor(() => {
    expect(screen.getByText(/We couldn't set up your organization/i)).toBeInTheDocument();
  });
});
