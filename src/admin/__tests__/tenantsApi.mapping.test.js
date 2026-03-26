import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../shared/api/transport", () => ({
  callAdminRpcV2: vi.fn(),
}));

import { callAdminRpcV2 } from "../../shared/api/transport";
import { adminListTenants, mapTenantRow } from "../../shared/api/admin/tenants";

describe("admin tenant API mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps tenant_admins and pending_applications into UI shape", async () => {
    callAdminRpcV2.mockResolvedValueOnce([
      {
        id: "t1",
        code: "tedu-ee",
        short_label: "TEDU EE",
        university: "TED University",
        department: "Electrical Engineering",
        status: "active",
        created_at: "2026-03-01T10:00:00Z",
        updated_at: "2026-03-02T10:00:00Z",
        tenant_admins: [
          {
            user_id: "u1",
            name: "Alice Smith",
            email: "alice@tedu.edu",
            status: "approved",
            updated_at: "2026-03-02T12:00:00Z",
          },
        ],
        pending_applications: [
          {
            application_id: "app-1",
            name: "Bob Jones",
            email: "bob@tedu.edu",
            status: "pending",
            created_at: "2026-03-03T10:00:00Z",
          },
        ],
      },
    ]);

    const result = await adminListTenants();
    expect(callAdminRpcV2).toHaveBeenCalledWith("rpc_admin_tenant_list");
    expect(result).toHaveLength(1);
    expect(result[0].shortLabel).toBe("TEDU EE");
    expect(result[0].tenantAdmins).toEqual([
      {
        name: "Alice Smith",
        userId: "u1",
        email: "alice@tedu.edu",
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

  it("normalizes missing json fields to empty arrays", () => {
    const row = mapTenantRow({
      id: "t2",
      code: "tedu-cs",
      short_label: "TEDU CS",
      tenant_admins: null,
      pending_applications: null,
    });

    expect(row.tenantAdmins).toEqual([]);
    expect(row.pendingApplications).toEqual([]);
  });
});
