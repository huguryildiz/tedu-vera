// src/admin/hooks/useAnalyticsData.js
// ============================================================
// Manages trend / analytics data for the admin panel.
//
// Extracted from useAdminData.js (Phase 5 — Final Decomposition).
//
// Owns: trendPeriodIds selection (with localStorage persistence),
// stale-ID cleanup when periodList changes, and the trend fetch.
// ============================================================

import { useEffect, useRef, useState } from "react";
import { getOutcomeTrends } from "../../shared/api";
import { readSection, writeSection } from "../persist";

/**
 * useAnalyticsData — trend/analytics loading for the admin panel.
 *
 * @param {object} opts
 * @param {string}    opts.organizationId         Current organization ID (JWT-based auth).
 * @param {object[]}  opts.periodList             Full period list (for stale-ID cleanup).
 * @param {object[]}  opts.sortedPeriods         Sorted periods (for initial seed).
 * @param {Date|null} opts.lastRefresh           Bumped by useAdminData after a fresh fetch;
 *                                               causes the trend to re-fetch with latest data.
 *
 * @returns {{
 *   trendData: object[],
 *   trendLoading: boolean,
 *   trendError: string,
 *   trendPeriodIds: string[],
 *   setTrendPeriodIds: Function,
 * }}
 */
export function useAnalyticsData({ organizationId, periodList, sortedPeriods, lastRefresh }) {
  const [trendPeriodIds, setTrendPeriodIds] = useState(() => {
    const s = readSection("trend");
    return Array.isArray(s.periodIds) ? s.periodIds : [];
  });
  const [trendData, setTrendData] = useState([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [trendError, setTrendError] = useState("");

  // Ensures trendPeriodIds is seeded from sortedPeriods exactly once.
  const trendInitRef = useRef(false);

  // ── Trend initialization ──────────────────────────────────
  // Seed from sortedPeriods once (if not already set by localStorage).
  useEffect(() => {
    if (trendInitRef.current) return;
    if (!sortedPeriods.length) return;
    setTrendPeriodIds((prev) => (
      prev.length ? prev : sortedPeriods.map((p) => p.id)
    ));
    trendInitRef.current = true;
  }, [sortedPeriods]);

  // Persist trend selection to localStorage.
  useEffect(() => {
    writeSection("trend", { periodIds: trendPeriodIds });
  }, [trendPeriodIds]);

  // Remove stale period IDs when periodList changes.
  useEffect(() => {
    if (!trendPeriodIds.length) return;
    const valid = new Set(periodList.map((p) => p.id));
    const filtered = trendPeriodIds.filter((id) => valid.has(id));
    if (filtered.length !== trendPeriodIds.length) {
      setTrendPeriodIds(filtered);
    }
  }, [periodList, trendPeriodIds]);

  // ── Trend fetch ────────────────────────────────────────────
  useEffect(() => {
    if (!organizationId) {
      setTrendData([]);
      setTrendError("");
      return;
    }
    if (!trendPeriodIds.length) {
      setTrendData([]);
      setTrendError("");
      return;
    }
    let cancelled = false;
    setTrendLoading(true);
    setTrendError("");
    getOutcomeTrends(trendPeriodIds)
      .then((data) => {
        if (cancelled) return;
        setTrendData(data);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e?.unauthorized) {
          setTrendError("Unauthorized. Please re-login.");
          return;
        }
        setTrendError("Could not load trend data.");
      })
      .finally(() => {
        if (cancelled) return;
        setTrendLoading(false);
      });
    return () => { cancelled = true; };
  }, [trendPeriodIds, organizationId, lastRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  return { trendData, trendLoading, trendError, trendPeriodIds, setTrendPeriodIds };
}
