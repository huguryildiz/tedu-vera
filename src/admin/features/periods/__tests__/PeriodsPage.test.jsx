import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    organizationId: "org-001",
    selectedPeriodId: null,
    isDemoMode: false,
    onDirtyChange: vi.fn(),
    onCurrentPeriodChange: vi.fn(),
    bgRefresh: { current: null },
    setMessage: vi.fn(),
    incLoading: vi.fn(),
    decLoading: vi.fn(),
    setPanelError: vi.fn(),
    clearPanelError: vi.fn(),
    setEvalLockError: vi.fn(),
    evalLockError: "",
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

vi.mock("./useManagePeriods", () => ({
  useManagePeriods: () => ({
    periodList: [],
    currentPeriodId: null,
    viewPeriodId: null,
    viewPeriodLabel: "—",
    viewPeriod: null,
    currentPeriod: null,
    settings: { evalLockActive: false },
    evalLockError: "",
    evalLockConfirmOpen: false,
    criteriaConfig: null,
    outcomeConfig: null,
    draftCriteria: [],
    savedCriteria: [],
    isDraftDirty: false,
    draftTotal: 0,
    canSaveDraft: false,
    loadPeriods: vi.fn().mockResolvedValue(undefined),
    handleCreatePeriod: vi.fn(),
    handleUpdatePeriod: vi.fn(),
    handleDeletePeriod: vi.fn(),
    handleSaveSettings: vi.fn(),
    commitDraft: vi.fn(),
    discardDraft: vi.fn(),
    updateDraft: vi.fn(),
  }),
}));

vi.mock("./AddEditPeriodDrawer", () => ({ default: () => null }));
vi.mock("./ClosePeriodModal", () => ({ default: () => null }));
vi.mock("./DeletePeriodModal", () => ({ default: () => null }));
vi.mock("./PublishPeriodModal", () => ({ default: () => null }));
vi.mock("./RevertToDraftModal", () => ({ default: () => null }));
vi.mock("./RequestRevertModal", () => ({ default: () => null }));
vi.mock("./CompletionStrip", () => ({ default: () => null }));
vi.mock("./PeriodCriteriaDrawer", () => ({ default: () => null }));
vi.mock("@/admin/shared/ExportPanel", () => ({ default: () => null }));
vi.mock("@/shared/ui/Pagination", () => ({ default: () => null }));
vi.mock("@/shared/ui/FloatingMenu", () => ({ default: () => null }));
vi.mock("@/shared/ui/PremiumTooltip", () => ({ default: () => null }));
vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));
vi.mock("@/shared/hooks/useFloating", () => ({ useFloating: () => ({ x: 0, y: 0, refs: {} }) }));
vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));
vi.mock("@/admin/utils/downloadTable", () => ({
  downloadTable: vi.fn(),
  generateTableBlob: vi.fn(),
}));
vi.mock("@/shared/lib/dateUtils", () => ({ formatDateTime: () => "2026-01-01" }));
vi.mock("@/shared/api", () => ({
  logExportInitiated: vi.fn(),
  setEvalLock: vi.fn(),
  getPeriodCriteriaSnapshot: vi.fn(),
  listPeriodStats: vi.fn().mockResolvedValue({ data: [] }),
}));
vi.mock("@/shared/criteria/criteriaHelpers", () => ({ getActiveCriteria: () => [] }));
vi.mock("@/auth/shared/lockedActions", () => ({
  LOCK_TOOLTIP_GRACE: "",
  LOCK_TOOLTIP_EXPIRED: "",
}));
vi.mock("./styles/index.css", () => ({}));
vi.mock("@/admin/features/setup-wizard/styles/index.css", () => ({}));

import PeriodsPage from "../PeriodsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <PeriodsPage />
    </MemoryRouter>
  );
}

describe("PeriodsPage", () => {
  qaTest("admin.periods.page.render", () => {
    renderPage();
    expect(screen.getByText("Evaluation Periods")).toBeInTheDocument();
  });
});
