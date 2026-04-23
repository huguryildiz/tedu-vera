import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

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
    activeOrganization: null,
    refreshMemberships: vi.fn(),
    isEmailVerified: true,
    graceEndsAt: null,
  }),
}));

vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/admin/shared/useManageOrganizations", () => ({
  useManageOrganizations: () => ({
    orgList: [],
    filteredOrgs: [],
    error: "",
    search: "",
    setSearch: vi.fn(),
    showCreate: false,
    createForm: {},
    setCreateForm: vi.fn(),
    createError: "",
    createFieldErrors: {},
    openCreate: vi.fn(),
    closeCreate: vi.fn(),
    handleCreateOrg: vi.fn(),
    showEdit: false,
    editForm: {},
    setEditForm: vi.fn(),
    editError: "",
    openEdit: vi.fn(),
    closeEdit: vi.fn(),
    handleUpdateOrg: vi.fn(),
    handleUpdateTenantAdmin: vi.fn(),
    handleDeleteTenantAdmin: vi.fn(),
    isDirty: false,
    loadOrgs: vi.fn().mockResolvedValue(undefined),
    inviteLoading: false,
    handleInviteAdmin: vi.fn(),
    handleCancelInvite: vi.fn(),
    joinRequestLoading: false,
    handleApproveJoinRequest: vi.fn(),
    handleRejectJoinRequest: vi.fn(),
  }),
}));

vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));

vi.mock("../CreateOrganizationDrawer", () => ({ default: () => null }));
vi.mock("../GovernanceDrawers", () => ({
  GlobalSettingsDrawer: () => null,
  ExportBackupDrawer: () => null,
  MaintenanceDrawer: () => null,
  SystemHealthDrawer: () => null,
}));
vi.mock("../TenantSwitcher", () => ({ default: () => null }));
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
vi.mock("@/shared/api", () => ({
  updateOrganization: vi.fn(),
  listUnlockRequests: vi.fn().mockResolvedValue({ data: [] }),
  resolveUnlockRequest: vi.fn(),
  deleteOrganization: vi.fn(),
  logExportInitiated: vi.fn(),
}));
vi.mock("@/shared/lib/dateUtils", () => ({ formatDateTime: () => "2026-01-01" }));
vi.mock("@/auth/shared/lockedActions", () => ({
  LOCK_TOOLTIP_GRACE: "",
  LOCK_TOOLTIP_EXPIRED: "",
}));
vi.mock("./OrganizationsPage.css", () => ({}));

import OrganizationsPage from "../OrganizationsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <OrganizationsPage />
    </MemoryRouter>
  );
}

describe("OrganizationsPage", () => {
  qaTest("admin.orgs.page.render", () => {
    renderPage();
    expect(screen.getByText("Platform Control")).toBeInTheDocument();
  });
});
