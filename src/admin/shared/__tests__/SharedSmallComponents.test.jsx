import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/shared/SendReportModal", () => ({ default: () => null }));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => <>{children}</>,
}));

import ProjectAveragesCard from "../ProjectAveragesCard";

describe("ProjectAveragesCard", () => {
  qaTest("coverage.project-averages-card.with-data", () => {
    const groups = [{ id: "g1", group_no: 1, title: "Alpha Team" }];
    render(
      <ProjectAveragesCard groups={groups} averages={[82.5]} overall={82.5} tabMax={100} />
    );
    expect(screen.getByText("Alpha Team")).toBeInTheDocument();
    expect(screen.getAllByText("82.5").length).toBeGreaterThan(0);
  });
});
