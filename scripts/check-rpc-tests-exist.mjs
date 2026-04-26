// Drift sentinel #2 — every public.rpc_* function has a contract test file.
//
// Plan ref: test-reclassification-plan.md § 5.1 P0-G2.
//
// What it does:
//   1. Scans active migration files for `CREATE OR REPLACE FUNCTION
//      [public.]rpc_<name>` declarations and de-duplicates (later migrations
//      can REPLACE earlier ones — the function still counts once).
//   2. Asserts each rpc_<name> has a test file in sql/tests/rpcs/ matching
//      either `<name>.sql` (preferred — strips the rpc_ prefix per the
//      established naming convention in sql/tests/rpcs/contracts/) or
//      `rpc_<name>.sql`. Searches recursively, EXCLUDING `_pending/`,
//      `_preview/`, and `_test/` so quarantined work cannot satisfy the gate.
//   3. Exits 1 with the missing list if any RPC is uncovered.
//
// Naming convention (from sql/tests/rpcs/contracts/):
//   rpc_admin_publish_period  → admin_publish_period.sql
//   rpc_juror_unlock_pin      → juror_unlock_pin.sql
//   rpc_jury_authenticate     → jury_authenticate.sql
//
// Expected state W0 (per plan § 7.4): 27/89 — sentinel intentionally RED
// against the current tree, drives W3–W5 to fill the gap.

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(REPO_ROOT, "sql/migrations");
const RPC_TESTS_DIR = path.join(REPO_ROOT, "sql/tests/rpcs");
const EXCLUDED_DIRS = new Set(["_pending", "_preview", "_test"]);

function fail(msg) {
  console.error(`✗ check-rpc-tests: ${msg}`);
  process.exit(1);
}

function readMigrationsRpcNames() {
  if (!fs.existsSync(MIGRATIONS_DIR)) fail(`missing ${MIGRATIONS_DIR}`);
  const files = fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".sql") && d.name !== "000_dev_teardown.sql")
    .map((d) => path.join(MIGRATIONS_DIR, d.name));

  const names = new Set();
  // Match: CREATE [OR REPLACE] FUNCTION [public.]rpc_<ident>(...
  // Tolerates optional schema, optional OR REPLACE, leading whitespace.
  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(rpc_\w+)\s*\(/gi;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = re.exec(text)) !== null) names.add(m[1]);
  }
  return [...names].sort();
}

function walkSql(dir, acc) {
  if (!fs.existsSync(dir)) return acc;
  const parentName = path.basename(dir);
  const isRpcsRoot = path.resolve(dir) === path.resolve(RPC_TESTS_DIR);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walkSql(path.join(dir, entry.name), acc);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".sql")) {
      const stem = entry.name.replace(/\.sql$/, "");
      acc.add(stem);
      // Subdir convention: sql/tests/rpcs/jury/authenticate.sql is the
      // contract for rpc_jury_authenticate. Add `<dir>_<stem>` so the
      // stripped-prefix match in the caller picks these up too. Skip when
      // we're at the rpcs/ root (no meaningful prefix).
      if (!isRpcsRoot) acc.add(`${parentName}_${stem}`);
    }
  }
  return acc;
}

const rpcs = readMigrationsRpcNames();
const present = walkSql(RPC_TESTS_DIR, new Set());

const missing = [];
const covered = [];
for (const rpc of rpcs) {
  const stripped = rpc.replace(/^rpc_/, "");
  if (present.has(stripped) || present.has(rpc)) {
    covered.push(rpc);
  } else {
    missing.push(rpc);
  }
}

console.log(`RPCs declared in migrations: ${rpcs.length}`);
console.log(`Contract tests present: ${covered.length}/${rpcs.length}`);

if (missing.length > 0) {
  console.error("");
  console.error("✗ Missing contract tests for the following RPCs:");
  for (const r of missing) console.error(`  - sql/tests/rpcs/contracts/${r.replace(/^rpc_/, "")}.sql`);
  console.error("");
  console.error(`Coverage: ${covered.length}/${rpcs.length} (need ${missing.length} more)`);
  console.error("Note: _pending/, _preview/, _test/ are EXCLUDED from the search.");
  process.exit(1);
}

console.log(`✓ check-rpc-tests: all ${rpcs.length} RPCs have contract tests`);
