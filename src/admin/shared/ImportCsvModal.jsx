// src/admin/modals/ImportCsvModal.jsx
// Unified import modal: drag-and-drop file selection + CSV preview + confirm.
//
// Props:
//   open       — boolean
//   onClose    — () => void
//   parseFile  — async (file: File) => { file, rows, stats, warningMessage }
//   onImport   — async (rows) => void   (receives valid rows)

import { useCallback, useRef, useState } from "react";
import { CheckCircle, FileText, Upload, X } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";
import Modal from "@/shared/ui/Modal";
import AsyncButtonContent from "@/shared/ui/AsyncButtonContent";

const STATUS_LABELS = { ok: "Valid", skip: "Duplicate", err: "Error" };

function hasAdvisor(rows) {
  return rows.some((r) => r.advisor);
}

export default function ImportCsvModal({ open, onClose, parseFile, onImport }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);

  const [file, setFile]               = useState(null);
  const [rows, setRows]               = useState([]);
  const [stats, setStats]             = useState({ valid: 0, duplicate: 0, error: 0, total: 0 });
  const [detectedColumns, setDetected] = useState([]);
  const [warningMessage, setWarning]  = useState(null);

  const [importing, setImporting]     = useState(false);
  const [importError, setImportError] = useState("");
  const [phase, setPhase]             = useState("preview"); // "preview" | "result"
  const [resultData, setResult]       = useState(null);      // { imported, skipped, failed }

  const handleClose = () => {
    setFile(null); setRows([]); setStats({ valid: 0, duplicate: 0, error: 0, total: 0 });
    setDetected([]); setWarning(null); setImportError(""); setParsing(false); setImporting(false);
    setPhase("preview"); setResult(null);
    onClose();
  };

  const handleFile = useCallback(async (f) => {
    if (!f || parsing) return;
    if (!f.name.toLowerCase().endsWith(".csv")) {
      setImportError(`"${f.name}" is not a CSV file. Please upload a .csv file.`);
      return;
    }
    setParsing(true);
    setImportError("");
    try {
      const parsed = await parseFile(f);
      setFile(parsed.file);
      setRows(parsed.rows);
      setStats(parsed.stats);
      setDetected(parsed.detectedColumns ?? []);
      setWarning(parsed.warningMessage);
    } catch {
      setImportError("Failed to parse file. Make sure it is a valid CSV.");
    } finally {
      setParsing(false);
    }
  }, [parseFile, parsing]);

  function onInputChange(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    handleFile(f);
  }

  function onDragOver(e)  { e.preventDefault(); setDragging(true); }
  function onDragLeave(e) { e.preventDefault(); setDragging(false); }
  function onDrop(e)      { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }

  const handleImport = async () => {
    setImporting(true);
    setImportError("");
    try {
      const result = await onImport?.(rows.filter((r) => r.status === "ok"));
      setResult({
        imported: result?.imported ?? validCount,
        skipped:  (result?.skipped ?? 0) + (stats.duplicate ?? 0),
        failed:   result?.failed ?? 0,
      });
      setPhase("result");
    } catch (e) {
      setImportError("Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const validCount = stats.valid ?? 0;
  const totalCount = stats.total ?? rows.length;

  return (
    <Modal open={open} onClose={handleClose} size="xl">
      {/* Header */}
      <div className="fs-modal-header">
        <div className="fs-modal-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="fs-icon accent">
              <Upload size={20} strokeWidth={2} />
            </div>
            <div className="fs-title-group">
              <div className="fs-title">Import Project Groups</div>
              <div className="fs-subtitle">Upload a CSV with group numbers, titles and team members.</div>
            </div>
          </div>
          <button className="fs-close" type="button" onClick={handleClose} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
      {phase === "preview" ? (
        <>
          <div className="fs-modal-body">
            {importError && (
              <FbAlert variant="danger" style={{ marginBottom: 12 }}>{importError}</FbAlert>
            )}

            {/* Drop zone — shown when no file selected */}
            {!file && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => !parsing && inputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                style={{
                  border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: "var(--radius)",
                  padding: "36px 20px",
                  textAlign: "center",
                  cursor: parsing ? "default" : "pointer",
                  background: dragging ? "rgba(59,130,246,0.05)" : "var(--surface-1)",
                  transition: "border-color .15s, background .15s",
                  userSelect: "none",
                  marginBottom: 0,
                }}
              >
                <div style={{
                  width: 46, height: 46, borderRadius: "50%",
                  background: dragging ? "rgba(59,130,246,0.12)" : "var(--bg-card)",
                  border: "1px solid var(--border)",
                  display: "grid", placeItems: "center",
                  margin: "0 auto 12px",
                  transition: "background .15s",
                }}>
                  <Upload
                    size={20}
                    strokeWidth={1.8}
                    color={dragging ? "var(--accent)" : "var(--text-tertiary)"}
                    style={{ transition: "color .15s" }}
                  />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  {parsing ? "Parsing…" : dragging ? "Release to upload" : "Drop CSV file here"}
                </div>
                {!parsing && (
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    or{" "}
                    <span style={{ color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}
                      onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}>
                      browse files
                    </span>
                  </div>
                )}
                <div style={{
                  marginTop: 16,
                  background: "var(--surface-2, var(--bg-card))",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm, 6px)",
                  padding: "10px 14px",
                  display: "inline-block",
                  fontSize: 11,
                  lineHeight: 1.7,
                  textAlign: "left",
                  width: "100%",
                  boxSizing: "border-box",
                }}>
                  <div style={{ color: "var(--text-tertiary)", marginBottom: 6, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 10 }}>Format</div>
                  <div style={{ color: "var(--text-primary)", marginBottom: 8 }}>
                    <span className="mono" style={{ fontSize: 11 }}>Project Title, Team Members, Advisor (optional)</span>
                    <span style={{ color: "var(--text-tertiary)", marginLeft: 6, fontSize: 10 }}>Use <span className="mono" style={{ color: "var(--danger)" }}>;</span> to separate multiple values</span>
                  </div>
                  <div style={{ color: "var(--text-tertiary)", marginBottom: 4, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 10 }}>Examples</div>
                  <div className="mono" style={{ color: "var(--text-secondary)", fontSize: 10.5, marginBottom: 2 }}>Smart Grid Monitor, Ali Yıldız; Zeynep Kaya, Prof. Dr. Hasan Göktaş</div>
                  <div className="mono" style={{ color: "var(--text-secondary)", fontSize: 10.5 }}>Drone Navigation System, Burak Şahin; Mert Can; Selin Arslan, Prof. Dr. Hasan Göktaş; Dr. Ayşe Kara</div>
                </div>
              </div>
            )}

            {/* File info row — shown after file selected */}
            {file && (
              <div className="fs-upload-file" style={{ marginBottom: 14 }}>
                <div className="fs-upload-file-icon">
                  <FileText size={20} strokeWidth={2} />
                </div>
                <div className="fs-upload-file-info">
                  <div className="fs-upload-file-name">{file.name}</div>
                  <div className="fs-upload-file-meta">
                    {file.sizeLabel} · {totalCount} rows detected ·{" "}
                    <span
                      style={{ color: "var(--accent)", cursor: "pointer", fontWeight: 500 }}
                      onClick={() => inputRef.current?.click()}
                    >
                      Replace file
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Preview — shown after file selected */}
            {file && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-secondary)" }}>Preview</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {stats.valid > 0    && <span className="fs-badge green">{stats.valid} valid</span>}
                    {stats.duplicate > 0 && <span className="fs-badge amber">{stats.duplicate} duplicate</span>}
                    {stats.error > 0    && <span className="fs-badge red">{stats.error} error</span>}
                  </div>
                </div>

                <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                  <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <table className="fs-preview-table table-dense table-pill-balance">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>Row</th>
                          <th>Title</th>
                          <th>Team Members</th>
                          {hasAdvisor(rows) && <th>Advisor</th>}
                          <th style={{ width: 76 }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.rowNum} className={row.status === "skip" ? "row-skip" : row.status === "err" ? "row-error" : undefined}>
                            <td className="mono table-secondary">{row.rowNum}</td>
                            <td>{row.title}</td>
                            <td style={{ color: row.status === "ok" ? "var(--text-secondary)" : undefined }}>{row.members}</td>
                            {hasAdvisor(rows) && <td style={{ color: "var(--text-secondary)" }}>{row.advisor || "—"}</td>}
                            <td>
                              <span className={`row-status ${row.status}`}>
                                {row.statusLabel || STATUS_LABELS[row.status] || row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length < totalCount && (
                    <div className="table-secondary" style={{
                      padding: "6px 10px", background: "var(--surface-1)",
                      color: "var(--text-tertiary)", borderTop: "1px solid var(--border)",
                    }}>
                      Showing {rows.length} of {totalCount} rows
                    </div>
                  )}
                </div>

                {warningMessage && (
                  <FbAlert variant="warning" style={{ marginTop: 10 }}>
                    {warningMessage.title && <strong>{warningMessage.title}: </strong>}
                    {warningMessage.desc ?? warningMessage}
                  </FbAlert>
                )}
              </>
            )}
          </div>

          <input ref={inputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={onInputChange} data-testid="projects-import-file" />

          <div className="fs-modal-footer">
            {file
              ? <div className="fs-footer-meta">{validCount} of {totalCount} groups ready</div>
              : <div className="fs-footer-meta" />
            }
            <button className="fs-btn fs-btn-secondary" type="button" onClick={handleClose} disabled={importing}>
              Cancel
            </button>
            <button
              type="button"
              className="fs-btn fs-btn-primary"
              onClick={handleImport}
              disabled={importing || !file || validCount === 0}
              data-testid="projects-import-submit"
            >
              <span className="btn-loading-content">
                <AsyncButtonContent loading={importing} loadingText="Importing…">
                  {file ? `Import ${validCount} Group${validCount !== 1 ? "s" : ""}` : "Import Groups"}
                </AsyncButtonContent>
              </span>
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="fs-modal-body" style={{ textAlign: "center", paddingTop: 8 }} data-testid="projects-import-success">
            <div className="fs-modal-icon success" style={{ margin: "0 auto 10px" }}>
              <CheckCircle size={20} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
              Import Complete
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>
              {resultData.imported} group{resultData.imported !== 1 ? "s" : ""} added.
            </div>
            <div className="fs-impact">
              <div className="fs-impact-item">
                <div className="fs-impact-value" style={{ color: "var(--success)" }}>{resultData.imported}</div>
                <div className="fs-impact-label">Imported</div>
              </div>
              <div className="fs-impact-item">
                <div className="fs-impact-value" style={{ color: "var(--warning)" }}>{resultData.skipped}</div>
                <div className="fs-impact-label">Skipped</div>
              </div>
              <div className="fs-impact-item">
                <div className="fs-impact-value" style={{ color: "var(--danger)" }}>{resultData.failed}</div>
                <div className="fs-impact-label">Failed</div>
              </div>
            </div>
            {(resultData.skipped > 0 || resultData.failed > 0) && (
              <FbAlert variant="info" title="What to do next" style={{ marginTop: 12 }}>
                Skipped rows have duplicate group numbers. Fix any failed rows manually or re-import a corrected CSV.
              </FbAlert>
            )}
          </div>
          <div className="fs-modal-footer" style={{ justifyContent: "center", borderTop: "none", background: "transparent", paddingTop: 0 }}>
            <button className="fs-btn fs-btn-primary" style={{ minWidth: 140 }} onClick={handleClose} data-testid="projects-import-done">
              Done
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
