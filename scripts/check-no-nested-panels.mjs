// Scans src/styles/**/*.css for the "nested panel" anti-pattern documented in
// CLAUDE.md — inner sections inside cards that get their own background,
// creating a floating-rectangle effect.
//
// Heuristic: inside any `@media (...portrait...)` block (mobile card layout),
// flag any rule that sets a non-transparent `background` / `background-color`
// on a `td`, `td.col-*`, or common inner-row selectors. Mobile portrait is
// where cards compose from table rows, so inner backgrounds are most jarring
// there. Legitimate uses (thead, status pills, badges) rarely live in these
// blocks; when they do, append `/* nested-panel-ok */` on the same line to
// opt out.
//
// Exit 1 on violations so CI can gate on it.

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src/styles");
const VIOLATIONS = [];

// Inner-element selectors that should NOT carry their own bg inside a card.
// Matches anywhere in the selector string.
const INNER_SELECTOR_RE = /(^|[\s>+~])(td\b|\.col-[a-z0-9-]+|\.card-inner\b|\.inner-panel\b)/i;

// Extract every `background(-color): <value>;` declaration on a line so we
// can inspect the value. (A single line can hold multiple declarations.)
const BG_DECL_RE = /background(?:-color)?\s*:\s*([^;}]+?)(?=[;}])/gi;

// Values that are intentional and don't create a floating panel:
// - resets
// - pass-through card bg (sticky cols need this)
const TRANSPARENT_VALUES = new Set(["transparent", "none", "inherit", "unset", "initial"]);
function isOpaqueValue(value) {
  const v = value.trim().toLowerCase().replace(/\s*!important$/i, "").trim();
  if (TRANSPARENT_VALUES.has(v)) return false;
  if (v === "var(--bg-card)") return false;
  return true;
}

// Mobile portrait media query — where card layouts live.
const PORTRAIT_MEDIA_RE = /@media[^{]*\(\s*max-width\s*:\s*(7|8|9)\d{2}px\s*\)[^{]*\borientation\s*:\s*portrait/i;

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".css")) scanFile(full);
  }
}

function scanFile(file) {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");

  // Walk brace depth; track whether we're inside a portrait media query.
  let depth = 0;
  let portraitDepth = null; // depth at which current portrait block opened
  let currentSelector = null;
  let selectorStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.replace(/\/\*.*?\*\//g, "");

    // Detect opening of a portrait media block on this line.
    if (portraitDepth === null && PORTRAIT_MEDIA_RE.test(stripped) && stripped.includes("{")) {
      portraitDepth = depth; // outer depth; block interior is depth+1
    }

    // Count braces.
    for (const ch of stripped) {
      if (ch === "{") {
        depth++;
        if (currentSelector === null && portraitDepth !== null && depth === portraitDepth + 2) {
          // selector just opened inside portrait media
          // currentSelector captured separately below
        }
      } else if (ch === "}") {
        depth--;
        if (portraitDepth !== null && depth === portraitDepth) {
          portraitDepth = null;
        }
      }
    }

    // Track selector (rough — captures the line that contains `{`).
    const openIdx = stripped.lastIndexOf("{");
    if (openIdx !== -1 && !PORTRAIT_MEDIA_RE.test(stripped)) {
      currentSelector = stripped.slice(0, openIdx).trim() || currentSelector;
      selectorStartLine = i + 1;
    }
    if (stripped.includes("}")) {
      if (stripped.indexOf("}") > stripped.lastIndexOf("{")) currentSelector = null;
    }

    // Inside a portrait media block, on a declaration line with bg, check selector.
    if (
      portraitDepth !== null &&
      currentSelector &&
      INNER_SELECTOR_RE.test(currentSelector) &&
      !/nested-panel-ok/.test(line)
    ) {
      let m;
      BG_DECL_RE.lastIndex = 0;
      while ((m = BG_DECL_RE.exec(stripped)) !== null) {
        if (isOpaqueValue(m[1])) {
          VIOLATIONS.push({
            file: path.relative(process.cwd(), file),
            line: i + 1,
            selector: currentSelector,
            snippet: line.trim(),
          });
          break;
        }
      }
    }
  }
}

walk(ROOT);

if (VIOLATIONS.length) {
  console.error("Nested-panel violations found (CLAUDE.md: no inner panels).");
  console.error("Cards must not contain inner sections with their own background.");
  console.error("Use spacing / border separators instead, or append `/* nested-panel-ok */`.\n");
  for (const v of VIOLATIONS) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    selector: ${v.selector}`);
    console.error(`    → ${v.snippet}\n`);
  }
  process.exit(1);
}

console.log("OK: no nested-panel backgrounds found in mobile card layouts.");
