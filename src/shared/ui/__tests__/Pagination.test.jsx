import { describe, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { qaTest } from "../../../test/qaTest.js";
import Pagination from "../Pagination.jsx";

const BASE = {
  currentPage: 1,
  totalPages: 5,
  pageSize: 10,
  totalItems: 50,
  onPageChange: vi.fn(),
  onPageSizeChange: vi.fn(),
};

describe("ui/Pagination", () => {
  qaTest("ui.Pagination.01", () => {
    const { container } = render(<Pagination {...BASE} totalItems={0} />);
    expect(container.firstChild).toBeNull();
  });

  qaTest("ui.Pagination.02", () => {
    const { getByText } = render(<Pagination {...BASE} itemLabel="jurors" />);
    expect(getByText("1–10 of 50 jurors")).toBeTruthy();
  });

  qaTest("ui.Pagination.03", () => {
    render(<Pagination {...BASE} currentPage={1} />);
    expect(screen.getByLabelText("First page")).toBeDisabled();
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
  });

  qaTest("ui.Pagination.04", () => {
    const onPageChange = vi.fn();
    render(<Pagination {...BASE} currentPage={1} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText("3"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  qaTest("ui.Pagination.05", () => {
    const onPageSizeChange = vi.fn();
    render(
      <Pagination
        {...BASE}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={[10, 25]}
        pageSize={10}
      />
    );
    fireEvent.click(screen.getByText("25"));
    expect(onPageSizeChange).toHaveBeenCalledWith(25);
  });
});
