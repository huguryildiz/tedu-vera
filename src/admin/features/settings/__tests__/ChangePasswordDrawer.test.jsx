import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Drawer", () => ({
  default: ({ open, children }) => (open ? <div data-testid="drawer">{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({ default: () => null }));
vi.mock("@/shared/ui/InlineError", () => ({ default: () => null }));
vi.mock("@/shared/hooks/useShakeOnError", () => ({ default: () => ({ current: null }) }));
vi.mock("@/shared/passwordPolicy", () => ({
  evaluatePassword: vi.fn(() => ({ checks: {}, score: 0 })),
  getStrengthMeta: vi.fn(() => ({ label: "Weak", color: "red" })),
  isStrongPassword: vi.fn(() => false),
  PASSWORD_POLICY_PLACEHOLDER: "",
  PASSWORD_REQUIREMENTS: [],
}));
vi.mock("@/auth", () => ({
  useAuth: () => ({ user: { email: "admin@example.com" } }),
}));

import ChangePasswordDrawer from "../ChangePasswordDrawer";

describe("ChangePasswordDrawer", () => {
  qaTest("admin.settings.drawer.password", () => {
    render(
      <ChangePasswordDrawer
        open={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        error={null}
      />
    );
    expect(screen.getByTestId("drawer")).toBeInTheDocument();
  });
});
