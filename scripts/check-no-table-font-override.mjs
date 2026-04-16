// Scans src/styles/**/*.css for `th` / `td` rules that hard-code typography
// (font-size, font-weight, padding, line-height) on generic cell selectors,
// competing with the unified table-system.css tokens.
//
// The Jurors-baseline table typography lives in variables.css / table-system.css
// and cascades via `.table-standard` / `.table-dense`. Page CSS should stay out
// of typography on bare `th` / `td` selectors and own only layout concerns
// (column widths, alignment, white-space, borders, colors). Exceptions for a
// specific cell (e.g. `.ranking-table td.col-rank { font-size: 15px }`) are
// fine — the scan only flags generic `th` / `td` (optionally with `thead` /
// `tbody` qualifiers).
//
// Append `/* table-font-ok */` on the same line to opt out of a rule when a
// selector genuinely needs a non-token typography for layout reasons (e.g. a
// marketing-surface table outside the admin family).
//
// Exit 1 on violations.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src/styles");
const VIOLATIONS = [];

// Matches selector lines whose last compound ends at a bare th/td, optionally
// prefixed with thead/tbody/tfoot. Examples:
//   .audit-table thead th {
//   .reviews-table td {
//   table.table-standard tbody td,
// Does NOT match column-specific or pseudo-class cells like `.jrm-table td.col-x`.
const GENERIC_CELL_RE =
  /(^|[\s>+~,])(?:(?:thead|tbody|tfoot)\s+)?(th|td)\s*[,{]/;

// Typography properties the unified system owns; any of these on a generic
// th/td rule is a violation unless explicitly opted out. `padding` is
// deliberately excluded — it varies legitimately per breakpoint and column,
// whereas font-size / weight / line-height / tracking must stay on token.
const OWNED_PROPS_RE =
  /(^|\s)(font-size|font-weight|line-height|letter-spacing)\s*:/m;

const OPT_OUT = /\/\*\s*table-font-ok\s*\*\//i;

// Allow page-local re-application of tokens (used to restore tokens after a
// mobile card reset — see pages/rankings.css, pages/outcomes.css, etc.)
const TOKEN_VALUE_RE = /\bvar\(\s*--table-[a-z0-9-]+\s*\)/i;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile() && entry.name.endsWith(".css")) scanFile(full);
  }
}

function scanFile(file) {
  const src = fs.readFileSync(file, "utf8");
  // Crude CSS rule splitter: rule = "<selector-list> { <decls> }".
  // Good enough for the flat, hand-authored stylesheets in this project.
  const RULE_RE = /([^{}]+)\{([^{}]*)\}/g;
  let lineOffset = 1;
  const lines = src.split("\n");
  const lineIndex = computeLineIndex(src);

  let match;
  while ((match = RULE_RE.exec(src)) !== null) {
    const selector = match[1].trim();
    const body = match[2];
    const startLine = lineAt(lineIndex, match.index);

    // Only inspect rules whose selector list contains a bare th/td cell.
    if (!GENERIC_CELL_RE.test(selector)) continue;

    // Skip if an opt-out appears anywhere in the selector list.
    if (OPT_OUT.test(selector)) continue;

    if (!OWNED_PROPS_RE.test(body)) continue;

    // Allow rules that only re-apply token values (e.g.
    //   .acc-table thead th { padding: var(--table-cell-py) ...; font-size: var(--table-header-size) }
    // — these are restorations after a mobile card reset.)
    const ownedValues = Array.from(
      body.matchAll(
        /(font-size|font-weight|line-height|letter-spacing)\s*:\s*([^;]+)/gi,
      ),
    );
    const allTokenized =
      ownedValues.length > 0 &&
      ownedValues.every(([, , v]) => TOKEN_VALUE_RE.test(v));
    if (allTokenized) continue;

    VIOLATIONS.push({
      file: path.relative(process.cwd(), file),
      line: startLine,
      selector: selector.replace(/\s+/g, " "),
      props: ownedValues.map(([, p]) => p).join(", "),
    });
  }
}

function computeLineIndex(src) {
  const idx = [0];
  for (let i = 0; i < src.length; i++) {
    if (src.charCodeAt(i) === 10) idx.push(i + 1);
  }
  return idx;
}

function lineAt(idx, pos) {
  let lo = 0;
  let hi = idx.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (idx[mid] <= pos) lo = mid;
    else hi = mid - 1;
  }
  return lo + 1;
}

walk(ROOT);

if (VIOLATIONS.length === 0) {
  console.log("check-no-table-font-override: clean");
  process.exit(0);
}

console.error(
  `check-no-table-font-override: ${VIOLATIONS.length} violation(s)`,
);
for (const v of VIOLATIONS) {
  console.error(`  ${v.file}:${v.line}  ${v.selector}  →  ${v.props}`);
}
console.error(
  "\nGeneric th/td selectors should not own typography. Move font-size / padding / line-height to table-system.css tokens, or add a column-specific class (e.g. td.col-rank). Append /* table-font-ok */ on the selector line to explicitly opt out.",
);
process.exit(1);
