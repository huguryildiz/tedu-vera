#!/usr/bin/env node
// Drift sentinel #5 — guideline coverage matrix.
//
// Reports which test items prescribed by `.claude/rules/test-writing.md` are
// actually present in the repo. Output: a markdown table of layer × item ×
// status (covered / partial / missing), plus a coverage percentage.
//
// Status semantics:
//   ✅ covered — at least one detection pattern matches in the expected layer
//   ⚠ partial — detection found in an unexpected place, or only one of N patterns matches
//   ❌ missing — no match anywhere
//
// Exit policy (current):
//   - Always exits 0 in CI to remain informational.
//   - When pass rate falls below `MIN_THRESHOLD`, prints a warning banner.
//   - As gaps close, raise MIN_THRESHOLD; when ≥ 90% sustained, flip to hard
//     fail by setting `HARD_FAIL = true`.
//
// Audit reference: docs/qa/vera-test-audit-report.md (P0/P1 list)
// Companion rule: .claude/rules/test-writing.md

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

// ─── tuning ────────────────────────────────────────────────────────────────
const MIN_THRESHOLD = 50; // current baseline ~50%; raise as gaps close
const HARD_FAIL = false; // set true after sustained ≥ 90%

// ─── helpers ───────────────────────────────────────────────────────────────
function grepCount(pattern, paths, opts = {}) {
  // Returns the number of matching files. Uses extended regex.
  // Note: grep's --include uses glob patterns and does NOT support brace
  // expansion ({a,b,c}). Use one --include per extension.
  const exts = ["js", "jsx", "ts", "tsx", "mjs", "cjs", "sql"];
  const flags = ["-rl", "-E"];
  for (const ext of exts) flags.push(`--include=*.${ext}`);
  if (opts.testOnly) {
    flags.push("--include=*test*");
    flags.push("--include=*spec*");
  }
  const args = [...flags, pattern, ...paths.map((p) => path.join(REPO_ROOT, p))];
  try {
    const out = execSync(`grep ${args.map((a) => JSON.stringify(a)).join(" ")}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

function fileExists(relPath) {
  return existsSync(path.join(REPO_ROOT, relPath));
}

function anyFileExists(globsRel) {
  for (const rel of globsRel) {
    try {
      const out = execSync(
        `find ${JSON.stringify(path.join(REPO_ROOT, rel))} -type f 2>/dev/null | head -1`,
        { encoding: "utf8" }
      ).trim();
      if (out) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

// ─── catalog of guideline items ────────────────────────────────────────────
// Each item declares one of:
//   - file: a single path that must exist
//   - patternIn: { pattern, paths } — at least one match required
//   - both: combine; status downgrades to ⚠ if only some pieces match
const ITEMS = [
  // ── Unit (§ Layer-by-Layer / Unit) ──
  {
    id: "unit.weighted_score",
    layer: "Unit",
    desc: "Weighted score calculation (asymmetric criteria)",
    detect: () => {
      const hits = grepCount(
        "weightedScore|calculateWeightedScore|computeWeightedScore",
        ["src"],
        { testOnly: true }
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "unit.ranking_tie_break",
    layer: "Unit",
    desc: "Ranking tie-break logic",
    detect: () => {
      const hits = grepCount(
        "tie.?break|rankingTie|breakTie|tieBreaker",
        ["src"],
        { testOnly: true }
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "unit.outcome_attainment",
    layer: "Unit",
    desc: "Outcome attainment calculation",
    detect: () => {
      const hits = grepCount("attainment|outcomeAttainment", ["src"], {
        testOnly: true,
      });
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "unit.criteria_total_weight",
    layer: "Unit",
    desc: "Criteria total weight = 100 validation",
    detect: () => {
      const hits = grepCount(
        "totalWeight|sumWeight|weight.*===.*100|weight.*!==.*100",
        ["src/admin"],
        { testOnly: true }
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "unit.rubric_band_validation",
    layer: "Unit",
    desc: "Rubric band overlap / gap detection",
    detect: () => {
      const hits = grepCount(
        "bandOverlap|bandGap|validateBand|rubricBand",
        ["src"],
        { testOnly: true }
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "unit.field_mapping_round_trip",
    layer: "Unit",
    desc: "UI ↔ DB field mapping round trip",
    detect: () =>
      fileExists("src/shared/api/__tests__/fieldMapping.test.js") ? "covered" : "missing",
  },
  {
    id: "unit.export_xlsx_formatter",
    layer: "Unit",
    desc: "Export XLSX / CSV formatter",
    detect: () =>
      fileExists("src/admin/utils/__tests__/exportXLSX.test.js") ? "covered" : "missing",
  },

  // ── Component (§ Layer-by-Layer / Component) ──
  {
    id: "component.criteria_save_disabled",
    layer: "Component",
    desc: "Criteria editor: Save disabled when total ≠ 100",
    detect: () => {
      const hits = grepCount(
        "Save.*disabled.*weight|disabled.*total.*100|weight.*!==.*100",
        ["src/admin/features/criteria"],
        { testOnly: true }
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "component.jury_form_post_submit_lock",
    layer: "Component",
    desc: "Jury scoring form: inputs locked after final_submitted_at",
    detect: () => {
      const hits = grepCount(
        "final_submitted_at.*disabled|read.?only.*after.*submit|edit_enabled.*false.*disabled",
        ["src/jury"],
        { testOnly: true }
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "component.autosave_failure_ux",
    layer: "Component",
    desc: "Autosave failure → user-visible error",
    detect: () => {
      const hits = grepCount(
        "autosave.*fail|saveStatus.*error|autosave.*error",
        ["src/jury"],
        { testOnly: true }
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "component.export_filter_count",
    layer: "Component",
    desc: "Export UI: visible-column ↔ export-column count consistency",
    detect: () => {
      const hits = grepCount(
        "exportColumn|visibleColumn.*export|filter.*count.*export",
        ["src/admin"],
        { testOnly: true }
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "component.outcome_unmapped_warning",
    layer: "Component",
    desc: "Outcome mapping: unmapped outcome warning visible",
    detect: () => {
      const hits = grepCount(
        "unmapped.*outcome|outcome.*unmapped.*warning",
        ["src/admin/features/outcomes"],
        { testOnly: true }
      );
      return hits > 0 ? "covered" : "missing";
    },
  },

  // ── Hook (§ Layer-by-Layer / Hook) ──
  {
    id: "hook.useJuryState",
    layer: "Hook",
    desc: "useJuryState state machine transitions",
    detect: () =>
      fileExists("src/jury/shared/__tests__/useJuryState.test.js")
        ? "covered"
        : "missing",
  },
  {
    id: "hook.useManagePeriods_lock",
    layer: "Hook",
    desc: "useManagePeriods lock-aware actions",
    detect: () =>
      fileExists(
        "src/admin/features/periods/__tests__/useManagePeriods.lockEnforcement.test.js"
      )
        ? "covered"
        : "missing",
  },
  {
    id: "hook.useManageJurors_lock",
    layer: "Hook",
    desc: "useManageJurors lock-aware actions (no it.todo placeholders)",
    detect: () => {
      const file = path.join(
        REPO_ROOT,
        "src/admin/features/jurors/__tests__/useManageJurors.lockEnforcement.test.js"
      );
      if (!existsSync(file)) return "missing";
      const txt = readFileSync(file, "utf8");
      const todoCount = (txt.match(/it\.todo\(|test\.todo\(/g) || []).length;
      return todoCount === 0 ? "covered" : "partial";
    },
  },
  {
    id: "hook.useManageProjects_lock",
    layer: "Hook",
    desc: "useManageProjects lock-aware actions (no it.todo placeholders)",
    detect: () => {
      const file = path.join(
        REPO_ROOT,
        "src/admin/features/projects/__tests__/useManageProjects.lockEnforcement.test.js"
      );
      if (!existsSync(file)) return "missing";
      const txt = readFileSync(file, "utf8");
      const todoCount = (txt.match(/it\.todo\(|test\.todo\(/g) || []).length;
      return todoCount === 0 ? "covered" : "partial";
    },
  },
  {
    id: "hook.useCriteriaForm",
    layer: "Hook",
    desc: "useCriteriaForm validation depth (>= 5 tests)",
    detect: () => {
      const file = path.join(
        REPO_ROOT,
        "src/admin/features/criteria/__tests__/useCriteriaForm.test.js"
      );
      if (!existsSync(file)) return "missing";
      const txt = readFileSync(file, "utf8");
      const testCount = (txt.match(/\b(?:it|test|qaTest)\(/g) || []).length;
      return testCount >= 5 ? "covered" : "partial";
    },
  },
  {
    id: "hook.useExportFlow",
    layer: "Hook",
    desc: "useExportFlow (or equivalent export hook) test",
    detect: () => {
      try {
        const out = execSync(
          `find ${JSON.stringify(path.join(REPO_ROOT, "src"))} -name "useExport*" -type f 2>/dev/null`,
          { encoding: "utf8" }
        ).trim();
        if (!out) return "missing";
        const hookFiles = out.split("\n");
        const hasTest = hookFiles.some((f) => /__tests__|test\.|spec\./.test(f));
        return hasTest ? "covered" : "partial";
      } catch {
        return "missing";
      }
    },
  },

  // ── SQL / pgTAP (§ Layer-by-Layer / SQL) ──
  {
    id: "sql.score_range_constraint",
    layer: "SQL",
    desc: "score_value ≥ 0 CHECK constraint test (schema has no upper-bound; lower-bound only)",
    detect: () => {
      // check.sql has: throws_ok('EXECUTE bad_score_value_neg', '23514', NULL,
      //   'score_sheet_items.score_value >= 0 rejects negative')
      const hits = grepCount(
        "score_value.*rejects|bad_score_value|score_value.*>= 0",
        ["sql/tests/constraints"],
        {}
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "sql.composite_unique",
    layer: "SQL",
    desc: "Composite UNIQUE constraint test (juror × project on score_sheets)",
    detect: () => {
      // unique.sql has: 'score_sheets(juror_id, project_id) UNIQUE prevents duplicate juror×project'
      // Pattern order matches: juror_id ...project_id... UNIQUE (reversed from original)
      const hits = grepCount(
        "juror.*project.*UNIQUE|bad_ss_duplicate|duplicate juror|score_sheets.*juror.*project",
        ["sql/tests/constraints"],
        {}
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "sql.period_lock_trigger",
    layer: "SQL",
    desc: "period_lock trigger: locked period mutation rejected",
    detect: () =>
      fileExists("sql/tests/triggers/period_lock.sql") ? "covered" : "missing",
  },
  {
    id: "sql.audit_chain_trigger",
    layer: "SQL",
    desc: "audit_chain trigger: hash chain integrity",
    detect: () =>
      fileExists("sql/tests/triggers/audit_chain.sql") ? "covered" : "missing",
  },
  {
    id: "sql.rls_27_tables",
    layer: "SQL",
    desc: "RLS isolation test for every RLS-enabled table",
    detect: () => {
      // Drift sentinel exists; if it passes, this is covered.
      try {
        execSync("npm run --silent check:rls-tests", {
          cwd: REPO_ROOT,
          stdio: ["ignore", "pipe", "pipe"],
        });
        return "covered";
      } catch {
        return "partial";
      }
    },
  },
  {
    id: "sql.rpc_89_contracts",
    layer: "SQL",
    desc: "RPC contract test for every public RPC",
    detect: () => {
      try {
        execSync("npm run --silent check:rpc-tests", {
          cwd: REPO_ROOT,
          stdio: ["ignore", "pipe", "pipe"],
        });
        return "covered";
      } catch {
        return "partial";
      }
    },
  },

  // ── RPC state mutation depth (§ Layer-by-Layer / SQL — RPC) ──
  {
    id: "rpc.upsert_score_post_submit_reject",
    layer: "RPC",
    desc: "rpc_jury_upsert_score returns final_submit_required after submit",
    detect: () => {
      const hits = grepCount(
        "final_submit_required",
        ["sql/tests/rpcs", "e2e"],
        {}
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "rpc.finalize_submission_mutation",
    layer: "RPC",
    desc: "rpc_jury_finalize_submission asserts final_submitted_at update",
    detect: () => {
      // Requires the RPC to be called in a pgTAP test AND final_submitted_at
      // to be asserted as non-NULL after the call. Both must appear in the same
      // file in sql/tests/rpcs to count as covered.
      const rpcCalled = grepCount(
        "rpc_jury_finalize_submission",
        ["sql/tests/rpcs"],
        {}
      );
      const stateAsserted = grepCount(
        "writes final_submitted_at|final_submitted_at.*juror_period_auth|isnt.*final_submitted_at",
        ["sql/tests/rpcs"],
        {}
      );
      if (rpcCalled > 0 && stateAsserted > 0) return "covered";
      if (rpcCalled > 0) return "partial";
      return "missing";
    },
  },
  {
    id: "rpc.audit_log_per_rpc",
    layer: "RPC",
    desc: "Audit log row written assertion in admin RPC tests",
    detect: () => {
      const hits = grepCount(
        "audit_logs.*INSERT|FROM audit_logs|action.*=.*'\\w+\\.",
        ["sql/tests/rpcs/admin", "sql/tests/rpcs/contracts"],
        {}
      );
      return hits >= 5 ? "covered" : hits > 0 ? "partial" : "missing";
    },
  },

  // ── Edge function (§ Layer-by-Layer / Edge) ──
  {
    id: "edge.21_schemas",
    layer: "Edge",
    desc: "All edge functions have Zod schema + Deno test",
    detect: () => {
      try {
        execSync("npm run --silent check:edge-schema", {
          cwd: REPO_ROOT,
          stdio: ["ignore", "pipe", "pipe"],
        });
        return "covered";
      } catch {
        return "partial";
      }
    },
  },

  // ── E2E (§ Layer-by-Layer / E2E) ──
  {
    id: "e2e.jury_final_submit_lock",
    layer: "E2E",
    desc: "Jury post-submit score lock (final_submit_required reject)",
    detect: () => {
      const hits = grepCount(
        "final_submit_required",
        ["e2e/jury"],
        {}
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "e2e.jury_mobile_viewport",
    layer: "E2E",
    desc: "Mobile portrait/landscape jury viewport",
    detect: () => {
      const hits = grepCount(
        "setViewportSize.*390|setViewportSize.*375|portrait.*jury|landscape.*jury",
        ["e2e/jury"],
        {}
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "e2e.demo_read_only",
    layer: "E2E",
    desc: "Demo mode read-only enforcement spec",
    detect: () => {
      const hits = grepCount(
        "demo.*read.?only|demo.*write.*reject|/demo/.*write",
        ["e2e"],
        {}
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "e2e.export_filter_parity",
    layer: "E2E",
    desc: "Export filter parity (filter applied → CSV row match)",
    detect: () => {
      const hits = grepCount(
        "filter.*export.*row|export.*filter.*parity|filtered.*export",
        ["e2e/admin"],
        {}
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "e2e.export_xlsx_numeric",
    layer: "E2E",
    desc: "XLSX export numeric cell type assertion",
    detect: () => {
      // Tight pattern: must read back the XLSX *and* assert numeric cell type.
      // Cell type "n" is the XLSX worksheet convention; matching `.t === "n"`
      // (or single-quoted variant) requires the test to actually parse cells.
      const hits = grepCount(
        '\\.t\\s*===\\s*[\\"\\\']n[\\"\\\']|cellType\\s*===\\s*[\\"\\\']number',
        ["e2e/admin"],
        {}
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "e2e.export_turkish_chars",
    layer: "E2E",
    desc: "Turkish character preservation in export",
    detect: () => {
      // Tight pattern: explicit reference to Turkish encoding/preservation.
      // Bare Turkish letters in UI strings (ç ğ ı ö ş ü) match anything.
      const hits = grepCount(
        "turkish.*(char|encod|preserve)|t[uü]rk[cç]e.*(encod|preserve|karakter)",
        ["e2e/admin"],
        {}
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "e2e.audit_log_helper",
    layer: "E2E",
    desc: "Audit log assertion helper (e2e/helpers/audit.ts)",
    detect: () => {
      if (!fileExists("e2e/helpers/audit.ts") && !fileExists("e2e/helpers/audit.js")) {
        return "missing";
      }
      const hits = grepCount(
        "audit_logs.*select|from\\(.audit_logs.\\)\\.select",
        ["e2e/admin"],
        {}
      );
      return hits >= 3 ? "covered" : "partial";
    },
  },
  {
    id: "e2e.multi_org_tenant_switch",
    layer: "E2E",
    desc: "Multi-org tenant context switch",
    detect: () => {
      const hits = grepCount(
        "multi.org|two.orgs|switch.*org|two.organizations",
        ["e2e/security", "e2e/admin"],
        {}
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "e2e.token_revoke_deny",
    layer: "E2E",
    desc: "Token revoke → next eval attempt rejected",
    detect: () => {
      const hits = grepCount(
        "revoke.*token.*reject|is_revoked.*deny|revoked.*entry",
        ["e2e"],
        {}
      );
      return hits > 0 ? "covered" : "missing";
    },
  },
  {
    id: "e2e.period_lifecycle_integrated",
    layer: "E2E",
    desc: "Period full lifecycle integrated (Create→Activate→Lock→Close)",
    detect: () => {
      // Tight signal: a dedicated spec file. Loose phrase matches keep
      // returning false positives because admin specs casually mention
      // "lifecycle"/"publish"/"close" in unrelated context.
      const hasFile =
        fileExists("e2e/admin/period-lifecycle.spec.ts") ||
        fileExists("e2e/admin/periods-lifecycle.spec.ts");
      return hasFile ? "covered" : "missing";
    },
  },

  // ── CI ──
  {
    id: "ci.e2e_pr_blocking",
    layer: "CI",
    desc: "Critical E2E subset is PR-blocking in e2e.yml",
    detect: () => {
      const file = path.join(REPO_ROOT, ".github/workflows/e2e.yml");
      if (!existsSync(file)) return "missing";
      const txt = readFileSync(file, "utf8");
      const isInformational = /continue-on-error:\s*true/i.test(txt);
      const triggersOnPR =
        /pull_request|on:.*pull_request/m.test(txt) || /pull_request:/m.test(txt);
      if (!triggersOnPR) return "missing";
      return isInformational ? "partial" : "covered";
    },
  },
  {
    id: "ci.visual_a11y_nightly",
    layer: "CI",
    desc: "Visual + a11y on a nightly schedule (cron)",
    detect: () => {
      const file = path.join(REPO_ROOT, ".github/workflows/e2e.yml");
      if (!existsSync(file)) return "missing";
      const txt = readFileSync(file, "utf8");
      const visualOrA11y = /visual|axe|a11y/i.test(txt);
      const onSchedule = /schedule:|cron:/i.test(txt);
      return visualOrA11y && onSchedule ? "covered" : "missing";
    },
  },
];

// ─── run ───────────────────────────────────────────────────────────────────
const STATUS_GLYPH = { covered: "✅", partial: "⚠ ", missing: "❌" };

const results = ITEMS.map((item) => {
  let status = "missing";
  try {
    status = item.detect();
  } catch (e) {
    status = "missing";
  }
  return { ...item, status };
});

// group by layer for output
const byLayer = new Map();
for (const r of results) {
  if (!byLayer.has(r.layer)) byLayer.set(r.layer, []);
  byLayer.get(r.layer).push(r);
}

// markdown output
console.log("# VERA Guideline Coverage Matrix\n");
console.log(
  "Sentinel for `.claude/rules/test-writing.md`. Run via `npm run check:guideline-coverage`.\n"
);

for (const [layer, items] of byLayer) {
  console.log(`\n## ${layer}\n`);
  console.log("| Status | Item | Description |");
  console.log("|---|---|---|");
  for (const r of items) {
    console.log(`| ${STATUS_GLYPH[r.status]} | \`${r.id}\` | ${r.desc} |`);
  }
}

const total = results.length;
const covered = results.filter((r) => r.status === "covered").length;
const partial = results.filter((r) => r.status === "partial").length;
const missing = results.filter((r) => r.status === "missing").length;
const score = ((covered + partial * 0.5) / total) * 100;

console.log("\n## Summary\n");
console.log(`- Total items: **${total}**`);
console.log(`- ✅ covered: **${covered}**`);
console.log(`- ⚠  partial: **${partial}**`);
console.log(`- ❌ missing: **${missing}**`);
console.log(`- Coverage score: **${score.toFixed(1)}%** (covered + 0.5×partial / total)`);
console.log(`- Threshold: ${MIN_THRESHOLD}% (informational; raise as gaps close)\n`);

if (score < MIN_THRESHOLD) {
  console.error(
    `\n⚠  Guideline coverage ${score.toFixed(1)}% is below threshold ${MIN_THRESHOLD}%.`
  );
  console.error(
    "   See .claude/rules/test-writing.md and docs/qa/vera-test-audit-report.md for the gap list.\n"
  );
  if (HARD_FAIL) process.exit(1);
}

process.exit(0);
