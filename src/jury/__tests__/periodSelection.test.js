import { describe, expect, it } from "vitest";
import {
  buildTokenPeriod,
  isEvaluablePeriod,
  listEvaluablePeriods,
  pickDemoPeriod,
  pickDefaultPeriod,
} from "../shared/periodSelection";

describe("periodSelection", () => {
  it("buildTokenPeriod maps entry-token payload to period shape", () => {
    const period = buildTokenPeriod({
      period_id: "p1",
      period_name: "Fall 2026",
      is_locked: true,
      closed_at: null,
    });
    expect(period).toEqual({
      id: "p1",
      name: "Fall 2026",
      is_locked: true,
      closed_at: null,
    });
  });

  it("returns evaluable periods only (Published/Live = locked and not closed)", () => {
    const periods = [
      { id: "live", is_locked: true, closed_at: null },
      { id: "closed", is_locked: true, closed_at: "2026-01-01T00:00:00Z" },
      { id: "draft", is_locked: false, closed_at: null },
    ];
    expect(listEvaluablePeriods(periods).map((p) => p.id)).toEqual(["live"]);
    expect(isEvaluablePeriod(periods[0])).toBe(true);
    expect(isEvaluablePeriod(periods[1])).toBe(false);
    expect(isEvaluablePeriod(periods[2])).toBe(false);
  });

  it("prefers token period over list ordering in demo mode", () => {
    const periods = [
      { id: "old", name: "Old", is_locked: true, closed_at: null },
      { id: "token", name: "Token From List", is_locked: true, closed_at: null, end_date: "2026-06-15" },
    ];
    const selected = pickDemoPeriod(periods, {
      id: "token",
      name: "Token Base",
      is_locked: true,
      closed_at: null,
    });

    expect(selected?.id).toBe("token");
    expect(selected?.name).toBe("Token From List");
    expect(selected?.end_date).toBe("2026-06-15");
  });

  it("falls back to first evaluable period when token is absent", () => {
    const periods = [
      { id: "draft", is_locked: false, closed_at: null },
      { id: "ok", is_locked: true, closed_at: null },
      { id: "closed", is_locked: true, closed_at: "2026-01-01T00:00:00Z" },
    ];
    expect(pickDemoPeriod(periods, null)?.id).toBe("ok");
  });

  it("pickDefaultPeriod prefers most recent Published/Live", () => {
    const periods = [
      { id: "old-live", is_locked: true, closed_at: null, activated_at: "2026-01-01T00:00:00Z" },
      { id: "new-live", is_locked: true, closed_at: null, activated_at: "2026-04-01T00:00:00Z" },
      { id: "closed",   is_locked: true, closed_at: "2026-05-01T00:00:00Z", activated_at: "2026-05-01T00:00:00Z" },
    ];
    expect(pickDefaultPeriod(periods)?.id).toBe("new-live");
  });

  it("pickDefaultPeriod falls back to most recent Closed when no active", () => {
    const periods = [
      { id: "draft",     is_locked: false, closed_at: null,                 activated_at: null },
      { id: "closed-a",  is_locked: true,  closed_at: "2026-01-01T00:00:00Z", activated_at: "2025-09-01T00:00:00Z" },
      { id: "closed-b",  is_locked: true,  closed_at: "2026-03-01T00:00:00Z", activated_at: "2025-12-01T00:00:00Z" },
    ];
    expect(pickDefaultPeriod(periods)?.id).toBe("closed-b");
  });

  it("pickDefaultPeriod falls back to Draft when only drafts exist", () => {
    const periods = [{ id: "d", is_locked: false, closed_at: null }];
    expect(pickDefaultPeriod(periods)?.id).toBe("d");
  });

  it("pickDefaultPeriod returns null for empty list", () => {
    expect(pickDefaultPeriod([])).toBeNull();
    expect(pickDefaultPeriod(null)).toBeNull();
  });
});
