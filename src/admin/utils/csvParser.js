// src/admin/utils/csvParser.js
// ============================================================
// CSV parsing helpers for project and juror bulk import.
//
// Strategy: parse header-less, auto-detect if first row is a
// header by fuzzy alias matching. Unmatched fields fall back to
// positional order. No warnings for column mapping — returns
// detectedColumns[] so the modal can show what was found.
// ============================================================

import Papa from "papaparse";

function sizeLabel(file) {
  const kb = file.size / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

function normalizeHeader(h) {
  return String(h ?? "").trim().toLowerCase().replace(/[\s#\-./]+/g, "_");
}

// Project numbers are DB-assigned; we do not accept group_no from CSV.
const PROJECT_COL_MAP = {
  title:    ["title", "project_title", "project_name", "name", "baslik", "başlık"],
  members:  ["members", "students", "team_members", "team", "student_names", "uyeler", "üyeler"],
};

const JUROR_COL_MAP = {
  juror_name:  ["juror_name", "name", "juror", "full_name", "fullname", "ad_soyad", "isim"],
  affiliation: ["affiliation", "department", "institution", "org", "company", "kurum", "birim"],
  email:       ["email", "e_mail", "email_address", "mail"],
};

// Positional order — used when a field has no header match
const PROJECT_POSITIONAL = ["title", "members"];
const JUROR_POSITIONAL   = ["juror_name", "affiliation", "email"];

/**
 * Auto-detect column mapping from raw rows.
 * Returns { dataRows, colIndices, detectedColumns, hasHeader }
 *
 * detectedColumns: [{ field, label, source: "header"|"positional" }]
 * colIndices: { [field]: columnIndex }  (-1 = not available)
 */
function detectAndMap(rawRows, colMap, positionalOrder) {
  if (rawRows.length === 0) {
    const colIndices = Object.fromEntries(positionalOrder.map((f, i) => [f, i]));
    const detectedColumns = positionalOrder.map((f, i) => ({ field: f, label: `column ${i + 1}`, source: "positional" }));
    return { dataRows: [], colIndices, detectedColumns, hasHeader: false };
  }

  // Skip leading comment rows (first cell starts with #) and blank rows
  const isComment = (row) => String(row[0] ?? "").trim().startsWith("#");
  const isBlank   = (row) => row.every((cell) => String(cell ?? "").trim() === "");
  const firstDataIdx = rawRows.findIndex((r) => !isComment(r) && !isBlank(r));
  const candidateRows = firstDataIdx >= 0 ? rawRows.slice(firstDataIdx) : rawRows;

  const firstRow = candidateRows[0].map((cell) => String(cell ?? "").trim());
  const normalizedFirst = firstRow.map(normalizeHeader);

  // Count how many aliases match the candidate header row
  const headerIndices = {};
  let matchCount = 0;
  for (const [canonical, aliases] of Object.entries(colMap)) {
    const idx = normalizedFirst.findIndex((h) => aliases.includes(h));
    if (idx >= 0) { headerIndices[canonical] = idx; matchCount++; }
  }

  const hasHeader = matchCount > 0;
  const dataRows  = hasHeader ? candidateRows.slice(1) : candidateRows;

  const colIndices = {};
  const detectedColumns = [];

  positionalOrder.forEach((canonical, posIdx) => {
    if (hasHeader && headerIndices[canonical] !== undefined) {
      const idx = headerIndices[canonical];
      colIndices[canonical] = idx;
      detectedColumns.push({ field: canonical, label: firstRow[idx], source: "header" });
    } else {
      // Positional fallback — use index in positionalOrder
      colIndices[canonical] = posIdx;
      detectedColumns.push({ field: canonical, label: `column ${posIdx + 1}`, source: "positional" });
    }
  });

  return { dataRows, colIndices, detectedColumns, hasHeader, firstDataIdx: firstDataIdx >= 0 ? firstDataIdx : 0 };
}

/**
 * Parse a projects CSV file.
 * @returns {{ rows, stats, detectedColumns, warningMessage, file }}
 *   rows: [{ rowNum, groupNo, title, members, status, statusLabel, group_no }]
 */
export async function parseProjectsCsv(file) {
  return new Promise((resolve) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete({ data }) {
        const { dataRows, colIndices, detectedColumns, hasHeader, firstDataIdx = 0 } =
          detectAndMap(data, PROJECT_COL_MAP, PROJECT_POSITIONAL);

        const rowOffset = firstDataIdx + (hasHeader ? 2 : 1);
        const rows = [];
        let valid = 0, error = 0;

        dataRows.forEach((raw, i) => {
          const rowNum = i + rowOffset;
          const title   = (raw[colIndices.title]   ?? "").toString().trim();
          const members = (raw[colIndices.members] ?? "").toString().trim();

          const hasTitle = title.length > 0;
          let status = "ok", statusLabel = "";
          if (!hasTitle) {
            status = "err";
            statusLabel = "Missing title";
            error += 1;
          } else {
            valid += 1;
          }

          rows.push({
            rowNum,
            title: title || "—",
            members,
            status,
            statusLabel,
          });
        });

        let warningMessage = null;
        if (error > 0) {
          const details = rows
            .filter((r) => r.status === "err")
            .map((r) => `Row ${r.rowNum}: ${r.statusLabel || "invalid"} (cannot import).`)
            .join(" ");
          warningMessage = { title: `${error} error${error !== 1 ? "s" : ""}`, desc: details };
        }

        resolve({
          rows,
          stats: { valid, duplicate: 0, error, total: dataRows.length },
          detectedColumns,
          warningMessage,
          file: { name: file.name, sizeLabel: sizeLabel(file) },
        });
      },
      error() {
        resolve({
          rows: [],
          stats: { valid: 0, duplicate: 0, error: 0, total: 0 },
          detectedColumns: [],
          warningMessage: { title: "Parse error", desc: "Could not parse the CSV file." },
          file: { name: file.name, sizeLabel: sizeLabel(file) },
        });
      },
    });
  });
}

