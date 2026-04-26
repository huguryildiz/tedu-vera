#!/usr/bin/env node
/**
 * check-no-skip.js
 *
 * Counts it.skip / test.skip / describe.skip / qaTest.skip calls across
 * src/ and e2e/. Compares to docs/qa/skip-baseline.json.
 *
 * Exit 0 — count <= baseline (safe to merge)
 * Exit 1 — count > baseline (new skips added; update baseline deliberately)
 */

import { readFileSync } from 'fs';
import { resolve, join } from 'path';
import { readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const root = resolve(__dirname, '..');

const BASELINE_FILE = join(root, 'docs/qa/skip-baseline.json');
const SCAN_DIRS = ['src', 'e2e'];
const SKIP_PATTERN = /\b(it|test|describe|qaTest)\.skip\s*\(/g;
const INCLUDE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);
const EXCLUDE_DIRS = new Set(['node_modules', '__tests__.archive', '.archive']);

function walkFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...walkFiles(full));
    } else if (INCLUDE_EXT.has(entry.slice(entry.lastIndexOf('.')))) {
      results.push(full);
    }
  }
  return results;
}

let totalSkips = 0;
const hits = [];

for (const scanDir of SCAN_DIRS) {
  const absDir = join(root, scanDir);
  for (const file of walkFiles(absDir)) {
    const src = readFileSync(file, 'utf8');
    const matches = src.match(SKIP_PATTERN);
    if (matches) {
      totalSkips += matches.length;
      hits.push({ file: file.replace(root + '/', ''), count: matches.length });
    }
  }
}

const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
const { baselineSkipCount } = baseline;

console.log(`\nSkip baseline: ${baselineSkipCount}`);
console.log(`Current count: ${totalSkips}`);

if (hits.length > 0) {
  console.log('\nFiles with skips:');
  for (const { file, count } of hits) {
    console.log(`  ${count}x  ${file}`);
  }
}

if (totalSkips > baselineSkipCount) {
  const added = totalSkips - baselineSkipCount;
  console.error(`\n✗ ${added} new skip(s) added (${baselineSkipCount} → ${totalSkips}).`);
  console.error('  Remove the new skips, or update docs/qa/skip-baseline.json with a justification.');
  process.exit(1);
}

const removed = baselineSkipCount - totalSkips;
if (removed > 0) {
  console.log(`\n✓ ${removed} skip(s) removed vs baseline — consider ratcheting skip-baseline.json down.`);
} else {
  console.log('\n✓ No new skips added.');
}
process.exit(0);
