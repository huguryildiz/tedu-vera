import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Modal", () => ({
  default: ({ open, children }) => (open ? <div>{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => <>{children}</>,
}));
vi.mock("@/shared/ui/FbAlert", () => ({
  default: ({ children }) => <div>{children}</div>,
}));
vi.mock("@/admin/shared/JurorBadge", () => ({ default: () => null }));
vi.mock("@/shared/lib/dateUtils", () => ({ formatDateTime: () => "2024-01-01" }));

import JuryRevokeConfirmDialog from "../JuryRevokeConfirmDialog";
import ResetPinModal from "../ResetPinModal";
import DeleteBackupModal from "../DeleteBackupModal";

const noop = vi.fn();

describe("JuryRevokeConfirmDialog", () => {
  qaTest("coverage.jury-revoke-confirm-dialog.renders", () => {
    render(
      <JuryRevokeConfirmDialog
        open={true}
        loading={false}
        activeJurorCount={0}
        onCancel={noop}
        onConfirm={noop}
      />
    );
    expect(screen.getByText("Revoke Jury Access?")).toBeInTheDocument();
  });
});

describe("ResetPinModal", () => {
  qaTest("coverage.reset-pin-modal.renders", () => {
    render(
      <ResetPinModal
        open={true}
        onClose={noop}
        juror={null}
        onConfirm={noop}
      />
    );
    expect(screen.getByText("Reset Juror PIN")).toBeInTheDocument();
  });
});

describe("DeleteBackupModal", () => {
  qaTest("coverage.delete-backup-modal.renders", () => {
    render(
      <DeleteBackupModal
        open={true}
        onClose={noop}
        backup={null}
        onDelete={noop}
      />
    );
    expect(screen.getByText("Delete Backup?")).toBeInTheDocument();
  });
});
