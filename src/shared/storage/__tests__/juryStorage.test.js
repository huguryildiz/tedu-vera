import { describe, expect, beforeEach } from "vitest";
import { qaTest } from "../../../test/qaTest.js";
import {
  setJuryAccess,
  getJuryAccess,
  setJuryAccessGrant,
  getJuryAccessGrant,
  saveJurySession,
  getJurySession,
  clearJurySession,
} from "../juryStorage.js";

describe("storage/juryStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  qaTest("storage.juryStorage.01", () => {
    setJuryAccess("period-abc");
    expect(sessionStorage.getItem("jury_access_period")).toBe("period-abc");
    expect(localStorage.getItem("jury_access_period")).toBe("period-abc");
  });

  qaTest("storage.juryStorage.02", () => {
    sessionStorage.setItem("jury_access_period", "session-only");
    expect(getJuryAccess()).toBe("session-only");
  });

  qaTest("storage.juryStorage.03", () => {
    setJuryAccessGrant({ period_id: "p1", period_name: "Spring" });
    const grant = getJuryAccessGrant();
    expect(grant).toEqual({ period_id: "p1", period_name: "Spring" });
  });

  qaTest("storage.juryStorage.04", () => {
    setJuryAccessGrant({ period_name: "Missing ID" });
    expect(getJuryAccessGrant()).toBeNull();
  });

  qaTest("storage.juryStorage.05", () => {
    saveJurySession({
      jurorSessionToken: "tok123",
      jurorId: "j1",
      periodId: "p1",
      periodName: "Spring 2025",
      juryName: "Alice",
      affiliation: "TEDU",
      current: 3,
    });
    const session = getJurySession();
    expect(session).not.toBeNull();
    expect(session.jurorSessionToken).toBe("tok123");
    expect(session.jurorId).toBe("j1");
    expect(session.current).toBe(3);
  });

  qaTest("storage.juryStorage.06", () => {
    saveJurySession({ jurorSessionToken: "tok123", jurorId: "j1", periodId: "p1", periodName: "", juryName: "", affiliation: "", current: 0 });
    clearJurySession();
    expect(getJurySession()).toBeNull();
  });
});
