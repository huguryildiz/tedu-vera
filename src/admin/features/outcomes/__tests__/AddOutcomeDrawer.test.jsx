import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Drawer", () => ({
  default: ({ open, children }) => (open ? <div data-testid="drawer">{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({ default: () => null }));
vi.mock("@/shared/ui/AutoTextarea", () => ({ default: () => null }));
vi.mock("@/shared/ui/InlineError", () => ({ default: () => null }));
vi.mock("@/shared/hooks/useShakeOnError", () => ({ default: () => ({ current: null }) }));

import AddOutcomeDrawer from "../AddOutcomeDrawer";

describe("AddOutcomeDrawer", () => {
  qaTest("admin.outcomes.drawer.add", () => {
    render(
      <AddOutcomeDrawer
        open={true}
        onClose={vi.fn()}
        frameworkName="MÜDEK"
        frameworkId="fw-001"
        platformFrameworks={[]}
        criteria={[]}
        onSave={vi.fn()}
        onSelectFrameworkTemplate={vi.fn()}
        error={null}
      />
    );
    expect(screen.getByText("Add Outcome")).toBeInTheDocument();
  });
});
