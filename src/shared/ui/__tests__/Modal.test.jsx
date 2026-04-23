import { describe, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";
import Modal from "../Modal.jsx";

describe("ui/Modal", () => {
  qaTest("ui.Modal.01", () => {
    render(<Modal open={true} onClose={vi.fn()}><p>Content</p></Modal>);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute("aria-modal")).toBe("true");
  });

  qaTest("ui.Modal.02", () => {
    const onClose = vi.fn();
    const { container } = render(
      <Modal open={true} onClose={onClose}><p>Content</p></Modal>
    );
    const overlay = container.querySelector(".fs-modal-wrap");
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  qaTest("ui.Modal.03", () => {
    const { container } = render(
      <Modal open={true} onClose={vi.fn()} size="lg"><p>Content</p></Modal>
    );
    const modal = container.querySelector(".fs-modal");
    expect(modal.classList.contains("lg")).toBe(true);
  });
});
