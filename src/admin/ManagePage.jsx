// src/admin/ManagePage.jsx
// ============================================================
// Admin Manage page: semesters, projects, jurors, permissions.
// ============================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  listSemesters,
  adminListJurors,
  adminGetScores,
  adminSetActiveSemester,
  adminCreateSemester,
  adminUpdateSemester,
  adminListProjects,
  adminUpsertProject,
  adminCreateJuror,
  adminUpdateJuror,
  adminResetJurorPin,
  adminSetJurorEditMode,
  adminDeleteEntity,
  adminGetSettings,
  adminListAuditLogs,
  adminSetSetting,
} from "../shared/api";
import { supabase } from "../lib/supabaseClient";
import { ChevronDownIcon, DownloadIcon, HistoryIcon } from "../shared/Icons";
import { exportXLSX, buildExportFilename } from "./utils";
import ManageSemesterPanel from "./ManageSemesterPanel";
import ManageProjectsPanel from "./ManageProjectsPanel";
import ManageJurorsPanel from "./ManageJurorsPanel";
import ManagePermissionsPanel from "./ManagePermissionsPanel";
import AdminSecurityPanel from "../components/admin/AdminSecurityPanel";
import DeleteConfirmDialog from "../components/admin/DeleteConfirmDialog";

const SETTINGS_KEYS = {
  evalLock: "eval_lock_active_semester",
};

const AUDIT_ACTOR_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "juror", label: "Juror" },
];

const AUDIT_ACTION_OPTIONS = [
  { value: "admin_password_change", label: "Admin password change" },
  { value: "delete_password_change", label: "Delete password change" },
  { value: "eval_lock_toggle", label: "Eval lock toggled" },
  { value: "semester_create", label: "Semester created" },
  { value: "semester_update", label: "Semester updated" },
  { value: "semester_delete", label: "Semester deleted" },
  { value: "set_active_semester", label: "Set active semester" },
  { value: "juror_create", label: "Juror created" },
  { value: "juror_update", label: "Juror updated" },
  { value: "juror_delete", label: "Juror deleted" },
  { value: "juror_pin_reset", label: "Juror PIN reset" },
  { value: "juror_pin_locked", label: "Juror PIN locked" },
  { value: "project_create", label: "Project created" },
  { value: "project_update", label: "Project updated" },
  { value: "project_delete", label: "Project deleted" },
  { value: "juror_group_started", label: "Juror group started" },
  { value: "juror_group_completed", label: "Juror group completed" },
  { value: "juror_all_completed", label: "Juror all completed" },
  { value: "juror_finalize_submission", label: "Juror finalized submission" },
  { value: "admin_juror_edit_toggle", label: "Admin juror edit toggle" },
];


const defaultSettings = {
  evalLockActive: false,
};

const defaultAuditFilters = {
  startDate: "",
  endDate: "",
  actorTypes: [],
  actions: [],
};

