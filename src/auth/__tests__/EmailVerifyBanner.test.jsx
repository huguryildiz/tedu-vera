import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect } from "vitest";
import { AuthContext } from "@/auth/AuthProvider";
import EmailVerifyBanner from "@/auth/features/verify-email/EmailVerifyBanner";
import { qaTest } from "@/test/qaTest.js";
import { vi } from "vitest";

const sendMock = vi.fn(async () => ({ ok: true }));

vi.mock("@/shared/api", () => ({
  sendEmailVerification: (...args) => sendMock(...args),
}));
vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));

function renderWith(auth) {
  return render(
    <AuthContext.Provider value={auth}>
      <EmailVerifyBanner />
    </AuthContext.Provider>
  );
}

qaTest("auth.banner.hidden_when_verified", () => {
  renderWith({ user: { id: "u1" }, emailVerified: true });
  expect(screen.queryByText(/Verify your email/i)).toBeNull();
});

qaTest("auth.banner.resend_success", async () => {
  sendMock.mockClear();
  sendMock.mockResolvedValueOnce({ ok: true });

  renderWith({ user: { id: "u1" }, emailVerified: false });

  expect(screen.getByText(/Verify your email/i)).toBeInTheDocument();

  const resendBtn = screen.getByRole("button", { name: /Resend link/i });
  fireEvent.click(resendBtn);

  await waitFor(() => expect(sendMock).toHaveBeenCalled());
  await waitFor(() => {
    expect(screen.getByText(/Link sent/i)).toBeInTheDocument();
  });
});
