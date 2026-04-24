// src/shared/storage/__tests__/storagePolicy.test.js
// Storage policy compliance: KEYS constants, try/catch guards, dual-write,
// Safari private mode resilience, JSON parse fallback.

import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { qaTest } from "../../../test/qaTest.js";
import { KEYS } from "../keys.js";

// ── Helpers ──────────────────────────────────────────────────

function makeStorage(throwOnWrite = false, throwAlways = false) {
  const store = {};
  return {
    _store: store,
    getItem: vi.fn((k) => {
      if (throwAlways) throw new DOMException("SecurityError", "SecurityError");
      return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
    }),
    setItem: vi.fn((k, v) => {
      if (throwAlways || throwOnWrite)
        throw new DOMException("QuotaExceededError", "QuotaExceededError");
      store[k] = String(v);
    }),
    removeItem: vi.fn((k) => {
      if (throwAlways) throw new DOMException("SecurityError", "SecurityError");
      delete store[k];
    }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
  };
}

let ls;
let ss;

beforeEach(() => {
  ls = makeStorage();
  ss = makeStorage();
  vi.stubGlobal("localStorage", ls);
  vi.stubGlobal("sessionStorage", ss);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

// ── juryStorage ──────────────────────────────────────────────

import * as juryStorage from "../juryStorage.js";

describe("juryStorage — round-trip and namespace", () => {
  qaTest("storage.policy.01", () => {
    juryStorage.setJuryAccess("period-42");
    expect(juryStorage.getJuryAccess()).toBe("period-42");
  });

  qaTest("storage.policy.02", () => {
    juryStorage.setJuryAccess("period-1");
    const key = ls.setItem.mock.calls[0]?.[0];
    expect(key).toBe(KEYS.JURY_ACCESS);
    expect(key).not.toMatch(/hardcoded/);
  });

  qaTest("storage.policy.03", () => {
    vi.stubGlobal("localStorage", makeStorage(true));
    vi.stubGlobal("sessionStorage", makeStorage(true));
    expect(() => juryStorage.setJuryAccess("period-1")).not.toThrow();
  });

  qaTest("storage.policy.04", () => {
    vi.stubGlobal("localStorage", makeStorage(false, true));
    vi.stubGlobal("sessionStorage", makeStorage(false, true));
    expect(juryStorage.getJuryAccess()).toBeNull();
    expect(() => juryStorage.setJuryAccess("period-1")).not.toThrow();
  });

  qaTest("storage.policy.05", () => {
    ss._store[KEYS.JURY_ACCESS_GRANT] = "{bad json{{";
    ls._store[KEYS.JURY_ACCESS_GRANT] = "{bad json{{";
    expect(juryStorage.getJuryAccessGrant()).toBeNull();
  });

  qaTest("storage.policy.06", () => {
    // Key values must not collide — each key must be unique
    expect(KEYS.JURY_ACCESS).not.toBe(KEYS.ADMIN_UI_STATE);
    expect(KEYS.JURY_ACCESS_GRANT).not.toBe(KEYS.ADMIN_UI_STATE);
    expect(KEYS.JURY_SESSION_TOKEN).not.toBe(KEYS.ADMIN_UI_STATE);
    expect(KEYS.JURY_RAW_TOKEN_PREFIX + "period-1").not.toBe(KEYS.ADMIN_UI_STATE);
  });
});

describe("juryStorage — dual-write", () => {
  qaTest("storage.policy.07", () => {
    juryStorage.setJuryAccessGrant({ period_id: "p1", period_name: "Spring" });
    const lsKeys = ls.setItem.mock.calls.map((c) => c[0]);
    const ssKeys = ss.setItem.mock.calls.map((c) => c[0]);
    expect(lsKeys).toContain(KEYS.JURY_ACCESS_GRANT);
    expect(ssKeys).toContain(KEYS.JURY_ACCESS_GRANT);
  });

  qaTest("storage.policy.08", () => {
    ls._store[KEYS.JURY_ACCESS] = "period-1";
    ss._store[KEYS.JURY_ACCESS] = "period-1";
    ls._store[KEYS.JURY_ACCESS_GRANT] = "{}";
    ss._store[KEYS.JURY_ACCESS_GRANT] = "{}";
    juryStorage.clearJuryAccess();
    const lsRemovedKeys = ls.removeItem.mock.calls.map((c) => c[0]);
    const ssRemovedKeys = ss.removeItem.mock.calls.map((c) => c[0]);
    expect(lsRemovedKeys).toContain(KEYS.JURY_ACCESS);
    expect(ssRemovedKeys).toContain(KEYS.JURY_ACCESS);
  });
});

describe("juryStorage — session snapshot", () => {
  qaTest("storage.policy.09", () => {
    juryStorage.saveJurySession({
      jurorSessionToken: "tok",
      jurorId: "j1",
      periodId: "p1",
      periodName: "Spring",
      juryName: "Jane",
      affiliation: "TEDU",
      current: 3,
    });
    const writtenKeys = ls.setItem.mock.calls.map((c) => c[0]);
    expect(writtenKeys).toContain(KEYS.JURY_SESSION_TOKEN);
    expect(writtenKeys).toContain(KEYS.JURY_JUROR_ID);
    expect(writtenKeys).toContain(KEYS.JURY_PERIOD_ID);
    expect(writtenKeys).toContain(KEYS.JURY_JUROR_NAME);
    expect(writtenKeys).toContain(KEYS.JURY_AFFILIATION);
    expect(writtenKeys).toContain(KEYS.JURY_CURRENT);
  });

  qaTest("storage.policy.10", () => {
    // Nothing in storage → getJurySession returns null
    expect(juryStorage.getJurySession()).toBeNull();
  });

  qaTest("storage.policy.11", () => {
    juryStorage.saveJurySession({
      jurorSessionToken: "tok",
      jurorId: "j1",
      periodId: "p1",
      periodName: "Spring",
      juryName: "Jane",
      affiliation: "TEDU",
      current: 2,
    });
    const session = juryStorage.getJurySession();
    expect(session).toMatchObject({
      jurorSessionToken: "tok",
      jurorId: "j1",
      periodId: "p1",
      periodName: "Spring",
      juryName: "Jane",
      affiliation: "TEDU",
      current: 2,
    });
  });

  qaTest("storage.policy.12", () => {
    ls._store[KEYS.JURY_SESSION_TOKEN] = "tok";
    ls._store[KEYS.JURY_JUROR_ID] = "j1";
    ls._store[KEYS.JURY_PERIOD_ID] = "p1";
    juryStorage.clearJurySession();
    const removedKeys = ls.removeItem.mock.calls.map((c) => c[0]);
    expect(removedKeys).toContain(KEYS.JURY_SESSION_TOKEN);
    expect(removedKeys).toContain(KEYS.JURY_JUROR_ID);
    expect(removedKeys).toContain(KEYS.JURY_PERIOD_ID);
  });
});

// ── adminStorage ─────────────────────────────────────────────

import * as adminStorage from "../adminStorage.js";

describe("adminStorage — raw token", () => {
  qaTest("storage.policy.13", () => {
    expect(adminStorage.getRawToken("period-99")).toBeNull();
  });

  qaTest("storage.policy.14", () => {
    adminStorage.setRawToken("period-1", "tok123");
    const lsKeys = ls.setItem.mock.calls.map((c) => c[0]);
    const ssKeys = ss.setItem.mock.calls.map((c) => c[0]);
    const expectedKey = KEYS.JURY_RAW_TOKEN_PREFIX + "period-1";
    expect(lsKeys).toContain(expectedKey);
    expect(ssKeys).toContain(expectedKey);
  });

  qaTest("storage.policy.15", () => {
    const key = KEYS.JURY_RAW_TOKEN_PREFIX + "period-1";
    ls._store[key] = "tok";
    ss._store[key] = "tok";
    adminStorage.clearRawToken("period-1");
    const lsRemoved = ls.removeItem.mock.calls.map((c) => c[0]);
    const ssRemoved = ss.removeItem.mock.calls.map((c) => c[0]);
    expect(lsRemoved).toContain(key);
    expect(ssRemoved).toContain(key);
  });

  qaTest("storage.policy.16", () => {
    vi.stubGlobal("localStorage", makeStorage(true));
    vi.stubGlobal("sessionStorage", makeStorage(true));
    expect(() => adminStorage.setRawToken("period-1", "tok")).not.toThrow();
  });

  qaTest("storage.policy.17", () => {
    // Raw-token prefix should not match JURY_SESSION_TOKEN key
    const rawKey = KEYS.JURY_RAW_TOKEN_PREFIX + "period-1";
    expect(rawKey).not.toBe(KEYS.JURY_SESSION_TOKEN);
    expect(rawKey).not.toBe(KEYS.JURY_ACCESS);
    expect(rawKey).not.toBe(KEYS.ADMIN_UI_STATE);
  });
});

describe("adminStorage — criteria scratch", () => {
  qaTest("storage.policy.18", () => {
    expect(adminStorage.getCriteriaScratch("period-x")).toBeNull();
  });

  qaTest("storage.policy.19", () => {
    const draft = { items: [{ key: "c1", label: "Design" }] };
    adminStorage.setCriteriaScratch("period-1", draft);
    const result = adminStorage.getCriteriaScratch("period-1");
    expect(result).toEqual(draft);
    // Criteria scratch goes to sessionStorage only
    const ssKeys = ss.setItem.mock.calls.map((c) => c[0]);
    expect(ssKeys).toContain(KEYS.CRITERIA_SCRATCH_PREFIX + "period-1");
  });
});

describe("adminStorage — active organization", () => {
  qaTest("storage.policy.23", () => {
    expect(adminStorage.getActiveOrganizationId()).toBeNull();
  });

  qaTest("storage.policy.24", () => {
    adminStorage.setActiveOrganizationId("org-1");
    expect(adminStorage.getActiveOrganizationId()).toBe("org-1");
    adminStorage.setActiveOrganizationId(null);
    const removedKeys = ls.removeItem.mock.calls.map((c) => c[0]);
    expect(removedKeys).toContain(KEYS.ADMIN_ACTIVE_ORGANIZATION);
  });
});

// ── persist.js (admin UI state) ──────────────────────────────

import { readSection, writeSection } from "@/admin/utils/persist";

describe("persist — writeSection / readSection", () => {
  qaTest("storage.policy.20", () => {
    writeSection("tab", { active: "rankings" });
    const result = readSection("tab");
    expect(result).toEqual({ active: "rankings" });
  });

  qaTest("storage.policy.21", () => {
    // Nothing written → readSection returns {}
    expect(readSection("nonexistent")).toEqual({});
    // Corrupt JSON → readSection returns {}
    ls._store[KEYS.ADMIN_UI_STATE] = "not valid json{{";
    expect(readSection("tab")).toEqual({});
  });

  qaTest("storage.policy.22", () => {
    vi.stubGlobal("localStorage", makeStorage(true));
    expect(() => writeSection("tab", { active: "rankings" })).not.toThrow();
  });
});
