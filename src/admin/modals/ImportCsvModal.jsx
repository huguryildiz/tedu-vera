// src/admin/modals/ImportCsvModal.jsx
// Modal: preview and confirm CSV import of project groups.
//
// Props:
//   open            — boolean
//   onClose         — () => void
//   file            — { name: string, sizeLabel: string } | null
//   rows            — [{ rowNum, groupNo, title, members, status: "ok"|"skip"|"err", statusLabel }]
//   stats           — { valid: number, duplicate: number, error: number, total: number }
//   warningMessage  — { title: string, desc: string } | null
//   onImport        — () => Promise<void>
//   onReplaceFile   — () => void

import { useState } from "react";
import Modal from "@/shared/ui/Modal";

const STATUS_LABELS = { ok: "Valid", skip: "Duplicate", err: "Error" };

export default function ImportCsvModal({
  open, onClose, file, rows = [], stats = {}, warningMessage, onImport, onReplaceFile,
}) {
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  const handleImport = async () => {
    setImporting(true);
    setImportError("");
    try {
      await onImport?.();
      onClose();
    } catch (e) {
      setImportError(e?.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const validCount = stats.valid ?? 0;
  const totalCount = stats.total ?? rows.length;

  return (
    <Modal open={open} onClose={onClose} size="xl">
      <div className="fs-modal-header">
        <div className="fs-modal-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="fs-icon accent">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="fs-title-group">
              <div className="fs-title">Import Project Groups</div>
              <div className="fs-subtitle">Upload a CSV with group numbers, titles and student names.</div>
            </div>
          </div>
          <button className="fs-close" type="button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="fs-modal-body">
        {importError && (
          <div className="fs-alert danger" style={{ marginBottom: 12 }}>
            <div className="fs-alert-body">{importError}</div>
          </div>
        )}

        {/* File info */}
        {file && (
          <div className="fs-upload-file">
            <div className="fs-upload-file-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              </svg>
            </div>
            <div className="fs-upload-file-info">
              <div className="fs-upload-file-name">{file.name}</div>
              <div className="fs-upload-file-meta">
                {file.sizeLabel} · {totalCount} rows detected ·{" "}
                <span
                  style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 500 }}
                  onClick={onReplaceFile}
                >
                  Replace file
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Preview header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)" }}>Preview</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {stats.valid > 0 && <span className="fs-badge green">{stats.valid} valid</span>}
            {stats.duplicate > 0 && <span className="fs-badge amber">{stats.duplicate} duplicate</span>}
            {stats.error > 0 && <span className="fs-badge red">{stats.error} error</span>}
          </div>
        </div>

        {/* Preview table */}
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <table className="fs-preview-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>Row</th>
                <th style={{ width: 50 }}>Group</th>
                <th>Title</th>
                <th>Team Members</th>
                <th style={{ width: 76 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.rowNum} className={row.status === "skip" ? "row-skip" : row.status === "err" ? "row-error" : undefined}>
                  <td style={{ fontFamily: "var(--mono)", color: "var(--text-tertiary)", fontSize: 10 }}>{row.rowNum}</td>
                  <td style={{ fontFamily: "var(--mono)" }}>{row.groupNo ?? "—"}</td>
                  <td>{row.title}</td>
                  <td style={{ color: row.status === "ok" ? "var(--text-secondary)" : undefined }}>{row.members}</td>
                  <td>
                    <span className={`row-status ${row.status}`}>
                      {row.statusLabel ?? STATUS_LABELS[row.status] ?? row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length < totalCount && (
            <div
              style={{
                padding: "6px 10px", background: "var(--surface-1)",
                fontSize: 10, color: "var(--text-tertiary)", borderTop: "1px solid var(--border)",
              }}
            >
              Showing {rows.length} of {totalCount} rows
            </div>
          )}
        </div>

        {warningMessage && (
          <div className="fs-alert warning" style={{ marginTop: 10, marginBottom: 0 }}>
            <div className="fs-alert-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </div>
            <div className="fs-alert-body">
              <div className="fs-alert-title">{warningMessage.title}</div>
              <div className="fs-alert-desc">{warningMessage.desc}</div>
            </div>
          </div>
        )}
      </div>

      <div className="fs-modal-footer">
        <div className="fs-footer-meta">{validCount} of {totalCount} rows ready</div>
        <button className="fs-btn fs-btn-secondary" type="button" onClick={onClose} disabled={importing}>
          Cancel
        </button>
        <button
          type="button"
          className="fs-btn fs-btn-primary"
          onClick={handleImport}
          disabled={importing || validCount === 0}
        >
          {importing ? "Importing…" : `Import ${validCount} Group${validCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </Modal>
  );
}
