import { describe, vi, expect, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { qaTest } from "@/test/qaTest";

const mockListBackups = vi.fn();
const mockCreateBackup = vi.fn();
const mockDeleteBackup = vi.fn();
const mockGetBackupSignedUrl = vi.fn();
const mockRecordBackupDownload = vi.fn();
const mockGetBackupSchedule = vi.fn();
const mockUpdateBackupSchedule = vi.fn();

vi.mock("@/shared/api", () => ({
  listBackups: (...a) => mockListBackups(...a),
  createBackup: (...a) => mockCreateBackup(...a),
  deleteBackup: (...a) => mockDeleteBackup(...a),
  getBackupSignedUrl: (...a) => mockGetBackupSignedUrl(...a),
  recordBackupDownload: (...a) => mockRecordBackupDownload(...a),
  getBackupSchedule: (...a) => mockGetBackupSchedule(...a),
  updateBackupSchedule: (...a) => mockUpdateBackupSchedule(...a),
}));

vi.mock("@/shared/lib/supabaseClient", () => ({ supabase: {} }));

import { useBackups } from "../useBackups";

const FAKE_BACKUPS = [
  { id: "b1", size_bytes: 1024, storage_path: "org/b1.json" },
  { id: "b2", size_bytes: 512, storage_path: "org/b2.json" },
];

describe("useBackups", () => {
  beforeEach(() => {
    mockListBackups.mockResolvedValue(FAKE_BACKUPS);
    mockCreateBackup.mockResolvedValue(null);
    mockDeleteBackup.mockResolvedValue(null);
    mockGetBackupSchedule.mockResolvedValue({ cron_expr: "0 2 * * *" });
  });

  qaTest("admin.shared.backups.01", async () => {
    const { result } = renderHook(() => useBackups("org-001"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.backups).toHaveLength(2);
    expect(result.current.totalBytes).toBe(1536);
    expect(mockListBackups).toHaveBeenCalledWith("org-001");
  });

  qaTest("admin.shared.backups.02", async () => {
    const { result } = renderHook(() => useBackups("org-001"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockListBackups.mockResolvedValue([...FAKE_BACKUPS, { id: "b3", size_bytes: 256, storage_path: "org/b3.json" }]);
    await act(async () => {
      await result.current.create();
    });

    expect(mockCreateBackup).toHaveBeenCalledWith("org-001");
    expect(result.current.creating).toBe(false);
    expect(result.current.backups).toHaveLength(3);
  });

  qaTest("admin.shared.backups.03", async () => {
    const { result } = renderHook(() => useBackups("org-001"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockListBackups.mockResolvedValue([FAKE_BACKUPS[0]]);
    await act(async () => {
      await result.current.remove("b2");
    });

    expect(mockDeleteBackup).toHaveBeenCalledWith("b2");
    expect(result.current.deletingId).toBeNull();
    expect(result.current.backups).toHaveLength(1);
  });

  qaTest("admin.shared.backups.04", async () => {
    mockCreateBackup.mockRejectedValue(new Error("Disk full"));
    const { result } = renderHook(() => useBackups("org-001"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let caught;
    await act(async () => {
      try { await result.current.create(); } catch (e) { caught = e; }
    });

    expect(caught).toBeDefined();
    expect(caught.message).toBe("Disk full");
    await waitFor(() => expect(result.current.error).toBe("Disk full"));
    expect(result.current.creating).toBe(false);
  });

  qaTest("admin.shared.backups.05", async () => {
    const { result } = renderHook(() => useBackups("org-001"));
    await waitFor(() => expect(result.current.scheduleLoading).toBe(false));
    expect(result.current.schedule).toEqual({ cron_expr: "0 2 * * *" });
    expect(mockGetBackupSchedule).toHaveBeenCalled();
  });
});
