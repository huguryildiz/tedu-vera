import { describe, vi, expect } from "vitest";
import { render } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

vi.mock("@/admin/shared/ScoreStatusPill", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorStatusPill", () => ({ default: () => null }));
vi.mock("@/admin/shared/JurorBadge", () => ({ default: () => null }));

import ReviewMobileCard from "../ReviewMobileCard";

describe("ReviewMobileCard", () => {
  qaTest("coverage.review-mobile-card.renders", () => {
    const row = {
      jurorKey: "j1",
      jurorName: "Dr. Smith",
      affiliation: "Engineering",
      effectiveStatus: "complete",
      finalSubmittedAt: null,
      updatedAt: null,
    };
    const { container } = render(
      <ReviewMobileCard
        row={row}
        criteria={[]}
      />
    );
    expect(container.firstChild).toBeTruthy();
  });
});
