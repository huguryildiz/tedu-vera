import { describe, vi, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/shared/ui/Modal", () => ({
  default: ({ open, children }) => (open ? <div>{children}</div> : null),
}));
vi.mock("@/admin/utils/adminUtils", () => ({ formatTs: () => "" }));
vi.mock("@/admin/shared/ScoreStatusPill", () => ({ default: () => null }));

import JurorReviewsModal from "../JurorReviewsModal";

const noop = vi.fn();

describe("JurorReviewsModal", () => {
  qaTest("coverage.juror-reviews-modal.renders", () => {
    render(
      <JurorReviewsModal
        open={true}
        onClose={noop}
        onOpenFullReviews={noop}
        onViewProjectScores={noop}
        juror={{ juror_id: "j1", juryName: "Prof. Aslan" }}
        scoreRows={[]}
        projects={[]}
      />
    );
    expect(screen.getByText("Juror Reviews")).toBeInTheDocument();
  });
});
