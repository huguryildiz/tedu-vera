import { describe, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";
import InlineError from "../InlineError.jsx";

describe("ui/InlineError", () => {
  qaTest("ui.InlineError.01", () => {
    const { container } = render(<InlineError>{""}</InlineError>);
    expect(container.firstChild).toBeNull();
  });

  qaTest("ui.InlineError.02", () => {
    render(<InlineError>Field is required</InlineError>);
    const alert = screen.getByRole("alert");
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain("Field is required");
  });
});
