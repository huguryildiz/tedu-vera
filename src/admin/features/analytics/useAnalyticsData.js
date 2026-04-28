// src/admin/hooks/useAnalyticsData.js
// ============================================================
// Manages trend / analytics data for the admin panel.
//
// Owns: trendPeriodIds selection (with localStorage persistence),
// stale-ID cleanup when periodList changes, and two trend fetches:
//   - trendData: criterion-level averages (for AttainmentTrendChart)
//   - outcomeTrendData: outcome-level attainment + avg (for OutcomeAttainmentTrendChart)
// ============================================================

import { useEffect, useRef, useState } from "react";
import { getOutcomeTrends, getOutcomeAttainmentTrends } from "@/shared/api";
import { readSection, writeSection } from "@/admin/utils/persist";

/**
 * useAnalyticsData — trend/analytics loading for the admin panel.
 *
 * @param {object} opts
 * @param {string}    opts.organizationId         Current organization ID (JWT-based auth).
 * @param {object[]}  opts.periodList             Full period list (for stale-ID cleanup).
 * @param {object[]}  opts.sortedPeriods         Sorted periods (for initial seed).
 * @param {Date|null} opts.lastRefresh           Bumped by useAdminData after a fresh fetch.
 *
 * @returns {{
 *   trendData: object[],
 *   trendLoading: boolean,
 *   trendError: string,
 *   outcomeTrendData: object[],
 *   outcomeTrendLoading: boolean,
 *   outcomeTrendError: string,
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

  const [outcomeTrendData, setOutcomeTrendData] = useState([]);
  const [outcomeTrendLoading, setOutcomeTrendLoading] = useState(false);
  const [outcomeTrendError, setOutcomeTrendError] = useState("");

  const trendInitRef = useRef(false);

  // ── Trend initialization ──────────────────────────────────
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

  // ── Criterion trend fetch (existing) ────────────────────────
  useEffect(() => {
    if (!organizationId || !trendPeriodIds.length) {
      setTrendData([]);
      setTrendError("");
      return;
    }
    let cancelled = false;
    setTrendLoading(true);
    setTrendError("");
    getOutcomeTrends(trendPeriodIds)
      .then((data) => { if (!cancelled) setTrendData(data); })
      .catch((e) => {
        if (cancelled) return;
        setTrendError(e?.unauthorized ? "Unauthorized. Please re-login." : "Failed to load trend data.");
      })
      .finally(() => { if (!cancelled) setTrendLoading(false); });
    return () => { cancelled = true; };
  }, [trendPeriodIds, organizationId, lastRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Outcome trend fetch (new) ────────────────────────────────
  useEffect(() => {
    if (!organizationId || !trendPeriodIds.length) {
      setOutcomeTrendData([]);
      setOutcomeTrendError("");
      return;
    }
    let cancelled = false;
    setOutcomeTrendLoading(true);
    setOutcomeTrendError("");
    getOutcomeAttainmentTrends(trendPeriodIds)
      .then((data) => { if (!cancelled) setOutcomeTrendData(data); })
      .catch((e) => {
        if (cancelled) return;
        setOutcomeTrendError(e?.unauthorized ? "Unauthorized. Please re-login." : "Failed to load outcome trend data.");
      })
      .finally(() => { if (!cancelled) setOutcomeTrendLoading(false); });
    return () => { cancelled = true; };
  }, [trendPeriodIds, organizationId, lastRefresh]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    trendData,
    trendLoading,
    trendError,
    outcomeTrendData,
    outcomeTrendLoading,
    outcomeTrendError,
    trendPeriodIds,
    setTrendPeriodIds,
  };
}
