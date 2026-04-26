import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

import TenantSwitcher from "../TenantSwitcher";

describe("TenantSwitcher", () => {
  qaTest("coverage.tenant-switcher.hidden-single", () => {
    const { container } = render(
      <TenantSwitcher
        tenants={[{ id: "t1", name: "TEDU" }]}
        activeOrganization={{ id: "t1", name: "TEDU" }}
        onSwitch={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  qaTest("coverage.tenant-switcher.shows-switcher-for-multi-tenant-admin", () => {
    const tenants = [
      { id: "t1", name: "TEDU" },
      { id: "t2", name: "METU" },
    ];
    render(
      <TenantSwitcher
        tenants={tenants}
        activeOrganization={{ id: "t1", name: "TEDU" }}
        onSwitch={vi.fn()}
      />
    );
    expect(screen.getByText("TEDU")).toBeInTheDocument();
  });
});
