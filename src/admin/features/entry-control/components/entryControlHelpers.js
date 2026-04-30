// Formatting + timing helpers for EntryControlPage.

import { formatDate } from "@/shared/lib/dateUtils";

export function fmtExpiry(ts) {
  if (!ts) return null;
  try {
    const diff = Date.parse(ts) - Date.now();
    if (diff <= 0) return null;
    if (diff >= 24 * 3600000) {
      return formatDate(ts);
    }
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  } catch {
    return null;
  }
}

export function fmtExpiryHeadline(ts) {
  if (!ts) return null;
  try {
    const diff = Date.parse(ts) - Date.now();
    if (diff <= 0) return "expired";
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days === 1 ? "" : "s"}`;
    }
    if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
    return `${Math.max(mins, 1)} minute${mins === 1 ? "" : "s"}`;
  } catch {
    return null;
  }
}

export function fmtExpiryCompact(ts) {
  if (!ts) return null;
  try {
    const diff = Date.parse(ts) - Date.now();
    if (diff <= 0) return "expired";
    const totalDays = Math.floor(diff / (24 * 3600000));
    const hours = Math.floor((diff % (24 * 3600000)) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);

    let durationStr = "";
    if (totalDays >= 365) {
      const y = Math.floor(totalDays / 365);
      const m = Math.floor((totalDays % 365) / 30);
      durationStr = `${y} year${y > 1 ? "s" : ""}${m > 0 ? ` ${m} month${m > 1 ? "s" : ""}` : ""}`;
    } else if (totalDays >= 30) {
      const m = Math.floor(totalDays / 30);
      const d = totalDays % 30;
      durationStr = `${m} month${m > 1 ? "s" : ""}${d > 0 ? ` ${d} day${d > 1 ? "s" : ""}` : ""}`;
    } else if (totalDays > 0) {
      durationStr = `${totalDays} day${totalDays > 1 ? "s" : ""}`;
    } else if (hours > 0) {
      durationStr = `${hours}h`;
    } else {
      durationStr = `${Math.max(mins, 1)}m`;
    }

    return durationStr;
  } catch {
    return null;
  }
}

export function fmtRelative(ts) {
  if (!ts) return null;
  try {
    const diff = Date.now() - Date.parse(ts);
    if (!Number.isFinite(diff) || diff < 0) return null;
    if (diff < 60000) return "just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return null;
  }
}

export function fmtTokenPrefix(prefix) {
  if (!prefix) return null;
  const clean = String(prefix).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!clean) return null;
  if (clean.length >= 8) return `${clean.slice(0, 4)}-${clean.slice(4, 8)}`;
  if (clean.length >= 4) {
    const mid = Math.ceil(clean.length / 2);
    return `${clean.slice(0, mid)}-${clean.slice(mid)}`;
  }
  return clean;
}

export function toTimestampMs(ts) {
  if (!ts) return 0;
  const ms = Date.parse(ts);
  return Number.isFinite(ms) ? ms : 0;
}

export function isExpiringSoon(ts) {
  if (!ts) return false;
  try {
    const diff = Date.parse(ts) - Date.now();
    return diff > 0 && diff < 3 * 3600000;
  } catch {
    return false;
  }
}
