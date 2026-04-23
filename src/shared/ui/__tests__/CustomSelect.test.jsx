import { describe, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { within } from "@testing-library/dom";
import { qaTest } from "../../../test/qaTest.js";
import CustomSelect from "../CustomSelect.jsx";

const OPTIONS = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
];

describe("ui/CustomSelect", () => {
  qaTest("ui.CustomSelect.01", () => {
    const { getByText } = render(
      <CustomSelect options={OPTIONS} placeholder="Pick one" />
    );
    expect(getByText("Pick one")).toBeTruthy();
  });

  qaTest("ui.CustomSelect.02", () => {
    const { getByText } = render(
      <CustomSelect options={OPTIONS} value="b" />
    );
    expect(getByText("Option B")).toBeTruthy();
  });

  qaTest("ui.CustomSelect.03", () => {
    const { getByRole } = render(<CustomSelect options={OPTIONS} />);
    const btn = getByRole("button");

    fireEvent.click(btn);
    expect(document.body.querySelector('[role="listbox"]')).not.toBeNull();
  });

  qaTest("ui.CustomSelect.04", () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <CustomSelect options={OPTIONS} onChange={onChange} />
    );
    fireEvent.click(getByRole("button"));

    const optionA = document.body.querySelector('[role="option"]');
    fireEvent.mouseDown(optionA);
    expect(onChange).toHaveBeenCalledWith("a");
  });

  qaTest("ui.CustomSelect.05", () => {
    const { getByRole } = render(
      <CustomSelect options={OPTIONS} disabled />
    );
    expect(getByRole("button")).toBeDisabled();
  });
});
