// src/shared/api/edge/__tests__/edgeFunctions.test.js
//
// ⚠️ QUALITY WARNING — This file does NOT test actual edge function code.
// Supabase edge functions run under Deno and are excluded from Vitest.
// The helpers below are re-implementations of logic extracted from
// supabase/functions/*/index.ts and tested HERE as a contract specification.
//
// If the real Deno code drifts from these helpers, tests pass but prod breaks.
// This is intentional coverage-shape documentation, NOT regression protection.
//
// Real Edge Function coverage requires `deno test` against the actual files.
// Tracked in: docs/superpowers/plans/session-d-unit-test-quality-audit/
//             (follow-up: true Deno runner setup)

import { describe, expect } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

// ── Helpers extracted from audit-anomaly-sweep/index.ts ─────────────────────

function anomalyDedupKey(type, anomaly) {
  const discriminator =
    anomaly.ip_address ||
    anomaly.organization_id ||
    "__global__";
  return `${type}:${discriminator}`;
}

function detailsDedupKey(details) {
  const type = details.anomaly_type || "";
  const discriminator =
    details.ip_address ||
    details.organization_id ||
    "__global__";
  return `${type}:${discriminator}`;
}

// Rule logic helpers (extracted from the sweep body)
function applyIpMultiOrgRule(logs) {
  const ipOrgMap = new Map();
  for (const row of logs) {
    if (!row.ip_address || !row.organization_id) continue;
    if (!ipOrgMap.has(row.ip_address)) ipOrgMap.set(row.ip_address, new Set());
    ipOrgMap.get(row.ip_address).add(row.organization_id);
  }
  const anomalies = [];
  for (const [ip, orgs] of ipOrgMap.entries()) {
    if (orgs.size >= 2) {
      anomalies.push({ type: "ip_multi_org", ip_address: ip, org_count: orgs.size });
    }
  }
  return anomalies;
}

function applyPinFloodRule(logs) {
  const pinFloodMap = new Map();
  for (const row of logs) {
    if (row.action !== "juror.pin_locked" && row.action !== "data.juror.pin.locked") continue;
    const org = row.organization_id || "__null__";
    pinFloodMap.set(org, (pinFloodMap.get(org) || 0) + 1);
  }
  const anomalies = [];
  for (const [org, count] of pinFloodMap.entries()) {
    if (count >= 10) {
      anomalies.push({ type: "pin_flood", organization_id: org === "__null__" ? null : org, event_count: count });
    }
  }
  return anomalies;
}

function applyExportBurstRule(logs) {
  const exportBurstMap = new Map();
  for (const row of logs) {
    if (!row.action?.startsWith("export.")) continue;
    const org = row.organization_id || "__null__";
    exportBurstMap.set(org, (exportBurstMap.get(org) || 0) + 1);
  }
  const anomalies = [];
  for (const [org, count] of exportBurstMap.entries()) {
    if (count >= 5) {
      anomalies.push({ type: "export_burst", organization_id: org === "__null__" ? null : org, event_count: count });
    }
  }
  return anomalies;
}

// ── Helpers extracted from request-pin-reset/index.ts ───────────────────────

function escapeHtml(input) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

// ── Helpers extracted from log-export-event/index.ts ────────────────────────

function readBearerToken(authHeader) {
  return (authHeader || "").replace(/^Bearer\s+/i, "").trim();
}

