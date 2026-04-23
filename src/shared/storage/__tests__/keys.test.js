import { describe, expect } from "vitest";
import { qaTest } from "../../../test/qaTest.js";
import { KEYS } from "../keys.js";

describe("storage/keys", () => {
  qaTest("storage.keys.01", () => {
    expect(typeof KEYS.JURY_ACCESS).toBe("string");
    expect(typeof KEYS.JURY_SESSION_TOKEN).toBe("string");
    expect(typeof KEYS.ADMIN_ACTIVE_ORGANIZATION).toBe("string");
    expect(typeof KEYS.THEME).toBe("string");
  });

  qaTest("storage.keys.02", () => {
    const values = Object.values(KEYS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
