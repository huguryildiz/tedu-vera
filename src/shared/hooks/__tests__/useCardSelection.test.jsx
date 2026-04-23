import { describe, expect } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";
import useCardSelection from "../useCardSelection.js";

function Fixture({ cards = 2, withInlineControl = false }) {
  const scopeRef = useCardSelection();
  return (
    <div ref={scopeRef} data-testid="scope">
      {Array.from({ length: cards }, (_, i) => (
        <div
          key={i}
          data-card-selectable
          className="card"
          data-testid={`card-${i}`}
        >
          {withInlineControl && i === 0 && (
            <button className="row-inline-control" data-testid="inline-btn" />
          )}
        </div>
      ))}
    </div>
  );
}

describe("hooks/useCardSelection", () => {
  qaTest("hooks.useCardSelection.01", () => {
    const { getByTestId } = render(<Fixture />);
    expect(getByTestId("scope")).toBeTruthy();
  });

  qaTest("hooks.useCardSelection.02", () => {
    const { getByTestId } = render(<Fixture cards={2} />);
    const card0 = getByTestId("card-0");
    const card1 = getByTestId("card-1");

    fireEvent.pointerDown(card0);
    expect(card0.classList.contains("is-selected")).toBe(true);
    expect(card1.classList.contains("is-selected")).toBe(false);

    fireEvent.pointerDown(card1);
    expect(card1.classList.contains("is-selected")).toBe(true);
    expect(card0.classList.contains("is-selected")).toBe(false);
  });

  qaTest("hooks.useCardSelection.03", () => {
    const { getByTestId } = render(<Fixture cards={1} withInlineControl={true} />);
    const card = getByTestId("card-0");
    const inlineBtn = getByTestId("inline-btn");

    fireEvent.pointerDown(inlineBtn);
    expect(card.classList.contains("is-selected")).toBe(false);
  });
});
