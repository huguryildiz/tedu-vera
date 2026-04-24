import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

// ── Stable mock constants — hoisted so vi.mock factories can close over them ─

const { EMPTY, AUTH_VALUE, CTX_VALUE, TOAST_VALUE } = vi.hoisted(() => {
  const EMPTY = Object.freeze([]);
  const AUTH_VALUE = Object.freeze({
    user: Object.freeze({ id: "u1", email: "admin@test.com" }),
    activeOrganization: null,
    isSuper: true,
    refreshMemberships: () => {},
  });
  const CTX_VALUE = Object.freeze({
    organizationId: "org1",
    isDemoMode: false,
    onDirtyChange: () => {},
    bgRefresh: { current: null },
    setMessage: () => {},
    incLoading: () => {},
    decLoading: () => {},
    setPanelError: () => {},
    clearPanelError: () => {},
  });
  const TOAST_VALUE = Object.freeze({ success: () => {}, error: () => {}, info: () => {} });
  return { EMPTY, AUTH_VALUE, CTX_VALUE, TOAST_VALUE };
});

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    from: vi.fn(() => ({ select: vi.fn(() => ({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) })) })),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
  },
}));
vi.mock("@/auth", () => ({ useAuth: () => AUTH_VALUE }));
vi.mock("@/admin/shared/useAdminContext", () => ({ useAdminContext: () => CTX_VALUE }));
vi.mock("@/shared/hooks/useToast", () => ({ useToast: () => TOAST_VALUE }));
vi.mock("@/shared/hooks/useShakeOnError", () => ({ default: () => ({ current: null }) }));
vi.mock("@/shared/hooks/useFocusTrap", () => ({ useFocusTrap: () => {} }));

vi.mock("@/shared/api/admin/maintenance", () => ({
  getMaintenanceConfig: vi.fn().mockResolvedValue(null),
  setMaintenance: vi.fn(),
  cancelMaintenance: vi.fn(),
  getActiveJurorCount: vi.fn().mockResolvedValue(0),
  sendTestMaintenanceEmail: vi.fn(),
}));
vi.mock("@/shared/api/admin/platform", () => ({
  getPlatformSettings: vi.fn().mockResolvedValue({
    platform_name: "VERA",
    support_email: "support@vera.app",
    auto_approve_new_orgs: false,
  }),
  setPlatformSettings: vi.fn(),
}));
vi.mock("@/shared/api/admin/organizations", () => ({
  listOrganizationsPublic: vi.fn().mockResolvedValue(EMPTY),
}));
vi.mock("@/shared/api", () => ({
  listPeriods: vi.fn().mockResolvedValue(EMPTY),
  listJurorsSummary: vi.fn().mockResolvedValue(EMPTY),
  getScores: vi.fn().mockResolvedValue(EMPTY),
  getProjectSummary: vi.fn().mockResolvedValue(EMPTY),
  logExportInitiated: vi.fn().mockResolvedValue(undefined),
  adminListProjects: vi.fn().mockResolvedValue(EMPTY),
}));
vi.mock("@/admin/utils/exportXLSX", () => ({
  exportXLSX: vi.fn(),
  buildExportFilename: vi.fn().mockReturnValue("test.xlsx"),
}));
vi.mock("@/shared/api/core/invokeEdgeFunction", () => ({
  invokeEdgeFunction: vi.fn().mockResolvedValue({ data: null, error: null }),
}));
vi.mock("@/admin/shared/ManageBackupsDrawer", () => ({ default: () => null }));
vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => <span>{children}</span>,
}));
vi.mock("recharts", () => ({
  AreaChart: () => null,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <>{children}</>,
}));
vi.mock("@/shared/lib/dateUtils", () => ({
  formatDate: () => "2026-01-01",
  formatTime: () => "10:00",
}));

import {
  GlobalSettingsDrawer,
  ExportBackupDrawer,
  MaintenanceDrawer,
  SystemHealthDrawer,
} from "../GovernanceDrawers";

const onClose = vi.fn();

describe("GovernanceDrawers", () => {
  qaTest("coverage.governance.global-settings-renders", () => {
    render(<GlobalSettingsDrawer open={false} onClose={onClose} />);
    expect(screen.getByText("Global Settings")).toBeInTheDocument();
  });

  qaTest("coverage.governance.export-backup-renders", () => {
    render(<ExportBackupDrawer open={false} onClose={onClose} />);
    expect(screen.getByText("Export & Backup")).toBeInTheDocument();
  });

  qaTest("coverage.governance.maintenance-renders", () => {
    render(<MaintenanceDrawer open={false} onClose={onClose} />);
    expect(screen.getByText("Maintenance Mode")).toBeInTheDocument();
  });

  qaTest("coverage.governance.system-health-renders", () => {
    render(<SystemHealthDrawer open={false} onClose={onClose} />);
    expect(screen.getByText("System Health")).toBeInTheDocument();
  });

  qaTest("coverage.governance.maintenance-mode-toggle", () => {
    render(<MaintenanceDrawer open={false} onClose={onClose} />);
    expect(screen.getByText("Schedule Maintenance")).toBeInTheDocument();
  });
});
