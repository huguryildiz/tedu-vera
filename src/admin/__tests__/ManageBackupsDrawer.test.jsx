// src/admin/__tests__/ManageBackupsDrawer.test.jsx
import { describe, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { qaTest } from "../../test/qaTest.js";

const mockHook = vi.fn();
vi.mock("../hooks/useBackups", () => ({
  useBackups: (...a) => mockHook(...a),
}));
vi.mock("../../shared/lib/supabaseClient", () => ({ supabase: {} }));
vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import ManageBackupsDrawer from "@/admin/shared/ManageBackupsDrawer.jsx";

const SAMPLE = [
  {
    id: "b1",
    origin: "manual",
    format: "json",
    size_bytes: 4200,
    row_counts: { projects: 48 },
    period_ids: ["p1"],
    created_by_name: "Hugur",
    created_at: "2026-04-11T14:02:00Z",
    expires_at: "2026-07-10T14:02:00Z",
    storage_path: "org-1/b1.json",
  },
];

describe("ManageBackupsDrawer", () => {
  beforeEach(() => {
    mockHook.mockReset();
  });

  qaTest("backups.drawer.render.01", () => {
    mockHook.mockReturnValue({
      backups: SAMPLE,
      loading: false,
      error: "",
      creating: false,
      deletingId: null,
      totalBytes: 4200,
      refresh: vi.fn(),
      create: vi.fn(),
      remove: vi.fn(),
      download: vi.fn(),
    });

    render(<ManageBackupsDrawer open organizationId="org-1" onClose={() => {}} />);

    expect(screen.getByText("Database Backups")).toBeInTheDocument();
    expect(screen.getAllByText(/Apr 11, 2026/)).toHaveLength(1);
    const manualBadges = screen.getAllByText("Manual");
    expect(manualBadges.length).toBeGreaterThan(0);
  });

  qaTest("backups.drawer.delete.01", async () => {
    const removeFn = vi.fn();
    mockHook.mockReturnValue({
      backups: SAMPLE,
      loading: false,
      error: "",
      creating: false,
      deletingId: null,
      totalBytes: 4200,
      refresh: vi.fn(),
      create: vi.fn(),
      remove: removeFn,
      download: vi.fn(),
    });

    render(<ManageBackupsDrawer open organizationId="org-1" onClose={() => {}} />);

    const deleteBtn = screen.getByLabelText("Delete backup");
    fireEvent.click(deleteBtn);

    // Confirmation dialog opens; find and click Delete button
    // The button text should be exactly "Delete" when confirmLabel="Delete"
    const confirmBtn = await screen.findByRole("button", { name: "Delete" });
    fireEvent.click(confirmBtn);

    expect(removeFn).toHaveBeenCalledWith("b1");
  });
});
