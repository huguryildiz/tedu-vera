import { describe, vi, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

// Mock API layer (boundary layer)
const mockListJurorsSummary = vi.fn();
const mockGetScores = vi.fn();
const mockGetPeriodMaxScore = vi.fn();
const mockCreateJuror = vi.fn();
const mockUpdateJuror = vi.fn();
const mockDeleteJuror = vi.fn();
const mockResetJurorPin = vi.fn();
const mockSetJurorEditMode = vi.fn();
const mockForceCloseJurorEditMode = vi.fn();
const mockNotifyJuror = vi.fn();
const mockLogExportInitiated = vi.fn();
const mockSendJurorPinEmail = vi.fn();
const mockGetActiveEntryTokenPlain = vi.fn();

vi.mock("@/shared/api", () => ({
  listJurorsSummary: (...a) => mockListJurorsSummary(...a),
  getScores: (...a) => mockGetScores(...a),
  getPeriodMaxScore: (...a) => mockGetPeriodMaxScore(...a),
  createJuror: (...a) => mockCreateJuror(...a),
  updateJuror: (...a) => mockUpdateJuror(...a),
  deleteJuror: (...a) => mockDeleteJuror(...a),
  resetJurorPin: (...a) => mockResetJurorPin(...a),
  setJurorEditMode: (...a) => mockSetJurorEditMode(...a),
  forceCloseJurorEditMode: (...a) => mockForceCloseJurorEditMode(...a),
  notifyJuror: (...a) => mockNotifyJuror(...a),
  logExportInitiated: (...a) => mockLogExportInitiated(...a),
  sendJurorPinEmail: (...a) => mockSendJurorPinEmail(...a),
  getActiveEntryTokenPlain: (...a) => mockGetActiveEntryTokenPlain(...a),
}));

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    organizationId: "org-001",
    selectedPeriodId: "period-001",
    isDemoMode: false,
    onDirtyChange: vi.fn(),
    onCurrentPeriodChange: vi.fn(),
    onViewReviews: vi.fn(),
    onNavigate: vi.fn(),
    bgRefresh: { current: null },
    setMessage: vi.fn(),
    incLoading: vi.fn(),
    decLoading: vi.fn(),
    setPanelError: vi.fn(),
    clearPanelError: vi.fn(),
    setEvalLockError: vi.fn(),
  }),
}));

vi.mock("@/auth", () => ({
  useAuth: () => ({
    activeOrganization: { id: "org-001" },
    isEmailVerified: true,
    graceEndsAt: null,
  }),
}));

vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("@/admin/shared/usePageRealtime", () => ({
  usePageRealtime: vi.fn(),
}));

const mockPeriodState = {
  periodList: [],
  viewPeriodId: "period-001",
  viewPeriodLabel: "Spring 2026",
};

vi.mock("@/admin/features/periods/useManagePeriods", () => {
  const loadPeriods = vi.fn().mockResolvedValue(undefined);
  return {
    useManagePeriods: () => ({
      ...mockPeriodState,
      currentPeriodId: null,
      loadPeriods,
      setViewPeriodId: vi.fn(),
    }),
  };
});

vi.mock("@/admin/features/projects/useManageProjects", () => {
  const loadProjects = vi.fn().mockResolvedValue(undefined);
  return {
    useManageProjects: () => ({
      projects: [],
      loadProjects,
    }),
  };
});

vi.mock("../useAdminResponsiveTableMode", () => ({
  useAdminResponsiveTableMode: () => ({
    shouldUseCardLayout: false,
    shouldUseTableLayout: true,
    isPhonePortrait: false,
    isLandscape: true,
    isPortrait: false,
  }),
  getAdminResponsiveTableMode: () => ({
    shouldUseCardLayout: false,
    shouldUseTableLayout: true,
  }),
  ADMIN_PHONE_PORTRAIT_MAX_WIDTH: 768,
  ADMIN_LANDSCAPE_TABLE_MIN_WIDTH: 560,
  ADMIN_LANDSCAPE_COMPACT_MAX_WIDTH: 900,
}));

vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));

