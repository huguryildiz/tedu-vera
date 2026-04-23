import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Drawer", () => ({
  default: ({ open, children }) => (open ? <div data-testid="drawer">{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({ default: () => null }));
vi.mock("@/shared/ui/AutoTextarea", () => ({ default: () => null }));
vi.mock("@/shared/ui/InlineError", () => ({ default: () => null }));
vi.mock("@/shared/ui/FbAlert", () => ({ default: () => null }));
vi.mock("@/shared/hooks/useShakeOnError", () => ({ default: () => ({ current: null }) }));

import OutcomeDetailDrawer from "../OutcomeDetailDrawer";

const OUTCOME = {
  id: "o-001",
  code: "PO1",
  shortLabel: "Engineering Knowledge",
  description: "Apply engineering knowledge",
  criterionIds: [],
  coverageType: "direct",
};

describe("OutcomeDetailDrawer", () => {
  qaTest("admin.outcomes.drawer.detail", () => {
    render(
      <OutcomeDetailDrawer
        open={true}
        onClose={vi.fn()}
        outcome={OUTCOME}
        criteria={[]}
        onSave={vi.fn()}
        error={null}
        isLocked={false}
      />
    );
    expect(screen.getByText("Edit Outcome")).toBeInTheDocument();
  });
});
