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

vi.mock("../useManagePeriods", () => {
  // Hoist fn refs outside factory so useEffect([periods.loadPeriods]) sees a
  // stable reference on every render — prevents infinite re-render loop.
  const loadPeriods = vi.fn().mockResolvedValue(undefined);
  const handleCreatePeriod = vi.fn();
  const handleUpdatePeriod = vi.fn();
  const handleDeletePeriod = vi.fn();
  const handleSaveSettings = vi.fn();
  const commitDraft = vi.fn();
  const discardDraft = vi.fn();
  const updateDraft = vi.fn();
  return {
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
      loadPeriods,
      handleCreatePeriod,
      handleUpdatePeriod,
      handleDeletePeriod,
      handleSaveSettings,
      commitDraft,
      discardDraft,
      updateDraft,
    }),
  };
});

vi.mock("../AddEditPeriodDrawer", () => ({ default: () => null }));
vi.mock("../ClosePeriodModal", () => ({ default: () => null }));
vi.mock("../DeletePeriodModal", () => ({ default: () => null }));
vi.mock("../PublishPeriodModal", () => ({ default: () => null }));
vi.mock("../RevertToDraftModal", () => ({ default: () => null }));
vi.mock("../RequestRevertModal", () => ({ default: () => null }));
vi.mock("../CompletionStrip", () => ({ default: () => null }));
vi.mock("../PeriodCriteriaDrawer", () => ({ default: () => null }));
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
vi.mock("../styles/index.css", () => ({}));
vi.mock("@/admin/features/setup-wizard/styles/index.css", () => ({}));
vi.mock("../components/PeriodsTable", () => ({
  default: ({ rows }) => (
    <table>
      <thead><tr><th>Status</th><th>Date Range</th></tr></thead>
      <tbody>{rows && rows.length === 0 && <tr><td>No evaluation periods yet</td></tr>}</tbody>
    </table>
  ),
}));
vi.mock("../components/PeriodsFilterPanel", () => ({ default: () => null }));
vi.mock("../components/LifecycleBar", () => ({ default: () => null }));
vi.mock("../components/LifecycleGuide", () => ({ default: () => null }));
vi.mock("@/shared/ui/FilterButton", () => ({ FilterButton: () => null }));
vi.mock("@/shared/ui/FbAlert", () => ({ default: () => null }));

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

  qaTest("admin.periods.page.page-desc", () => {
    renderPage();
    expect(
      screen.getByText("Manage evaluation periods, active sessions, and locked historical records.")
    ).toBeInTheDocument();
  });

  qaTest("admin.periods.page.add-btn", () => {
    renderPage();
    expect(screen.getByTestId("periods-add-btn")).toBeInTheDocument();
  });

  qaTest("admin.periods.page.subtitle", () => {
    renderPage();
    expect(screen.getByText("All Evaluation Periods")).toBeInTheDocument();
  });

  qaTest("admin.periods.page.empty-list", () => {
    renderPage();
    expect(screen.getByText("No evaluation periods yet")).toBeInTheDocument();
  });

  qaTest("admin.periods.page.column-headers", () => {
    renderPage();
    expect(screen.getByText(/Status/)).toBeInTheDocument();
    expect(screen.getByText(/Date Range/)).toBeInTheDocument();
  });
});
