import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Modal", () => ({
  default: ({ open, children }) => (open ? <div>{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => <>{children}</>,
}));
vi.mock("@/admin/shared/JurorBadge", () => ({ default: () => null }));

import PinResetConfirmModal from "../PinResetConfirmModal";
import UnlockAllModal from "../UnlockAllModal";

const noop = vi.fn();

describe("PinResetConfirmModal", () => {
  qaTest("coverage.pin-reset-confirm-modal.renders", () => {
    render(
      <PinResetConfirmModal
        open={true}
        onClose={noop}
        juror={null}
        loading={false}
        onConfirm={noop}
      />
    );
    expect(screen.getByText("Reset Juror PIN")).toBeInTheDocument();
  });
});

describe("UnlockAllModal", () => {
  qaTest("coverage.unlock-all-modal.renders", () => {
    render(
      <UnlockAllModal
        open={true}
        onClose={noop}
        lockedCount={3}
        onConfirm={noop}
      />
    );
    expect(screen.getByText("Unlock All Jurors?")).toBeInTheDocument();
  });
});
