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

import RevertToDraftModal from "../RevertToDraftModal";
import RequestRevertModal from "../RequestRevertModal";

const noop = vi.fn();

describe("RevertToDraftModal", () => {
  qaTest("coverage.revert-to-draft-modal.renders", () => {
    render(
      <RevertToDraftModal
        open={true}
        onClose={noop}
        period={{ id: "p1", name: "Spring 2025" }}
        onRevert={noop}
      />
    );
    expect(screen.getByText("Revert to Draft?")).toBeInTheDocument();
  });
});

describe("RequestRevertModal", () => {
  qaTest("coverage.request-revert-modal.renders", () => {
    render(
      <RequestRevertModal
        open={true}
        onClose={noop}
        period={{ id: "p1", name: "Spring 2025" }}
        onRequest={noop}
      />
    );
    expect(screen.getByText("Request Revert to Draft")).toBeInTheDocument();
  });
});
