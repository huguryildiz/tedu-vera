import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/auth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "admin@example.com" },
    displayName: "Dr. Admin",
    avatarUrl: null,
    activeOrganization: { id: "org1", name: "TEDU" },
    isSuper: false,
  }),
}));
vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));
vi.mock("@/shared/hooks/useFloating", () => ({
  useFloating: () => ({
    floatingRef: { current: null },
    floatingStyle: {},
    actualPlacement: "bottom-end",
  }),
}));

import SecuritySignalPill from "../SecuritySignalPill";
import UserAvatarMenu from "../UserAvatarMenu";

describe("SecuritySignalPill", () => {
  qaTest("coverage.security-signal-pill.renders", () => {
    render(
      <SecuritySignalPill
        signal={{ state: "secure" }}
        onReviewSessions={vi.fn()}
      />
    );
    expect(screen.getByText("Secure")).toBeInTheDocument();
  });
});

describe("UserAvatarMenu", () => {
  qaTest("coverage.user-avatar-menu.renders", () => {
    const { container } = render(
      <UserAvatarMenu onLogout={vi.fn()} onNavigate={vi.fn()} />
    );
    expect(container.firstChild).toBeTruthy();
  });
});
