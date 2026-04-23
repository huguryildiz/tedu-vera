import { describe, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";

import AlertCard from "../AlertCard.jsx";
import Avatar from "../Avatar.jsx";
import { avatarGradient, initials } from "../avatarColor.js";
import LevelPill from "../LevelPill.jsx";
import ErrorBoundary from "../ErrorBoundary.jsx";
import MinimalLoaderOverlay from "../MinimalLoaderOverlay.jsx";
import StatCard from "../StatCard.jsx";
import BlockingValidationAlert from "../BlockingValidationAlert.jsx";
import Tooltip from "../Tooltip.jsx";
import ConfirmModal from "../ConfirmModal.jsx";
import AutoGrow from "../AutoGrow.jsx";
import AutoTextarea from "../AutoTextarea.jsx";
import AsyncButtonContent from "../AsyncButtonContent.jsx";
import CollapsibleEditorItem from "../CollapsibleEditorItem.jsx";
import { GroupLabel } from "../EntityMeta.jsx";
import FloatingMenu from "../FloatingMenu.jsx";
import GroupedCombobox from "../GroupedCombobox.jsx";
import { HomeIcon } from "../Icons.jsx";
import SpotlightTour from "../SpotlightTour.jsx";

describe("ui/smoke", () => {
  qaTest("ui.AlertCard.01", () => {
    render(<AlertCard variant="warning" title="Warning" message="Something happened" />);
    expect(screen.getByText("Warning")).toBeTruthy();
  });

  qaTest("ui.Avatar.01", () => {
    const { container } = render(<Avatar initials="AB" />);
    expect(container.firstChild).toBeTruthy();
    expect(container.firstChild.textContent).toContain("AB");
  });

  qaTest("ui.avatarColor.01", () => {
    expect(avatarGradient("Alice")).toMatch(/^linear-gradient\(/);
    expect(initials("Alice Doe")).toBe("AD");
  });

  qaTest("ui.LevelPill.01", () => {
    render(<LevelPill variant="excellent">Excellent</LevelPill>);
    expect(screen.getByText("Excellent")).toBeTruthy();
  });

  qaTest("ui.ErrorBoundary.01", () => {
    render(
      <ErrorBoundary>
        <span data-testid="safe">Safe content</span>
      </ErrorBoundary>
    );
    expect(screen.getByTestId("safe")).toBeTruthy();
  });

  qaTest("ui.MinimalLoaderOverlay.01", () => {
    const { container } = render(<MinimalLoaderOverlay open={false} />);
    expect(container.firstChild).toBeNull();
  });

  qaTest("ui.StatCard.01", () => {
    render(<StatCard value={42} label="Total" />);
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("Total")).toBeTruthy();
  });

  qaTest("ui.BlockingValidationAlert.01", () => {
    render(<BlockingValidationAlert message="Fix errors before proceeding" />);
    expect(screen.getByText("Fix errors before proceeding")).toBeTruthy();
  });

  qaTest("ui.Tooltip.01", () => {
    render(
      <Tooltip text="Tooltip content">
        <button>Hover me</button>
      </Tooltip>
    );
    expect(screen.getByText("Hover me")).toBeTruthy();
  });

  qaTest("ui.ConfirmModal.01", () => {
    render(
      <ConfirmModal
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete item"
        description="Are you sure?"
      />
    );
    expect(screen.getByText("Delete item")).toBeTruthy();
  });

  qaTest("ui.AutoGrow.01", () => {
    render(<AutoGrow value="" onChange={vi.fn()} placeholder="Type here" />);
    expect(screen.getByPlaceholderText("Type here")).toBeTruthy();
  });

  qaTest("ui.AutoTextarea.01", () => {
    render(<AutoTextarea value="" onChange={vi.fn()} placeholder="Write something" />);
    expect(screen.getByPlaceholderText("Write something")).toBeTruthy();
  });

  qaTest("ui.AsyncButtonContent.01", () => {
    render(
      <AsyncButtonContent loading={false}>
        <span>Save</span>
      </AsyncButtonContent>
    );
    expect(screen.getByText("Save")).toBeTruthy();
  });

  qaTest("ui.CollapsibleEditorItem.01", () => {
    render(
      <CollapsibleEditorItem
        open={true}
        onToggle={vi.fn()}
        summaryLabel="Edit item"
        summary={<span>Item summary</span>}
      >
        <span>Body content</span>
      </CollapsibleEditorItem>
    );
    expect(screen.getByText("Item summary")).toBeTruthy();
  });

  qaTest("ui.EntityMeta.01", () => {
    const { container } = render(<GroupLabel text="Group 1" />);
    expect(container.querySelector(".entity-group-label")).toBeTruthy();
  });

  qaTest("ui.FloatingMenu.01", () => {
    render(
      <FloatingMenu
        trigger={<button>Open</button>}
        isOpen={false}
        onClose={vi.fn()}
      >
        <span>Menu item</span>
      </FloatingMenu>
    );
    expect(screen.getByText("Open")).toBeTruthy();
  });

  qaTest("ui.GroupedCombobox.01", () => {
    render(
      <GroupedCombobox
        value=""
        onChange={vi.fn()}
        options={[{ value: "a", label: "Option A", group: "Group 1" }]}
        placeholder="Select..."
      />
    );
    expect(screen.getByText("Select...")).toBeTruthy();
  });

  qaTest("ui.Icons.01", () => {
    const { container } = render(<HomeIcon size={20} />);
    expect(container.firstChild).toBeTruthy();
  });

  qaTest("ui.SpotlightTour.01", () => {
    const { container } = render(
      <SpotlightTour
        steps={[{ selector: "#noop", title: "Step 1", body: "Body", placement: "below" }]}
        sessionKey="test_tour_smoke"
      />
    );
    expect(container).toBeTruthy();
  });
});
