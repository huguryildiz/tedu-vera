// Drift sentinel #4 — every Edge Function has a co-located schema.ts and the
// matching test file calls Schema.parse().
//
// Plan ref: test-reclassification-plan.md § 5.1 P0-G3.
//
// What it does: for each subdir of supabase/functions/<fn>/ that contains
// index.ts, asserts:
//   1. supabase/functions/<fn>/schema.ts exists
//   2. schema.ts exports at least one Zod schema (export const ...Schema =)
//   3. supabase/functions/<fn>/index.test.ts exists
//   4. index.test.ts references either `Schema.parse(` or `Schema.safeParse(`
//      against a symbol imported from ./schema.ts
//
// Architecture: § 3.5 of the architecture spec — the Edge fn schema.ts is the
// single wire-shape source of truth shared by server + client. Without this
// gate, an Edge fn shape change passes CI silently and surfaces as a runtime
// ZodError or (worse) a silent UI failure.
//
// Excluded directories (no index.ts → not a deployable function):
//   _shared, _test, _preview, _examples
//
// Reference implementation lives in supabase/functions/notify-unlock-request/.
// Expected state W0 (per plan § 7.4): 1/21 — sentinel intentionally RED
// against the current tree, drives W6 to fill the gap.

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const FUNCTIONS_DIR = path.join(REPO_ROOT, "supabase/functions");
const EXCLUDED = new Set(["_shared", "_test", "_preview", "_examples"]);

function fail(msg) {
  console.error(`✗ check-edge-schema: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(FUNCTIONS_DIR)) {
  console.log("✓ check-edge-schema: no supabase/functions directory — nothing to check");
  process.exit(0);
}

const fnDirs = fs
  .readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !EXCLUDED.has(d.name))
  .map((d) => d.name)
  .sort();

const issues = [];
let coveredCount = 0;

for (const fn of fnDirs) {
  const fnDir = path.join(FUNCTIONS_DIR, fn);
  const indexPath = path.join(fnDir, "index.ts");
  if (!fs.existsSync(indexPath)) continue; // non-fn subdir (helpers etc.)

  const schemaPath = path.join(fnDir, "schema.ts");
  const testPath = path.join(fnDir, "index.test.ts");
  const fnIssues = [];

  if (!fs.existsSync(schemaPath)) {
    fnIssues.push("missing schema.ts");
  } else {
    const schemaText = fs.readFileSync(schemaPath, "utf8");
    if (!/export\s+const\s+\w*Schema\s*=/.test(schemaText)) {
      fnIssues.push("schema.ts has no `export const ...Schema =` (Zod) export");
    }
  }

  if (!fs.existsSync(testPath)) {
    fnIssues.push("missing index.test.ts");
  } else {
    const testText = fs.readFileSync(testPath, "utf8");
    const importsSchema = /from\s+["']\.\/schema(?:\.ts)?["']/.test(testText);
    const callsParse = /\b\w*Schema\.(?:safe)?Parse?\s*\(/.test(testText)
      || /\b\w*Schema\.parse\s*\(/.test(testText)
      || /\b\w*Schema\.safeParse\s*\(/.test(testText);
    if (!importsSchema) fnIssues.push("index.test.ts does not import from ./schema");
    if (!callsParse) fnIssues.push("index.test.ts does not call any Schema.parse() / .safeParse()");
  }

  if (fnIssues.length === 0) {
    coveredCount += 1;
  } else {
    issues.push({ fn, fnIssues });
  }
}

const totalFns = coveredCount + issues.length;
console.log(`Edge functions discovered: ${totalFns}`);
console.log(`schema.ts + Zod-parse coverage: ${coveredCount}/${totalFns}`);

if (issues.length > 0) {
  console.error("");
  console.error("✗ Edge functions missing schema/test coverage:");
  for (const { fn, fnIssues } of issues) {
    console.error(`  - ${fn}`);
    for (const issue of fnIssues) console.error(`      · ${issue}`);
  }
  console.error("");
  console.error(`Coverage: ${coveredCount}/${totalFns} (need ${issues.length} more)`);
  console.error("Reference: supabase/functions/notify-unlock-request/{schema.ts,index.test.ts}");
  process.exit(1);
}

console.log(`✓ check-edge-schema: all ${totalFns} Edge functions covered`);
