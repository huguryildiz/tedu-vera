import { describe, vi, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/shared/useAdminContext", () => ({
  useAdminContext: () => ({
    organizationId: "org-001",
    selectedPeriodId: "period-001",
    isDemoMode: false,
    incLoading: vi.fn(),
    decLoading: vi.fn(),
    setMessage: vi.fn(),
    bgRefresh: { current: null },
    activeOrganization: { id: "org-001" },
    sortedPeriods: [],
    periodList: [],
    selectedPeriod: { id: "period-001", name: "Spring 2026" },
    matrixJurors: [],
    rawScores: [],
    groups: [],
    criteriaConfig: [],
    summaryData: [],
  }),
}));

vi.mock("@/shared/api", () => ({
  listLockedJurors: vi.fn().mockResolvedValue([]),
  countTodayLockEvents: vi.fn().mockResolvedValue(0),
  unlockJurorPin: vi.fn(),
  listJurorsSummary: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

vi.mock("../PinBlockingPage.css", () => ({}));

vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));

vi.mock("@/auth/shared/SecurityPolicyContext", () => ({
  useSecurityPolicy: () => ({
    policy: { pin_fail_threshold: 3, pin_lockout_minutes: 30 },
    loading: false,
  }),
}));

vi.mock("@/admin/utils/adminUtils", () => ({
  formatTs: vi.fn(() => "—"),
}));

vi.mock("@/shared/ui/FbAlert", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorBadge", () => ({ default: () => null }));
vi.mock("../UnlockAllModal", () => ({ default: () => null }));
vi.mock("../UnlockPinModal", () => ({ default: () => null }));

import PinBlockingPage from "../PinBlockingPage";

describe("PinBlockingPage", () => {
  qaTest("admin.pin.page.render", () => {
    render(
      <MemoryRouter>
        <PinBlockingPage />
      </MemoryRouter>
    );
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});
