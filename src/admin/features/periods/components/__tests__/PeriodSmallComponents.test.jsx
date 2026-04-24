import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/hooks/useFloating", () => ({
  useFloating: () => ({ floatingRef: { current: null }, floatingStyle: {} }),
}));

import LifecycleGuide from "../LifecycleGuide";
import ReadinessPopover from "../ReadinessPopover";

describe("LifecycleGuide", () => {
  qaTest("coverage.lifecycle-guide.renders", () => {
    const { container } = render(<LifecycleGuide />);
    expect(container.firstChild).toBeTruthy();
  });

  qaTest("coverage.lifecycle-guide.toggle", () => {
    render(<LifecycleGuide />);
    expect(screen.getByText(/Draft/i)).toBeInTheDocument();
  });
});

describe("ReadinessPopover", () => {
  qaTest("coverage.readiness-popover.null-readiness", () => {
    const { container } = render(<ReadinessPopover readiness={null} onFix={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  qaTest("coverage.readiness-popover.renders-badge", () => {
    const readiness = { ready: false, checks: [{ label: "Projects", ok: false }] };
    const { container } = render(<ReadinessPopover readiness={readiness} onFix={vi.fn()} />);
    expect(container.firstChild).toBeTruthy();
  });
});
