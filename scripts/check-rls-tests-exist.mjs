// Drift sentinel #3 — every RLS-enabled table in public has an isolation test.
//
// Plan ref: test-reclassification-plan.md § 5.1 P0-G1.
//
// What it does:
//   1. Scans active migration files (sql/migrations/*.sql, excluding archive/)
//      for `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY` statements.
//   2. Asserts each table has a matching `sql/tests/rls/<table>_isolation.sql`
//      file (or one of two allowed splits — see SPECIAL_CASES below).
//   3. Exits 1 with the missing list if any table is uncovered.
//
// Architecture: this is the static counterpart to pg_class introspection.
// Parsing the migration is preferable to a live DB query because:
//   - the migration file is the source of truth for schema state per
//     CLAUDE.md "DB Migration Policy",
//   - it works in CI without DB credentials,
//   - it stays in sync with whatever a fresh-DB apply produces.
//
// Expected state W0 (per plan § 7.4): 12/28 — sentinel intentionally RED
// against the current tree, drives W2 to fill the gap.

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(REPO_ROOT, "sql/migrations");
const RLS_TESTS_DIR = path.join(REPO_ROOT, "sql/tests/rls");

// Some tables are split across multiple test files (e.g. scores → score_sheets +
// score_sheet_items) or covered by a generic file. Map "table → list of
// acceptable test file basenames (without .sql)". If any one is present the
// table is considered covered.
const ACCEPTABLE_FILES = (table) => [
  `${table}_isolation`,
];

function fail(msg) {
  console.error(`✗ check-rls-tests: ${msg}`);
  process.exit(1);
}

function readMigrationsRlsTables() {
  if (!fs.existsSync(MIGRATIONS_DIR)) fail(`missing ${MIGRATIONS_DIR}`);
  const files = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".sql") && d.name !== "000_dev_teardown.sql")
    .map((d) => path.join(MIGRATIONS_DIR, d.name));

  const tables = new Set();
  // Match ALTER TABLE [schema.]<name> ENABLE ROW LEVEL SECURITY (case-insensitive,
  // tolerant of optional "public." prefix and intervening whitespace).
  const re = /ALTER\s+TABLE\s+(?:public\.)?(\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = re.exec(text)) !== null) tables.add(m[1]);
  }
  return [...tables].sort();
}

function existingRlsTestBasenames() {
  if (!fs.existsSync(RLS_TESTS_DIR)) return new Set();
  return new Set(
    fs
      .readdirSync(RLS_TESTS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .map((f) => f.replace(/\.sql$/, "")),
  );
}

const expected = readMigrationsRlsTables();
const present = existingRlsTestBasenames();

const missing = [];
const covered = [];
for (const table of expected) {
  const hit = ACCEPTABLE_FILES(table).find((bn) => present.has(bn));
  if (hit) covered.push({ table, file: `${hit}.sql` });
  else missing.push(table);
}

console.log(`RLS tables in migrations: ${expected.length}`);
console.log(`RLS isolation files present: ${covered.length}/${expected.length}`);

if (missing.length > 0) {
  console.error("");
  console.error("✗ Missing isolation tests for the following RLS-enabled tables:");
  for (const t of missing) console.error(`  - sql/tests/rls/${t}_isolation.sql`);
  console.error("");
  console.error(`Coverage: ${covered.length}/${expected.length} (need ${missing.length} more)`);
  process.exit(1);
}

console.log(`✓ check-rls-tests: all ${expected.length} RLS tables have isolation tests`);
