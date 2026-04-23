import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/auth", () => ({
  useAuth: () => ({
    user: { id: "u-001", email: "admin@example.com" },
    session: null,
    displayName: "Demo Admin",
    setDisplayName: vi.fn(),
    avatarUrl: null,
    setAvatarUrl: vi.fn(),
    isSuper: false,
    activeOrganization: { id: "org-001", code: "TEDU" },
    signOut: vi.fn(),
    signOutAll: vi.fn(),
    refreshUser: vi.fn(),
    clearPendingEmail: vi.fn(),
    updatePassword: vi.fn(),
    reauthenticateWithPassword: vi.fn(),
    refreshMemberships: vi.fn(),
    loading: false,
  }),
}));

vi.mock("@/auth/shared/SecurityPolicyContext", () => ({
  useUpdatePolicy: () => vi.fn(),
}));

vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/admin/features/settings/useAdminTeam", () => ({
  useAdminTeam: () => ({ team: [], loading: false, error: null }),
}));

vi.mock("@/shared/api", () => ({
  upsertProfile: vi.fn(),
  getSecurityPolicy: vi.fn().mockResolvedValue({}),
  setSecurityPolicy: vi.fn(),
  getPinPolicy: vi.fn().mockResolvedValue({}),
  setPinPolicy: vi.fn(),
  listAdminSessions: vi.fn().mockResolvedValue([]),
  deleteAdminSession: vi.fn(),
  updateOrganization: vi.fn(),
}));

vi.mock("@/shared/lib/adminSession", () => ({
  getAdminDeviceId: vi.fn(() => "device-001"),
  getAuthMethodLabelFromSession: vi.fn(() => "Email"),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    auth: { updateUser: vi.fn() },
    storage: { from: vi.fn(() => ({ upload: vi.fn(), getPublicUrl: vi.fn(() => ({ data: { publicUrl: "" } })) })) },
    from: vi.fn(() => ({ update: vi.fn(() => ({ eq: vi.fn() })) })),
  },
}));

vi.mock("@/shared/lib/dateUtils", () => ({
  formatDate: vi.fn(() => "Apr 23, 2026"),
}));

vi.mock("@/admin/utils/computeSecuritySignal.js", () => ({
  computeSecuritySignal: vi.fn(() => ({ level: "good", label: "Good" })),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useOutletContext: () => ({ onStartTour: vi.fn() }) };
});

vi.mock("./SecurityPolicyDrawer", () => ({ default: () => null }));
vi.mock("@/admin/shared/PinPolicyDrawer", () => ({ default: () => null }));
vi.mock("./EditProfileDrawer", () => ({ default: () => null }));
vi.mock("./ChangePasswordDrawer", () => ({ default: () => null }));
vi.mock("@/admin/shared/ViewSessionsDrawer", () => ({ default: () => null }));
vi.mock("@/admin/features/settings/SecuritySignalPill", () => ({ default: () => null }));
vi.mock("@/shared/ui/Avatar", () => ({ default: () => null }));
vi.mock("@/admin/shared/AdminTeamCard.jsx", () => ({ default: () => null }));
vi.mock("@/shared/ui/FbAlert", () => ({ default: () => null }));
vi.mock("./SettingsPage.css", () => ({}));

import SettingsPage from "../SettingsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  );
}

describe("SettingsPage", () => {
  qaTest("admin.settings.page.render", () => {
    renderPage();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
