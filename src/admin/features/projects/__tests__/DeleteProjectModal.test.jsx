import { describe, vi, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Modal", () => ({
  default: ({ open, children }) => (open ? <div>{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => <span>{children}</span>,
}));
vi.mock("@/shared/ui/EntityMeta", () => ({ TeamMemberNames: () => null }));

import DeleteProjectModal from "../DeleteProjectModal";

const PROJECT = { id: "proj-001", title: "Smart Campus IoT" };

describe("DeleteProjectModal", () => {
  qaTest("admin.projects.delete.confirm", () => {
    render(
      <DeleteProjectModal
        open
        onClose={vi.fn()}
        project={PROJECT}
        impact={{}}
        onDelete={vi.fn()}
        periodName="Spring 2026"
      />
    );

    expect(screen.getByText("Delete Project?")).toBeInTheDocument();

    const deleteBtn = screen.getByRole("button", { name: /delete project/i });
    expect(deleteBtn).toBeDisabled();

    fireEvent.change(
      screen.getByPlaceholderText(/Type Smart Campus IoT to confirm/i),
      { target: { value: "Smart Campus IoT" } }
    );

    expect(deleteBtn).not.toBeDisabled();
  });
});
