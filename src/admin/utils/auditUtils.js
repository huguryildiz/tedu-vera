// src/admin/utils/auditUtils.js
// ============================================================
// Pure utility functions for audit log query construction,
// date parsing, timestamp formatting, and student name
// normalization. No React imports. No Supabase imports.
// Safe to use in tests without mocking.
// ============================================================

import {
  APP_DATE_MIN_YEAR,
  APP_DATE_MAX_YEAR,
  isValidDateParts,
} from "../../shared/dateBounds";

// ── Constants ─────────────────────────────────────────────────

export const AUDIT_PAGE_SIZE = 120;

export const CATEGORY_META = {
  auth:     { label: "Auth",     cssClass: "cat-auth",     color: "#3b82f6" },
  access:   { label: "Access",   cssClass: "cat-access",   color: "#8b5cf6" },
  data:     { label: "Data",     cssClass: "cat-data",     color: "#22c55e" },
  config:   { label: "Config",   cssClass: "cat-config",   color: "#f59e0b" },
  security: { label: "Security", cssClass: "cat-security", color: "#ef4444" },
};

export const SEVERITY_META = {
  info:     { label: "Info",     cssClass: "sev-info"     },
  low:      { label: "Low",      cssClass: "sev-low"      },
  medium:   { label: "Medium",   cssClass: "sev-medium"   },
  high:     { label: "High",     cssClass: "sev-high"     },
  critical: { label: "Critical", cssClass: "sev-critical" },
};

const AUDIT_MIN_YEAR = APP_DATE_MIN_YEAR;
const AUDIT_MAX_YEAR = APP_DATE_MAX_YEAR;

// ── Timestamp formatting ───────────────────────────────────────

export const formatAuditTimestamp = (value) => {
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

// ── Date / time validation helpers ────────────────────────────

const isValidTimeParts = (hh, mi, ss) => {
  if (hh < 0 || hh > 23) return false;
  if (mi < 0 || mi > 59) return false;
  if (ss < 0 || ss > 59) return false;
  return true;
};

const isValidAuditYear = (year) => year >= AUDIT_MIN_YEAR && year <= AUDIT_MAX_YEAR;

// ── Month name lookup (used by parseSearchDateParts) ──────────

const monthLookup = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const normalizeSearchYear = (yearToken) => {
  if (!yearToken) return null;
  const raw = String(yearToken);
  if (!/^\d{2,4}$/.test(raw)) return null;
  if (raw.length === 2) return 2000 + Number(raw);
  return Number(raw);
};

// ── parseSearchDateParts ───────────────────────────────────────
// Parses a free-text search query into { day, month, year } parts.
// Accepts: "jan 2025", "15 jan 2025", "15.01.2025", "2025-01-15".
// Returns null if the input is not a recognizable date pattern.

export const parseSearchDateParts = (value) => {
  const query = String(value || "").trim().toLowerCase();
  if (!query) return null;

  // "jan" or "jan 25" or "jan 2025"
  let match = query.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s*(\d{2,4})?$/i);
  if (match) {
    const month = monthLookup[match[1].toLowerCase()];
    const year = normalizeSearchYear(match[2]);
    if (!month) return null;
    return { day: null, month, year };
  }

  // "15 jan" or "15 jan 2025"
  match = query.match(/^(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)\s*(\d{2,4})?$/i);
  if (match) {
    const day = Number(match[1]);
    const month = monthLookup[match[2].toLowerCase()];
    const year = normalizeSearchYear(match[3]);
    if (!month || day < 1 || day > 31) return null;
    if (year && !isValidDateParts(year, month, day)) return null;
    return { day, month, year };
  }

  // "dd.mm" or "dd.mm.yyyy" (also accepts / and -)
  match = query.match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = normalizeSearchYear(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    if (year && !isValidDateParts(year, month, day)) return null;
    return { day, month, year };
  }

  // "yyyy-mm-dd" or "yyyy.mm.dd" or "yyyy/mm/dd"
  match = query.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!isValidDateParts(year, month, day)) return null;
    return { day, month, year };
  }

  return null;
};

