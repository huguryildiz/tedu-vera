// src/admin/__tests__/tenantsApi.mapping.test.js
// ============================================================
// Organizations API (PostgREST) — mapping and normalization.
// Replaced legacy tenants RPC test after PostgREST migration.
// ============================================================

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── PostgREST chainable mock (same pattern as adminApi.shaping.test.js) ────
function makeChain(rows, error = null) {
  const data = Array.isArray(rows) ? rows : [rows];
  const p = Promise.resolve({ data, error });
  const chain = {
    select:  vi.fn().mockReturnThis(),
    eq:      vi.fn().mockReturnThis(),
    order:   vi.fn().mockReturnThis(),
    single:  vi.fn().mockResolvedValue({ data: data[0] ?? null, error }),
    then:    p.then.bind(p),
    catch:   p.catch.bind(p),
    finally: p.finally.bind(p),
  };
  return chain;
}

vi.mock("../../lib/supabaseClient", () => ({
  supabase: { from: vi.fn() },
}));

import { supabase } from "../../lib/supabaseClient";
import { listOrganizations } from "../../shared/api/admin/organizations";

// ── Tests ─────────────────────────────────────────────────────────────────

describe("admin organization API mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps memberships and tenant_applications into UI shape", async () => {
    supabase.from.mockReturnValue(makeChain([
      {
        id: "t1",
        name: "TED University EE",
        short_name: "TEDU EE",
        status: "active",
        created_at: "2026-03-01T10:00:00Z",
        updated_at: "2026-03-02T10:00:00Z",
        memberships: [
          {
            user_id: "u1",
            role: "admin",
            created_at: "2026-03-02T12:00:00Z",
            profiles: {
              display_name: "Alice Smith",
              email: "alice@tedu.edu",
            },
          },
        ],
        tenant_applications: [
          {
            id: "app-1",
            applicant_name: "Bob Jones",
            contact_email: "bob@tedu.edu",
            status: "pending",
            created_at: "2026-03-03T10:00:00Z",
          },
        ],
      },
    ]));

    const result = await listOrganizations();
    expect(supabase.from).toHaveBeenCalledWith("organizations");
    expect(result).toHaveLength(1);
    expect(result[0].shortLabel).toBe("TEDU EE");
    expect(result[0].tenantAdmins).toEqual([
      {
        name: "Alice Smith",
        userId: "u1",
        email: "alice@tedu.edu",
        role: "admin",
        status: "approved",
        updatedAt: "2026-03-02T12:00:00Z",
      },
    ]);
    expect(result[0].pendingApplications).toEqual([
      {
        applicationId: "app-1",
        name: "Bob Jones",
        email: "bob@tedu.edu",
        status: "pending",
        createdAt: "2026-03-03T10:00:00Z",
      },
    ]);
  });

  it("normalizes null memberships and tenant_applications to empty arrays", async () => {
    supabase.from.mockReturnValue(makeChain([
      {
        id: "t2",
        name: "TEDU CS",
        short_name: "TEDU CS",
        memberships: null,
        tenant_applications: null,
      },
    ]));

    const [row] = await listOrganizations();
    expect(row.tenantAdmins).toEqual([]);
    expect(row.pendingApplications).toEqual([]);
  });
});
