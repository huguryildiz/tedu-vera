import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ManageOrganizationsPanel from "../features/settings/ManageOrganizationsPanel";

vi.mock("../LastActivity", () => ({
  default: () => <span>Last activity</span>,
}));

const BASE_PROPS = {
  isMobile: false,
  isOpen: true,
  onToggle: vi.fn(),
  orgList: [
    {
      id: "t1",
      code: "tedu-ee",
      shortLabel: "TEDU EE",
      name: "TED University — Electrical Engineering",
      status: "active",
      created_at: "2026-03-01T10:00:00Z",
      updated_at: "2026-03-02T10:00:00Z",
      tenantAdmins: [
        { name: "Alice Smith", email: "alice@tedu.edu", status: "approved" },
      ],
    },
  ],
  filteredOrgs: [],
  error: "",
  search: "",
  setSearch: vi.fn(),
  showCreate: false,
  createForm: { code: "", name: "" },
  setCreateForm: vi.fn(),
  createError: "",
  openCreate: vi.fn(),
  closeCreate: vi.fn(),
  handleCreateOrg: vi.fn(),
  showEdit: false,
  editForm: { id: "", code: "", name: "", status: "active", created_at: "", updated_at: "" },
  setEditForm: vi.fn(),
  editError: "",
  openEdit: vi.fn(),
  closeEdit: vi.fn(),
  handleUpdateOrg: vi.fn(),
  isDirty: false,
};

describe("ManageOrganizationsPanel", () => {
  it("shows organization admins in review modal", () => {
    render(<ManageOrganizationsPanel {...BASE_PROPS} />);

    fireEvent.click(screen.getByRole("button", { name: /review admins for tedu ee/i }));

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /alice@tedu\.edu/i })).toBeInTheDocument();
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
  });
});
