import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Drawer", () => ({
  default: ({ open, children }) => (open ? <div data-testid="drawer">{children}</div> : null),
}));
vi.mock("@/shared/ui/CustomSelect", () => ({ default: () => null }));

import StarterCriteriaDrawer from "../StarterCriteriaDrawer";

describe("StarterCriteriaDrawer", () => {
  qaTest("admin.criteria.drawer.starter", () => {
    render(
      <StarterCriteriaDrawer
        open={true}
        onClose={vi.fn()}
        draftCriteria={[]}
        otherPeriods={[]}
        isLocked={false}
        onApplyTemplate={vi.fn()}
        onCopyFromPeriod={vi.fn()}
      />
    );
    expect(screen.getByText("Active Criteria")).toBeInTheDocument();
  });
});
