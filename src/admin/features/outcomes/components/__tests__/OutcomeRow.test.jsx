import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/FloatingMenu", () => ({
  default: ({ trigger }) => <div data-testid="floating-menu">{trigger}</div>,
}));
vi.mock("@/shared/ui/PremiumTooltip", () => ({
  default: ({ children }) => <>{children}</>,
}));

import OutcomeRow from "../OutcomeRow";

const outcome = {
  id: "o1",
  code: "PO 1",
  label: "Engineering Design",
  description: "Design engineering systems",
};

describe("OutcomeRow", () => {
  qaTest("coverage.outcome-row.renders", () => {
    render(
      <table>
        <tbody>
          <OutcomeRow
            outcome={outcome}
            mappedCriteria={[]}
            coverage="unmapped"
            onEdit={vi.fn()}
            onDelete={vi.fn()}
            onDuplicate={vi.fn()}
            onRemoveChip={vi.fn()}
            onAddMapping={vi.fn()}
            onCycleCoverage={vi.fn()}
            openMenuId={null}
            setOpenMenuId={vi.fn()}
            isLocked={false}
          />
        </tbody>
      </table>
    );
    expect(screen.getByText("Engineering Design")).toBeInTheDocument();
  });
});
