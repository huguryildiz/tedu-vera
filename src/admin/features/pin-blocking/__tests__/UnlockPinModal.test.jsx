import { describe, vi, expect } from "vitest";
import { render } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Modal", () => ({
  default: ({ children, open }) => (open ? <div data-testid="modal">{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => children,
}));
vi.mock("@/shared/api/admin/notifications", () => ({
  sendJurorPinEmail: vi.fn().mockResolvedValue({ error: null }),
}));
vi.mock("@/shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import UnlockPinModal from "../UnlockPinModal";

describe("UnlockPinModal", () => {
  qaTest("admin.pin.unlock.modal", () => {
    render(
      <UnlockPinModal
        open={true}
        onClose={vi.fn()}
        pin="1234"
        jurorId="juror-001"
        jurorName="Test Juror"
        affiliation="Test University"
        email="juror@test.com"
        periodId="period-001"
        periodName="Spring 2026"
        organizationId="org-001"
      />
    );
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });
});