function toNullableNumber(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeExportDetails(raw) {
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const filtersRaw = input.filters;
  const filters =
    filtersRaw && typeof filtersRaw === "object" && !Array.isArray(filtersRaw)
      ? filtersRaw
      : {};
  const periodName =
    typeof input.period_name === "string"
      ? input.period_name
      : typeof input.periodName === "string"
      ? input.periodName
      : null;
  return {
    format: String(input.format || "unknown").toLowerCase(),
    row_count: toNullableNumber(input.row_count ?? input.rowCount),
    period_name: periodName,
    project_count: toNullableNumber(input.project_count ?? input.projectCount),
    juror_count: toNullableNumber(input.juror_count ?? input.jurorCount),
    filters,
  };
}

// ── audit-anomaly-sweep: dedup key tests ────────────────────────────────────

describe("edge / audit-anomaly-sweep — anomalyDedupKey", () => {
  qaTest("edge.contract.01", () => {
    expect(anomalyDedupKey("ip_multi_org", { ip_address: "1.2.3.4" })).toBe(
      "ip_multi_org:1.2.3.4"
    );
  });

  qaTest("edge.contract.02", () => {
    expect(anomalyDedupKey("pin_flood", { organization_id: "org-1" })).toBe(
      "pin_flood:org-1"
    );
  });

  qaTest("edge.contract.03", () => {
    expect(anomalyDedupKey("org_suspended", {})).toBe("org_suspended:__global__");
  });
});

describe("edge / audit-anomaly-sweep — detailsDedupKey", () => {
  qaTest("edge.contract.04", () => {
    const details = { anomaly_type: "ip_multi_org", ip_address: "1.2.3.4" };
    const written = anomalyDedupKey("ip_multi_org", { ip_address: "1.2.3.4" });
    expect(detailsDedupKey(details)).toBe(written);
  });

  qaTest("edge.contract.05", () => {
    expect(detailsDedupKey({ anomaly_type: "pin_flood", organization_id: "org-2" })).toBe(
      "pin_flood:org-2"
    );
  });

  qaTest("edge.contract.06", () => {
    expect(() => detailsDedupKey({})).not.toThrow();
    expect(detailsDedupKey({})).toBe(":__global__");
  });
});

// ── audit-anomaly-sweep: rule logic tests ───────────────────────────────────

describe("edge / audit-anomaly-sweep — ip_multi_org rule", () => {
  qaTest("edge.contract.07", () => {
    const logs = [
      { ip_address: "10.0.0.1", organization_id: "org-A", action: "any" },
      { ip_address: "10.0.0.1", organization_id: "org-B", action: "any" },
    ];
    const result = applyIpMultiOrgRule(logs);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("ip_multi_org");
    expect(result[0].org_count).toBe(2);
  });

  qaTest("edge.contract.08", () => {
    const logs = [
      { ip_address: "10.0.0.1", organization_id: "org-A", action: "any" },
      { ip_address: "10.0.0.1", organization_id: "org-A", action: "other" },
    ];
    const result = applyIpMultiOrgRule(logs);
    expect(result).toHaveLength(0);
  });
});

describe("edge / audit-anomaly-sweep — pin_flood rule", () => {
  qaTest("edge.contract.09", () => {
    const makeRow = (i) => ({ action: "juror.pin_locked", organization_id: "org-1" });
    const logsAt10 = Array.from({ length: 10 }, makeRow);
    const logsAt9 = Array.from({ length: 9 }, makeRow);

    expect(applyPinFloodRule(logsAt10)).toHaveLength(1);
    expect(applyPinFloodRule(logsAt9)).toHaveLength(0);
  });
});

describe("edge / audit-anomaly-sweep — export_burst rule", () => {
  qaTest("edge.contract.10", () => {
    const makeRow = () => ({ action: "export.scores", organization_id: "org-1" });
    const logsAt5 = Array.from({ length: 5 }, makeRow);
    const logsAt4 = Array.from({ length: 4 }, makeRow);

    expect(applyExportBurstRule(logsAt5)).toHaveLength(1);
    expect(applyExportBurstRule(logsAt4)).toHaveLength(0);
  });
});

// ── request-pin-reset: escapeHtml tests ─────────────────────────────────────

describe("edge / request-pin-reset — escapeHtml", () => {
  qaTest("edge.contract.11", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  qaTest("edge.contract.12", () => {
    const result = escapeHtml(`& < > " '`);
    expect(result).toBe("&amp; &lt; &gt; &quot; &#39;");
  });

  qaTest("edge.contract.13", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });

  qaTest("edge.contract.14", () => {
    expect(escapeHtml("")).toBe("");
  });

  qaTest("edge.contract.15", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  qaTest("edge.contract.16", () => {
    const payload = `<img src=x onerror="alert(1)">`;
    const result = escapeHtml(payload);
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
    expect(result).not.toContain('"');
    expect(result).toContain("&lt;");
    expect(result).toContain("&gt;");
    expect(result).toContain("&quot;");
  });
});

// ── log-export-event: readBearerToken tests ─────────────────────────────────

describe("edge / log-export-event — readBearerToken", () => {
  qaTest("edge.contract.17", () => {
    expect(readBearerToken("Bearer mytoken")).toBe("mytoken");
  });

  qaTest("edge.contract.18", () => {
    expect(readBearerToken("bearer mytoken")).toBe("mytoken");
  });

  qaTest("edge.contract.19", () => {
    expect(readBearerToken("")).toBe("");
    expect(readBearerToken(null)).toBe("");
  });
});

// ── log-export-event: toNullableNumber tests ────────────────────────────────

describe("edge / log-export-event — toNullableNumber", () => {
  qaTest("edge.contract.20", () => {
    expect(toNullableNumber(42)).toBe(42);
    expect(toNullableNumber("7")).toBe(7);
  });

  qaTest("edge.contract.21", () => {
    expect(toNullableNumber(null)).toBeNull();
    expect(toNullableNumber(undefined)).toBeNull();
  });

  qaTest("edge.contract.22", () => {
    expect(toNullableNumber("abc")).toBeNull();
  });
});

// ── log-export-event: normalizeExportDetails tests ──────────────────────────

describe("edge / log-export-event — normalizeExportDetails", () => {
  qaTest("edge.contract.23", () => {
    const result = normalizeExportDetails({
      format: "XLSX",
      rowCount: 50,
      projectCount: 10,
      jurorCount: 5,
      periodName: "Spring 2025",
    });
    expect(result.row_count).toBe(50);
    expect(result.project_count).toBe(10);
    expect(result.juror_count).toBe(5);
    expect(result.period_name).toBe("Spring 2025");
  });

  qaTest("edge.contract.24", () => {
    expect(normalizeExportDetails({ format: "XLSX" }).format).toBe("xlsx");
    expect(normalizeExportDetails({ format: "CSV" }).format).toBe("csv");
    expect(normalizeExportDetails({}).format).toBe("unknown");
  });
});