function normName(s) {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Parse a jurors CSV file.
 * @param {File} file
 * @param {Array} [existingJurors] — current juror list; rows whose name matches will be marked duplicate
 * @returns {{ rows, stats, detectedColumns, warningMessage, file }}
 *   rows: [{ rowNum, name, affiliation, status, statusLabel, juror_name, email }]
 */
export async function parseJurorsCsv(file, existingJurors = []) {
  const existingNames = new Set(
    existingJurors.map((j) => normName(j.juror_name || j.juryName || ""))
  );

  return new Promise((resolve) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete({ data }) {
        const { dataRows, colIndices, detectedColumns, hasHeader, firstDataIdx = 0 } =
          detectAndMap(data, JUROR_COL_MAP, JUROR_POSITIONAL);

        const rowOffset = firstDataIdx + (hasHeader ? 2 : 1);
        const rows = [];
        let valid = 0, duplicate = 0, error = 0;

        dataRows.forEach((raw, i) => {
          const rowNum      = i + rowOffset;
          const jurorName   = (raw[colIndices.juror_name]  ?? "").toString().trim();
          const affiliation = (raw[colIndices.affiliation] ?? "").toString().trim();
          const email       = (raw[colIndices.email]       ?? "").toString().trim();

          let status = "ok", statusLabel = "";
          if (!jurorName) {
            status = "err";
            statusLabel = "No name";
            error += 1;
          } else if (existingNames.has(normName(jurorName))) {
            status = "skip";
            statusLabel = "Duplicate";
            duplicate += 1;
          } else {
            valid += 1;
          }

          rows.push({
            rowNum,
            name: jurorName || "—",
            affiliation,
            status,
            statusLabel,
            juror_name: jurorName || null,
            email: email || null,
          });
        });

        // Build per-row warning summary for duplicates + errors
        let warningMessage = null;
        if (duplicate > 0 || error > 0) {
          const parts = [];
          if (duplicate > 0) parts.push(`${duplicate} duplicate`);
          if (error > 0) parts.push(`${error} error`);
          const title = parts.join(", ");
          const details = rows
            .filter((r) => r.status !== "ok")
            .map((r) => {
              if (r.status === "skip") return `Row ${r.rowNum}: ${r.name} already exists in this evaluation period (will be skipped).`;
              if (r.status === "err") return `Row ${r.rowNum}: juror name is missing — cannot import.`;
              return null;
            })
            .filter(Boolean)
            .join(" ");
          warningMessage = { title, desc: details };
        }

        resolve({
          rows,
          stats: { valid, duplicate, error, total: dataRows.length },
          detectedColumns,
          warningMessage,
          file: { name: file.name, sizeLabel: sizeLabel(file) },
        });
      },
      error() {
        resolve({
          rows: [],
          stats: { valid: 0, duplicate: 0, error: 0, total: 0 },
          detectedColumns: [],
          warningMessage: { title: "Parse error", desc: "Could not parse the CSV file." },
          file: { name: file.name, sizeLabel: sizeLabel(file) },
        });
      },
    });
  });
}
