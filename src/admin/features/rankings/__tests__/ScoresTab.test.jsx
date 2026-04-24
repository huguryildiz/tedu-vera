import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("../RankingsPage", () => ({
  default: () => <div>RankingsPage</div>,
}));
vi.mock("@/admin/features/analytics/AnalyticsPage", () => ({
  default: () => <div>AnalyticsPage</div>,
}));
vi.mock("@/admin/features/reviews/ReviewsPage", () => ({
  default: () => <div>ReviewsPage</div>,
}));
vi.mock("@/admin/features/heatmap/HeatmapPage", () => ({
  default: () => <div>HeatmapPage</div>,
}));

import ScoresTab from "../ScoresTab";

describe("ScoresTab", () => {
  qaTest("coverage.scores-tab.renders-rankings", () => {
    render(<ScoresTab view="rankings" />);
    expect(screen.getByText("RankingsPage")).toBeInTheDocument();
  });
});
