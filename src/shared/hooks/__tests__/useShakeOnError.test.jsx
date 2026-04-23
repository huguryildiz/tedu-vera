import { describe, expect } from "vitest";
import { render, act } from "@testing-library/react";
import { useState } from "react";
import { qaTest } from "../../../test/qaTest.js";
import useShakeOnError from "../useShakeOnError.js";

function Fixture({ error }) {
  const btnRef = useShakeOnError(error);
  return <button ref={btnRef} data-testid="btn">Save</button>;
}

function ControlledFixture() {
  const [error, setError] = useState(null);
  const btnRef = useShakeOnError(error);
  return (
    <>
      <button ref={btnRef} data-testid="btn">Save</button>
      <button data-testid="trigger" onClick={() => setError("some error")} />
      <button data-testid="keep" onClick={() => setError("same")} />
    </>
  );
}

describe("hooks/useShakeOnError", () => {
  qaTest("hooks.useShakeOnError.01", () => {
    const { getByTestId, rerender } = render(<Fixture error={null} />);
    const btn = getByTestId("btn");

    rerender(<Fixture error="Failed to save" />);
    expect(btn.classList.contains("vera-btn-shake")).toBe(true);
  });

  qaTest("hooks.useShakeOnError.02", () => {
    const { getByTestId, rerender } = render(<Fixture error="error" />);
    const btn = getByTestId("btn");
    // Already has shake from first render with truthy error
    btn.classList.remove("vera-btn-shake");

    // Re-render with same truthy error — should NOT re-add shake
    rerender(<Fixture error="error" />);
    expect(btn.classList.contains("vera-btn-shake")).toBe(false);
  });
});
