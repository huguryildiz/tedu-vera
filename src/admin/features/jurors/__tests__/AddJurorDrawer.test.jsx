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

import AddJurorDrawer from "../AddJurorDrawer";

describe("AddJurorDrawer", () => {
  qaTest("admin.jurors.add.happy", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <AddJurorDrawer
        open
        onClose={vi.fn()}
        onSave={onSave}
        periodName="Spring 2026"
        error={null}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("Prof. Dr. Sevgi Kahraman"), {
      target: { value: "Dr. Ayşe Kaya" },
    });
    fireEvent.change(screen.getByPlaceholderText("TED University"), {
      target: { value: "METU / CS" },
    });
    fireEvent.change(screen.getByPlaceholderText("juror@university.edu"), {
      target: { value: "akaya@metu.edu.tr" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add juror/i }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        name: "Dr. Ayşe Kaya",
        affiliation: "METU / CS",
        email: "akaya@metu.edu.tr",
      })
    );
  });

  qaTest("admin.jurors.add.error", () => {
    render(
      <AddJurorDrawer
        open
        onClose={vi.fn()}
        onSave={vi.fn()}
        periodName="Spring 2026"
        error="Email already in use"
      />
    );
    expect(screen.getByText("Email already in use")).toBeInTheDocument();
  });
});
