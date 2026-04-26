import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/hooks/useFloating", () => ({
  useFloating: () => ({ floatingRef: { current: null }, floatingStyle: {} }),
}));

import LifecycleGuide from "../LifecycleGuide";
import ReadinessPopover from "../ReadinessPopover";

describe("LifecycleGuide", () => {
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

});
