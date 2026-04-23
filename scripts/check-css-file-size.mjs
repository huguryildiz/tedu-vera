#!/usr/bin/env node
/**
 * check-css-file-size.mjs
 * Enforces CSS file size ceiling from CLAUDE.md:
 *   sweet spot: ≤600 lines
 *   warn range: 601–800 lines
 *   hard violation: >1000 lines → exit 1
 *
 * Escape hatch: files with "size-ceiling-ok: <reason>" comment in first 5 lines are exempt.
 * Exclusions: node_modules, dist
 */

import fs from 'fs';
import path from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const HARD_LIMIT = 1000;
const WARN_LIMIT = 600;

function collectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git'].includes(entry.name)) continue;
      collectFiles(full, files);
    } else if (entry.name.endsWith('.css')) {
      files.push(full);
    }
  }
  return files;
}

function hasExemptComment(content) {
  const firstLines = content.split('\n').slice(0, 5).join('\n');
  return /\/\*\s*size-ceiling-ok:/i.test(firstLines);
}

const srcDir = path.join(ROOT, 'src');
const allFiles = collectFiles(srcDir);

const violations = [];
const warnings = [];

for (const f of allFiles) {
  const content = fs.readFileSync(f, 'utf8');
  if (hasExemptComment(content)) continue;
  const lines = content.split('\n').length;
  const rel = path.relative(ROOT, f);
  if (lines > HARD_LIMIT) violations.push({ rel, lines });
  else if (lines > WARN_LIMIT) warnings.push({ rel, lines });
}

for (const { rel, lines } of warnings) {
  console.warn(`WARN  ${lines.toString().padStart(5)} lines  ${rel}`);
}

for (const { rel, lines } of violations) {
  console.error(`FAIL  ${lines.toString().padStart(5)} lines  ${rel}`);
}

if (warnings.length) {
  console.warn(`\n${warnings.length} file(s) in warn range (601–1000). Consider splitting.`);
}

if (violations.length) {
  console.error(`\n${violations.length} file(s) exceed ${HARD_LIMIT} lines — HARD VIOLATION. Must be split.`);
  process.exit(1);
}

console.log(`CSS file size check passed. ${warnings.length} warning(s).`);
