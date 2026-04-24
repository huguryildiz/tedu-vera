// src/shared/api/admin/__tests__/tokens.test.js
// Tests for getActiveEntryToken, getActiveEntryTokenPlain, and getEntryTokenHistory.
// Private helpers (isTokenUnexpired, makeTokenPrefix, normalizeSessionCount) are
// exercised through the public API surface.

import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../../../test/qaTest.js";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: { from: mockFrom },
}));

import {
  getActiveEntryToken,
  getActiveEntryTokenPlain,
  getEntryTokenHistory,
} from "../tokens.js";

// ─── helpers ────────────────────────────────────────────────────────────────

function mockActiveChain(data, error = null) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    }),
  });
}

function mockHistoryChain(tokens, auditRows = []) {
  mockFrom.mockImplementation((table) => {
    if (table === "entry_tokens") {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: tokens, error: null }),
      };
    }
    // audit_logs
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: auditRows, error: null }),
    };
  });
}

function futureIso(ms = 24 * 3600 * 1000) {
  return new Date(Date.now() + ms).toISOString();
}
function pastIso(ms = 3600 * 1000) {
  return new Date(Date.now() - ms).toISOString();
}

// ─── getActiveEntryToken ─────────────────────────────────────────────────────

describe("admin/tokens — getActiveEntryToken", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("tokens.race.01", async () => {
    mockActiveChain(null);
    const result = await getActiveEntryToken("period-1");
    expect(result).toBe(false);
  });

  qaTest("tokens.race.02", async () => {
    mockActiveChain({ id: "tok-1", expires_at: null });
    const result = await getActiveEntryToken("period-1");
    // null expiry → treated as no expiry → active
    expect(result).toBe(true);
  });

  qaTest("tokens.race.03", async () => {
    mockActiveChain({ id: "tok-1", expires_at: futureIso() });
    const result = await getActiveEntryToken("period-1");
    expect(result).toBe(true);
  });

  qaTest("tokens.race.04", async () => {
    mockActiveChain({ id: "tok-1", expires_at: pastIso() });
    const result = await getActiveEntryToken("period-1");
    expect(result).toBe(false);
  });

  qaTest("tokens.race.05", async () => {
    mockActiveChain({ id: "tok-1", expires_at: "not-a-date" });
    const result = await getActiveEntryToken("period-1");
    // NaN from Date.parse → treated as non-expired
    expect(result).toBe(true);
  });

  qaTest("tokens.race.06", async () => {
    mockActiveChain(null, { message: "db error", code: "42P01" });
    await expect(getActiveEntryToken("period-1")).rejects.toMatchObject({
      message: "db error",
    });
  });
});

// ─── getActiveEntryTokenPlain ────────────────────────────────────────────────

describe("admin/tokens — getActiveEntryTokenPlain", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("tokens.race.07", async () => {
    mockActiveChain({ token_plain: "secret-token", expires_at: null });
    const result = await getActiveEntryTokenPlain("period-1");
    expect(result).toBe("secret-token");
  });

  qaTest("tokens.race.08", async () => {
    mockActiveChain({ token_plain: "secret-token", expires_at: pastIso() });
    const result = await getActiveEntryTokenPlain("period-1");
    expect(result).toBeNull();
  });

  qaTest("tokens.race.09", async () => {
    mockActiveChain(null);
    const result = await getActiveEntryTokenPlain("period-1");
    expect(result).toBeNull();
  });
});

// ─── getEntryTokenHistory ────────────────────────────────────────────────────

describe("admin/tokens — getEntryTokenHistory", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("tokens.race.10", async () => {
    mockHistoryChain([]);
    const result = await getEntryTokenHistory("period-1");
    expect(result).toEqual([]);
  });

  qaTest("tokens.race.11", async () => {
    const token = {
      id: "tok-1",
      token_hash: "hash",
      token_plain: null,
      is_revoked: false,
      revoked_at: null,
      created_at: "2025-01-01T00:00:00Z",
      expires_at: futureIso(),
      last_used_at: null,
    };
    const auditRows = [
      { resource_id: "tok-1" },
      { resource_id: "tok-1" },
      { resource_id: "tok-1" },
    ];
    mockHistoryChain([token], auditRows);
    const [row] = await getEntryTokenHistory("period-1");
    // Non-revoked: session_count = rawCount as-is
    expect(row.session_count).toBe(3);
  });

  qaTest("tokens.race.12", async () => {
    const token = {
      id: "tok-2",
      token_hash: "hash2",
      token_plain: null,
      is_revoked: true,
      revoked_at: "2025-01-02T00:00:00Z",
      created_at: "2025-01-01T00:00:00Z",
      expires_at: null,
      last_used_at: null,
    };
    const auditRows = [
      { resource_id: "tok-2" },
      { resource_id: "tok-2" },
      { resource_id: "tok-2" },
    ];
    mockHistoryChain([token], auditRows);
    const [row] = await getEntryTokenHistory("period-1");
    // Revoked: session_count = max(3-1, 0) = 2
    expect(row.session_count).toBe(2);
  });

  qaTest("tokens.race.13", async () => {
    const token = {
      id: "tok-3",
      token_hash: "hash3",
      token_plain: null,
      is_revoked: true,
      revoked_at: "2025-01-02T00:00:00Z",
      created_at: "2025-01-01T00:00:00Z",
      expires_at: null,
      last_used_at: null,
    };
    mockHistoryChain([token], []);
    const [row] = await getEntryTokenHistory("period-1");
    // Revoked with 0 events: session_count = max(0-1, 0) = 0
    expect(row.session_count).toBe(0);
  });

  qaTest("tokens.race.14", async () => {
    const token = {
      id: "tok-4",
      token_hash: null,
      token_plain: "abcd1234xyz",
      is_revoked: false,
      revoked_at: null,
      created_at: "2025-01-01T00:00:00Z",
      expires_at: futureIso(),
      last_used_at: null,
    };
    mockHistoryChain([token], []);
    const [row] = await getEntryTokenHistory("period-1");
    // 'abcd1234xyz' → strip non-alphanum → 'abcd1234xyz' → slice 8 → 'abcd1234' → upper → 'ABCD1234'
    // length 8 > 4 → 'ABCD-1234'
    expect(row.access_id).toBe("ABCD-1234");
  });

  qaTest("tokens.race.15", async () => {
    const token = {
      id: "tok-5",
      token_hash: "hashval",
      token_plain: null,
      is_revoked: false,
      revoked_at: null,
      created_at: "2025-01-01T00:00:00Z",
      expires_at: futureIso(),
      last_used_at: null,
    };
    mockHistoryChain([token], []);
    const [row] = await getEntryTokenHistory("period-1");
    expect(row.is_active).toBe(true);
    expect(row.is_revoked).toBe(false);
    expect(row.is_expired).toBe(false);
    expect(row.status).toBe("active");
  });
});