// ── parseAuditDateString ───────────────────────────────────────
// Parses an audit filter date string into { ms, isDateOnly }.
// Accepts ISO datetime "YYYY-MM-DDThh:mm[:ss]" or date-only "YYYY-MM-DD".
// Returns null for invalid or out-of-bounds input.

export const parseAuditDateString = (value) => {
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
    const [datePart, timePart] = value.split("T");
    const [yyyy, mm, dd] = datePart.split("-").map(Number);
    const [hh, mi, ss = "0"] = timePart.split(":").map(Number);
    if (!isValidAuditYear(yyyy)) return null;
    if (!isValidDateParts(yyyy, mm, dd)) return null;
    if (!isValidTimeParts(hh, mi, ss)) return null;
    return { ms: new Date(yyyy, mm - 1, dd, hh, mi, ss).getTime(), isDateOnly: false };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yyyy, mm, dd] = value.split("-").map(Number);
    if (!isValidAuditYear(yyyy)) return null;
    if (!isValidDateParts(yyyy, mm, dd)) return null;
    return { ms: new Date(yyyy, mm - 1, dd).getTime(), isDateOnly: true };
  }

  return null;
};

// ── getAuditDateRangeError ─────────────────────────────────────
// Returns an error message string if the filter date range is invalid,
// or "" if valid.

