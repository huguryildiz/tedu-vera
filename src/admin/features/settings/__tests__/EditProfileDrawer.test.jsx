import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Drawer", () => ({
  default: ({ open, children }) => (open ? <div data-testid="drawer">{children}</div> : null),
}));
vi.mock("@/shared/ui/Avatar", () => ({ default: () => null }));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({ default: () => null }));
vi.mock("@/shared/hooks/useShakeOnError", () => ({ default: () => ({ current: null }) }));
vi.mock("../AvatarUploadModal", () => ({ default: () => null }));

import EditProfileDrawer from "../EditProfileDrawer";

describe("EditProfileDrawer", () => {
  qaTest("admin.settings.drawer.profile", () => {
    render(
      <EditProfileDrawer
        open={true}
        onClose={vi.fn()}
        profile={{ displayName: "Demo Admin", email: "admin@example.com", avatarUrl: null }}
        onSave={vi.fn()}
        onCancelEmailChange={vi.fn()}
        pendingEmail={null}
        error={null}
        initials="DA"
        avatarBg="#6366f1"
        isSuper={false}
      />
    );
    expect(screen.getByText("Edit Profile")).toBeInTheDocument();
  });
});
