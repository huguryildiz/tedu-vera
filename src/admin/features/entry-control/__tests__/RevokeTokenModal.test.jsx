import { describe, vi, expect } from "vitest";
import { render } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Modal", () => ({
  default: ({ children, open }) => (open ? <div data-testid="modal">{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => children,
}));

import RevokeTokenModal from "../RevokeTokenModal";

describe("RevokeTokenModal", () => {
  qaTest("admin.entry.token.revoke", () => {
    render(
      <RevokeTokenModal
        open={true}
        onClose={vi.fn()}
        activeCount={3}
        onRevoke={vi.fn()}
      />
    );
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});