export const getAuditDateRangeError = (filters) => {
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

// ── buildAuditParams ───────────────────────────────────────────
// Converts UI filter state into the RPC parameter object for
// rpc_admin_list_audit_logs.

export const buildAuditParams = (filters, limit, cursor, searchText) => {
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

  const search = String(searchText || "").trim();
  const searchDate = parseSearchDateParts(search);

  return {
    startAt: startAt ? startAt.toISOString() : null,
    endAt: endAt ? endAt.toISOString() : null,
    actorTypes: null,
    actions: null,
    limit: limit || AUDIT_PAGE_SIZE,
    beforeAt: cursor?.beforeAt || null,
    beforeId: cursor?.beforeId || null,
    search: search ? search : null,
    searchDay: searchDate?.day || null,
    searchMonth: searchDate?.month || null,
    searchYear: searchDate?.year || null,
  };
};

// ── Actor resolution ──────────────────────────────────────────

const JUROR_ACTIONS = new Set([
  "evaluation.complete",
  "juror.pin_locked",
  "juror.edit_mode_closed_on_resubmit",
]);

export function getInitials(name) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Categorise an audit log row and extract human-readable actor info.
 *
 * @param {object} log - Raw audit_logs row (with optional profiles join)
 * @returns {{ type: 'admin'|'juror'|'system', name: string, role: string, initials: string|null }}
 */
export function getActorInfo(log) {
  // Prefer new DB columns populated by migration 043+
  if (log.actor_type) {
    const colName = log.actor_name || null;
    if (log.actor_type === "juror") {
      const name = colName || log.details?.actor_name || "Juror";
      return { type: "juror", name, role: "Juror", initials: getInitials(name) };
    }
    if (log.actor_type === "system") {
      return { type: "system", name: "System", role: "Automated", initials: null };
    }
    if (log.actor_type === "anonymous") {
      return { type: "system", name: "Anonymous", role: "Unauthenticated", initials: "?" };
    }
    // admin
    const name = colName || log.profiles?.display_name || "Admin";
    return { type: "admin", name, role: "Organization Admin", initials: getInitials(name) };
  }
  // Legacy fallback for rows without actor_type column
  if (log.user_id) {
    const name = log.profiles?.display_name || "Admin";
    return { type: "admin", name, role: "Organization Admin", initials: getInitials(name) };
  }
  if (JUROR_ACTIONS.has(log.action) && log.details?.actor_name) {
    const name = log.details.actor_name;
    return { type: "juror", name, role: "Juror", initials: getInitials(name) };
  }
  return { type: "system", name: "System", role: "Automated", initials: null };
}

// ── Action labels ─────────────────────────────────────────────

export const ACTION_LABELS = {
  // ── Auth ──
  "admin.login": "Admin login",

  // ── Admin lifecycle ──
  "admin.create": "Admin created",
  "admin.updated": "Admin updated",

  // ── Evaluation flow (juror-initiated) ──
  "evaluation.complete": "Evaluation completed",
  "juror.pin_locked": "Juror locked (too many PIN attempts)",
  "juror.edit_mode_closed_on_resubmit": "Edit mode closed (resubmit)",

  // ── Juror admin actions ──
  "pin.reset": "Juror PIN reset by admin",
  "juror.pin_unlocked": "Juror unlocked by admin",
  "juror.edit_mode_enabled": "Edit mode granted",
  "juror.edit_enabled": "Edit mode granted", // legacy alias → juror.edit_mode_enabled
  "juror.blocked": "Juror blocked",

  // ── Tokens & snapshots ──
  "token.generate": "QR access code generated",
  "token.revoke": "QR access code revoked",
  "snapshot.freeze": "Snapshot frozen",

  // ── Application workflow ──
  "application.submitted": "Application submitted",
  "application.approved": "Application approved",
  "application.rejected": "Application rejected",

  // ── Period management (manual instrumented) ──
  "period.create": "Period created",
  "period.update": "Period updated",
  "period.lock": "Evaluation locked",
  "period.unlock": "Evaluation unlocked",
  "period.set_current": "Active period changed",

  // ── Criteria, outcomes & framework ──
  "criteria.save": "Criteria & outcomes saved",
  "criteria.update": "Criteria updated",
  "outcome.create": "Outcome created",
  "outcome.update": "Outcome updated",
  "outcome.delete": "Outcome deleted",

  // ── Imports & manual data ──
  "juror.import": "Jurors imported",
  "juror.create": "Juror created",
  "project.import": "Projects imported",
  "project.create": "Project created",
  "project.update": "Project updated",
  "project.delete": "Project deleted",
  "score.update": "Score updated",

  // ── Cross-org super-admin actions ──
  "organization.status_changed": "Organization status changed",

  // ── Exports ──
  "export.scores": "Scores exported",
  "export.rankings": "Rankings exported",
  "export.heatmap": "Heatmap exported",
  "export.analytics": "Analytics exported",
  "export.audit": "Audit log exported",
  "export.backup": "Backup exported",

  // ── Notifications ──
  "notification.application": "Application notification sent",
  "notification.admin_invite": "Admin invite email sent",
  "notification.entry_token": "QR access link emailed",
  "notification.juror_pin": "Juror PIN emailed",
  "notification.export_report": "Report shared via email",
  "notification.password_reset": "Password reset email sent",

  // ── Backups ──
  "backup.created": "Backup created",
  "backup.deleted": "Backup deleted",
  "backup.downloaded": "Backup downloaded",

  // ── Trigger-based CRUD (table.operation) ──
  "score_sheets.insert": "Score sheet created",
  "score_sheets.update": "Score sheet updated",
  "score_sheets.delete": "Score sheet deleted",
  "projects.insert": "Project created",
  "projects.update": "Project updated",
  "projects.delete": "Project deleted",
  "jurors.insert": "Juror created",
  "jurors.update": "Juror updated",
  "jurors.delete": "Juror deleted",
  "periods.insert": "Period created",
  "periods.update": "Period updated",
  "periods.delete": "Period deleted",
  "entry_tokens.insert": "QR access code created",
  "entry_tokens.update": "QR access code updated",
  "entry_tokens.delete": "QR access code deleted",
  "memberships.insert": "Membership created",
  "memberships.update": "Membership updated",
  "memberships.delete": "Membership deleted",
  "organizations.insert": "Organization created",
  "organizations.update": "Organization updated",
  "org_applications.insert": "Application submitted",
  "org_applications.update": "Application status changed",
  "org_applications.delete": "Application deleted",
  "admin_invites.insert": "Admin invite created",
  "admin_invites.update": "Admin invite updated",
  "admin_invites.delete": "Admin invite deleted",
  "frameworks.insert": "Framework created",
  "frameworks.update": "Framework updated",
  "frameworks.delete": "Framework deleted",
  "profiles.insert": "Profile created",
  "profiles.update": "Profile updated",
};

/**
 * Return a human-readable label for an audit action.
 * Falls back to a best-effort title-case transformation.
 */
export function formatActionLabel(action) {
  if (!action) return "—";
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  // Fallback: convert "some_table.insert" → "Some table inserted"
  const parts = action.split(".");
  if (parts.length >= 2) {
    const table = parts[0].replace(/_/g, " ");
    const op = { insert: "created", update: "updated", delete: "deleted" }[parts[1]] || parts[1];
    return `${table.charAt(0).toUpperCase() + table.slice(1)} ${op}`;
  }
  return action;
}

/**
 * Build a detail string for the action context (e.g. affected juror name).
 */
export function formatActionDetail(log) {
  if (!log.details) return "";
  const d = log.details;

  // Juror actions — show juror name
  if (d.juror_name) return d.juror_name;
  if (d.actor_name && !log.user_id) return d.actor_name;

  // Application actions — show applicant info
  if (d.applicant_name || d.applicant_email) {
    return [d.applicant_name, d.applicant_email].filter(Boolean).join(" · ");
  }

  // Period actions — show period name / org context
  if (d.periodName) {
    return [d.periodName, d.organizationCode].filter(Boolean).join(" · ");
  }

  // Organization status change
  if (d.previousStatus && d.newStatus) {
    const parts = [d.organizationCode, `${d.previousStatus} → ${d.newStatus}`];
    if (d.reason) parts.push(d.reason);
    return parts.filter(Boolean).join(" · ");
  }

  // Notification actions — show recipient
  if (d.recipientEmail) {
    return [d.recipientEmail, d.type].filter(Boolean).join(" · ");
  }
  if (d.recipients && Array.isArray(d.recipients)) {
    return d.recipients.join(", ");
  }

  // Export actions — show format
  if (d.format) {
    const parts = [d.format.toUpperCase()];
    if (d.rowCount != null) parts.push(`${d.rowCount} rows`);
    if (d.jurorCount != null) parts.push(`${d.jurorCount} jurors`);
    if (d.projectCount != null) parts.push(`${d.projectCount} projects`);
    if (d.periodCount != null) parts.push(`${d.periodCount} periods`);
    return parts.join(" · ");
  }

  // Admin management — show admin name/email
  if (d.adminName || d.adminEmail) {
    return [d.adminName, d.adminEmail].filter(Boolean).join(" · ");
  }
  if (d.email) return d.email;

  // Auth — show method
  if (d.method) return d.method;

  // Criteria save
  if (d.criteriaCount != null) {
    return `${d.criteriaCount} criteria · ${d.outcomeMappingCount || 0} mappings`;
  }

  // Backup actions
  if (d.fileName) {
    const parts = [d.fileName];
    if (d.fileSizeBytes != null) {
      const mb = (d.fileSizeBytes / (1024 * 1024)).toFixed(1);
      parts.push(`${mb} MB`);
    }
    return parts.join(" · ");
  }

  // Trigger-based CRUD fallback — show operation · table
  const op = d.operation || "";
  const table = d.table || "";
  if (op || table) return `${op} · ${table}`.replace(/^ · | · $/g, "");

  return "";
}

// ── normalizeStudentNames ──────────────────────────────────────
// Normalizes a free-text student name list (pasted from spreadsheet,
// Word, or typed) into a consistent semicolon-separated string.

export const normalizeStudentNames = (value) => {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\n+/g, ";")
    .replace(/[,/|&]+/g, ";")
    .replace(/\s+-\s+/g, ";")
    .replace(/;+/g, ";")
    .split(";")
    .map((name) => name.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .filter((name, idx, arr) => arr.indexOf(name) === idx)
    .join("; ");
};

// ── groupByDay ────────────────────────────────────────────────
function formatDayHeader(d) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const label = d.toLocaleString("en-GB", { month: "long", day: "numeric" });
  if (d.toDateString() === today.toDateString()) return `Today · ${label}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday · ${label}`;
  return d.toLocaleString("en-GB", { weekday: "long", month: "long", day: "numeric" });
}

