import { describe, vi, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/api", () => ({
  listAuditLogs: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
  logExportInitiated: vi.fn(),
}));

vi.mock("@/admin/utils/auditUtils", () => ({
  AUDIT_PAGE_SIZE: 50,
  formatAuditTimestamp: vi.fn(() => ""),
  getAuditDateRangeError: vi.fn(() => null),
  buildAuditParams: vi.fn(() => ({})),
}));

vi.mock("@/admin/utils/auditColumns", () => ({
  AUDIT_TABLE_COLUMNS: [],
}));

vi.mock("@/admin/utils/downloadTable", () => ({
  downloadTable: vi.fn(),
}));

vi.mock("@/auth", () => ({
  useAuth: () => ({
    activeOrganization: { id: "org-001" },
  }),
}));

import { useAuditLogFilters } from "../useAuditLogFilters";

describe("useAuditLogFilters", () => {
  qaTest("admin.audit.filter.active", () => {
    const { result } = renderHook(() =>
      useAuditLogFilters({
        organizationId: "org-001",
        isMobile: false,
        setMessage: vi.fn(),
      })
    );
    expect(result.current.hasAuditFilters).toBe(false);
    expect(Array.isArray(result.current.auditLogs)).toBe(true);
    expect(typeof result.current.handleAuditRefresh).toBe("function");
  });
});
