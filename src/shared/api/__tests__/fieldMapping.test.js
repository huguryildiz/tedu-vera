import { describe, expect } from "vitest";
import { qaTest } from "../../../test/qaTest.js";
import {
  dbScoresToUi,
  uiScoresToDb,
  dbAvgScoresToUi,
  formatMembers,
} from "../fieldMapping.js";

describe("fieldMapping", () => {
  qaTest("api.fieldMapping.01", () => {
    const ui = dbScoresToUi({ written: 80, oral: 70, technical: 90, teamwork: 85 });
    expect(ui.design).toBe(80);
    expect(ui.delivery).toBe(70);
  });

  qaTest("api.fieldMapping.02", () => {
    const ui = dbScoresToUi({ technical: null, written: undefined, oral: null, teamwork: undefined });
    expect(ui.design).toBeNull();
    expect(ui.delivery).toBeNull();
    expect(ui.technical).toBeNull();
    expect(ui.teamwork).toBeNull();
  });

  qaTest("api.fieldMapping.03", () => {
    const db = uiScoresToDb({ design: 80, delivery: 70, technical: 90, teamwork: 85 });
    expect(db.written).toBe(80);
    expect(db.oral).toBe(70);
  });

  qaTest("api.fieldMapping.04", () => {
    const db = uiScoresToDb({ design: null, delivery: undefined, technical: null, teamwork: undefined });
    expect(db.written).toBeNull();
    expect(db.oral).toBeNull();
    expect(db.technical).toBeNull();
    expect(db.teamwork).toBeNull();
  });

  qaTest("api.fieldMapping.05", () => {
    const ui = dbAvgScoresToUi({ written: "7.5", oral: "8.2", technical: "9.0", teamwork: "6.8" });
    expect(typeof ui.design).toBe("number");
    expect(ui.design).toBe(7.5);
    expect(typeof ui.delivery).toBe("number");
    expect(ui.delivery).toBe(8.2);
  });

  qaTest("api.fieldMapping.06", () => {
    const ui = dbAvgScoresToUi({ written: null, oral: null, technical: null, teamwork: null });
    expect(ui.design).toBeNull();
    expect(ui.delivery).toBeNull();
    expect(ui.technical).toBeNull();
    expect(ui.teamwork).toBeNull();
  });

  qaTest("api.fieldMapping.07", () => {
    const result = formatMembers([{ name: "Alice" }, { name: "Bob" }, { name: "Carol" }]);
    expect(result).toBe("Alice; Bob; Carol");
  });

  qaTest("api.fieldMapping.08", () => {
    const result = formatMembers("Alice,Bob,Carol");
    expect(result).toBe("Alice; Bob; Carol");
  });

  qaTest("api.fieldMapping.09", () => {
    expect(formatMembers(null)).toBe("");
    expect(formatMembers(undefined)).toBe("");
    expect(formatMembers("")).toBe("");
  });

  qaTest("api.fieldMapping.10", () => {
    const db = uiScoresToDb({ technical: 90, design: 80, delivery: 70, teamwork: 85 });
    expect(db.technical).toBe(90);
    expect(db.teamwork).toBe(85);
    expect("design" in db).toBe(false);
    expect("delivery" in db).toBe(false);
  });

  qaTest("api.fieldMapping.11", () => {
    const original = { technical: 90, written: 80, oral: 70, teamwork: 85 };
    const roundTripped = uiScoresToDb(dbScoresToUi(original));
    expect(roundTripped).toEqual(original);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Additional coverage: dbScoresToUi
  // ─────────────────────────────────────────────────────────────────────────

  qaTest("api.fieldMapping.12", () => {
    const ui = dbScoresToUi({ technical: 75, written: 80, oral: 70, teamwork: 88 });
    expect(ui.technical).toBe(75);
    expect(ui.teamwork).toBe(88);
    expect(ui.design).toBe(80);
    expect(ui.delivery).toBe(70);
  });

  qaTest("api.fieldMapping.13", () => {
    const ui = dbScoresToUi({ technical: 90 });
    expect(ui.technical).toBe(90);
    expect(ui.design).toBeNull();
    expect(ui.delivery).toBeNull();
    expect(ui.teamwork).toBeNull();
  });

  qaTest("api.fieldMapping.14", () => {
    const ui = dbScoresToUi({ technical: 0, written: 0, oral: 0, teamwork: 0 });
    expect(ui.technical).toBe(0);
    expect(ui.design).toBe(0);
    expect(ui.delivery).toBe(0);
    expect(ui.teamwork).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Additional coverage: uiScoresToDb
  // ─────────────────────────────────────────────────────────────────────────

  qaTest("api.fieldMapping.15", () => {
    const db = uiScoresToDb({ design: 80 });
    expect(db.written).toBe(80);
    expect(db.oral).toBeNull();
    expect(db.technical).toBeNull();
    expect(db.teamwork).toBeNull();
  });

  qaTest("api.fieldMapping.16", () => {
    const db = uiScoresToDb({ design: 0, delivery: 0, technical: 0, teamwork: 0 });
    expect(db.written).toBe(0);
    expect(db.oral).toBe(0);
    expect(db.technical).toBe(0);
    expect(db.teamwork).toBe(0);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Additional coverage: dbAvgScoresToUi
  // ─────────────────────────────────────────────────────────────────────────

  qaTest("api.fieldMapping.17", () => {
    const ui = dbAvgScoresToUi({ written: "82.5", oral: "91.75", technical: "88.0", teamwork: "79.2" });
    expect(ui.design).toBe(82.5);
    expect(ui.delivery).toBe(91.75);
    expect(ui.technical).toBe(88);
    expect(ui.teamwork).toBe(79.2);
    expect(typeof ui.design).toBe("number");
    expect(typeof ui.delivery).toBe("number");
  });

  qaTest("api.fieldMapping.18", () => {
    const ui = dbAvgScoresToUi({ written: "7.5", oral: 8, technical: null, teamwork: undefined });
    expect(ui.design).toBe(7.5);
    expect(ui.delivery).toBe(8);
    expect(ui.technical).toBeNull();
    expect(ui.teamwork).toBeNull();
  });

  qaTest("api.fieldMapping.19", () => {
    const ui = dbAvgScoresToUi({ written: undefined, oral: null, technical: undefined, teamwork: null });
    expect(ui.design).toBeNull();
    expect(ui.delivery).toBeNull();
    expect(ui.technical).toBeNull();
    expect(ui.teamwork).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Additional coverage: formatMembers
  // ─────────────────────────────────────────────────────────────────────────

  qaTest("api.fieldMapping.20", () => {
    const result = formatMembers([{ name: "Alice" }, { name: "Bob" }]);
    expect(result).toBe("Alice; Bob");
  });

  qaTest("api.fieldMapping.21", () => {
    const result = formatMembers(["Alice", "Bob", "Carol"]);
    expect(result).toBe("Alice; Bob; Carol");
  });

  qaTest("api.fieldMapping.22", () => {
    const result = formatMembers("  Alice  ,  Bob  ,  Carol  ");
    expect(result).toBe("Alice; Bob; Carol");
  });

  qaTest("api.fieldMapping.23", () => {
    const result = formatMembers("Alice,,Bob,");
    expect(result).toBe("Alice; Bob");
  });

  qaTest("api.fieldMapping.24", () => {
    const result = formatMembers("Alice,Bob;Carol");
    expect(result).toBe("Alice; Bob; Carol");
  });

  qaTest("api.fieldMapping.25", () => {
    const result = formatMembers(["Alice"]);
    expect(result).toBe("Alice");
  });

  qaTest("api.fieldMapping.26", () => {
    const original = { technical: 90, written: 80, oral: 70, teamwork: 85 };
    const step1 = dbScoresToUi(original);
    const step2 = uiScoresToDb(step1);
    const step3 = dbScoresToUi(step2);
    expect(step3).toEqual(step1);
    expect(step2).toEqual(original);
  });
});
