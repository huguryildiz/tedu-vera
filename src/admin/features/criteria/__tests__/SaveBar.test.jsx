import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";
import SaveBar from "../SaveBar";

describe("SaveBar", () => {
  qaTest("coverage.save-bar.hidden-when-clean", () => {
    const { container } = render(
      <SaveBar isDirty={false} canSave onSave={vi.fn()} onDiscard={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  qaTest("coverage.save-bar.shows-unsaved-message", () => {
    render(
      <SaveBar isDirty canSave total={80} onSave={vi.fn()} onDiscard={vi.fn()} />
    );
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument();
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  qaTest("component.save-bar.disabled-when-weight-not-100", () => {
    // Save disabled when weight !== 100: canSave=false when total weight is not 100
    render(
      <SaveBar isDirty={true} canSave={false} total={80} onSave={vi.fn()} onDiscard={vi.fn()} />
    );
    expect(screen.getByText("Save Changes")).toBeDisabled();
  });
});
