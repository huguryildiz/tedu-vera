import { describe, vi, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

const { mockConfirmEmailVerification, mockSendEmailVerification } = vi.hoisted(() => ({
  mockConfirmEmailVerification: vi.fn(),
  mockSendEmailVerification: vi.fn(),
}));

vi.mock("@/shared/api", () => ({
  confirmEmailVerification: mockConfirmEmailVerification,
  sendEmailVerification: mockSendEmailVerification,
}));

vi.mock("@/auth/shared/AuthProvider", () => ({
  AuthContext: {
    _currentValue: { refreshEmailVerified: vi.fn() },
  },
  default: ({ children }) => children,
}));

import VerifyEmailScreen from "../VerifyEmailScreen";

function renderScreen(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/verify-email${search}`]}>
      <Routes>
        <Route path="/verify-email" element={<VerifyEmailScreen />} />
        <Route path="/admin" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("VerifyEmailScreen", () => {
  qaTest("auth.verify.shows-error-state-when-token-absent", async () => {
    // No token → error state immediately
    renderScreen("");
    await waitFor(() =>
      expect(screen.getByText(/missing token/i)).toBeInTheDocument()
    );
  });

  qaTest("auth.verify.happy", async () => {
    mockConfirmEmailVerification.mockResolvedValue(undefined);
    renderScreen("?token=valid-token");
    await waitFor(() => expect(mockConfirmEmailVerification).toHaveBeenCalledWith("valid-token"));
    await waitFor(() =>
      expect(screen.getByText(/verified/i)).toBeInTheDocument()
    );
  });

  qaTest("auth.verify.error", async () => {
    mockConfirmEmailVerification.mockRejectedValue(new Error("Token invalid or expired"));
    renderScreen("?token=bad-token");
    await waitFor(() =>
      expect(screen.getByText(/verification link has expired/i)).toBeInTheDocument()
    );
  });
});
