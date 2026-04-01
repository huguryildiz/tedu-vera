// src/admin/projects/ProjectImport.jsx

import { useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { ChevronDownIcon, FileUpIcon, CloudUploadIcon } from "../../shared/Icons";
import { parseCsv } from "../utils";
import { getInvalidStudentSeparators, buildCsvSeparatorReason } from "./projectHelpers";

const MAX_CSV_BYTES = 2 * 1024 * 1024; // 2MB

export default function ProjectImport({
  show,
  onClose,
  onImport,
  periodName,
  projects,
}) {
  const fileRef = useRef(null);
  const importCancelRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const [importSuccess, setImportSuccess] = useState("");
  const [importError, setImportError] = useState("");
  const [importWarning, setImportWarning] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  if (!show) return null;

  const handleFile = async (file) => {
    if (!file) return;
    setImportSuccess("");
    setImportError("");
    setImportWarning("");
    if (file.size > MAX_CSV_BYTES) {
      setImportError("File is too large. Maximum allowed size is 2MB.");
      return;
    }
    const fileName = String(file.name || "").toLowerCase();
    if (!fileName.endsWith(".csv")) {
      setImportError("Only .csv files are supported.");
      return;
    }
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      setImportError("The file appears to be empty. Check the file and try again.");
      return;
    }
    const header = rows[0].map((h) => h.toLowerCase());
    const idxGroup = header.indexOf("group_no");
    const idxTitle = header.indexOf("title");
    const idxStudents = header.indexOf("members");
    if (idxGroup < 0 || idxTitle < 0 || idxStudents < 0) {
      setImportError("Header row is required and must include: group_no, title, members.");
      return;
    }
    const invalidGroupRows = [];
    const invalidTitleRows = [];
    const invalidStudentsRows = [];
    const invalidStudentSeparatorSkips = [];
    const duplicateGroupRows = [];
    const seenGroups = new Set();
    const data = rows.slice(1).map((r) => {
      const studentsRaw = idxStudents >= 0 ? r[idxStudents] : "";
      const studentsText = String(studentsRaw || "").trim();
      const groupNo = Number(r[idxGroup] || 0);
      const title = String(r[idxTitle] || "").trim();
      const hasExtraValues = r.slice(idxStudents + 1).some((cell) => String(cell || "").trim() !== "");
      return {
        group_no: groupNo,
        title: title,
        members: studentsText,
        has_extra_values: hasExtraValues,
      };
    }).filter((r, idx) => {
      const rowNo = idx + 2; // include header row
      let isValid = true;
      if (!Number.isFinite(r.group_no) || r.group_no <= 0 || r.group_no > 999) {
        invalidGroupRows.push(rowNo);
        isValid = false;
      }
      if (!r.title) {
        invalidTitleRows.push(rowNo);
        isValid = false;
      }
      if (!r.members) {
        invalidStudentsRows.push(rowNo);
        isValid = false;
      }
      const invalidSeparators = getInvalidStudentSeparators(r.members);
      if (r.members.includes(",") || r.has_extra_values) {
        invalidSeparators.push(",");
      }
      const uniqueInvalidSeparators = [...new Set(invalidSeparators)];
      if (uniqueInvalidSeparators.length > 0) {
        invalidStudentSeparatorSkips.push({
          rowNo,
          groupNo: Number.isFinite(r.group_no) && r.group_no > 0 ? r.group_no : null,
          separators: uniqueInvalidSeparators,
        });
        isValid = false;
      }
      if (isValid && seenGroups.has(r.group_no)) {
        duplicateGroupRows.push(rowNo);
        isValid = false;
      }
      if (isValid && Number.isFinite(r.group_no) && r.group_no > 0) {
        seenGroups.add(r.group_no);
      }
      return isValid;
    });
    if (
      invalidGroupRows.length ||
      invalidTitleRows.length ||
      invalidStudentsRows.length ||
      duplicateGroupRows.length
    ) {
      const parts = [];
      if (invalidGroupRows.length) {
        parts.push(`Invalid group_no at rows: ${invalidGroupRows.slice(0, 6).join(", ")}.`);
      }
      if (invalidTitleRows.length) {
        parts.push(`Missing title at rows: ${invalidTitleRows.slice(0, 6).join(", ")}.`);
      }
      if (invalidStudentsRows.length) {
        parts.push(`Missing members at rows: ${invalidStudentsRows.slice(0, 6).join(", ")}.`);
      }
      if (duplicateGroupRows.length) {
        parts.push(`Duplicate group_no at rows: ${duplicateGroupRows.slice(0, 6).join(", ")}.`);
      }
      setImportError(parts.join(" "));
      return;
    }
    if (!data.length) {
      if (invalidStudentSeparatorSkips.length) {
        const details = invalidStudentSeparatorSkips
          .slice(0, 6)
          .map((item) => {
            const target = item.groupNo ? `group_no ${item.groupNo}` : `row ${item.rowNo}`;
            return `${target} (${buildCsvSeparatorReason(item.separators)})`;
          })
          .join("; ");
        const extraCount = Math.max(0, invalidStudentSeparatorSkips.length - 6);
        const extraText = extraCount > 0 ? ` +${extraCount} more` : "";
        setImportWarning(`• Skipped rows with invalid student separators: ${details}${extraText}.`);
        return;
      }
      setImportError("No valid rows found in CSV.");
      return;
    }
    const existingGroupNos = new Set(
      (projects || [])
        .map((p) => Number(p.group_no))
        .filter((n) => Number.isFinite(n) && n > 0)
    );
    const skippedExisting = data.filter((r) => existingGroupNos.has(r.group_no));
    const toImport = data.filter((r) => !existingGroupNos.has(r.group_no));
    const successMsg = toImport.length > 0
      ? `• Import complete: ${toImport.length} added, ${skippedExisting.length} skipped.`
      : "";

    const warningParts = [];
    if (skippedExisting.length) {
      warningParts.push(`• Skipped existing group_no: ${Array.from(new Set(skippedExisting.map((r) => r.group_no))).join(", ")}.`);
    }
    if (invalidStudentSeparatorSkips.length) {
      const details = invalidStudentSeparatorSkips
        .slice(0, 6)
        .map((item) => {
          const target = item.groupNo ? `group_no ${item.groupNo}` : `row ${item.rowNo}`;
          return `${target} (${buildCsvSeparatorReason(item.separators)})`;
        })
        .join("; ");
      const extraCount = Math.max(0, invalidStudentSeparatorSkips.length - 6);
      const extraText = extraCount > 0 ? ` +${extraCount} more` : "";
      warningParts.push(`• Skipped rows with invalid student separators: ${details}${extraText}.`);
    }
    const localWarning = warningParts.join("\n");
    setImportWarning(localWarning);

    if (!toImport.length) {
      return;
    }

    setIsImporting(true);
    importCancelRef.current = false;
    let res;
    try {
      res = await onImport(toImport, { cancelRef: importCancelRef });
    } finally {
      setIsImporting(false);
    }
    if (res?.cancelled) {
      setImportError("Import stopped. Rows processed before stopping were saved.");
      return;
    }
    if (res?.formError) {
      setImportError(res.formError);
      return;
    }
    if (res?.ok === false) {
      return;
    }
    // Success: show message only after import resolves
    setImportSuccess(successMsg);
    const serverSkipped = Number(res?.skipped || 0);
    if (serverSkipped > 0) {
      const extra = `• Skipped ${serverSkipped} existing groups during import.`;
      setImportWarning(localWarning ? `${localWarning}\n${extra}` : extra);
    }
    if (!skippedExisting.length && !invalidStudentSeparatorSkips.length && serverSkipped === 0) onClose();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    await handleFile(file);
    e.target.value = "";
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm">
      <div className="w-[min(520px,92vw)] max-w-[100vw] max-h-[90vh] rounded-2xl border bg-card shadow-lg flex flex-col gap-3 p-5 relative overflow-hidden">
        <div className="flex items-center gap-2.5 mb-0.5">
          <span className="inline-flex items-center justify-center size-9 rounded-xl bg-muted text-muted-foreground" aria-hidden="true">
            <FileUpIcon />
          </span>
          <div className="text-lg font-bold tracking-tight">Import CSV</div>
        </div>
        <p className="-mt-1 mb-0.5 block text-xs leading-snug text-muted-foreground whitespace-nowrap">
          Groups will be added to{" "}
          <span className="font-bold text-destructive animate-pulse">{periodName || "selected"}</span>{" "}
          period.
        </p>
        <div className="flex flex-col gap-2.5">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <div
            className={cn(
              "rounded-xl border-2 border-dashed border-indigo-200 bg-muted/50 p-5 flex flex-col items-center gap-2 text-center cursor-pointer transition-colors",
              isDragging && "border-indigo-500 bg-indigo-50",
              importError && "border-destructive bg-destructive/5"
            )}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              handleFile(file);
            }}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileRef.current?.click();
              }
            }}
          >
            <div className="text-muted-foreground" aria-hidden="true"><CloudUploadIcon className="size-6" /></div>
            <div className="font-bold text-foreground">Drag & Drop your CSV here</div>
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
              type="button"
            >
              Select CSV File
            </button>
            <div className="text-xs text-muted-foreground">Only .csv files supported</div>
            <div className="text-xs text-muted-foreground/60">Max file size: 2MB</div>
          </div>
          {importError && (
            <div className="rounded-lg border border-destructive/40 border-l-4 border-l-destructive bg-destructive/5 px-3 py-2.5 text-[13px] leading-snug text-destructive flex items-start gap-2" role="alert">
              {importError}
            </div>
          )}
          {importSuccess && !importError && (
            <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2.5 text-[13px] leading-snug text-green-800 whitespace-pre-line" role="status">
              {importSuccess}
            </div>
          )}
          {importWarning && !importError && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] leading-snug text-amber-800 whitespace-pre-line" role="status">
              {importWarning}
            </div>
          )}
          <details className="rounded-lg border border-border bg-card">
            <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-muted-foreground list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
              <span>CSV example</span>
              <ChevronDownIcon className="size-3.5 text-muted-foreground/60 transition-transform [[open]>&]:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-3 pb-3 flex flex-col gap-1.5">
              <div className="font-mono text-xs text-muted-foreground">group_no,title,members</div>
              <div className="font-mono text-xs text-muted-foreground">1,Autonomous Drone Navigation,Ali Yilmaz</div>
              <div className="font-mono text-xs text-muted-foreground">2,Power Quality Monitoring,Elif Kaya; Mert Arslan</div>
              <div className="font-mono text-xs text-muted-foreground">3,Embedded Vision for Robots,Zeynep Acar; Kerem Sahin; Ayse Demir</div>
            </div>
          </details>
          <details className="rounded-lg border border-border bg-card">
            <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-muted-foreground list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden [&::marker]:content-['']">
              <span>Rules</span>
              <ChevronDownIcon className="size-3.5 text-muted-foreground/60 transition-transform [[open]>&]:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-3 pb-3 flex flex-col gap-1.5">
              <ul className="text-xs text-muted-foreground leading-relaxed list-disc pl-4 space-y-0.5">
                <li>Header row is required with exact field names: <code className="rounded bg-muted px-1 text-foreground text-[0.9em]">group_no</code>, <code className="rounded bg-muted px-1 text-foreground text-[0.9em]">title</code>, <code className="rounded bg-muted px-1 text-foreground text-[0.9em]">members</code>.</li>
                <li><code className="rounded bg-muted px-1 text-foreground text-[0.9em]">group_no</code> must be a positive number and unique in the CSV.</li>
                <li><code className="rounded bg-muted px-1 text-foreground text-[0.9em]">title</code> and <code className="rounded bg-muted px-1 text-foreground text-[0.9em]">members</code> cannot be empty.</li>
                <li>One row must represent one group. Separate students with <code className="rounded bg-muted px-1 text-foreground text-[0.9em]">;</code> in <code className="rounded bg-muted px-1 text-foreground text-[0.9em]">members</code>.</li>
                <li>Existing <code className="rounded bg-muted px-1 text-foreground text-[0.9em]">group_no</code> values are skipped during import.</li>
              </ul>
            </div>
          </details>
        </div>
        <div className="flex justify-end gap-2.5 border-t pt-4">
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
            type="button"
            onClick={() => {
              if (isImporting) {
                // Soft-cancel: stops loop between rows.
                // Note: true request abort is not feasible with the current Supabase RPC wrappers.
                importCancelRef.current = true;
              } else {
                onClose();
              }
            }}
          >
            {isImporting ? "Stop" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
