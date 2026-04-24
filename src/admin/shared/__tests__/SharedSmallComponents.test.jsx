import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";
import { ThemeProvider } from "@/shared/theme/ThemeProvider";

vi.mock("@/admin/shared/SendReportModal", () => ({ default: () => null }));
vi.mock("@/shared/ui/AsyncButtonContent", () => ({
  default: ({ children }) => <>{children}</>,
}));

import ProjectAveragesCard from "../ProjectAveragesCard";
import ExportPanel from "../ExportPanel";
import JurorHeatmapCard from "../JurorHeatmapCard";

describe("ProjectAveragesCard", () => {
  qaTest("coverage.project-averages-card.empty", () => {
    render(<ProjectAveragesCard groups={[]} averages={[]} overall={null} />);
    expect(screen.getByText("Project Averages")).toBeInTheDocument();
  });

  qaTest("coverage.project-averages-card.with-data", () => {
    const groups = [{ id: "g1", group_no: 1, title: "Alpha Team" }];
    render(
      <ProjectAveragesCard groups={groups} averages={[82.5]} overall={82.5} tabMax={100} />
    );
    expect(screen.getByText("Alpha Team")).toBeInTheDocument();
    expect(screen.getAllByText("82.5").length).toBeGreaterThan(0);
  });
});

describe("ExportPanel", () => {
  qaTest("coverage.export-panel.renders", () => {
    render(
      <ExportPanel
        title="Export Scores"
        onClose={vi.fn()}
        onExport={vi.fn()}
      />
    );
    expect(screen.getByText(/Export Scores/)).toBeInTheDocument();
  });
});

describe("JurorHeatmapCard", () => {
  qaTest("coverage.juror-heatmap-card.renders", () => {
    const juror = { name: "Dr. Smith", affiliation: "Engineering" };
    render(
      <ThemeProvider>
        <JurorHeatmapCard
          juror={juror}
          avg={75}
          tabMax={100}
          tabLabel="Total"
          status="completed"
          rows={[]}
        />
      </ThemeProvider>
    );
    expect(screen.getByText("Dr. Smith")).toBeInTheDocument();
  });
});
