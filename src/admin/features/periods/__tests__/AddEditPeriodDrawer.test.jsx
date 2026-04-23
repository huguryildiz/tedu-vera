import { describe, vi, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Drawer", () => ({
  default: ({ open, children }) => (open ? <div>{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => <span>{children}</span>,
}));
vi.mock("@/shared/hooks/useShakeOnError", () => ({
  default: () => ({ current: null }),
}));
vi.mock("@/shared/lib/dateBounds", () => ({
  clampDate: (d) => d,
  formatForInput: (d) => d,
}));

import AddEditPeriodDrawer from "../AddEditPeriodDrawer";

describe("AddEditPeriodDrawer", () => {
  qaTest("admin.periods.add.happy", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(
      <AddEditPeriodDrawer
        open
        onClose={vi.fn()}
        period={null}
        onSave={onSave}
        allPeriods={[]}
      />
    );

    expect(screen.getByText("Add Evaluation Period")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("e.g., Spring 2026"), {
      target: { value: "Fall 2026" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create period/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const [data] = onSave.mock.calls[0];
    expect(data.name).toBe("Fall 2026");
  });

  qaTest("admin.periods.add.error", () => {
    // Duplicate-name validation only runs in edit mode (period prop is set).
    render(
      <AddEditPeriodDrawer
        open
        onClose={vi.fn()}
        period={{ id: "p-001", name: "Fall 2025" }}
        onSave={vi.fn()}
        allPeriods={[
          { id: "p-001", name: "Fall 2025" },
          { id: "p-existing", name: "Spring 2026" },
        ]}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("e.g., Spring 2026"), {
      target: { value: "Spring 2026" },
    });

    expect(screen.getByText("Period name already exists.")).toBeInTheDocument();
  });
});
