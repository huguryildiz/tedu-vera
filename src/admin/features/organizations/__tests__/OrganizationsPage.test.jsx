// OrganizationsPage — minimal smoke render only.
//
// useManageOrganizations runs for real (mocked at @/shared/api boundary).
// supabaseClient is mocked to prevent live channel subscriptions.
// Component mocks null every sub-component; only the "Platform Control"
// heading proves the page tree compiled and mounted correctly.

import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    organizationId: null,
    isDemoMode: false,
    onDirtyChange: vi.fn(),
    bgRefresh: { current: null },
    setMessage: vi.fn(),
    incLoading: vi.fn(),
    decLoading: vi.fn(),
    setPanelError: vi.fn(),
    clearPanelError: vi.fn(),
  }),
}));

vi.mock("@/auth", () => ({
  useAuth: () => ({
    user: { id: "user-001", email: "super@vera.dev" },
    isSuper: true,
    loading: false,
    activeOrganization: null,
    refreshMemberships: vi.fn(),
    isEmailVerified: true,
    graceEndsAt: null,
  }),
}));

vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/shared/api", () => ({
  listOrganizations: vi.fn().mockResolvedValue([]),
  createOrganization: vi.fn(),
  updateOrganization: vi.fn(),
  updateMemberAdmin: vi.fn(),
  deleteMemberHard: vi.fn(),
  inviteOrgAdmin: vi.fn(),
  cancelOrgAdminInvite: vi.fn(),
  approveJoinRequest: vi.fn(),
  rejectJoinRequest: vi.fn(),
  approveApplication: vi.fn(),
  rejectApplication: vi.fn(),
  listUnlockRequests: vi.fn().mockResolvedValue({ data: [] }),
  resolveUnlockRequest: vi.fn(),
  deleteOrganization: vi.fn(),
  logExportInitiated: vi.fn(),
}));

vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));

vi.mock("../GovernanceDrawers", () => ({
  GlobalSettingsDrawer: () => null,
  ExportBackupDrawer: () => null,
  MaintenanceDrawer: () => null,
  SystemHealthDrawer: () => null,
}));
vi.mock("../components/OrgTable", () => ({ default: () => <table /> }));
vi.mock("../components/UnlockRequestsPanel", () => ({ default: () => null }));
vi.mock("../components/PendingApplicationsPanel", () => ({ default: () => null }));
vi.mock("../components/OrgDrawers", () => ({
  CreateOrgDrawer: () => null,
  EditOrgDrawer: () => null,
  ViewOrgDrawer: () => null,
  ManageAdminsDrawer: () => null,
}));
vi.mock("../components/OrgModals", () => ({
  ToggleStatusModal: () => null,
  DeleteOrgModal: () => null,
  ResolveUnlockModal: () => null,
}));
vi.mock("@/shared/ui/Pagination", () => ({ default: () => null }));
vi.mock("@/shared/ui/FloatingMenu", () => ({ default: () => null }));
vi.mock("@/shared/ui/PremiumTooltip", () => ({ default: () => null }));
vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));
vi.mock("@/shared/ui/Avatar", () => ({ default: () => null }));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => <span>{children}</span>,
}));
vi.mock("@/admin/utils/jurorIdentity", () => ({
  jurorInitials: (n) => n?.[0] ?? "?",
  jurorAvatarBg: () => "#000",
  jurorAvatarFg: () => "#fff",
}));
vi.mock("@/shared/lib/dateUtils", () => ({ formatDateTime: () => "2026-01-01" }));
vi.mock("@/auth/shared/lockedActions", () => ({
  LOCK_TOOLTIP_GRACE: "",
  LOCK_TOOLTIP_EXPIRED: "",
}));
vi.mock("../OrganizationsPage.css", () => ({}));

import OrganizationsPage from "../OrganizationsPage";

describe("OrganizationsPage", () => {
  qaTest("admin.orgs.page.render", () => {
    render(
      <MemoryRouter>
        <OrganizationsPage />
      </MemoryRouter>
    );
    expect(screen.getByText("Platform Control")).toBeInTheDocument();
  });
});
