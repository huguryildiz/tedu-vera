import { describe, vi, expect } from "vitest";
import { render } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/utils/auditUtils", () => ({
  getActorInfo: vi.fn(() => ({ name: "Admin Test", avatar: "" })),
  formatActionLabel: vi.fn(() => "Updated period"),
  formatAuditTimestamp: vi.fn(() => "Apr 23, 2026"),
  formatSentence: vi.fn(() => ({ verb: "Admin updated a period", resource: null })),
  formatDiffChips: vi.fn(() => []),
  CATEGORY_META: { periods: { label: "Periods", icon: null } },
  SEVERITY_META: { info: { label: "Info", color: "blue" } },
}));

import AuditEventDrawer from "../AuditEventDrawer";

const sampleLog = {
  id: "log-001",
  action: "period_updated",
  details: { before: {}, after: {} },
  severity: "info",
  category: "periods",
  ip_address: "127.0.0.1",
  user_agent: "TestAgent/1.0",
  session_id: "sess-001",
  created_at: "2026-04-23T10:00:00Z",
};

describe("AuditEventDrawer", () => {
  qaTest("admin.audit.drawer.render", () => {
    render(<AuditEventDrawer log={sampleLog} onClose={vi.fn()} />);
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});
