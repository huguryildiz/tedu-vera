import { render, screen, waitFor } from "@testing-library/react";
import { expect } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import VerifyEmailScreen from "@/auth/features/verify-email/VerifyEmailScreen";
import { AuthContext } from "@/auth/shared/AuthProvider";
import { qaTest } from "@/test/qaTest.js";
import { vi } from "vitest";

const confirmMock = vi.fn();

vi.mock("@/shared/api", () => ({
  confirmEmailVerification: (...args) => confirmMock(...args),
}));
vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));

function renderAt(url) {
  return render(
    <AuthContext.Provider value={{ refreshEmailVerified: vi.fn() }}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailScreen />} />
          <Route path="/admin" element={<div>Admin Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

qaTest("auth.verify_email.success", async () => {
  confirmMock.mockClear();
  confirmMock.mockResolvedValueOnce({ ok: true });

  renderAt("/verify-email?token=00000000-0000-0000-0000-000000000000");

  // Should show pending state first
  expect(screen.getByText(/Verifying your email/i)).toBeInTheDocument();

  // Should transition to success
  await waitFor(() => {
    expect(screen.getByText(/Email verified/i)).toBeInTheDocument();
  });
});

qaTest("auth.verify_email.expired", async () => {
  confirmMock.mockClear();
  const error = new Error("token_expired");
  confirmMock.mockRejectedValueOnce(error);

  renderAt("/verify-email?token=00000000-0000-0000-0000-000000000000");

  // Should show pending state first
  expect(screen.getByText(/Verifying your email/i)).toBeInTheDocument();

  // Should transition to error with expired message
  await waitFor(() => {
    expect(screen.getByText(/expired/i)).toBeInTheDocument();
  });
});
