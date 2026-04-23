import { describe, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";
import Drawer from "../Drawer.jsx";

describe("ui/Drawer", () => {
  qaTest("ui.Drawer.01", () => {
    render(<Drawer open={true} onClose={vi.fn()}><p>Content</p></Drawer>);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  qaTest("ui.Drawer.02", () => {
    const { container } = render(
      <Drawer open={true} onClose={vi.fn()}><p>Content</p></Drawer>
    );
    const drawer = container.querySelector(".fs-drawer");
    expect(drawer.classList.contains("show")).toBe(true);
  });

  qaTest("ui.Drawer.03", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Drawer open={true} onClose={onClose}><p>Content</p></Drawer>
    );
    const overlay = container.querySelector(".fs-overlay");
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
