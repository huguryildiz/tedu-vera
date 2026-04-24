import { describe, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { qaTest } from "@/test/qaTest";

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "../ui/table";
import AuthRouteLayout from "../../layouts/AuthRouteLayout";

describe("UI Table components", () => {
  qaTest("coverage.ui-table.renders", () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Header</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
        <TableCaption>Caption</TableCaption>
      </Table>
    );
    expect(container.querySelector("table")).toBeInTheDocument();
    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.getByText("Cell")).toBeInTheDocument();
  });
});

describe("AuthRouteLayout", () => {
  qaTest("coverage.auth-route-layout.renders", () => {
    const { container } = render(
      <MemoryRouter>
        <AuthRouteLayout />
      </MemoryRouter>
    );
    expect(container).toBeInTheDocument();
  });
});
