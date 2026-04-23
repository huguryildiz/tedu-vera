import { describe, vi, expect } from "vitest";
import { render } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Modal", () => ({
  default: ({ children, open }) => (open ? <div data-testid="modal">{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => children,
}));

import EntryTokenModal from "../EntryTokenModal";

describe("EntryTokenModal", () => {
  qaTest("admin.entry.token.modal", () => {
    render(
      <EntryTokenModal
        open={true}
        onClose={vi.fn()}
        tokenUrl="https://example.com/entry?token=abc"
        expiresIn="24h"
        activeSessions={0}
        onRevoke={vi.fn()}
        onSendEmail={vi.fn()}
      />
    );
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});