/**
 * Group a sorted-desc log array into day buckets.
 * @returns {{ key: string, label: string, logs: object[] }[]}
 */
export function groupByDay(logs) {
  const groups = [];
  let current = null;
  for (const log of logs) {
    const d = log.created_at ? new Date(log.created_at) : null;
    const key = d ? `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` : "unknown";
    const label = d ? formatDayHeader(d) : "Unknown date";
    if (!current || current.key !== key) {
      current = { key, label, logs: [] };
      groups.push(current);
    }
    current.logs.push(log);
  }
  return groups;
}

// ── formatSentence ────────────────────────────────────────────
/**
 * Return { verb, resource } for sentence-style event rendering.
 * verb: string, resource: string | null
 */
export function formatSentence(log) {
  const action = log.action || "";
  const d = log.details || {};

  // ── Auth ──
  if (action === "admin.login")                 return { verb: d.method ? `signed in via ${d.method}` : "signed in", resource: null };
  if (action === "admin.create")                return { verb: "created admin",                     resource: d.adminName || d.adminEmail || null };
  if (action === "admin.updated")               return { verb: "updated admin",                     resource: d.adminName || d.adminEmail || null };

  // ── Evaluation flow (juror-initiated) ──
  if (action === "evaluation.complete")         return { verb: "completed an evaluation on",       resource: d.periodName || null };
  if (action === "juror.pin_locked")            return { verb: "was locked out (failed PIN attempts) on", resource: d.periodName || null };
  if (action === "juror.edit_mode_closed_on_resubmit") return { verb: "edit window closed on resubmit for", resource: d.periodName || null };

  // ── Juror admin actions ──
  if (action === "pin.reset")                   return { verb: "reset PIN for",                     resource: d.juror_name || null };
  if (action === "juror.pin_unlocked")          return { verb: "unlocked",                          resource: d.juror_name || null };
  if (action === "juror.edit_mode_enabled" ||
      action === "juror.edit_enabled")          return { verb: "granted edit mode to",              resource: d.juror_name || null };
  if (action === "juror.blocked")               return { verb: "blocked juror",                     resource: d.juror_name || null };
  if (action === "juror.import")                return { verb: "imported jurors",                   resource: d.count != null ? `${d.count} jurors` : null };
  if (action === "juror.create")                return { verb: "added juror",                       resource: d.juror_name || null };

  // ── Tokens & snapshots ──
  if (action === "token.generate")              return { verb: "generated QR access code for",      resource: d.periodName || null };
  if (action === "token.revoke")                return { verb: "revoked QR access code for",        resource: d.periodName || null };
  if (action === "snapshot.freeze")             return { verb: "froze framework snapshot for",      resource: d.periodName || null };

  // ── Application workflow ──
  if (action === "application.submitted")       return { verb: "submitted an application",          resource: d.applicant_email || d.applicantEmail || null };
  if (action === "application.approved")        return { verb: "approved application from",        resource: d.applicant_email || d.applicantEmail || null };
  if (action === "application.rejected")        return { verb: "rejected application from",        resource: d.applicant_email || d.applicantEmail || null };

  // ── Period management ──
  if (action === "period.create"   ||
      action === "periods.insert")              return { verb: "created period",                    resource: d.periodName || null };
  if (action === "period.update"   ||
      action === "periods.update")              return { verb: "updated period",                    resource: d.periodName || null };
  if (action === "periods.delete")              return { verb: "deleted period",                    resource: d.periodName || null };
  if (action === "period.lock")                 return { verb: "locked evaluation period",          resource: d.periodName || null };
  if (action === "period.unlock")               return { verb: "unlocked evaluation period",        resource: d.periodName || null };
  if (action === "period.set_current")          return { verb: "set active period to",              resource: d.periodName || null };

  // ── Criteria, outcomes, framework ──
  if (action === "criteria.save")               return { verb: "saved criteria configuration for",  resource: d.periodName || null };
  if (action === "criteria.update")             return { verb: "updated criteria for",              resource: d.periodName || null };
  if (action === "outcome.create")              return { verb: "created outcome",                   resource: d.outcomeCode || d.outcome_code || d.outcomeName || null };
  if (action === "outcome.update")              return { verb: "updated outcome",                   resource: d.outcomeCode || d.outcome_code || d.outcomeName || null };
  if (action === "outcome.delete")              return { verb: "deleted outcome",                   resource: d.outcomeCode || d.outcome_code || d.outcomeName || null };

  // ── Project management (manual instrumented) ──
  if (action === "project.import")              return { verb: "imported projects",                 resource: d.count != null ? `${d.count} projects` : null };
  if (action === "project.create")              return { verb: "created project",                   resource: d.title || d.projectTitle || null };
  if (action === "project.update")              return { verb: "updated project",                   resource: d.title || d.projectTitle || null };
  if (action === "project.delete")              return { verb: "deleted project",                   resource: d.title || d.projectTitle || null };

  // ── Score management ──
  if (action === "score.update")                return { verb: "updated scores for",                resource: d.projectTitle || d.title || null };

  // ── Cross-org super-admin ──
  if (action === "organization.status_changed") {
    const transition = d.previousStatus && d.newStatus ? `${d.previousStatus} → ${d.newStatus}` : null;
    const target = [d.organizationCode || d.orgCode, transition].filter(Boolean).join(" · ");
    return { verb: "changed organization status",                                                  resource: target || null };
  }

  // ── Backups ──
  if (action === "backup.created")              return { verb: "created a backup",                  resource: d.fileName || null };
  if (action === "backup.deleted")              return { verb: "deleted backup",                    resource: d.fileName || null };
  if (action === "backup.downloaded")           return { verb: "downloaded backup",                 resource: d.fileName || null };

  // ── Exports & notifications (prefix matchers) ──
  if (action.startsWith("export.")) {
    const type = action.replace("export.", "");
    return { verb: `exported ${type}`,                                                              resource: d.periodName || null };
  }
  if (action.startsWith("notification.")) {
    const type = action.replace("notification.", "");
    return { verb: `sent ${type.replace(/_/g, " ")} to`,                                           resource: d.recipientEmail || (Array.isArray(d.recipients) ? d.recipients.join(", ") : null) };
  }

  // ── Trigger-based CRUD fallback (table.insert/update/delete) ──
  const parts = action.split(".");
  if (parts.length >= 2) {
    const table = parts[0].replace(/_/g, " ");
    const op = { insert: "created", update: "updated", delete: "deleted" }[parts[1]] || parts[1];
    return { verb: `${op} a ${table}`, resource: null };
  }
  return { verb: formatActionLabel(action).toLowerCase(), resource: null };
}