const formatAuditTimestamp = (value) => {
  if (!value) return "—";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "—";
  const day = String(dt.getDate()).padStart(2, "0");
  const month = dt.toLocaleString("en-GB", { month: "short" });
  const year = dt.getFullYear();
  const hours = String(dt.getHours()).padStart(2, "0");
  const minutes = String(dt.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes}`;
};

const isValidDateParts = (yyyy, mm, dd) => {
  if (yyyy < 2000 || yyyy > 2100) return false;
  if (mm < 1 || mm > 12) return false;
  if (dd < 1) return false;
  const maxDays = new Date(yyyy, mm, 0).getDate();
  return dd <= maxDays;
};

const isValidTimeParts = (hh, mi, ss) => {
  if (hh < 0 || hh > 23) return false;
  if (mi < 0 || mi > 59) return false;
  if (ss < 0 || ss > 59) return false;
  return true;
};

const parseAuditDateString = (value) => {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [datePart, timePart] = value.split("T");
    const [yyyy, mm, dd] = datePart.split("-").map(Number);
    const [hh, mi, ss = "0"] = timePart.split(":").map(Number);
    if (!isValidDateParts(yyyy, mm, dd)) return null;
    if (!isValidTimeParts(hh, mi, ss)) return null;
    return { ms: new Date(yyyy, mm - 1, dd, hh, mi, ss).getTime(), isDateOnly: false };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yyyy, mm, dd] = value.split("-").map(Number);
    if (!isValidDateParts(yyyy, mm, dd)) return null;
    return { ms: new Date(yyyy, mm - 1, dd).getTime(), isDateOnly: true };
  }
  return null;
};

const getAuditDateRangeError = (filters) => {
  const start = filters?.startDate || "";
  const end = filters?.endDate || "";
  const parsedStart = start ? parseAuditDateString(start) : null;
  const parsedEnd = end ? parseAuditDateString(end) : null;
  if ((start && !parsedStart) || (end && !parsedEnd)) {
    return "Invalid date format. Use YYYY-MM-DDThh:mm.";
  }
  if (parsedStart && parsedEnd && parsedStart.ms > parsedEnd.ms) {
    return "The 'From' date/time cannot be later than the 'To' date/time.";
  }
  return "";
};

const buildAuditParams = (filters) => {
  let startAt = null;
  let endAt = null;
  if (filters.startDate) {
    const parsed = parseAuditDateString(filters.startDate);
    if (parsed) {
      startAt = new Date(parsed.ms);
    }
  }
  if (filters.endDate) {
    const parsed = parseAuditDateString(filters.endDate);
    if (parsed) {
      const endMs = parsed.ms + (parsed.isDateOnly ? (24 * 60 * 60 * 1000 - 1) : 0);
      endAt = new Date(endMs);
    }
  }
  return {
    startAt: startAt ? startAt.toISOString() : null,
    endAt: endAt ? endAt.toISOString() : null,
    actorTypes: filters.actorTypes?.length ? filters.actorTypes : null,
    actions: filters.actions?.length ? filters.actions : null,
    limit: 120,
  };
};

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, [query]);
  return matches;
}

export default function ManagePage({ adminPass, onAdminPasswordChange }) {
  const isMobile = useMediaQuery("(max-width: 900px)");
  const [openPanels, setOpenPanels] = useState({
    semester: true,
    projects: true,
    jurors: true,
    permissions: true,
    security: true,
    audit: true,
    export: true,
  });

  const [semesterList, setSemesterList] = useState([]);
  const [activeSemesterId, setActiveSemesterId] = useState("");
  const [projects, setProjects] = useState([]);
  const [jurors, setJurors] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resetPinInfo, setResetPinInfo] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [auditFilters, setAuditFilters] = useState(defaultAuditFilters);
  const [auditSearch, setAuditSearch] = useState("");
  const [activityLogs, setActivityLogs] = useState([]);
  const liveTimerRef = useRef(null);
  const adminSecurityRef = useRef(null);
  const auditCardRef = useRef(null);

  const activeSemester = useMemo(
    () => semesterList.find((s) => s.id === activeSemesterId) || null,
    [semesterList, activeSemesterId]
  );

  const togglePanel = (id) => {
    setOpenPanels((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const loadSemesters = useCallback(async () => {
    const sems = await listSemesters();
    setSemesterList(sems);
    const active = sems.find((s) => s.is_active) || sems[0];
    setActiveSemesterId(active?.id || "");
  }, []);

  const loadProjects = useCallback(async (semesterId) => {
    if (!semesterId || !adminPass) return;
    const rows = await adminListProjects(semesterId, adminPass);
    setProjects(rows || []);
  }, [adminPass]);

  const loadJurors = useCallback(async () => {
    if (!adminPass) return;
    const rows = await adminListJurors(activeSemesterId, adminPass);
    setJurors(rows || []);
  }, [adminPass, activeSemesterId]);

  const loadSettings = useCallback(async () => {
    if (!adminPass) return;
    const rows = await adminGetSettings(adminPass);
    const map = new Map((rows || []).map((r) => [r.key, r.value]));
    const evalLockActive = map.get(SETTINGS_KEYS.evalLock) === "true";
    setSettings({
      evalLockActive,
    });
  }, [adminPass]);

  const loadAuditLogs = useCallback(async (filters) => {
    if (!adminPass) return;
    setAuditLoading(true);
    setAuditError("");
    const rangeError = getAuditDateRangeError(filters || defaultAuditFilters);
    if (rangeError) {
      setAuditError(rangeError);
      setAuditLogs([]);
      setAuditLoading(false);
      return;
    }
    try {
      const params = buildAuditParams(filters || defaultAuditFilters);
      const rows = await adminListAuditLogs(params, adminPass);
      setAuditLogs(rows || []);
    } catch (e) {
      setAuditError(e?.message || "Could not load audit logs.");
    } finally {
      setAuditLoading(false);
    }
  }, [adminPass]);

  const loadActivityLogs = useCallback(async () => {
    if (!adminPass) return;
    try {
      const rows = await adminListAuditLogs({
        startAt: null,
        endAt: null,
        actorTypes: null,
        actions: null,
        limit: 500,
      }, adminPass);
      setActivityLogs(rows || []);
    } catch {
      setActivityLogs([]);
    }
  }, [adminPass]);

  useEffect(() => {
    setLoading(true);
    setError("");
    loadSemesters()
      .catch(() => setError("Could not load semesters."))
      .finally(() => setLoading(false));
  }, [loadSemesters]);

  useEffect(() => {
    if (!activeSemesterId) return;
    if (!adminPass) {
      setError("Admin password missing. Please re-login.");
      return;
    }
    setLoading(true);
    Promise.all([
      loadProjects(activeSemesterId),
      loadJurors(),
      loadSettings(),
    ])
      .catch((e) => setError(e?.message || "Could not load manage data."))
      .finally(() => setLoading(false));
  }, [activeSemesterId, adminPass, loadProjects, loadJurors, loadSettings]);

  useEffect(() => {
    if (!adminPass) return;
    loadAuditLogs(auditFilters);
  }, [adminPass, auditFilters, loadAuditLogs]);

  useEffect(() => {
    if (!adminPass) return;
    loadActivityLogs();
  }, [adminPass, loadActivityLogs]);

  const visibleAuditLogs = useMemo(() => {
    const query = auditSearch.trim().toLowerCase();
    if (!query) return auditLogs;
    return auditLogs.filter((log) => {
      const message = String(log?.message || "").toLowerCase();
      const action = String(log?.action || "").toLowerCase();
      const actor = String(log?.actor_type || "").toLowerCase();
      const entity = String(log?.entity_type || "").toLowerCase();
      return (
        message.includes(query)
        || action.includes(query)
        || actor.includes(query)
        || entity.includes(query)
      );
    });
  }, [auditLogs, auditSearch]);

  useLayoutEffect(() => {
    const adminEl = adminSecurityRef.current;
    const auditEl = auditCardRef.current;
    if (!adminEl || !auditEl) return undefined;

    if (isMobile) {
      auditEl.style.height = "";
      return undefined;
    }

    const syncHeight = () => {
      const height = adminEl.getBoundingClientRect().height;
      if (height) {
        auditEl.style.height = `${height}px`;
      }
    };

    syncHeight();

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => syncHeight());
      observer.observe(adminEl);
    } else {
      window.addEventListener("resize", syncHeight);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener("resize", syncHeight);
      }
    };
  }, [isMobile, openPanels.security]);

  const activityMaps = useMemo(() => {
    const maps = {
      semester: new Map(),
      project: new Map(),
      juror: new Map(),
      permission: new Map(),
    };

    const normalizeMeta = (meta) => {
      if (!meta) return null;
      if (typeof meta === "object") return meta;
      try {
        return JSON.parse(meta);
      } catch {
        return null;
      }
    };

    const updateLatest = (map, key, value) => {
      if (!key || !value) return;
      const ms = Date.parse(value);
      if (!Number.isFinite(ms)) return;
      const prev = map.get(key);
      if (!prev || ms > prev.ms) {
        map.set(key, { value, ms });
      }
    };

    (activityLogs || []).forEach((log) => {
      const ts = log?.created_at;
      if (!ts) return;

      if (log.entity_type === "semester" && log.entity_id) {
        updateLatest(maps.semester, log.entity_id, ts);
      }
      if (log.entity_type === "project" && log.entity_id) {
        updateLatest(maps.project, log.entity_id, ts);
      }
      if (log.entity_type === "juror" && log.entity_id) {
        updateLatest(maps.juror, log.entity_id, ts);
      }
      if (log.actor_type === "juror" && log.actor_id) {
        updateLatest(maps.juror, log.actor_id, ts);
      }

      if (log.action === "admin_juror_edit_toggle" && log.entity_id) {
        const meta = normalizeMeta(log.metadata);
        const semId = meta?.semester_id;
        if (semId) {
          updateLatest(maps.permission, `${log.entity_id}:${semId}`, ts);
        }
      }
    });

    return maps;
  }, [activityLogs]);

  const scheduleLiveRefresh = useCallback(() => {
    if (!adminPass) return;
    if (liveTimerRef.current) return;
    liveTimerRef.current = setTimeout(() => {
      liveTimerRef.current = null;
      loadSemesters().catch(() => {});
      if (activeSemesterId) {
        loadProjects(activeSemesterId).catch(() => {});
        loadJurors().catch(() => {});
      }
      loadSettings().catch(() => {});
      loadAuditLogs(auditFilters).catch(() => {});
      loadActivityLogs().catch(() => {});
    }, 500);
  }, [
    adminPass,
    activeSemesterId,
    auditFilters,
    loadSemesters,
    loadProjects,
    loadJurors,
    loadSettings,
    loadAuditLogs,
    loadActivityLogs,
  ]);

  useEffect(() => {
    if (!adminPass) return;
    const channel = supabase
      .channel("admin-manage-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "juror_semester_auth" },
        scheduleLiveRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores" },
        scheduleLiveRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jurors" },
        scheduleLiveRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects" },
        scheduleLiveRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "semesters" },
        scheduleLiveRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings" },
        scheduleLiveRefresh
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        scheduleLiveRefresh
      )
      .subscribe();

    return () => {
      if (liveTimerRef.current) {
        clearTimeout(liveTimerRef.current);
        liveTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [adminPass, scheduleLiveRefresh]);

  const handleSetActiveSemester = async (semesterId) => {
    setMessage("");
    setError("");
    if (!adminPass) return setError("Admin password missing.");
    setLoading(true);
    try {
      await adminSetActiveSemester(semesterId, adminPass);
      await loadSemesters();
      setMessage("Active semester updated.");
    } catch (e) {
      setError(e?.message || "Could not update active semester.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSemester = async (payload) => {
    setMessage("");
    setError("");
    if (!adminPass) return setError("Admin password missing.");
    setLoading(true);
    try {
      await adminCreateSemester(payload, adminPass);
      await loadSemesters();
      setMessage("Semester created.");
    } catch (e) {
      setError(e?.message || "Could not create semester.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSemester = async (payload) => {
    setMessage("");
    setError("");
    if (!adminPass) return setError("Admin password missing.");
    setLoading(true);
    try {
      await adminUpdateSemester(payload, adminPass);
      await loadSemesters();
      setMessage("Semester updated.");
    } catch (e) {
      setError(e?.message || "Could not update semester.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportProjects = async (rows) => {
    if (!activeSemesterId) return;
    setMessage("");
    setError("");
    setLoading(true);
    try {
      for (const row of rows) {
        await adminUpsertProject({ ...row, semesterId: activeSemesterId }, adminPass);
      }
      await loadProjects(activeSemesterId);
      setMessage("Projects imported.");
    } catch (e) {
      setError(e?.message || "Could not import projects.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddProject = async (row) => {
    if (!activeSemesterId) return;
    setMessage("");
    setError("");
    setLoading(true);
    try {
      await adminUpsertProject({ ...row, semesterId: activeSemesterId }, adminPass);
      await loadProjects(activeSemesterId);
      setMessage("Group saved.");
    } catch (e) {
      setError(e?.message || "Could not save group.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditProject = async (row) => {
    if (!activeSemesterId) return;
    setMessage("");
    setError("");
    setLoading(true);
    try {
      await adminUpsertProject({ ...row, semesterId: activeSemesterId }, adminPass);
      await loadProjects(activeSemesterId);
      setMessage("Group updated.");
    } catch (e) {
      setError(e?.message || "Could not update group.");
    } finally {
      setLoading(false);
    }
  };


  const handleAddJuror = async (row) => {
    setMessage("");
    setError("");
    setLoading(true);
    try {
      await adminCreateJuror(row, adminPass);
      await loadJurors();
      setMessage("Juror added.");
    } catch (e) {
      setError(e?.message || "Could not add juror.");
    } finally {
      setLoading(false);
    }
  };

  const handleImportJurors = async (rows) => {
    setMessage("");
    setError("");
    setLoading(true);
    try {
      for (const row of rows) {
        await adminCreateJuror(row, adminPass);
      }
      await loadJurors();
      setMessage("Jurors imported.");
    } catch (e) {
      setError(e?.message || "Could not import jurors.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditJuror = async (row) => {
    if (!row?.jurorId) return;
    setMessage("");
    setError("");
    setLoading(true);
    try {
      await adminUpdateJuror(row, adminPass);
      await loadJurors();
      setMessage("Juror updated.");
    } catch (e) {
      setError(e?.message || "Could not update juror.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPin = async (juror) => {
    const jurorId = juror?.jurorId || juror?.juror_id;
    const jurorName = juror?.juror_name || juror?.juryName;
    const jurorInst = juror?.juror_inst || juror?.juryDept;
    if (!activeSemesterId || !jurorId) return;
    setMessage("");
    setError("");
    setLoading(true);
    try {
      const res = await adminResetJurorPin({ semesterId: activeSemesterId, jurorId }, adminPass);
      setResetPinInfo({
        ...res,
        juror_name: jurorName || res?.juror_name || null,
        juror_inst: jurorInst || res?.juror_inst || null,
      });
      setMessage("PIN reset.");
    } catch (e) {
      setError(e?.message || "Could not reset PIN.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleJurorEdit = async ({ jurorId, enabled }) => {
    if (!activeSemesterId || !jurorId) return;
    setMessage("");
    setError("");
    setLoading(true);
    try {
      await adminSetJurorEditMode(
        {
          semesterId: activeSemesterId,
          jurorId,
          enabled,
        },
        adminPass
      );
      await loadJurors();
      setMessage(enabled ? "Edit mode enabled." : "Edit mode disabled.");
    } catch (e) {
      setError(e?.message || "Could not update edit mode.");
    } finally {
      setLoading(false);
    }
  };


  const handleSaveSettings = async (next) => {
    if (!adminPass) return;
    setLoading(true);
    setMessage("");
    setError("");
    try {
      await adminSetSetting(SETTINGS_KEYS.evalLock, String(!!next.evalLockActive), adminPass);
      setSettings(next);
      setMessage("Settings saved.");
    } catch (e) {
      setError(e?.message || "Could not save settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuditRefresh = () => {
    loadAuditLogs(auditFilters);
  };

  const handleAuditReset = () => {
    setAuditFilters(defaultAuditFilters);
    setAuditSearch("");
  };

  const handleRequestDelete = (target) => {
    if (!target || !target.id) return;
    setDeleteTarget(target);
  };

  const mapDeleteError = (e) => {
    const msg = String(e?.message || "");
    if (msg.includes("delete_password_missing")) {
      return "Delete password is not configured. Set it in Admin Security.";
    }
    if (msg.includes("incorrect_delete_password") || msg.includes("unauthorized")) {
      return "Incorrect delete password.";
    }
    if (msg.includes("semester_has_dependencies")) {
      return "Cannot delete semester with existing projects or scores.";
    }
    if (msg.includes("project_has_scores")) {
      return "Cannot delete project with existing scores.";
    }
    if (msg.includes("juror_has_scores")) {
      return "Cannot delete juror with existing scores.";
    }
    if (msg.includes("not_found")) {
      return "Item not found.";
    }
    return "Could not delete. Please try again.";
  };

  const handleConfirmDelete = async (password) => {
    if (!deleteTarget) throw new Error("Nothing selected for deletion.");
    const { type, id, label } = deleteTarget;
    setMessage("");
    setError("");
    await adminDeleteEntity({ targetType: type, targetId: id, deletePassword: password });
    if (type === "semester") {
      await loadSemesters();
    } else if (type === "project") {
      await loadProjects(activeSemesterId);
    } else if (type === "juror") {
      await loadJurors();
    }
    setMessage(`Deleted ${label}.`);
  };

  const handleExportProjects = async () => {
    if (!projects.length) return;
    const XLSX = await import("xlsx");
    const headers = ["group_no", "project_title", "group_students"];
    const data = projects.map((p) => [p.group_no, p.project_title, p.group_students || ""]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws["!cols"] = [8, 36, 42].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Projects");
    XLSX.writeFile(wb, buildExportFilename("projects", activeSemester?.name));
  };

  const handleExportJurors = async () => {
    if (!jurors.length) return;
    const XLSX = await import("xlsx");
    const headers = ["juror_name", "juror_inst"];
    const data = jurors.map((j) => [j.juryName || j.juror_name || j.jurorName, j.juryDept || j.juror_inst || j.jurorInst]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
    ws["!cols"] = [28, 32].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jurors");
    XLSX.writeFile(wb, buildExportFilename("jurors", activeSemester?.name));
  };

  const handleExportScores = async () => {
    if (!activeSemesterId || !adminPass) return;
    const rows = await adminGetScores(activeSemesterId, adminPass);
    await exportXLSX(rows || [], {
      semesterName: activeSemester?.name || "",
      summaryData: (projects || []).map((p) => ({ id: p.id, students: p.group_students || "" })),
    });
  };

  return (
    <div className="manage-page">
      {(loading || error || message) && (
        <div className="manage-alerts">
          {loading && <span className="manage-alert">Working…</span>}
          {message && <span className="manage-alert success">{message}</span>}
          {error && <span className="manage-alert error">{error}</span>}
        </div>
      )}
      {resetPinInfo?.pin_plain_once && (
        <div className="manage-modal">
          <div className="manage-modal-card">
            <div className="manage-modal-title">New PIN Created</div>
            <div className="manage-modal-body">
              <div className="manage-hint">
                {resetPinInfo.juror_name || resetPinInfo.juror_id}
                {resetPinInfo.juror_inst ? ` — ${resetPinInfo.juror_inst}` : ""}
              </div>
              <div className="manage-pin-code">{resetPinInfo.pin_plain_once}</div>
            </div>
            <div className="manage-modal-actions">
              <button
                className="manage-btn"
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(resetPinInfo.pin_plain_once).catch(() => {});
                }}
              >
                Copy PIN
              </button>
              <button
                className="manage-btn primary"
                type="button"
                onClick={() => setResetPinInfo(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <DeleteConfirmDialog
        open={!!deleteTarget}
        targetLabel={deleteTarget?.label}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={async (password) => {
          try {
            await handleConfirmDelete(password);
          } catch (e) {
            const msg = mapDeleteError(e);
            setError(msg);
            throw new Error(msg);
          }
        }}
      />

      <div className="manage-grid">
        <section className="manage-section" style={{ gridColumn: "1 / -1" }}>
          <h3 className="manage-section-title">Data</h3>
          <div className="manage-section-grid">
            <ManageSemesterPanel
              semesters={semesterList}
              activeSemesterId={activeSemesterId}
              isMobile={isMobile}
              isOpen={openPanels.semester}
              onToggle={() => togglePanel("semester")}
              onSetActive={handleSetActiveSemester}
              onCreateSemester={handleCreateSemester}
              onUpdateSemester={handleUpdateSemester}
              onDeleteSemester={(s) =>
                handleRequestDelete({
                  type: "semester",
                  id: s?.id,
                  label: `Semester ${s?.name || ""}`.trim(),
                })
              }
              activityMap={activityMaps.semester}
            />

            <ManageProjectsPanel
              projects={projects}
              semesterName={activeSemester?.name || ""}
              isMobile={isMobile}
              isOpen={openPanels.projects}
              onToggle={() => togglePanel("projects")}
              onImport={handleImportProjects}
              onAddGroup={handleAddProject}
              onEditGroup={handleEditProject}
              onDeleteProject={(p, groupLabel) =>
                handleRequestDelete({
                  type: "project",
                  id: p?.id,
                  label: `Group ${groupLabel}${p?.project_title ? ` — ${p.project_title}` : ""}`,
                })
              }
              activityMap={activityMaps.project}
            />

            <ManageJurorsPanel
              jurors={jurors}
              isMobile={isMobile}
              isOpen={openPanels.jurors}
              onToggle={() => togglePanel("jurors")}
              onImport={handleImportJurors}
              onAddJuror={handleAddJuror}
              onEditJuror={handleEditJuror}
              onResetPin={handleResetPin}
              onDeleteJuror={(j) =>
                handleRequestDelete({
                  type: "juror",
                  id: j?.jurorId || j?.juror_id,
                  label: `Juror ${j?.juryName || j?.juror_name || ""}`.trim(),
                })
              }
              activityMap={activityMaps.juror}
            />

            <ManagePermissionsPanel
              settings={settings}
              jurors={jurors}
              isMobile={isMobile}
              isOpen={openPanels.permissions}
              onToggle={() => togglePanel("permissions")}
              onSave={handleSaveSettings}
              onToggleEdit={handleToggleJurorEdit}
              activityMap={activityMaps.permission}
              activeSemesterId={activeSemesterId}
            />
          </div>
        </section>

        <section className="manage-section" style={{ gridColumn: "1 / -1" }}>
          <h3 className="manage-section-title">Access Control</h3>
          <div className="manage-section-grid">
            <AdminSecurityPanel
              isMobile={isMobile}
              isOpen={openPanels.security}
              onToggle={() => togglePanel("security")}
              onPasswordChanged={onAdminPasswordChange}
              adminPass={adminPass}
              innerRef={adminSecurityRef}
            />

            <div
              className={`manage-card manage-card-audit${isMobile ? " is-collapsible" : ""}`}
              ref={auditCardRef}
            >
              <button
                type="button"
                className="manage-card-header"
                onClick={() => togglePanel("audit")}
                aria-expanded={openPanels.audit}
              >
                <div className="manage-card-title">
                  <span className="manage-card-icon" aria-hidden="true"><HistoryIcon /></span>
                  Audit Log
                </div>
                {isMobile && <ChevronDownIcon className={`manage-chevron${openPanels.audit ? " open" : ""}`} />}
              </button>

              {(!isMobile || openPanels.audit) && (
                <div className="manage-card-body manage-audit-body">
                  <div className="manage-audit-header">
                    <div className="manage-card-desc">Latest audit events (most recent first).</div>
                    <div className="manage-audit-filters">
                      <div className="manage-field">
                        <label className="manage-label" htmlFor="auditStartDate">From</label>
                        <input
                          id="auditStartDate"
                          type="datetime-local"
                          step="60"
                          placeholder="YYYY-MM-DDThh:mm"
                          className={`manage-input manage-date${auditFilters.startDate ? "" : " is-empty"}${auditError ? " is-error" : ""}`}
                          value={auditFilters.startDate}
                          onChange={(e) => setAuditFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                        />
                      </div>
                      <div className="manage-field">
                        <label className="manage-label" htmlFor="auditEndDate">To</label>
                        <input
                          id="auditEndDate"
                          type="datetime-local"
                          step="60"
                          placeholder="YYYY-MM-DDThh:mm"
                          className={`manage-input manage-date${auditFilters.endDate ? "" : " is-empty"}${auditError ? " is-error" : ""}`}
                          value={auditFilters.endDate}
                          onChange={(e) => setAuditFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                        />
                      </div>
                      <div className="manage-field">
                        <label className="manage-label" htmlFor="auditActorType">Actor</label>
                        <select
                          id="auditActorType"
                          className="manage-select"
                          multiple
                          size={Math.max(1, AUDIT_ACTOR_OPTIONS.length)}
                          value={auditFilters.actorTypes}
                          onChange={(e) =>
                            setAuditFilters((prev) => ({
                              ...prev,
                              actorTypes: Array.from(e.target.selectedOptions).map((opt) => opt.value),
                            }))
                          }
                        >
                          {AUDIT_ACTOR_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="manage-field">
                        <label className="manage-label" htmlFor="auditAction">Action</label>
                        <select
                          id="auditAction"
                          className="manage-select"
                          multiple
                          value={auditFilters.actions}
                          onChange={(e) =>
                            setAuditFilters((prev) => ({
                              ...prev,
                              actions: Array.from(e.target.selectedOptions).map((opt) => opt.value),
                            }))
                          }
                        >
                          {AUDIT_ACTION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="manage-field">
                        <label className="manage-label" htmlFor="auditSearch">Search</label>
                        <input
                          id="auditSearch"
                          type="text"
                          className="manage-input"
                          placeholder="Search message, actor, action, or entity"
                          value={auditSearch}
                          onChange={(e) => setAuditSearch(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="manage-card-actions manage-audit-actions">
                      <button className="manage-btn" type="button" onClick={handleAuditRefresh}>
                        Refresh
                      </button>
                      <button className="manage-btn ghost" type="button" onClick={handleAuditReset}>
                        Reset filters
                      </button>
                    </div>

                    {auditError && <div className="manage-hint manage-hint-error">{auditError}</div>}
                    {auditLoading && <div className="manage-hint">Loading audit logs…</div>}
                  </div>

                  <div className="manage-audit-scroll" role="region" aria-label="Audit log list">
                    {!auditLoading && visibleAuditLogs.length === 0 && (
                      <div className="manage-empty">No audit entries found.</div>
                    )}

                    {visibleAuditLogs.length > 0 && (
                      <div className="manage-audit-list">
                        {visibleAuditLogs.map((log) => (
                          <div key={log.id} className="manage-audit-row">
                            <span className="manage-audit-time">{formatAuditTimestamp(log.created_at)}</span>
                            <span className="manage-audit-sep" aria-hidden="true">—</span>
                            <span className="manage-audit-message">{log.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className={`manage-card${isMobile ? " is-collapsible" : ""}`}>
              <button
                type="button"
                className="manage-card-header"
                onClick={() => togglePanel("export")}
                aria-expanded={openPanels.export}
              >
                <div className="manage-card-title">
                  <span className="manage-card-icon" aria-hidden="true"><DownloadIcon /></span>
                  Export Tools
                </div>
                {isMobile && <ChevronDownIcon className={`manage-chevron${openPanels.export ? " open" : ""}`} />}
              </button>

              {(!isMobile || openPanels.export) && (
                <div className="manage-card-body">
                  <div className="manage-card-desc">Download Excel exports for scores, jurors, and projects.</div>
                  <div className="manage-export-actions">
                    <button className="manage-btn" type="button" onClick={handleExportScores}>
                      <DownloadIcon /> Export Scores
                    </button>
                    <button className="manage-btn" type="button" onClick={handleExportJurors}>
                      <DownloadIcon /> Export Jurors
                    </button>
                    <button className="manage-btn" type="button" onClick={handleExportProjects}>
                      <DownloadIcon /> Export Projects
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
