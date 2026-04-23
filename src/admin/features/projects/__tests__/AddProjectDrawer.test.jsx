import { describe, vi, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Drawer", () => ({
  default: ({ open, children }) => (open ? <div>{children}</div> : null),
}));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => <span>{children}</span>,
}));
vi.mock("@/shared/hooks/useShakeOnError", () => ({
  default: () => ({ current: null }),
}));

import AddProjectDrawer from "../AddProjectDrawer";

describe("AddProjectDrawer", () => {
  qaTest("admin.projects.add.happy", async () => {
    const onSave = vi.fn().mockResolvedValue({ ok: true });
    render(
      <AddProjectDrawer open onClose={vi.fn()} onSave={onSave} error={null} />
    );

    expect(screen.getAllByText("Add Project").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("Project title"), {
      target: { value: "Smart Campus IoT" },
    });
    fireEvent.change(screen.getByPlaceholderText("Member 1"), {
      target: { value: "Ahmet Yılmaz" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add project/i }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    const [data] = onSave.mock.calls[0];
    expect(data.title).toBe("Smart Campus IoT");
    expect(data.members).toContain("Ahmet Yılmaz");
  });
});
