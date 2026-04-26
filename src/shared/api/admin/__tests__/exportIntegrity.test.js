// src/shared/api/admin/__tests__/exportIntegrity.test.js
// Tests for logExportInitiated (action validation, edge fn routing, error propagation)
// and fullExport (result shape, DB error paths).
// invokeEdgeFunction is mocked at module level; supabase.from mocked for fullExport.

import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

const { mockInvokeEdgeFunction, mockFrom } = vi.hoisted(() => ({
  mockInvokeEdgeFunction: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: { from: mockFrom },
}));

vi.mock("@/shared/api/core/invokeEdgeFunction", () => ({
  invokeEdgeFunction: mockInvokeEdgeFunction,
}));

import { logExportInitiated, fullExport } from "../export.js";

// ─── helpers ────────────────────────────────────────────────────────────────

// Build a fluent Supabase chain where either .eq(), .in(), or .limit() is the
// terminal call that resolves. Providing finalMethod="eq" overrides .eq() to
// return a Promise instead of returning `this`.
function buildChain(resolveValue, finalMethod) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolveValue),
    in: vi.fn().mockResolvedValue(resolveValue),
  };
  if (finalMethod === "eq") {
    chain.eq = vi.fn().mockResolvedValue(resolveValue);
  }
  return chain;
}

function mockFullExport({
  periodsData = [],
  jurorsData = [],
  auditData = [],
  projData = [],
  sheetData = [],
  periodsError = null,
  jurorsError = null,
} = {}) {
  mockFrom.mockImplementation((table) => {
    if (table === "periods")
      return buildChain({ data: periodsData, error: periodsError }, "eq");
    if (table === "jurors")
      return buildChain({ data: jurorsData, error: jurorsError }, "eq");
    if (table === "audit_logs")
      return buildChain({ data: auditData, error: null });
    if (table === "projects")
      return buildChain({ data: projData, error: null });
    // score_sheets
    return buildChain({ data: sheetData, error: null });
  });
}

// ─── logExportInitiated ──────────────────────────────────────────────────────

describe("admin/export — logExportInitiated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvokeEdgeFunction.mockResolvedValue({ data: { ok: true }, error: null });
  });

  qaTest("export.integrity.01", async () => {
    await expect(logExportInitiated({ action: "export.scores" })).resolves.not.toThrow();
    expect(mockInvokeEdgeFunction).toHaveBeenCalledWith("log-export-event", {
      body: {
        action: "export.scores",
        details: {},
      },
    });
  });

  qaTest("export.integrity.02", async () => {
    await expect(logExportInitiated({ action: "scores" })).rejects.toThrow(
      "logExportInitiated: action must start with 'export.'"
    );
    expect(mockInvokeEdgeFunction).not.toHaveBeenCalled();
  });

  qaTest("export.integrity.03", async () => {
    await expect(logExportInitiated({ action: null })).rejects.toThrow(
      "logExportInitiated: action must start with 'export.'"
    );
    expect(mockInvokeEdgeFunction).not.toHaveBeenCalled();
  });

  qaTest("export.integrity.04", async () => {
    // Empty string is falsy — same validation branch as null
    await expect(logExportInitiated({ action: "" })).rejects.toThrow(
      "logExportInitiated: action must start with 'export.'"
    );
    expect(mockInvokeEdgeFunction).not.toHaveBeenCalled();
  });

  qaTest("export.integrity.05", async () => {
    const networkErr = new Error("network failure");
    mockInvokeEdgeFunction.mockResolvedValue({ data: null, error: networkErr });
    await expect(logExportInitiated({ action: "export.scores" })).rejects.toThrow(
      "network failure"
    );
  });

  qaTest("export.integrity.06", async () => {
    mockInvokeEdgeFunction.mockResolvedValue({ data: { error: "forbidden" }, error: null });
    await expect(logExportInitiated({ action: "export.scores" })).rejects.toThrow(
      "logExportInitiated: forbidden"
    );
  });

  qaTest("export.integrity.07", async () => {
    await logExportInitiated({
      action: "export.audit",
      organizationId: "org-1",
      resourceType: "period",
      resourceId: "p-1",
      details: { format: "csv" },
    });
    expect(mockInvokeEdgeFunction).toHaveBeenCalledWith("log-export-event", {
      body: {
        action: "export.audit",
        organizationId: "org-1",
        resourceType: "period",
        resourceId: "p-1",
        details: { format: "csv" },
      },
    });
  });
});

// ─── fullExport ──────────────────────────────────────────────────────────────

describe("admin/export — fullExport", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("export.integrity.08", async () => {
    mockFullExport({
      periodsData: [{ id: "p-1", organization_id: "org-1" }],
      jurorsData: [{ id: "j-1" }],
      auditData: [{ id: "a-1" }],
      projData: [{ id: "proj-1" }],
      sheetData: [],
    });
    const result = await fullExport("org-1");
    expect(result).toMatchObject({
      periods: [{ id: "p-1" }],
      jurors: [{ id: "j-1" }],
      projects: [{ id: "proj-1" }],
      scores: [],
      audit_logs: [{ id: "a-1" }],
    });
  });

  qaTest("export.integrity.09", async () => {
    mockFullExport({ periodsError: { message: "permission denied", code: "42501" } });
    await expect(fullExport("org-1")).rejects.toMatchObject({ message: "permission denied" });
  });

  qaTest("export.integrity.10", async () => {
    mockFullExport({ jurorsError: { message: "relation does not exist", code: "42P01" } });
    await expect(fullExport("org-1")).rejects.toMatchObject({
      message: "relation does not exist",
    });
  });
});
