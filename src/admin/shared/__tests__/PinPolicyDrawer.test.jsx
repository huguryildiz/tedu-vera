import { describe, vi, expect } from "vitest";
import { render } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

import PinPolicyDrawer from "../PinPolicyDrawer";

describe("PinPolicyDrawer", () => {
  qaTest("coverage.pin-policy-drawer.renders", () => {
    const policy = { maxPinAttempts: 5, pinLockCooldown: "30m", qrTtl: "24h" };
    const { container } = render(
      <PinPolicyDrawer
        open={true}
        onClose={vi.fn()}
        policy={policy}
        onSave={vi.fn()}
        error={null}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });
});
