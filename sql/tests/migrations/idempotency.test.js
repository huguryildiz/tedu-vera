import { describe, expect } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { qaTest } from "../../src/test/qaTest.js";

const MIGRATION_DIR = resolve(__dirname, "..", "migrations");
const migrationFiles = readdirSync(MIGRATION_DIR)
  .filter((f) => /^\d+.*\.sql$/.test(f))
  .sort();
const MIGRATIONS = migrationFiles.map((f) => ({
  name: f,
  sql: readFileSync(join(MIGRATION_DIR, f), "utf-8"),
}));

/**
 * Returns an array of { lineNumber, text } for every line that matches `regex`.
 * `regex` must have the `g` flag.
 */
function findViolations(sql, regex) {
  const lines = sql.split("\n");
  const violations = [];
  lines.forEach((line, idx) => {
    if (regex.test(line)) {
      violations.push({ lineNumber: idx + 1, text: line.trim() });
    }
    regex.lastIndex = 0;
  });
  return violations;
}

describe("SQL migration idempotency", () => {
  for (const { name, sql } of MIGRATIONS) {
    qaTest(`phaseA.sql.migration.${name.replace(/\.sql$/, "")}`, () => {
      // Functions must use CREATE OR REPLACE
      const bareCreateFunction = /CREATE\s+FUNCTION\s+/gi;
      const functionViolations = findViolations(sql, bareCreateFunction);
      expect(
        functionViolations,
        `[${name}] Found CREATE FUNCTION without OR REPLACE:\n${functionViolations
          .map((v) => `  L${v.lineNumber}: ${v.text}`)
          .join("\n")}`
      ).toHaveLength(0);

      // DROP statements must use IF EXISTS
      const bareDropStatement =
        /DROP\s+(TABLE|FUNCTION|TRIGGER|INDEX|POLICY|VIEW|SCHEMA|EXTENSION)\s+(?!IF\s+EXISTS)/gi;
      const dropViolations = findViolations(sql, bareDropStatement);
      expect(
        dropViolations,
        `[${name}] Found DROP statement without IF EXISTS:\n${dropViolations
          .map((v) => `  L${v.lineNumber}: ${v.text}`)
          .join("\n")}`
      ).toHaveLength(0);
    });
  }
});
