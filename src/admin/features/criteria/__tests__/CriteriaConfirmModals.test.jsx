import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Modal", () => ({
  default: ({ open, children }) => (open ? <div>{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => <>{children}</>,
}));
vi.mock("@/shared/hooks/useFocusTrap", () => ({ useFocusTrap: () => {} }));
vi.mock("@/shared/ui/AlertCard", () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock("@/shared/ui/Icons", () => ({
  TrashIcon: () => null,
  TriangleAlertLucideIcon: () => null,
}));

import { ClearAllCriteriaModal, DeleteCriterionModal } from "../components/CriteriaConfirmModals";
import CriterionDeleteDialog from "../CriterionDeleteDialog";

const noop = vi.fn();

describe("ClearAllCriteriaModal", () => {
  qaTest("coverage.criteria-confirm-modals.clear-all-renders", () => {
    render(
      <ClearAllCriteriaModal
        open={true}
        submitting={false}
        confirmText=""
        onConfirmTextChange={noop}
        onClose={noop}
        onConfirm={noop}
        displayName="Spring 2025"
      />
    );
    expect(screen.getByText("Delete All Criteria?")).toBeInTheDocument();
  });

  qaTest("coverage.criteria-confirm-modals.clear-all-confirm-disabled", () => {
    render(
      <ClearAllCriteriaModal
        open={true}
        submitting={false}
        confirmText="wrong text"
        onConfirmTextChange={noop}
        onClose={noop}
        onConfirm={noop}
        displayName="Spring 2025"
      />
    );
    expect(screen.getByRole("button", { name: "Delete All Criteria" })).toBeDisabled();
  });
});

describe("DeleteCriterionModal", () => {
  qaTest("coverage.criteria-confirm-modals.reorder-renders", () => {
    render(
      <DeleteCriterionModal
        open={true}
        submitting={false}
        confirmText=""
        onConfirmTextChange={noop}
        onClose={noop}
        onConfirm={noop}
        deleteLabel="C1"
        canDelete={false}
      />
    );
    expect(screen.getByText("Remove Criterion?")).toBeInTheDocument();
  });

  qaTest("coverage.criteria-confirm-modals.delete-btn-candelete-false", () => {
    render(
      <DeleteCriterionModal
        open={true}
        submitting={false}
        confirmText=""
        onConfirmTextChange={noop}
        onClose={noop}
        onConfirm={noop}
        deleteLabel="C1"
        canDelete={false}
      />
    );
    expect(screen.getByRole("button", { name: "Remove Criterion" })).toBeDisabled();
  });
});

describe("CriterionDeleteDialog", () => {
  qaTest("coverage.criterion-delete-dialog.hidden-when-closed", () => {
    const { container } = render(
      <CriterionDeleteDialog
        open={false}
        rowLabel="C1"
        onOpenChange={noop}
        onConfirm={noop}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  qaTest("coverage.criterion-delete-dialog.visible-when-open", () => {
    render(
      <CriterionDeleteDialog
        open={true}
        rowLabel="C1"
        onOpenChange={noop}
        onConfirm={noop}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
