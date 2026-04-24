import { describe, expect } from "vitest";
import { qaTest } from "@/test/qaTest";
import { computeSecuritySignal } from "../computeSecuritySignal";

const NOW = new Date("2024-06-01T00:00:00Z").getTime();

describe("computeSecuritySignal", () => {
  qaTest("coverage.security-signal.secure", () => {
    const result = computeSecuritySignal({
      adminSessions: [{ country_code: "TR", expires_at: "2030-01-01" }],
      lastLoginAt: "2024-05-30T00:00:00Z",
      loading: false,
      now: NOW,
    });
    expect(result.state).toBe("secure");
    expect(result.verdict.title).toBeNull();
  });

  qaTest("coverage.security-signal.risk", () => {
    const sessions = Array.from({ length: 6 }, (_, i) => ({
      country_code: `C${i}`,
      expires_at: "2030-01-01",
    }));
    const result = computeSecuritySignal({
      adminSessions: sessions,
      lastLoginAt: "2024-05-30T00:00:00Z",
      loading: false,
      now: NOW,
    });
    expect(result.state).toBe("risk");
    expect(result.verdict.title).toBeTruthy();
  });

  qaTest("coverage.security-signal.loading", () => {
    const result = computeSecuritySignal({ adminSessions: [], lastLoginAt: null, loading: true });
    expect(result.state).toBe("loading");
    expect(result.signals.sessionCount.severity).toBe("ok");
  });
});
