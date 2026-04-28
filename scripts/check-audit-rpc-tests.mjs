// Drift sentinel — every public.rpc_* that emits an audit row has a pgTAP test
// that asserts on audit_logs.
//
// Plan ref: 2026-04-28-audit-hardening § P3.14.
//
// Why: it's possible for an RPC to keep its happy-path test passing while
// silently dropping its `_audit_write` call (or vice versa: leaving a stale
// `_audit_write` for a renamed action). The contract test file should at
// minimum reference `audit_logs` to prove its author thought about the audit
// side-effect.
//
// What it does:
//   1. Scans active migration files for `CREATE OR REPLACE FUNCTION rpc_<name>`
//      and detects whether the body contains either `_audit_write(` or
//      `INSERT INTO audit_logs` (case-insensitive).
//   2. For each emitting RPC, asserts its contract test file (per the same
//      naming convention used by check-rpc-tests-exist.mjs) references
//      `audit_logs` somewhere in its body — typically as a SELECT FROM audit_logs
//      assertion or a `is(...)` check on an audit row count.
//   3. Exits 1 with the gap list if any audit-emitting RPC has a test file that
//      never mentions audit_logs.
//
// This is intentionally a soft check: it doesn't validate the assertion is
// correct, only that the test author considered the audit-side effect. False
// positives can be silenced by having the test file mention `audit_logs` in a
// comment with a justification, but reviewers should push back.
//
// Ratchet behavior: BLIND_BASELINE captures the count of audit-emitting RPCs
// whose contract tests do NOT yet mention audit_logs. New audit-emitting RPCs
// without audit-aware tests cause blind count > BASELINE → CI fails. Lowering
// the baseline (i.e. retrofitting old tests) is encouraged. Don't raise it.

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const MIGRATIONS_DIR = path.join(REPO_ROOT, "sql/migrations");
const RPC_TESTS_DIR = path.join(REPO_ROOT, "sql/tests/rpcs");
const EXCLUDED_DIRS = new Set(["_pending", "_preview", "_test"]);

// Ratchet: do not let "blind" count grow. Lower this number as tests are
// retrofitted. Audit-aware test = test file references `audit_logs`.
// As of 2026-04-28: 45 / 48 audit-emitting RPCs have blind tests.
const BLIND_BASELINE = 45;

function fail(msg) {
  console.error(`✗ check-audit-rpc-tests: ${msg}`);
  process.exit(1);
}

function readMigrations() {
  if (!fs.existsSync(MIGRATIONS_DIR)) fail(`missing ${MIGRATIONS_DIR}`);
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".sql") && d.name !== "000_dev_teardown.sql")
    .map((d) => path.join(MIGRATIONS_DIR, d.name));
}

// Extract each RPC's full body (BEGIN..END$$) so we can scan for audit calls
// only within that function, not across stale text in the same file.
function extractRpcBodies(text) {
  // Match function header up to the AS $$ delimiter, then capture body up to $$;
  const out = new Map();
  const headerRe = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(rpc_\w+)\s*\([\s\S]*?\)\s*[\s\S]*?AS\s+\$\$([\s\S]*?)\$\$\s*;/gi;
  let m;
  while ((m = headerRe.exec(text)) !== null) {
    const name = m[1];
    const body = m[2];
    // Aggregate: if a later CREATE OR REPLACE for the same RPC appears, use the
    // last one (which is what runtime resolves to).
    out.set(name, body);
  }
  return out;
}

function rpcEmitsAudit(body) {
  // Either explicit _audit_write call or direct INSERT INTO audit_logs.
  return /_audit_write\s*\(/i.test(body) || /INSERT\s+INTO\s+audit_logs\b/i.test(body);
}

function walkTests(dir, acc) {
  if (!fs.existsSync(dir)) return acc;
  const isRpcsRoot = path.resolve(dir) === path.resolve(RPC_TESTS_DIR);
  const parentName = path.basename(dir);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walkTests(path.join(dir, entry.name), acc);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".sql")) {
      const stem = entry.name.replace(/\.sql$/, "");
      const fullPath = path.join(dir, entry.name);
      acc.set(stem, fullPath);
      // Subdir convention: sql/tests/rpcs/admin/set_period_lock.sql is the
      // contract for rpc_admin_set_period_lock. Add `<dir>_<stem>` so the
      // stripped-prefix match in the caller picks these up too.
      if (!isRpcsRoot) acc.set(`${parentName}_${stem}`, fullPath);
    }
  }
  return acc;
}

const migrationFiles = readMigrations();

// Collect every RPC's latest body.
const rpcBodies = new Map();
for (const file of migrationFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const [name, body] of extractRpcBodies(text)) {
    rpcBodies.set(name, body);
  }
}

const emitting = [];
for (const [name, body] of rpcBodies) {
  if (rpcEmitsAudit(body)) emitting.push(name);
}
emitting.sort();

const tests = walkTests(RPC_TESTS_DIR, new Map());

const missingTest = [];
const blindTest = [];
const covered = [];
for (const rpc of emitting) {
  const stripped = rpc.replace(/^rpc_/, "");
  const candidate = tests.get(stripped) || tests.get(rpc);
  if (!candidate) {
    missingTest.push(rpc);
    continue;
  }
  const testText = fs.readFileSync(candidate, "utf8");
  if (!/audit_logs\b/i.test(testText)) {
    blindTest.push({ rpc, file: path.relative(REPO_ROOT, candidate) });
  } else {
    covered.push(rpc);
  }
}

console.log(`Audit-emitting RPCs detected: ${emitting.length}`);
console.log(`With audit-aware contract tests: ${covered.length}/${emitting.length}`);

if (missingTest.length > 0) {
  console.error("");
  console.error(`✗ ${missingTest.length} audit-emitting RPCs have NO contract test at all`);
  console.error("  (these are also caught by check-rpc-tests-exist.mjs)");
  for (const r of missingTest) console.error(`  - ${r}`);
}

if (blindTest.length > 0) {
  console.error("");
  console.error(`✗ ${blindTest.length} audit-emitting RPCs have contract tests that never mention audit_logs:`);
  for (const { rpc, file } of blindTest) {
    console.error(`  - ${rpc}  →  ${file}`);
  }
  console.error("");
  console.error("Add a SELECT FROM audit_logs assertion (or at minimum a comment");
  console.error("acknowledging the audit side-effect). Tests for audit-emitting RPCs");
  console.error("must verify the audit row, not just the primary state mutation.");
}

// Ratchet: fail only if blind count exceeds baseline. Missing-test always fails
// (those are real coverage gaps, also caught by check-rpc-tests-exist).
if (missingTest.length > 0) {
  process.exit(1);
}

if (blindTest.length > BLIND_BASELINE) {
  console.error("");
  console.error(`✗ Blind-test count grew (${blindTest.length} > baseline ${BLIND_BASELINE}).`);
  console.error("  Either retrofit the new test with an audit_logs assertion or");
  console.error("  RAISE the baseline ONLY if there's a written justification — but the");
  console.error("  rule is: new audit-emitting RPCs must come with audit-aware tests.");
  process.exit(1);
}

if (blindTest.length < BLIND_BASELINE) {
  console.log("");
  console.log(`✓ Blind count dropped to ${blindTest.length} (baseline was ${BLIND_BASELINE}).`);
  console.log("  Lower the BLIND_BASELINE constant in this script to lock in the gain.");
}

console.log(`✓ check-audit-rpc-tests: ${blindTest.length} ≤ baseline ${BLIND_BASELINE}; ${covered.length} fully covered`);
process.exit(0);
