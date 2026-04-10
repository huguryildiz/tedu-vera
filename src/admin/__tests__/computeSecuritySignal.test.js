// src/admin/__tests__/computeSecuritySignal.test.js
import { describe, expect } from "vitest";
import { qaTest } from "../../test/qaTest.js";
import {
  computeSecuritySignal,
  SESSION_COUNT_WARN,
  SESSION_COUNT_BAD,
  COUNTRY_WARN,
  COUNTRY_BAD,
  LAST_LOGIN_WARN_DAYS,
  LAST_LOGIN_BAD_DAYS,
  EXPIRED_WARN,
  EXPIRED_BAD,
} from "../utils/computeSecuritySignal.js";

const NOW = new Date("2026-04-10T12:00:00.000Z").getTime();

function buildSession(overrides = {}) {
  return {
    id: "s1",
    device_id: "d1",
    country_code: "TR",
    expires_at: new Date(NOW + 3600_000).toISOString(),
    ...overrides,
  };
}

describe("computeSecuritySignal", () => {
  qaTest("settings.security.signal.01", () => {
    const result = computeSecuritySignal({
      adminSessions: [buildSession()],
      lastLoginAt: new Date(NOW - 2 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.state).toBe("secure");
    expect(result.verdict.title).toBeNull();
    expect(result.verdict.reason).toBeNull();
    expect(result.signals.sessionCount.severity).toBe("ok");
    expect(result.signals.countryDiversity.severity).toBe("ok");
    expect(result.signals.lastLoginFreshness.severity).toBe("ok");
    expect(result.signals.expiredSessions.severity).toBe("ok");
  });

  qaTest("settings.security.signal.02", () => {
    const sessions = Array.from({ length: SESSION_COUNT_WARN }, (_, i) =>
      buildSession({ id: `s${i}`, device_id: `d${i}` }),
    );
    const result = computeSecuritySignal({
      adminSessions: sessions,
      lastLoginAt: new Date(NOW - 2 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.state).toBe("review");
    expect(result.signals.sessionCount.severity).toBe("warn");
    expect(result.verdict.title).toBe("This account needs a review.");
    expect(result.verdict.reason).toContain("active sessions");
  });

  qaTest("settings.security.signal.03", () => {
    const sessions = Array.from({ length: SESSION_COUNT_BAD }, (_, i) =>
      buildSession({ id: `s${i}`, device_id: `d${i}` }),
    );
    const result = computeSecuritySignal({
      adminSessions: sessions,
      lastLoginAt: new Date(NOW - 2 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.state).toBe("risk");
    expect(result.signals.sessionCount.severity).toBe("bad");
    expect(result.verdict.title).toBe("This account is at risk.");
  });

  qaTest("settings.security.signal.04", () => {
    const sessions = [
      buildSession({ id: "s1", device_id: "d1", country_code: "TR" }),
      buildSession({ id: "s2", device_id: "d2", country_code: "DE" }),
      buildSession({ id: "s3", device_id: "d3", country_code: "TR" }),
      buildSession({ id: "s4", device_id: "d4", country_code: "TR" }),
    ];
    const result = computeSecuritySignal({
      adminSessions: sessions,
      lastLoginAt: new Date(NOW - 21 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.state).toBe("review");
    expect(result.verdict.reason).toMatch(/active sessions.*and.*days of inactivity/);
  });
});

describe("computeSecuritySignal — thresholds", () => {
  qaTest("settings.security.signal.05", () => {
    const warnBoundary = computeSecuritySignal({
      adminSessions: Array.from({ length: SESSION_COUNT_WARN - 1 }, (_, i) =>
        buildSession({ id: `s${i}`, device_id: `d${i}` }),
      ),
      lastLoginAt: new Date(NOW - 1 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(warnBoundary.signals.sessionCount.severity).toBe("ok");

    const badBoundary = computeSecuritySignal({
      adminSessions: Array.from({ length: SESSION_COUNT_BAD }, (_, i) =>
        buildSession({ id: `s${i}`, device_id: `d${i}` }),
      ),
      lastLoginAt: new Date(NOW - 1 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(badBoundary.signals.sessionCount.severity).toBe("bad");
  });
});

describe("computeSecuritySignal — loading and edge cases", () => {
  qaTest("settings.security.signal.06", () => {
    const result = computeSecuritySignal({
      adminSessions: [],
      lastLoginAt: null,
      loading: true,
      now: NOW,
    });
    expect(result.state).toBe("loading");
    expect(result.verdict.title).toBeNull();
  });

  qaTest("settings.security.signal.07", () => {
    // Empty sessions but fresh login → treat as 1 session, secure
    const result = computeSecuritySignal({
      adminSessions: [],
      lastLoginAt: new Date(NOW - 2 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.state).toBe("secure");
    expect(result.signals.sessionCount.value).toBe(1);
  });

  qaTest("settings.security.signal.08", () => {
    // All sessions have null country_code → diversity value 0, severity ok
    const result = computeSecuritySignal({
      adminSessions: [
        buildSession({ country_code: null }),
        buildSession({ id: "s2", device_id: "d2", country_code: null }),
      ],
      lastLoginAt: new Date(NOW - 2 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.signals.countryDiversity.value).toBe(0);
    expect(result.signals.countryDiversity.severity).toBe("ok");
  });

  qaTest("settings.security.signal.09", () => {
    // Expired sessions only: 2 expired → bad
    const result = computeSecuritySignal({
      adminSessions: [
        buildSession({ expires_at: new Date(NOW - 3600_000).toISOString() }),
        buildSession({ id: "s2", device_id: "d2", expires_at: new Date(NOW - 7200_000).toISOString() }),
      ],
      lastLoginAt: new Date(NOW - 2 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.signals.expiredSessions.value).toBe(2);
    expect(result.signals.expiredSessions.severity).toBe("bad");
    expect(result.state).toBe("risk");
  });
});
