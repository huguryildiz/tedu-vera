import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/shared/lib/supabaseClient", () => ({
  supabase: {
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: vi.fn(),
  },
}));
vi.mock("@/shared/api/admin/maintenance", () => ({
  getMaintenanceStatus: vi.fn().mockResolvedValue({ data: null }),
}));
vi.mock("@/auth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isSuper: false }),
}));
vi.mock("@/auth/shared/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" }, isSuper: false }),
}));
vi.mock("@/assets/vera_logo_dark.png", () => ({ default: "vera_logo_dark.png" }));
vi.mock("@/assets/vera_logo_white.png", () => ({ default: "vera_logo_white.png" }));

import MaintenanceGate from "../MaintenanceGate";

describe("MaintenanceGate", () => {
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
});
