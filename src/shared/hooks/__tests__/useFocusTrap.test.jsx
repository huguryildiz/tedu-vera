import { describe, expect, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { useRef } from "react";
import { qaTest } from "../../../test/qaTest.js";
import { useFocusTrap } from "../useFocusTrap.js";

function Fixture({ isOpen, onClose }) {
  const containerRef = useRef(null);
  useFocusTrap({ containerRef, isOpen, onClose });
  return (
    <div ref={containerRef} data-testid="dialog">
      <button data-testid="btn-a">A</button>
      <button data-testid="btn-b">B</button>
    </div>
  );
}

describe("hooks/useFocusTrap", () => {
  qaTest("hooks.useFocusTrap.01", () => {
    const onClose = vi.fn();
    render(<Fixture isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  qaTest("hooks.useFocusTrap.02", () => {
    const onClose = vi.fn();
    render(<Fixture isOpen={false} onClose={onClose} />);

    // Escape does not call onClose when dialog is closed
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });
});
