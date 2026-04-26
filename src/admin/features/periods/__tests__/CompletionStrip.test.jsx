import { describe, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

import CompletionStrip from "../CompletionStrip";

describe("CompletionStrip", () => {
  qaTest("coverage.completion-strip.displays-completion-fraction-text", () => {
    render(<CompletionStrip metrics={{ completedJurors: 3, totalJurors: 5 }} />);
    expect(screen.getByText(/3 of 5 jurors completed/)).toBeInTheDocument();
    expect(screen.getByText(/2 pending/)).toBeInTheDocument();
  });

  qaTest("coverage.completion-strip.null-on-no-metrics", () => {
    const { container } = render(<CompletionStrip metrics={null} />);
    expect(container.firstChild).toBeNull();
  });
});
