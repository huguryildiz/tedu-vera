// src/admin/pages/ExportPage.jsx
// Standalone page for data export and database backup/restore.
// Export handlers and DB backup state machine extracted from SettingsPage.

import { useCallback, useRef, useState } from "react";
import { useToast } from "../../components/toast/useToast";
import { useAuth } from "../../shared/auth";
import {
  listPeriods,
  listJurorsSummary,
  getScores,
  getProjectSummary,
  fullExport,
} from "../../shared/api";
import { exportXLSX, buildExportFilename } from "../xlsx/exportXLSX";
import ExportBackupPanel from "../settings/ExportBackupPanel";
import PageShell from "./PageShell";

const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
const MIN_BACKUP_DELAY = 1200;

export default function ExportPage({ organizationId, isDemoMode = false }) {
  const { activeOrganization } = useAuth();
  const tenantCode = activeOrganization?.code || "";
  const _toast = useToast();
  const setMessage = (msg) => { if (msg) _toast.success(msg); };

  const [dbBackupMode, setDbBackupMode] = useState(null);
  const [dbImportData, setDbImportData] = useState(null);
  const [dbImportFileName, setDbImportFileName] = useState("");
  const [dbImportFileSize, setDbImportFileSize] = useState(0);
  const [dbImportDragging, setDbImportDragging] = useState(false);
  const [dbBackupConfirmText, setDbBackupConfirmText] = useState("");
  const [dbBackupLoading, setDbBackupLoading] = useState(false);
  const [dbBackupError, setDbBackupError] = useState("");
  const [dbImportSuccess, setDbImportSuccess] = useState("");
  const [dbImportWarning, setDbImportWarning] = useState("");
  const importFileRef = useRef(null);

  // ── Export helpers ───────────────────────────────────────
  const sortSemesters = (sems) =>
    [...sems].sort((a, b) => {
      const aTs = a?.poster_date ? Date.parse(a.poster_date) : 0;
      const bTs = b?.poster_date ? Date.parse(b.poster_date) : 0;
      return bTs - aTs;
    });

  const handleExportProjects = useCallback(async () => {
    if (!organizationId) return;
    const sems = (await listPeriods(organizationId)) || [];
    if (!sems.length) return;
    const orderedSemesters = sortSemesters(sems);
    const projectsBySemester = await Promise.all(
      orderedSemesters.map(async (sem) => {
        const { adminListProjects } = await import("../../shared/api");
        return {
          periodName: sem?.period_name || "",
          rows: await adminListProjects(sem.id),
        };
      }),
    );
    const XLSX = await import("xlsx-js-style");
    const headers = ["Period", "Group No", "Title", "Team Members"];
    const data = projectsBySemester.flatMap(({ periodName, rows }) =>
      (rows || []).map((p) => [
        periodName,
        p?.group_no ?? "",
        p?.title ?? "",
        p?.members || "",
      ]),
    );
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws["!cols"] = [18, 8, 36, 42].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Groups");
    XLSX.writeFile(wb, buildExportFilename("groups", "all-periods", "xlsx", tenantCode));
  }, [organizationId, tenantCode]);

  const handleExportJurors = useCallback(async () => {
    if (!organizationId) return;
    const sems = (await listPeriods(organizationId)) || [];
    if (!sems.length) return;
    const orderedSemesters = sortSemesters(sems);
    const jurorsBySemester = await Promise.all(
      orderedSemesters.map(async (sem) => ({
        periodName: sem?.period_name || "",
        rows: await listJurorsSummary(sem.id),
      })),
    );
    const isAssignedJuror = (j) => {
      if (j?.isAssigned === true) return true;
      if (j?.is_assigned === true) return true;
      if (typeof j?.isAssigned === "string")
        return ["true", "t", "1"].includes(j.isAssigned.toLowerCase());
      if (typeof j?.is_assigned === "string")
        return ["true", "t", "1"].includes(j.is_assigned.toLowerCase());
      return false;
    };
    const XLSX = await import("xlsx-js-style");
    const headers = ["Period", "Juror Name", "Institution / Department"];
    const data = jurorsBySemester.flatMap(({ periodName, rows }) => {
      const hasAssignedFlag = (rows || []).some(
        (j) =>
          (j?.isAssigned !== undefined && j?.isAssigned !== null) ||
          (j?.is_assigned !== undefined && j?.is_assigned !== null),
      );
      const exportRows = hasAssignedFlag
        ? (rows || []).filter(isAssignedJuror)
        : rows || [];
      return exportRows.map((j) => [
        periodName,
        j?.juryName || j?.juror_name || j?.jurorName || "",
        j?.affiliation || j?.affiliation || j?.affiliation || "",
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws["!cols"] = [18, 28, 32].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jurors");
    XLSX.writeFile(wb, buildExportFilename("jurors", "all-periods", "xlsx", tenantCode));
  }, [organizationId, tenantCode]);

  const handleExportScores = useCallback(async () => {
    if (!organizationId) return;
    const sems = (await listPeriods(organizationId)) || [];
    if (!sems.length) return;
    const orderedSemesters = sortSemesters(sems);
    const results = await Promise.all(
      orderedSemesters.map(async (sem) => {
        const [rows, summary] = await Promise.all([
          getScores(sem.id),
          getProjectSummary(sem.id).catch(() => []),
        ]);
        const summaryMap = new Map((summary || []).map((p) => [p.id, p]));
        const mappedRows = (rows || []).map((r) => ({
          ...r,
          period: sem?.period_name || "",
          students: summaryMap.get(r.projectId)?.students ?? "",
        }));
        return { rows: mappedRows, summary: summary || [] };
      }),
    );
    await exportXLSX(results.flatMap((x) => x.rows), {
      periodName: "all-periods",
      summaryData: results.flatMap((x) => x.summary),
      tenantCode,
    });
  }, [organizationId, tenantCode]);

  // ── DB backup helpers ────────────────────────────────────
  const handleDbExportStart = () => {
    if (dbBackupLoading) return;
    setDbBackupMode("export");
    setDbBackupConfirmText("");
    setDbBackupError("");
    setDbImportSuccess("");
    setDbImportWarning("");
    setDbImportData(null);
    setDbImportFileName("");
    setDbImportFileSize(0);
    setDbImportDragging(false);
  };

  const handleDbImportStart = () => {
    if (dbBackupLoading) return;
    setDbBackupMode("import");
    setDbBackupConfirmText("");
    setDbBackupError("");
    setDbImportSuccess("");
    setDbImportWarning("");
    setDbImportData(null);
    setDbImportFileName("");
    setDbImportFileSize(0);
    setDbImportDragging(false);
  };

  const validateBackupPayload = (payload) => {
    if (!payload || typeof payload !== "object") return "Invalid backup file format.";
    if (!Number.isFinite(Number(payload.schema_version)))
      return "Missing schema_version in backup file.";
    const required = ["periods", "jurors", "projects", "scores", "juror_semester_auth"];
    for (const key of required) {
      if (!Array.isArray(payload[key])) return `Backup file is missing '${key}' data.`;
    }
    return "";
  };

  const buildBackupLoadFeedback = (payload) => {
    const periods = Array.isArray(payload?.periods) ? payload.periods.length : 0;
    const jurors = Array.isArray(payload?.jurors) ? payload.jurors.length : 0;
    const projects = Array.isArray(payload?.projects) ? payload.projects.length : 0;
    const scores = Array.isArray(payload?.scores) ? payload.scores.length : 0;
    const assignments = Array.isArray(payload?.juror_semester_auth)
      ? payload.juror_semester_auth.length
      : 0;
    const schemaVersion = Number(payload?.schema_version);
    const success = [
      "\u2022 Backup file loaded successfully.",
      `\u2022 Found: ${periods} periods, ${jurors} jurors, ${projects} groups, ${scores} scores, ${assignments} assignments (schema v${Number.isFinite(schemaVersion) ? schemaVersion : "?"}).`,
    ].join("\n");
    const emptySections = [];
    if (periods === 0) emptySections.push("periods");
    if (jurors === 0) emptySections.push("jurors");
    if (projects === 0) emptySections.push("groups");
    if (scores === 0) emptySections.push("scores");
    if (assignments === 0) emptySections.push("assignments");
    const warning = emptySections.length
      ? `\u2022 Empty sections in this backup: ${emptySections.join(", ")}.`
      : "";
    return { success, warning };
  };

  const handleDbImportFile = (file) => {
    if (!file) return;
    setDbBackupError("");
    setDbImportSuccess("");
    setDbImportWarning("");
    setDbImportData(null);
    if (!file.name.toLowerCase().endsWith(".json")) {
      setDbImportFileName("");
      setDbImportFileSize(0);
      setDbBackupError("Only .json backup files are supported.");
      return;
    }
    if (file.size > MAX_BACKUP_BYTES) {
      setDbImportFileName("");
      setDbImportFileSize(0);
      setDbBackupError("Backup file is too large (max 10 MB).");
      return;
    }
    setDbImportFileName(file.name);
    setDbImportFileSize(file.size);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const schemaError = validateBackupPayload(parsed);
        if (schemaError) {
          setDbBackupError(schemaError);
          setDbImportSuccess("");
          setDbImportWarning("");
          setDbImportData(null);
          return;
        }
        setDbImportData(parsed);
        setDbBackupError("");
        const feedback = buildBackupLoadFeedback(parsed);
        setDbImportSuccess(feedback.success);
        setDbImportWarning(feedback.warning);
      } catch {
        setDbBackupError("Invalid backup file. Could not parse JSON.");
        setDbImportSuccess("");
        setDbImportWarning("");
      }
    };
    reader.readAsText(file);
  };

  const handleDbImportFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleDbImportFile(file);
    e.target.value = "";
  };

  const mapDbBackupError = (e) => {
    const msg = String(e?.message || "");
    if (msg.includes("unauthorized")) return "Unauthorized. Please re-login.";
    return null;
  };

  const handleDbExportConfirm = async () => {
    if (!organizationId) return;
    const start = Date.now();
    setDbBackupLoading(true);
    setDbBackupError("");
    try {
      const data = await fullExport(organizationId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildExportFilename("backup", "full", "json", tenantCode);
      a.click();
      URL.revokeObjectURL(url);
      setDbBackupMode(null);
      setDbBackupConfirmText("");
      setDbImportDragging(false);
      setMessage("Database backup downloaded");
    } catch (e) {
      setDbBackupError(mapDbBackupError(e) || "Export failed. Please try again.");
    } finally {
      const remaining = Math.max(0, MIN_BACKUP_DELAY - (Date.now() - start));
      if (remaining) await new Promise((r) => setTimeout(r, remaining));
      setDbBackupLoading(false);
    }
  };

  const handleDbImportConfirm = async () => {
    if (!dbImportData || !organizationId) return;
    if (dbBackupConfirmText.trim() !== "RESTORE") {
      setDbBackupError("Type RESTORE to confirm.");
      return;
    }
    const start = Date.now();
    setDbBackupLoading(true);
    setDbBackupError("");
    try {
      throw new Error("Full import is not supported in this version.");
      setDbBackupMode(null);
      setDbBackupConfirmText("");
      setDbImportDragging(false);
      setDbImportData(null);
      setDbImportFileName("");
      setDbImportFileSize(0);
      setDbImportSuccess("");
      setDbImportWarning("");
      setMessage("Database restored from backup");
    } catch (e) {
      setDbBackupError(
        mapDbBackupError(e) || "Import failed. Check the backup file and try again.",
      );
    } finally {
      const remaining = Math.max(0, MIN_BACKUP_DELAY - (Date.now() - start));
      if (remaining) await new Promise((r) => setTimeout(r, remaining));
      setDbBackupLoading(false);
    }
  };

  return (
    <PageShell
      title="Export & Backup"
      description="Download data and manage database backups"
    >
      <ExportBackupPanel
        isDemoMode={isDemoMode}
        isMobile={false}
        openPanels={{ export: true, dbbackup: true }}
        dbBackupMode={dbBackupMode}
        dbBackupLoading={dbBackupLoading}
        dbBackupConfirmText={dbBackupConfirmText}
        dbBackupError={dbBackupError}
        dbImportData={dbImportData}
        dbImportFileName={dbImportFileName}
        dbImportFileSize={dbImportFileSize}
        dbImportDragging={dbImportDragging}
        dbImportSuccess={dbImportSuccess}
        dbImportWarning={dbImportWarning}
        importFileRef={importFileRef}
        onToggleExport={() => {}}
        onToggleDbBackup={() => {}}
        onExportScores={handleExportScores}
        onExportJurors={handleExportJurors}
        onExportProjects={handleExportProjects}
        onDbExportStart={handleDbExportStart}
        onDbImportStart={handleDbImportStart}
        onDbImportFileSelect={handleDbImportFileSelect}
        onSetDbImportDragging={setDbImportDragging}
        onDbImportFile={handleDbImportFile}
        onSetDbBackupError={setDbBackupError}
        onSetDbBackupConfirmText={setDbBackupConfirmText}
        onCancelBackupDialog={() => {
          setDbBackupMode(null);
          setDbBackupConfirmText("");
          setDbImportData(null);
          setDbImportFileName("");
          setDbImportFileSize(0);
          setDbImportDragging(false);
          setDbBackupError("");
          setDbImportSuccess("");
          setDbImportWarning("");
        }}
        onDbExportConfirm={handleDbExportConfirm}
        onDbImportConfirm={handleDbImportConfirm}
      />
    </PageShell>
  );
}
