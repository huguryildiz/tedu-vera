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
import UnassignFrameworkModal from "../UnassignFrameworkModal";
import ImportConfirmModal from "../ImportConfirmModal";

const noop = vi.fn();

describe("DeleteOutcomeModal", () => {
  qaTest("coverage.delete-outcome-modal.renders", () => {
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
    expect(screen.getByText("Remove Outcome?")).toBeInTheDocument();
  });

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

describe("UnassignFrameworkModal", () => {
  qaTest("coverage.unassign-framework-modal.renders", () => {
    render(
      <UnassignFrameworkModal
        open={true}
        frameworkName="MÜDEK"
        confirmText=""
        onConfirmTextChange={noop}
        submitting={false}
        onCancel={noop}
        onConfirm={noop}
      />
    );
    expect(screen.getByText("Remove Framework?")).toBeInTheDocument();
  });
});

describe("ImportConfirmModal", () => {
  qaTest("coverage.import-confirm-modal.renders", () => {
    render(
      <ImportConfirmModal
        open={true}
        proposedName="MÜDEK 2024"
        saving={false}
        onCancel={noop}
        onConfirm={noop}
      />
    );
    expect(screen.getByText("Replace Outcome Set?")).toBeInTheDocument();
  });
});
