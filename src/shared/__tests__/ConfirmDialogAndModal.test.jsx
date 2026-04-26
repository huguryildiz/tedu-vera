import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/hooks/useFocusTrap", () => ({ useFocusTrap: () => {} }));
vi.mock("@/shared/ui/AlertCard", () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock("@/shared/ui/Icons", () => ({
  TrashIcon: () => null,
  TriangleAlertLucideIcon: () => null,
}));
vi.mock("@/shared/ui/Modal", () => ({
  default: ({ open, children }) => (open ? <div>{children}</div> : null),
}));

import ConfirmDialog from "../ui/ConfirmDialog";

const noop = vi.fn();

describe("ConfirmDialog", () => {
  qaTest("coverage.confirm-dialog.hidden-when-closed", () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        onOpenChange={noop}
        title="Delete Item"
        onConfirm={noop}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

