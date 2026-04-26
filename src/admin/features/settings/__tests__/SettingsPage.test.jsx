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

const { EMPTY_SESSIONS } = vi.hoisted(() => ({
  EMPTY_SESSIONS: Object.freeze([]),
}));

vi.mock("@/shared/api", () => ({
  upsertProfile: vi.fn(),
  getSecurityPolicy: vi.fn().mockResolvedValue({
    googleOAuth: true,
    emailPassword: true,
    rememberMe: true,
    qrTtl: "24h",
    maxPinAttempts: 5,
    pinLockCooldown: "5m",
    ccOnPinReset: false,
    ccOnScoreEdit: false,
    ccOnTenantApplication: false,
    ccOnMaintenance: false,
    ccOnPasswordChanged: false,
  }),
  setSecurityPolicy: vi.fn(),
  getPinPolicy: vi.fn().mockResolvedValue({
    maxPinAttempts: 5,
    pinLockCooldown: "5m",
    qrTtl: "24h",
  }),
  setPinPolicy: vi.fn(),
  listAdminSessions: vi.fn().mockResolvedValue(EMPTY_SESSIONS),
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
  qaTest("admin.settings.page.mounts-showing-settings-heading", () => {
    renderPage();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
