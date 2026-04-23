import { describe, expect, beforeEach } from "vitest";
import { qaTest } from "../../../test/qaTest.js";
import {
  setRawToken,
  getRawToken,
  clearRawToken,
  setCriteriaScratch,
  getCriteriaScratch,
  setActiveOrganizationId,
  getActiveOrganizationId,
} from "../adminStorage.js";

describe("storage/adminStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  qaTest("storage.adminStorage.01", () => {
    setRawToken("sem-1", "token-xyz");
    expect(sessionStorage.getItem("jury_raw_token_sem-1")).toBe("token-xyz");
    expect(localStorage.getItem("jury_raw_token_sem-1")).toBe("token-xyz");
    expect(getRawToken("sem-1")).toBe("token-xyz");
    clearRawToken("sem-1");
    expect(getRawToken("sem-1")).toBeNull();
  });

  qaTest("storage.adminStorage.02", () => {
    const draft = { items: [{ key: "technical", label: "Technical" }] };
    setCriteriaScratch("p1", draft);
    const read = getCriteriaScratch("p1");
    expect(read).toEqual(draft);
    expect(localStorage.getItem("vera.criteria_scratch_p1")).toBeNull();
  });

  qaTest("storage.adminStorage.03", () => {
    setActiveOrganizationId("org-1");
    expect(getActiveOrganizationId()).toBe("org-1");
    setActiveOrganizationId(null);
    expect(getActiveOrganizationId()).toBeNull();
  });
});
