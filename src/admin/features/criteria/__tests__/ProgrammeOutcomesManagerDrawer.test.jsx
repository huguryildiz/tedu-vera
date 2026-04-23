import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Drawer", () => ({
  default: ({ open, children }) => (open ? <div data-testid="drawer">{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({ default: () => null }));

import ProgrammeOutcomesManagerDrawer from "../ProgrammeOutcomesManagerDrawer";

describe("ProgrammeOutcomesManagerDrawer", () => {
  qaTest("admin.criteria.drawer.outcomes", () => {
    render(
      <ProgrammeOutcomesManagerDrawer
        open={true}
        onClose={vi.fn()}
        frameworkName="MÜDEK"
        periodName="Spring 2026"
        outcomes={[]}
        onAddOutcome={vi.fn()}
        onEditOutcome={vi.fn()}
        onDeleteOutcome={vi.fn()}
        onSave={vi.fn()}
      />
    );
    expect(screen.getByTestId("drawer")).toBeInTheDocument();
  });
});
