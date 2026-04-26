import { describe, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";
import ProgressCell from "../components/ProgressCell";
import StatusPill from "../components/StatusPill";
import LifecycleBar from "../components/LifecycleBar";

describe("ProgressCell", () => {
  qaTest("coverage.progress-cell.draft-state", () => {
    const { container } = render(
      <ProgressCell period={{ id: "p1", is_locked: false }} stats={{}} />
    );
    expect(container.querySelector(".periods-progress-val")).toHaveTextContent("—");
  });

  qaTest("coverage.progress-cell.pct-value", () => {
    render(
      <ProgressCell
        period={{ id: "p1", is_locked: true, closed_at: null }}
        stats={{ p1: { progress: 75 } }}
      />
    );
    expect(screen.getByText("75%")).toBeInTheDocument();
  });
});

describe("StatusPill", () => {
  qaTest("coverage.status-pill.displays-draft-text-for-draft-status", () => {
    render(<StatusPill status="draft" />);
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  qaTest("coverage.status-pill.displays-live-text-for-live-status", () => {
    render(<StatusPill status="live" />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });
});

describe("LifecycleBar", () => {
  qaTest("coverage.lifecycle-bar.displays-segment-summary-text", () => {
    render(<LifecycleBar draft={2} published={1} live={3} closed={0} />);
    expect(screen.getByText(/2 draft/)).toBeInTheDocument();
    expect(screen.getByText(/3 live/)).toBeInTheDocument();
  });

  qaTest("coverage.lifecycle-bar.hidden-when-empty", () => {
    const { container } = render(
      <LifecycleBar draft={0} published={0} live={0} closed={0} />
    );
    expect(container.firstChild).toBeNull();
  });
});
