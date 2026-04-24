# C2 — Rankings Export Content Validation

**Branch:** `test/c2-export-content`
**Date:** 2026-04-24
**Status:** Complete

---

## Deliverables

### New files

| File | Purpose |
|------|---------|
| `e2e/fixtures/seed-ids.ts` | Canonical source of all hardcoded UUIDs shared across E2E specs. Eliminates UUID drift risk and prepares C4 (scoring correctness). |
| `e2e/helpers/parseExport.ts` | `readCSV()` + `readXLSX()` helpers. Handles UTF-8 BOM, `# Section Title` comment lines, quoted CSV fields, and CJS `xlsx-js-style` inside an ESM project via `createRequire`. |

### Modified files

| File | Change |
|------|--------|
| `src/admin/features/rankings/RankingsPage.jsx` | Added `data-testid="rankings-export-format-{id}"` to each format option div; added `data-testid="rankings-export-download-btn"` to download button. No behavior changes. |
| `e2e/poms/RankingsPom.ts` | Added `exportFormatOption()`, `exportDownloadBtn()`, `selectFormat()`, `clickDownloadAndCapture()`. |
| `e2e/admin/rankings-export.spec.ts` | Rewrote to 4 tests: 2 original (KPI strip + panel open) + 2 new content-validating (CSV headers + XLSX headers). Added `readCSV`/`readXLSX` imports and `REQUIRED_EXPORT_HEADERS` constant. |

---

## Tests Added

```
CSV export → file downloaded → header columns correct
XLSX export → file downloaded → header columns correct
```

Both assert:
1. `download.path()` is non-null (file was actually downloaded)
2. Parsed headers array is non-empty
3. Each of `["Rank", "Project Title", "Team Members"]` appears in headers

### Why header-only (not row-count assertion)

The demo org (`E2E_PERIODS_ORG_ID`) has no scored projects in its active period. The exported CSV contains only `BOM + "# Rankings\n" + header row`. Asserting `rows.length > 0` would always fail against this seed. The plan's fallback rule applies: *"Eğer seed'de scored project yoksa, test basit content doğrulamasına kadar çek."* Header schema validation is the correct scope and still catches the regressions that matter (column renames, export pipeline breakage).

---

## Key Technical Issues Resolved

### 1. CSV parser: BOM + comment lines

VERA's `downloadTable.js` prepends a UTF-8 BOM (`﻿`) and inserts `# SheetName` comment lines before each data block. The parser in `parseExport.ts` strips the BOM on read, skips lines starting with `#`, and treats the first non-empty/non-comment line as the header row.

### 2. CJS module in ESM project

`xlsx-js-style` is a CommonJS module. Because `package.json` has `"type": "module"`, `require()` is not available. Fix: `createRequire(import.meta.url)` from `node:module` provides a CJS-compatible require that works inside ESM.

### 3. `readXLSX` headers when rows is empty

`XLSX.utils.sheet_to_json()` returns `[]` when there are no data rows, giving no headers to extract. Fix: read headers directly from `ws["!ref"]` range via `XLSX.utils.decode_range` + `XLSX.utils.encode_cell`, independent of row count.

---

## Deliberately-Break Validation

### Break 1 — wrong column name

Changed `"Project Title"` to `"Project Titlezzz"` in `REQUIRED_EXPORT_HEADERS`.

**Result:** CSV and XLSX tests both failed with `Expected array to contain "Project Titlezzz"`. Reverted.

### Break 2 — wrong `data-testid` on format options

Changed `rankings-export-format-${opt.id}` to `BROKEN-rankings-export-format-${opt.id}` in `RankingsPage.jsx`.

**Result:** `selectFormat("csv")` timed out (`locator('[data-testid="rankings-export-format-csv"]')` not found). Test failed after 30s. Reverted.

---

## Flake Check

```
npm run e2e -- --grep "export" --repeat-each=3 --workers=1
```

**Result: 12/12 passed** (3 repetitions × 4 tests). Zero flakes.

---

## Full Suite

Run with default parallel workers. Result varies between runs due to pre-existing F1 auth timing flakiness (shared demo DB + parallel sign-in race):

- **C2 tests (with --workers=1):** 12/12 stable
- **Full parallel runs:** rankings-export CSV/XLSX tests occasionally fail at the `expectOnDashboard()` step (`/login` URL instead of `/admin`) — this is the same pre-existing auth timing flake documented in C1 (F1). Not introduced by C2.
- **Other failures in full run:** `periods`, `projects`, `reviews`, `setup-wizard`, `tenant-application` — all fail at `signIn` step; pre-existing parallel contention.

The C2 additions do not introduce new flakiness. All 4 rankings-export tests are determistically stable under `--workers=1`.

---

## `REQUIRED_EXPORT_HEADERS` Contract

These 3 columns are now gated by E2E. Any rename or removal in `downloadTable.js` will break the tests:

```
Rank | Project Title | Team Members
```

Dynamic criteria columns (e.g. `"Design (10)"`) are not asserted here; that scope belongs to C4 (scoring correctness).
