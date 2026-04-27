import { beforeEach, describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { MemoryRouter } from "react-router-dom";

const { authState } = vi.hoisted(() => ({
  authState: { current: { user: { id: "u1" }, isSuper: false } },
}));

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));
vi.mock("@/shared/api/admin/maintenance", () => ({
  getMaintenanceStatus: vi.fn(),
}));
vi.mock("@/auth", () => ({
  useAuth: () => authState.current,
}));
vi.mock("@/auth/shared/useAuth", () => ({
  useAuth: () => authState.current,
}));
vi.mock("@/assets/vera_logo_dark.png", () => ({ default: "vera_logo_dark.png" }));
vi.mock("@/assets/vera_logo_white.png", () => ({ default: "vera_logo_white.png" }));

import MaintenanceGate from "../MaintenanceGate";
import { getMaintenanceStatus } from "@/shared/api/admin/maintenance";

describe("MaintenanceGate", () => {
  beforeEach(() => {
    vi.mocked(getMaintenanceStatus).mockResolvedValue(null);
    authState.current = { user: { id: "u1" }, isSuper: false };
  });

  qaTest("coverage.maintenance-gate.passes-children-when-not-in-maintenance", () => {
    render(
      <MemoryRouter>
        <ThemeProvider>
          <MaintenanceGate>
            <div>app content</div>
          </MaintenanceGate>
        </ThemeProvider>
      </MemoryRouter>
    );
    expect(screen.getByText("app content")).toBeInTheDocument();
  });

  qaTest("coverage.maintenance-gate.blocks-anonymous-users-when-active", async () => {
    authState.current = { user: null, isSuper: false };
    vi.mocked(getMaintenanceStatus).mockResolvedValue({
      is_active: true,
      upcoming: false,
      mode: "immediate",
      message: "E2E Test: Maintenance Active",
      start_time: new Date().toISOString(),
      end_time: null,
      affected_org_ids: null,
    });

    render(
      <MemoryRouter initialEntries={["/eval"]}>
        <ThemeProvider>
          <MaintenanceGate>
            <div>app content</div>
          </MaintenanceGate>
        </ThemeProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Maintenance in Progress")).toBeInTheDocument();
    expect(screen.queryByText("app content")).not.toBeInTheDocument();
  });
});
