import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Modal", () => ({
  default: ({ open, children }) => (open ? <div>{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => <>{children}</>,
}));

import DeleteOutcomeModal from "../DeleteOutcomeModal";

const noop = vi.fn();

describe("DeleteOutcomeModal", () => {
  qaTest("coverage.delete-outcome-modal.confirm-disabled", () => {
    render(
      <DeleteOutcomeModal
        target={{ code: "PO1" }}
        confirmText=""
        onConfirmTextChange={noop}
        submitting={false}
        onCancel={noop}
        onConfirm={noop}
      />
    );
    const btn = screen.getByRole("button", { name: /Remove Outcome/i });
    expect(btn).toBeDisabled();
  });
});

