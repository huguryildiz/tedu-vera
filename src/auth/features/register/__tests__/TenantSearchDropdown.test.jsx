import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/hooks/useFloating", () => ({
  useFloating: () => ({ floatingRef: { current: null }, floatingStyle: {} }),
}));

import TenantSearchDropdown from "../TenantSearchDropdown";

const tenants = [
  { id: "t1", name: "TEDU Engineering", code: "TEDU" },
  { id: "t2", name: "METU Computer", code: "METU" },
];

describe("TenantSearchDropdown", () => {
  qaTest("coverage.tenant-search-dropdown.displays-search-input", () => {
    render(
      <TenantSearchDropdown
        tenants={tenants}
        value={null}
        onChange={vi.fn()}
        disabled={false}
      />
    );
    expect(screen.getByText("Select a department…")).toBeInTheDocument();
  });
});
