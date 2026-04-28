// src/admin/hooks/useBackups.js
// State hook for the Backups drawer.
// Loads the list on mount + whenever organizationId changes; exposes
// create / delete / download actions that refresh the list.

import { useCallback, useEffect, useState } from "react";
import {
  listBackups,
  createBackup,
  deleteBackup,
  getBackupSignedUrl,
  recordBackupDownload,
  getBackupSchedule,
  updateBackupSchedule,
} from "../../shared/api";

export function useBackups(organizationId) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [updatingSchedule, setUpdatingSchedule] = useState(false);

  const refresh = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError("");
    try {
      const rows = await listBackups(organizationId);
      setBackups(rows);
    } catch (e) {
      setError("Failed to load backups. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    try {
      const data = await getBackupSchedule();
      setSchedule(data);
    } catch (e) {
      console.warn("[backups] Failed to load schedule:", e?.message);
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const create = useCallback(async () => {
    if (!organizationId) return;
    setCreating(true);
    setError("");
    try {
      await createBackup(organizationId);
      await refresh();
    } catch (e) {
      setError("Failed to create backup. Please try again.");
      throw e;
    } finally {
      setCreating(false);
    }
  }, [organizationId, refresh]);

  const remove = useCallback(
    async (backupId) => {
      setDeletingId(backupId);
      setError("");
      try {
        await deleteBackup(backupId);
        await refresh();
      } catch (e) {
        setError("Failed to delete backup. Please try again.");
        throw e;
      } finally {
        setDeletingId(null);
      }
    },
    [refresh],
  );

  const download = useCallback(async (backup) => {
    if (!backup?.storage_path) return;
    const url = await getBackupSignedUrl(backup.storage_path);
    // Fetch as blob so the download attribute works across origins
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const filename = backup.storage_path.split("/").pop() || "backup.json";
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(blobUrl);
    // Fire-and-forget audit
    recordBackupDownload(backup.id).catch((e) =>
      console.warn("[backups] record download failed:", e?.message),
    );
  }, []);

  const saveSchedule = useCallback(async (cronExpr) => {
    setUpdatingSchedule(true);
    try {
      await updateBackupSchedule(cronExpr);
      setSchedule({ cron_expr: cronExpr });
    } catch (e) {
      throw e;
    } finally {
      setUpdatingSchedule(false);
    }
  }, []);

  const totalBytes = backups.reduce((sum, b) => sum + (b.size_bytes || 0), 0);

  return {
    backups,
    loading,
    error,
    creating,
    deletingId,
    totalBytes,
    refresh,
    create,
    remove,
    download,
    schedule,
    scheduleLoading,
    updatingSchedule,
    saveSchedule,
  };
}
