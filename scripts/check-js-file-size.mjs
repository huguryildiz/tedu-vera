#!/usr/bin/env node
/**
 * check-js-file-size.mjs
 * Enforces JSX/JS file size ceiling from CLAUDE.md:
 *   sweet spot: ≤500 lines
 *   warn range: 801–1000 lines
 *   hard violation: >1000 lines → exit 1
 *
 * Exclusions: __tests__, .archive, node_modules, dist, scripts/
 */

import fs from 'fs';
import path from 'path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const HARD_LIMIT = 1000;
const WARN_LIMIT = 800;

function hasExemptComment(f) {
  const content = fs.readFileSync(f, 'utf8');
  const firstLines = content.split('\n').slice(0, 5).join('\n');
  return /\/\/\s*size-ceiling-ok:/i.test(firstLines);
}

function collectFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.git', 'scripts'].includes(entry.name)) continue;
      collectFiles(full, files);
    } else if (/\.(jsx?|tsx?)$/.test(entry.name) && !entry.name.includes('.archive')) {
      if (!full.includes('__tests__') && !full.includes('.archive')) {
        files.push(full);
      }
    }
  }
  return files;
}

const srcDir = path.join(ROOT, 'src');
const allFiles = collectFiles(srcDir);

const violations = [];
const warnings = [];

for (const f of allFiles) {
  if (hasExemptComment(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n').length;
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
  console.warn(`\n${warnings.length} file(s) in warn range (801–1000). Consider splitting.`);
}

if (violations.length) {
  console.error(`\n${violations.length} file(s) exceed ${HARD_LIMIT} lines — HARD VIOLATION. Must be split.`);
  process.exit(1);
}

console.log(`JS/JSX file size check passed. ${warnings.length} warning(s).`);
