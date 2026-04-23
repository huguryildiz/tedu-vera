import { describe, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";
import ConfirmDialog from "../ConfirmDialog.jsx";

describe("ui/ConfirmDialog", () => {
  qaTest("ui.ConfirmDialog.01", () => {
    const { container } = render(
      <ConfirmDialog open={false} onOpenChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  qaTest("ui.ConfirmDialog.02", () => {
    render(
      <ConfirmDialog open={true} onOpenChange={vi.fn()} title="Delete record?" />
    );
    expect(screen.getByText("Delete record?")).toBeTruthy();
  });

  qaTest("ui.ConfirmDialog.03", () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog open={true} onOpenChange={onOpenChange} cancelLabel="Go back" />
    );
    fireEvent.click(screen.getByText("Go back"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  qaTest("ui.ConfirmDialog.04", () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        confirmLabel="Delete"
      />
    );
    fireEvent.click(screen.getByText("Delete"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  qaTest("ui.ConfirmDialog.05", () => {
    render(
      <ConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        typedConfirmation="DELETE"
        confirmLabel="Confirm delete"
      />
    );
    const confirmBtn = screen.getByText("Confirm delete");
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByPlaceholderText("DELETE");
    fireEvent.change(input, { target: { value: "DELETE" } });
    expect(confirmBtn).not.toBeDisabled();
  });
});
