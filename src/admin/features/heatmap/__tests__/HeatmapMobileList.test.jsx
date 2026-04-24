import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

import HeatmapMobileList from "../HeatmapMobileList";

describe("HeatmapMobileList", () => {
  qaTest("coverage.heatmap-mobile-list.empty-state", () => {
    render(
      <HeatmapMobileList
        visibleJurors={[]}
        groups={[]}
        lookup={{}}
        activeTab="total"
        activeCriteria={[]}
        tabLabel="Total"
        tabMax={100}
        jurorRowAvgs={{}}
        visibleAverages={[]}
        overallAvg={null}
        jurorWorkflowMap={{}}
        getCellDisplay={vi.fn()}
      />
    );
    expect(screen.getByText("No Jurors to Display")).toBeInTheDocument();
  });
});
