// src/admin/settings/ExportBackupPanel.jsx
import {
  ChevronDownIcon,
  CircleXLucideIcon,
  CloudUploadIcon,
  DatabaseBackupIcon,
  DownloadIcon,
  FileDownIcon,
  FileUpIcon,
  TriangleAlertIcon,
  UploadIcon,
  InfoIcon,
} from "../../shared/Icons";
import AlertCard from "../../shared/AlertCard";

const SAMPLE_DB_BACKUP_JSON = `{
  "schema_version": 1,
  "periods": [{ "...": "..." }],
  "jurors": [{ "...": "..." }],
  "projects": [{ "...": "..." }],
  "scores": [{ "...": "..." }],
  "juror_semester_auth": [{ "...": "..." }]
}`;

export default function ExportBackupPanel({
  isMobile,
  openPanels,
  dbBackupMode,
  dbBackupLoading,
  dbBackupConfirmText,
  dbBackupError,
  dbImportData,
  dbImportFileName,
  dbImportFileSize,
  dbImportDragging,
  dbImportSuccess,
  dbImportWarning,
  importFileRef,
  onToggleExport,
  onToggleDbBackup,
  onExportScores,
  onExportJurors,
  onExportProjects,
  onDbExportStart,
  onDbImportStart,
  onDbImportFileSelect,
  onSetDbImportDragging,
  onDbImportFile,
  onSetDbBackupError,
  onSetDbBackupConfirmText,
  onCancelBackupDialog,
  onDbExportConfirm,
  onDbImportConfirm,
  isDemoMode = false,
}) {
  return (
    <>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <button
          type="button"
          className="flex items-center gap-3 p-4 w-full"
          onClick={onToggleExport}
          aria-expanded={openPanels.export}
        >
          <div className="text-base font-semibold flex items-center gap-2">
            <span className="size-5 text-muted-foreground" aria-hidden="true"><FileDownIcon /></span>
            <span className="section-label">Export Tools</span>
          </div>
          <ChevronDownIcon className={`ml-auto size-4 text-muted-foreground transition-transform duration-200${openPanels.export ? " rotate-180" : ""}`} />
        </button>

        {(!isMobile || openPanels.export) && (
          <div className="px-4 pb-4">
            <div className="text-sm text-muted-foreground mb-3">Download Excel exports for scores, jurors, and groups.</div>
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50" type="button" onClick={onExportScores}>
                <DownloadIcon /> Scores
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50" type="button" onClick={onExportJurors}>
                <DownloadIcon /> Jurors
              </button>
              <button className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50" type="button" onClick={onExportProjects}>
                <DownloadIcon /> Groups
              </button>
            </div>
          </div>
        )}
      </div>

      {!isDemoMode && (
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <button
          type="button"
          className="flex items-center gap-3 p-4 w-full"
          onClick={onToggleDbBackup}
          aria-expanded={openPanels.dbbackup}
        >
          <div className="text-base font-semibold flex items-center gap-2">
            <span className="size-5 text-muted-foreground" aria-hidden="true"><DatabaseBackupIcon /></span>
            <span className="section-label">Database Backup</span>
          </div>
          <ChevronDownIcon className={`ml-auto size-4 text-muted-foreground transition-transform duration-200${openPanels.dbbackup ? " rotate-180" : ""}`} />
        </button>

        {(!isMobile || openPanels.dbbackup) && (
          <div className="px-4 pb-4">
            <div className="text-sm text-muted-foreground mb-3">
              Export or restore the database for this tenant.
            </div>
            <input
              ref={importFileRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={onDbImportFileSelect}
            />

            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                type="button"
                onClick={onDbExportStart}
                disabled={dbBackupLoading}
              >
                <DownloadIcon /> Export JSON
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                type="button"
                onClick={onDbImportStart}
                disabled={dbBackupLoading}
              >
                <UploadIcon /> Import / Restore
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {!isDemoMode && dbBackupMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
          <div className="mx-4 w-full max-w-lg rounded-lg border bg-card p-6 shadow-lg">
            {dbBackupMode === "export" ? (
              <div className="flex items-center gap-3 border-b pb-4">
                <span className="text-muted-foreground" aria-hidden="true">
                  <FileDownIcon />
                </span>
                <h3 className="text-base font-semibold">Export Database Backup</h3>
              </div>
            ) : (
              <div className="flex items-center gap-3 border-b pb-4">
                <span className="text-muted-foreground" aria-hidden="true">
                  <FileUpIcon />
                </span>
                <h3 className="text-base font-semibold">Import / Restore Database</h3>
              </div>
            )}
            <div className="mt-4 space-y-4">
              <AlertCard variant="info">
                {dbBackupMode === "export"
                  ? "Export a full backup of periods, jurors, groups, and scores."
                  : "Upload a backup JSON exported from this portal to restore all data."}
              </AlertCard>
              {dbBackupMode === "import" && (
                <div className="flex flex-col gap-1.5">
                  <div
                    className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer${dbImportDragging ? " border-primary bg-primary/5" : " border-muted-foreground/25 hover:border-muted-foreground/50"}`}
                    onDragEnter={(e) => { e.preventDefault(); onSetDbImportDragging(true); }}
                    onDragOver={(e) => { e.preventDefault(); onSetDbImportDragging(true); }}
                    onDragLeave={(e) => { e.preventDefault(); onSetDbImportDragging(false); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      onSetDbImportDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      onDbImportFile(file);
                    }}
                    onClick={() => {
                      if (dbBackupLoading) return;
                      importFileRef.current?.click();
                    }}
                    role="button"
                    tabIndex={0}
                    aria-disabled={dbBackupLoading}
                    onKeyDown={(e) => {
                      if (dbBackupLoading) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        importFileRef.current?.click();
                      }
                    }}
                  >
                    <div className="mx-auto size-10 text-muted-foreground/50" aria-hidden="true"><CloudUploadIcon /></div>
                    <div className="mt-2 font-medium">Drag &amp; Drop your JSON here</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Only `.json` files exported from this portal.
                    </div>
                    <button className="inline-flex items-center justify-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium transition-colors hover:bg-primary/90 mt-3" type="button" tabIndex={-1}>
                      Select Backup File
                    </button>
                    <div className="mt-1 text-xs text-muted-foreground">Max file size: 10 MB</div>
                  </div>
                  {dbImportFileName && (
                    <div className="text-xs text-muted-foreground" style={{ marginTop: "0.5rem" }}>
                      Selected: {dbImportFileName} ({Math.ceil(dbImportFileSize / 1024)} KB)
                    </div>
                  )}
                  {dbBackupMode === "import" && dbBackupError && (
                    <AlertCard variant="error" style={{ marginTop: "0.5rem" }}>
                      {dbBackupError}
                    </AlertCard>
                  )}
                  {dbBackupMode === "import" && dbImportSuccess && !dbBackupError && (
                    <AlertCard variant="success" style={{ marginTop: "0.5rem" }}>
                      {dbImportSuccess}
                    </AlertCard>
                  )}
                  {dbBackupMode === "import" && dbImportWarning && !dbBackupError && (
                    <AlertCard variant="warning" style={{ marginTop: "0.5rem" }}>
                      {dbImportWarning}
                    </AlertCard>
                  )}
                </div>
              )}
              {dbBackupMode === "import" && (
                <>
                  <details className="rounded-lg border">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                      <span>JSON example</span>
                      <ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 [[open]>&]:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="px-4 pb-3">
                      <pre className="rounded bg-muted px-2 py-1 font-mono text-xs" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{SAMPLE_DB_BACKUP_JSON}</pre>
                    </div>
                  </details>
                  <details className="rounded-lg border">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
                      <span>Rules</span>
                      <ChevronDownIcon className="size-4 text-muted-foreground transition-transform duration-200 [[open]>&]:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="px-4 pb-3">
                      <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                        <li>Only .json files exported from this portal are supported.</li>
                        <li>Backup contains periods, jurors, groups, scores, and assignments.</li>
                        <li>Maximum file size: 10 MB.</li>
                        <li>This operation overwrites existing data.</li>
                        <li>Type RESTORE to confirm import.</li>
                      </ul>
                    </div>
                  </details>
                </>
              )}
              {dbBackupMode === "import" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Type RESTORE to confirm</label>
                  <input
                    type="text"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={dbBackupConfirmText}
                    onChange={(e) => { onSetDbBackupConfirmText(e.target.value.toUpperCase()); onSetDbBackupError(""); }}
                    disabled={dbBackupLoading}
                    autoComplete="off"
                  />
                </div>
              )}
              {dbBackupMode !== "import" && dbBackupError && (
                <AlertCard variant="error">
                  {dbBackupError}
                </AlertCard>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
                type="button"
                disabled={dbBackupLoading}
                onClick={onCancelBackupDialog}
              >
                Cancel
              </button>
              <button
                className={`inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 ${dbBackupMode === "import" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
                type="button"
                disabled={
                  dbBackupLoading
                  || (dbBackupMode === "import" && (!dbImportData || dbBackupConfirmText.trim() !== "RESTORE"))
                }
                onClick={dbBackupMode === "export" ? onDbExportConfirm : onDbImportConfirm}
              >
                {dbBackupLoading
                  ? (dbBackupMode === "export" ? "Exporting…" : "Restoring…")
                  : (dbBackupMode === "export" ? "Download Backup" : "Restore Database")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
