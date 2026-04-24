import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/api", () => ({ sendEmailVerification: vi.fn() }));
vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));

import { AuthContext } from "@/auth/shared/AuthProvider";
import EmailVerifyBanner from "../EmailVerifyBanner";

describe("EmailVerifyBanner", () => {
  qaTest("coverage.email-verify-banner.hidden-verified", () => {
    const auth = { user: { id: "u1" }, emailVerified: true, isSuper: false };
    const { container } = render(
      <AuthContext.Provider value={auth}>
        <EmailVerifyBanner />
      </AuthContext.Provider>
    );
    expect(container.firstChild).toBeNull();
  });

  qaTest("coverage.email-verify-banner.shows-unverified", () => {
    const auth = {
      user: { id: "u1" },
      emailVerified: false,
      isSuper: false,
      graceEndsAt: null,
    };
    render(
      <AuthContext.Provider value={auth}>
        <EmailVerifyBanner />
      </AuthContext.Provider>
    );
    expect(screen.getByText(/Verify your email/)).toBeInTheDocument();
  });
});
