import { describe, expect } from "vitest";
import { render } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";
import FbAlert from "../FbAlert.jsx";

describe("ui/FbAlert", () => {
  qaTest("ui.FbAlert.01", () => {
    const { container } = render(<FbAlert variant="danger">msg</FbAlert>);
    expect(container.querySelector(".fba-danger")).not.toBeNull();
  });

  qaTest("ui.FbAlert.02", () => {
    const { getByText } = render(
      <FbAlert variant="info" title="Heads up">body text</FbAlert>
    );
    expect(getByText("Heads up")).toBeTruthy();
  });

  qaTest("ui.FbAlert.03", () => {
    const { getByText } = render(
      <FbAlert variant="success">Operation complete</FbAlert>
    );
    expect(getByText("Operation complete")).toBeTruthy();
  });

  qaTest("ui.FbAlert.04", () => {
    const { container } = render(
      <FbAlert variant="warning" className="extra">msg</FbAlert>
    );
    const root = container.firstChild;
    expect(root.classList.contains("fba-warning")).toBe(true);
    expect(root.classList.contains("extra")).toBe(true);
  });
});
