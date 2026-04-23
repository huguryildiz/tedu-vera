import { describe, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";
import ToastContainer from "../ToastContainer.jsx";
import { toastStore } from "../../lib/toastStore.js";

describe("ui/ToastContainer", () => {
  qaTest("ui.ToastContainer.01", () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  qaTest("ui.ToastContainer.02", () => {
    render(<ToastContainer />);
    act(() => {
      toastStore.emit({ type: "success", message: "Toast message" });
    });
    expect(screen.getByText("Toast message")).toBeTruthy();
  });
});