// ── formatDiffChips ───────────────────────────────────────────
/**
 * Return diff entries for update events.
 * @returns {{ key: string, from: string|null, to: string|null }[]}
 */
export function formatDiffChips(log) {
  const d = log.details || {};
  const action = log.action || "";

  // criteria.save with explicit weight changes
  if (action === "criteria.save" && d.changes && typeof d.changes === "object") {
    return Object.entries(d.changes)
      .slice(0, 4)
      .map(([key, val]) => ({
        key,
        from: val?.from != null ? String(val.from) : null,
        to:   val?.to   != null ? String(val.to)   : null,
      }));
  }

  // periods.update with changedFields
  if ((action === "period.update" || action === "periods.update") && Array.isArray(d.changedFields)) {
    return d.changedFields.slice(0, 3).map((field) => ({
      key:  field,
      from: d.oldValues?.[field] != null ? String(d.oldValues[field]) : null,
      to:   d.newValues?.[field] != null ? String(d.newValues[field]) : null,
    }));
  }

  // Trigger-generated diff from migration 045 — {before:{...}, after:{...}}
  if (log.diff && typeof log.diff === "object") {
    const before = log.diff.before || {};
    const after  = log.diff.after  || {};
    const SKIP_KEYS = new Set([
      "created_at", "updated_at", "id", "organization_id",
      "user_id", "period_id", "framework_id",
    ]);
    const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
    const changed = allKeys.filter(
      (k) => !SKIP_KEYS.has(k) && JSON.stringify(before[k]) !== JSON.stringify(after[k])
    );
    if (changed.length > 0) {
      return changed.slice(0, 4).map((k) => ({
        key:  k.replace(/_/g, " "),
        from: before[k] != null ? String(before[k]).slice(0, 60) : null,
        to:   after[k]  != null ? String(after[k]).slice(0, 60)  : null,
      }));
    }
  }

  return [];
}