vi.mock("../AddJurorDrawer", () => ({ default: () => null }));
vi.mock("../EditJurorDrawer", () => ({ default: () => null }));
vi.mock("../RemoveJurorModal", () => ({ default: () => null }));
vi.mock("../EnableEditingModal", () => ({ default: () => null }));
vi.mock("../JurorScoresDrawer", () => ({ default: () => null }));
vi.mock("@/admin/shared/ImportJurorsModal", () => ({ default: () => null }));
vi.mock("@/admin/shared/ExportPanel", () => ({ default: () => null }));
vi.mock("@/admin/shared/PinResultModal", () => ({ default: () => null }));
vi.mock("@/admin/shared/ResetPinModal", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorBadge", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorStatusPill", () => ({ default: () => null }));
vi.mock("@/shared/ui/Pagination", () => ({ default: () => null }));
vi.mock("@/shared/ui/FloatingMenu", () => ({ default: () => null }));
vi.mock("@/shared/ui/PremiumTooltip", () => ({ default: ({ children }) => <>{children}</> }));
vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));
vi.mock("@/shared/ui/FbAlert", () => ({ default: () => null }));
vi.mock("@/shared/ui/FilterButton", () => ({ FilterButton: () => null }));
vi.mock("@/admin/utils/csvParser", () => ({ parseJurorsCsv: vi.fn() }));
vi.mock("@/admin/utils/downloadTable", () => ({
  downloadTable: vi.fn(),
  generateTableBlob: vi.fn(),
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
  LOCKED_ACTIONS: {},
}));

import JurorsPage from "../JurorsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <JurorsPage />
    </MemoryRouter>
  );
}

describe("JurorsPage", () => {
  beforeEach(() => {
    mockPeriodState.periodList = [];
    mockPeriodState.viewPeriodId = "period-001";
    mockPeriodState.viewPeriodLabel = "Spring 2026";

    // Initialize API mocks with default resolved values
    mockListJurorsSummary.mockResolvedValue([]);
    mockGetScores.mockResolvedValue([]);
    mockGetPeriodMaxScore.mockResolvedValue({ data: 100 });
    mockCreateJuror.mockResolvedValue({});
    mockUpdateJuror.mockResolvedValue({});
    mockDeleteJuror.mockResolvedValue({});
    mockResetJurorPin.mockResolvedValue({});
    mockSetJurorEditMode.mockResolvedValue({});
    mockForceCloseJurorEditMode.mockResolvedValue({});
    mockNotifyJuror.mockResolvedValue({});
    mockLogExportInitiated.mockResolvedValue({});
    mockSendJurorPinEmail.mockResolvedValue({});
    mockGetActiveEntryTokenPlain.mockResolvedValue({});
  });

  qaTest("admin.jurors.page.render", () => {
    renderPage();
    expect(screen.getAllByText("Jurors").length).toBeGreaterThan(0);
  });

  qaTest("admin.jurors.page.kpi-labels", () => {
    renderPage();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Editing")).toBeInTheDocument();
    expect(screen.getByText("Ready to Submit")).toBeInTheDocument();
    expect(screen.getByText("Not Started")).toBeInTheDocument();
  });

  qaTest("admin.jurors.page.search-input", () => {
    renderPage();
    expect(screen.getByPlaceholderText("Search jurors...")).toBeInTheDocument();
  });

  qaTest("admin.jurors.page.add-btn", () => {
    renderPage();
    expect(screen.getByTestId("jurors-create-btn")).toBeInTheDocument();
  });

  qaTest("admin.jurors.page.table-headers", () => {
    renderPage();
    expect(screen.getByText(/Juror Name/)).toBeInTheDocument();
    expect(screen.getByText(/Juror Progress/)).toBeInTheDocument();
  });

  qaTest("admin.jurors.page.no-period-state", async () => {
    mockPeriodState.viewPeriodId = null;
    mockPeriodState.periodList = [{ id: "p1", name: "Spring 2026" }];
    renderPage();
    await waitFor(() =>
      expect(
        screen.getByText("Select an evaluation period above to manage jurors.")
      ).toBeInTheDocument()
    );
  });
});
