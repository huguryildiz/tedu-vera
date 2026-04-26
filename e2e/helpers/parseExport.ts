import * as fs from "node:fs";
import * as path from "node:path";
import { createRequire } from "node:module";

const _require = createRequire(import.meta.url);

export interface CSVResult {
  /** Column names extracted from the first non-comment line */
  headers: string[];
  /** Data rows keyed by header name */
  rows: Record<string, string>[];
}

/**
 * Parse a CSV file exported by VERA's downloadTable utility.
 *
 * The utility prepends a UTF-8 BOM and optional `# Section Title` comment lines
 * before each data block. This parser strips the BOM, skips comment lines, treats
 * the first non-comment line as the header row, and returns subsequent rows as
 * plain string record objects.
 *
 * Returns `{headers, rows:[]}` when the file contains only the header (no data).
 */
export function readCSV(filePath: string): CSVResult {
  const raw = fs.readFileSync(filePath, "utf-8");
  // Strip UTF-8 BOM (U+FEFF) if present
  const text = raw.startsWith("﻿") ? raw.slice(1) : raw;
  const lines = text.split(/\r?\n/);

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (let ci = 0; ci < line.length; ci++) {
      const ch = line[ci];
      if (ch === '"') {
        if (inQ && line[ci + 1] === '"') {
          cur += '"';
          ci++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === "," && !inQ) {
        fields.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  };

  // Find first non-comment, non-empty line → header
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed && !trimmed.startsWith("#")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { headers: [], rows: [] };

  const headers = parseRow(lines[headerIdx]);
  const rows: Record<string, string>[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    // Stop at empty line or next section comment
    if (!line || line.startsWith("#")) break;
    const values = parseRow(lines[i]);
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = values[idx] ?? "";
    });
    rows.push(record);
  }

  return { headers, rows };
}

/**
 * Parse an XLSX file exported by VERA's downloadTable utility.
 *
 * Uses xlsx-js-style (already a project dependency) to read the first sheet.
 * Returns `{headers, rows}` where headers come from the first sheet row and
 * rows are subsequent rows as plain objects.
 *
 * Returns `{headers:[], rows:[]}` for an empty workbook.
 */
export function readXLSX(filePath: string): { headers: string[]; rows: Record<string, unknown>[] } {
  // xlsx-js-style is CJS; use createRequire since the project is ESM ("type": "module")
  const XLSX = _require("xlsx-js-style") as typeof import("xlsx-js-style");
  const resolvedPath = path.resolve(filePath);
  const wb = XLSX.readFile(resolvedPath);
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { headers: [], rows: [] };

  const ws = wb.Sheets[sheetName];
  // sheet_to_json with defval:"" uses first row as headers automatically
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
  });

  // Extract headers from the sheet range directly so we have them even when rows is empty
  const ref = ws["!ref"];
  let headers: string[] = [];
  if (ref) {
    const range = XLSX.utils.decode_range(ref);
    for (let col = range.s.c; col <= range.e.c; col++) {
      const cellAddr = XLSX.utils.encode_cell({ r: range.s.r, c: col });
      const cell = ws[cellAddr];
      if (cell) headers.push(String(cell.v ?? ""));
    }
  }

  return { headers, rows };
}

/**
 * Per-sheet 2D-array view of an XLSX workbook.
 *
 * `rows` preserves the original sheet layout cell-by-cell — row 0 is the
 * literal first row of the sheet (e.g. a title row in analytics exports), not
 * a header row. Use this when sheets have title/note/blank rows above the
 * actual headers (analyticsExport's addTableSheet emits
 * `[title], [note], [], headers, ...rows`).
 *
 * `cell(ref)` returns the raw `.v` value at any A1-style cell reference (e.g.
 * "C5") — the escape hatch for sheets where sheet_to_json's heuristics break
 * on merged cells, multi-section layouts, or non-standard header positions.
 */
export interface SheetView {
  rows: unknown[][];
  cell(ref: string): unknown;
}

export type MultiSheetXLSX = Record<string, SheetView>;

/**
 * Read every sheet of an XLSX file as a 2D array of raw values.
 * Returns an object keyed by sheet name. Useful for analytics exports where
 * each chart section emits its own sheet and the first row is a title, not
 * headers.
 */
export function readXLSXAllSheets(filePath: string): MultiSheetXLSX {
  const XLSX = _require("xlsx-js-style") as typeof import("xlsx-js-style");
  const wb = XLSX.readFile(path.resolve(filePath));
  const out: MultiSheetXLSX = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
    out[name] = {
      rows,
      cell: (ref: string) => ws[ref]?.v,
    };
  }
  return out;
}

/**
 * Read a single cell value by A1-style coordinate from a specific sheet.
 * Returns `undefined` if the sheet or cell is missing.
 */
export function cellAt(filePath: string, sheetName: string, cellRef: string): unknown {
  const XLSX = _require("xlsx-js-style") as typeof import("xlsx-js-style");
  const wb = XLSX.readFile(path.resolve(filePath));
  const ws = wb.Sheets[sheetName];
  if (!ws) return undefined;
  return ws[cellRef]?.v;
}