// ── groupBulkEvents ───────────────────────────────────────────
const BULK_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const BULK_MIN_SIZE  = 3;

/**
 * Collapse runs of N+ events from same actor on same resource_type
 * within a 5-minute window into a single "bulk" item.
 *
 * @returns {{ type: "single", log: object } | { type: "bulk", logs: object[], count: number, representative: object }}[]
 */
export function groupBulkEvents(logs) {
  const result = [];
  let i = 0;
  while (i < logs.length) {
    const log = logs[i];
    const actorId = log.user_id;
    const resType = log.resource_type;
    if (!actorId) { result.push({ type: "single", log }); i++; continue; }
    const ts0 = log.created_at ? Date.parse(log.created_at) : 0;
    let j = i + 1;
    while (j < logs.length) {
      const next = logs[j];
      if (next.user_id !== actorId) break;
      if (next.resource_type !== resType) break;
      const tsJ = next.created_at ? Date.parse(next.created_at) : 0;
      if (Math.abs(ts0 - tsJ) > BULK_WINDOW_MS) break;
      j++;
    }
    const count = j - i;
    if (count >= BULK_MIN_SIZE) {
      result.push({ type: "bulk", logs: logs.slice(i, j), count, representative: log });
    } else {
      for (let k = i; k < j; k++) result.push({ type: "single", log: logs[k] });
    }
    i = j;
  }
  return result;
}

