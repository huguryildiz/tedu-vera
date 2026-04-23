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
    selectedPeriod: { id: "period-001", name: "Spring 2026", status: "active" },
    matrixJurors: [],
    rawScores: [],
    groups: [],
    criteriaConfig: [],
    summaryData: [],
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

vi.mock("qr-code-styling", () => ({
  default: vi.fn().mockImplementation(() => ({
    append: vi.fn(),
    download: vi.fn(),
    update: vi.fn(),
  })),
}));

vi.mock("@/assets/vera_logo.png", () => ({ default: "logo.png" }));

vi.mock("@/shared/api", () => ({
  generateEntryToken: vi.fn(),
  publishPeriod: vi.fn(),
  revokeEntryToken: vi.fn(),
  getEntryTokenStatus: vi.fn().mockResolvedValue({ data: null, error: null }),
  getEntryTokenHistory: vi.fn().mockResolvedValue({ data: [], error: null }),
  getActiveEntryTokenPlain: vi.fn().mockResolvedValue({ data: null, error: null }),
  sendEntryTokenEmail: vi.fn(),
  supabase: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } },
}));

vi.mock("@/shared/storage/adminStorage", () => ({
  getRawToken: vi.fn(() => null),
  setRawToken: vi.fn(),
  clearRawToken: vi.fn(),
}));

vi.mock("@/shared/lib/dateUtils", () => ({
  formatDateTime: vi.fn(() => ""),
  formatDate: vi.fn(() => ""),
}));

vi.mock("@/shared/ui/PremiumTooltip", () => ({ default: () => null }));
vi.mock("@/shared/ui/FbAlert", () => ({ default: () => null }));
vi.mock("@/shared/ui/Modal", () => ({ default: () => null }));
vi.mock("@/admin/shared/JuryRevokeConfirmDialog", () => ({ default: () => null }));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({ default: ({ children }) => children }));
vi.mock("@/shared/ui/InlineError", () => ({ default: () => null }));
vi.mock("@/shared/hooks/useCardSelection", () => ({
  default: () => ({ selectedId: null, select: vi.fn(), clear: vi.fn() }),
}));
vi.mock("@/auth/shared/lockedActions", () => ({
  LOCK_TOOLTIP_GRACE: "",
  LOCK_TOOLTIP_EXPIRED: "",
}));

import EntryControlPage from "../EntryControlPage";

describe("EntryControlPage", () => {
  qaTest("admin.entry.page.render", () => {
    render(
      <MemoryRouter>
        <EntryControlPage />
      </MemoryRouter>
    );
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});
