import { describe, vi, expect, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

beforeAll(() => {
  window.HTMLElement.prototype.scrollTo = vi.fn();
});
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    activeOrganization: { id: "org-001" },
    sortedPeriods: [],
    criteriaConfig: [],
    frameworks: [],
    allJurors: [],
    summaryData: [],
    navigateTo: vi.fn(),
    fetchData: vi.fn().mockResolvedValue(undefined),
    reloadCriteriaAndOutcomes: vi.fn(),
    selectedPeriodId: null,
    setSelectedPeriodId: vi.fn(),
    isDemoMode: false,
  }),
}));

vi.mock("@/auth", () => ({
  useAuth: () => ({
    refreshMemberships: vi.fn(),
    isSuper: false,
  }),
}));

vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("../useSetupWizard", () => ({
  useSetupWizard: () => ({
    currentStep: 1,
    completedSteps: new Set(),
    goToStep: vi.fn(),
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    isStepComplete: vi.fn(() => false),
    completionPercent: 0,
    setupComplete: false,
    wizardData: {},
    setWizardData: vi.fn(),
  }),
}));

vi.mock("@/shared/api", () => ({
  createPeriod: vi.fn(),
  savePeriodCriteria: vi.fn(),
  createJuror: vi.fn(),
  createProject: vi.fn(),
  generateEntryToken: vi.fn(),
  listPeriodOutcomes: vi.fn().mockResolvedValue([]),
  listPeriodCriteriaForMapping: vi.fn().mockResolvedValue([]),
  upsertPeriodCriterionOutcomeMap: vi.fn(),
  assignFrameworkToPeriod: vi.fn(),
  getVeraStandardCriteria: vi.fn().mockResolvedValue([]),
  setPeriodCriteriaName: vi.fn(),
  checkPeriodReadiness: vi.fn(),
  publishPeriod: vi.fn(),
  markSetupComplete: vi.fn(),
  getSecurityPolicy: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/admin/shared/ImportJurorsModal", () => ({ default: () => null }));
vi.mock("@/admin/shared/ImportCsvModal", () => ({ default: () => null }));
vi.mock("@/admin/utils/csvParser", () => ({
  parseJurorsCsv: vi.fn(),
  parseProjectsCsv: vi.fn(),
}));
vi.mock("@/admin/utils/auditUtils", () => ({ normalizeStudentNames: vi.fn((s) => s) }));
vi.mock("@/shared/ui/avatarColor", () => ({
  avatarGradient: vi.fn(() => "#6366f1"),
  initials: vi.fn(() => "DA"),
}));
vi.mock("@/shared/storage/keys", () => ({ KEYS: {} }));
vi.mock("@/shared/constants", () => ({ CRITERIA: [] }));
vi.mock("qr-code-styling", () => ({ default: class { append() {} update() {} } }));
vi.mock("@/assets/vera_logo.png", () => ({ default: "" }));
vi.mock("@/shared/ui/FbAlert", () => ({ default: () => null }));
vi.mock("./styles/index.css", () => ({}));

import SetupWizardPage from "../SetupWizardPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <SetupWizardPage />
    </MemoryRouter>
  );
}

describe("SetupWizardPage", () => {
  qaTest("admin.setup.page.render", () => {
    renderPage();
    expect(screen.getByText("Set up your evaluation")).toBeInTheDocument();
  });
});