// ── detectAnomalies ───────────────────────────────────────────
function _timeAgo(ms) {
  const diff = Date.now() - ms;
  if (diff < 60_000)     return "just now";
  if (diff < 3_600_000)  return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/**
 * Scan logs for anomalies worth surfacing to the admin.
 * Returns the highest-priority anomaly object, or null.
 *
 * @returns {{ title: string, desc: string, filterAction: string } | null}
 */
export function detectAnomalies(logs) {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Failed admin login burst (highest priority)
  const recentFailures = logs.filter(
    (l) =>
      (l.action === "admin.login.failure" || l.action === "auth.admin.login.failure") &&
      l.created_at &&
      now - Date.parse(l.created_at) < oneDayMs
  );
  if (recentFailures.length >= 3) {
    const latest = recentFailures[0];
    const ip = latest.ip_address || null;
    const timeAgo = _timeAgo(Date.parse(latest.created_at));
    return {
      title: `Failed login attempts detected · ${timeAgo}`,
      desc: `${recentFailures.length} failed sign-in${recentFailures.length > 1 ? "s" : ""} in the last 24 hours.${ip ? ` Source: ${ip}.` : ""}`,
      filterAction: latest.action,
    };
  }

  // Juror PIN lockout
  const recentLocks = logs.filter(
    (l) => l.action === "juror.pin_locked" && l.created_at && (now - Date.parse(l.created_at)) < oneDayMs
  );
  if (recentLocks.length === 0) return null;
  const latest = recentLocks[0];
  const name = latest.actor_name || latest.details?.actor_name || "A juror";
  const timeAgo = _timeAgo(Date.parse(latest.created_at));
  return {
    title: `Unusual activity detected · ${timeAgo}`,
    desc: `${name} triggered too many failed PIN attempts and was locked.${recentLocks.length > 1 ? ` ${recentLocks.length} lock events today.` : ""}`,
    filterAction: "juror.pin_locked",
  };
}
