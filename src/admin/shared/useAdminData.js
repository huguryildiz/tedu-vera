// src/admin/hooks/useAdminData.js
// ============================================================
// Manages admin data fetching and details view lazy-loading.
//
// Extracted from AdminPanel.jsx (Phase 4 — Admin Layer Decomposition).
// Phase 5: Realtime subscription extracted to useAdminRealtime.js;
// trend/analytics loading extracted to useAnalyticsData.js.
//
// sortedPeriods is returned from this hook (not AdminPanel.jsx)
// because it is derived purely from periodList state, which lives
// here. All other derived useMemo values (groups, ranked, etc.)
// remain in AdminPanel.jsx because they are tightly coupled to the
// rendering layer and use data from multiple sources.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  getScores,
  listJurorsSummary,
  listPeriods,
  getProjectSummary,
} from "../../shared/api";
import { sortPeriodsByStartDateDesc } from "../../shared/periodSort";
import { pickDefaultPeriod } from "../../jury/shared/periodSelection";
import { useAdminRealtime } from "./useAdminRealtime";

// Routes that display score data. The score-cluster Realtime channel is only
// opened on these. Keeps the high-frequency `score_sheet_items` WS stream from
// running on settings/jurors/periods/orgs pages during live jury days.
const SCORES_ACTIVE_PATHS = new Set([
  "overview",
  "rankings",
  "heatmap",
  "analytics",
  "reviews",
  "outcomes",
  "entry-control",
  "pin-blocking",
]);

const isScoresActivePath = (pathname) => {
  const last = String(pathname || "").split("/").filter(Boolean).pop() || "";
  return SCORES_ACTIVE_PATHS.has(last);
};

// Module-scoped cache for the details view. Scores are large; re-fetching
// every period on every tab switch is wasteful. Entries are invalidated
// per-period when the main view's rawScores changes for that period.
// Key: `${organizationId}:${periodId}` → { scores, summary }
const detailsCache = new Map();
const detailsKeyFor = (orgId, periodId) => `${orgId}:${periodId}`;

// ── Hook ──────────────────────────────────────────────────────

/**
 * useAdminData — data fetching and details view lazy-loading.
 *
 * Realtime subscription is delegated to useAdminRealtime.
 * Trend/analytics loading is delegated to useAnalyticsData.
 *
 * @param {object} opts
 * @param {string}   opts.organizationId             Current organization ID for scoping admin queries.
 * @param {string}   opts.selectedPeriodId           Controlled by AdminPanel (UI state).
 * @param {Function} opts.onSelectedPeriodChange     Setter for selectedPeriodId in AdminPanel.
 * @param {Function} [opts.onAuthError]             Called on auth failure during initial load.
 * @param {Function} [opts.onInitialLoadDone]       Called once after the first successful fetch.
 * @param {string}   opts.scoresView                Current scores view; used to gate details fetch.
 *
 * @returns {{
 *   rawScores: object[],
 *   summaryData: object[],
 *   allJurors: object[],
 *   periodList: object[],
 *   sortedPeriods: object[],
 *   trendData: object[],
 *   trendLoading: boolean,
 *   trendError: string,
 *   trendPeriodIds: string[],
 *   setTrendPeriodIds: Function,
 *   detailsScores: object[],
 *   detailsSummary: object[],
 *   detailsLoading: boolean,
 *   loading: boolean,
 *   loadError: string,
 *   authError: string,
 *   lastRefresh: Date | null,
 *   fetchData: (forcePeriodId?: string) => Promise<void>,
 * }}
 */
export function useAdminData({
  organizationId,
  selectedPeriodId,
  onSelectedPeriodChange,
  onAuthError,
  onInitialLoadDone,
  scoresView,
}) {
  // ── Core data state ────────────────────────────────────────
  const [rawScores, setRawScores] = useState([]);
  const [summaryData, setSummaryData] = useState([]);
  const [allJurors, setAllJurors] = useState([]);
  const [periodList, setPeriodList] = useState([]);

  // ── Details view state (all-periods lazy load) ──────────
  const [detailsScores, setDetailsScores] = useState([]);
  const [detailsSummary, setDetailsSummary] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const detailsKeyRef = useRef("");

  // ── Loading / error state ──────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadError, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [lastRefresh, setLastRefresh] = useState(null);

  // ── Refs for async closures ────────────────────────────────
  // organizationIdRef: always reflects the latest organizationId without re-creating
  // callbacks on every change.
  const organizationIdRef = useRef(organizationId);
  useEffect(() => { organizationIdRef.current = organizationId; }, [organizationId]);

  // selectedPeriodRef: latest selection without stale closure risk.
  const selectedPeriodRef = useRef(selectedPeriodId);
  useEffect(() => { selectedPeriodRef.current = selectedPeriodId; }, [selectedPeriodId]);

  // initialLoadFiredRef: ensures onInitialLoadDone is called exactly once.
  const initialLoadFiredRef = useRef(false);

  // bgRefresh: mutable ref holding the background-refresh callback.
  // Passed to useAdminRealtime so the subscription stays stable.
  const bgRefresh = useRef(null);
  const fetchSeqRef = useRef(0);

  // ── sortedPeriods ─────────────────────────────────────────
  // Derived from periodList (owned here). Returned to AdminPanel so
  // it can pass it to PeriodDropdown and the details fetch key.
  const sortedPeriods = useMemo(
    () => sortPeriodsByStartDateDesc(periodList),
    [periodList]
  );

  // ── fetchData ──────────────────────────────────────────────
  // Stable via useCallback; all mutable reads go through refs so the
  // dependency array only includes the stable prop callbacks.
  const fetchData = useCallback(async (forcePeriodId) => {
    const seq = ++fetchSeqRef.current;
    const isLatest = () => seq === fetchSeqRef.current;
    if (forcePeriodId) selectedPeriodRef.current = forcePeriodId;
    setLoading(true);
    setError("");
    try {
      if (!organizationIdRef.current) {
        if (!isLatest()) return;
        // Organization not yet resolved (e.g. super-admin initial load).
        // Release the initial overlay; the effect re-triggers when organization resolves.
        if (!initialLoadFiredRef.current) {
          initialLoadFiredRef.current = true;
          onInitialLoadDone?.();
        }
        return;
      }

      // Always refresh period list (IDs change after reseed).
      // Uses the v2 organization-scoped RPC for server-side filtering.
      let periods = await listPeriods(organizationIdRef.current);
      if (!isLatest()) return;
      setPeriodList(periods);

      // Determine target period
      const activeId = pickDefaultPeriod(periods)?.id || "";
      const selectedId = selectedPeriodRef.current;
      const selectedIsValid = !!selectedId && periods.some((p) => p.id === selectedId);
      const targetId =
        forcePeriodId ||
        (selectedIsValid ? selectedId : "") ||
        activeId ||
        periods[0]?.id;

      if (!targetId) {
        if (!isLatest()) return;
        setRawScores([]);
        setSummaryData([]);
        setAllJurors([]);
        onSelectedPeriodChange(null);
        setLoading(false);
        return;
      }
      selectedPeriodRef.current = targetId;
      onSelectedPeriodChange(targetId);

      // Fetch scores + summary + juror list in parallel.
      // listJurorsSummary is non-fatal: degrades gracefully if RPC not yet deployed.
      const [scores, summary, jurors] = await Promise.all([
        getScores(targetId),
        getProjectSummary(targetId),
        listJurorsSummary(targetId).catch(() => []),
      ]);
      if (!isLatest()) return;

      setRawScores(scores);
      setSummaryData(summary);
      setAllJurors(jurors);
      setLastRefresh(new Date());
      setAuthError("");

      if (!initialLoadFiredRef.current) {
        initialLoadFiredRef.current = true;
        onInitialLoadDone?.();
      }
    } catch (e) {
      if (!isLatest()) return;
      if (e.unauthorized) {
        if (onAuthError) { onAuthError("Invalid password"); return; }
        setAuthError("Incorrect password.");
        return;
      }
      setError("Failed to load data. Check your connection and try refreshing.");
      setRawScores([]);
      setSummaryData([]);
      if (!initialLoadFiredRef.current) {
        initialLoadFiredRef.current = true;
        onInitialLoadDone?.();
      }
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [onSelectedPeriodChange, onAuthError, onInitialLoadDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch data when organization is available; re-fetch when organization changes.
  // Super-admin: organizationId starts as "" (resolves after AuthProvider
  // processes memberships). When empty, clear loading so the UI isn't
  // stuck behind loading indicators while the organization resolves.
  useEffect(() => {
    if (organizationId) {
      fetchData();
    } else {
      // No organization yet — release loading indicators so the UI isn't
      // stuck. fetchData will run once organizationId becomes available.
      setLoading(false);
      if (!initialLoadFiredRef.current) {
        initialLoadFiredRef.current = true;
        onInitialLoadDone?.();
      }
    }
  }, [organizationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Failsafe for first paint: release the App-level initial overlay even if
  // initial network/auth requests hang and never resolve.
  useEffect(() => {
    if (!loading) return;
    if (initialLoadFiredRef.current) return;
    const t = setTimeout(() => {
      if (initialLoadFiredRef.current) return;
      initialLoadFiredRef.current = true;
      onInitialLoadDone?.();
    }, 5000);
    return () => clearTimeout(t);
  }, [loading, onInitialLoadDone]);

  // ── Background (silent) refresh ────────────────────────────
  // Assigned each render so the Realtime hook always calls the latest
  // closure without needing to rebuild the subscription.
  //
  // Accepts a list of tables that fired events so we can refetch only
  // the affected slices instead of always firing all three RPCs.
  bgRefresh.current = async (changedTables = []) => {
    if (!organizationIdRef.current) return;
    const seq = fetchSeqRef.current;
    const isLatest = () => seq === fetchSeqRef.current;
    const all = !changedTables || changedTables.length === 0;
    const touched = new Set(changedTables);
    const needPeriods  = all || touched.has("periods");
    const needScores   = all || touched.has("score_sheets") || touched.has("score_sheet_items");
    const needSummary  = all || touched.has("score_sheets") || touched.has("score_sheet_items") || touched.has("projects");
    const needJurors   = all || touched.has("juror_period_auth") || touched.has("jurors");
    try {
      // Always need an up-to-date period list for targetId resolution when
      // scores/summary/jurors need a refresh (a deleted period invalidates
      // the current selection). When only jurors or periods changed, we can
      // skip the explicit list fetch in the score branch since we fall into
      // the needPeriods path below.
      let periods = null;
      if (needPeriods || needScores || needSummary || needJurors) {
        periods = await listPeriods(organizationIdRef.current);
        if (!isLatest()) return;
        setPeriodList(periods);
      }
      if (!periods) return;

      const activeId = pickDefaultPeriod(periods)?.id || "";
      const selectedId = selectedPeriodRef.current;
      const selectedIsValid = !!selectedId && periods.some((p) => p.id === selectedId);
      const periodId = selectedIsValid ? selectedId : activeId;
      if (!periodId) return;
      if (periodId !== selectedId) {
        onSelectedPeriodChange(periodId);
      }
      selectedPeriodRef.current = periodId;

      const tasks = [];
      tasks.push(needScores  ? getScores(periodId)              : Promise.resolve(null));
      tasks.push(needSummary ? getProjectSummary(periodId)      : Promise.resolve(null));
      tasks.push(needJurors  ? listJurorsSummary(periodId).catch(() => []) : Promise.resolve(null));
      const [scores, summary, jurors] = await Promise.all(tasks);
      if (!isLatest()) return;

      if (scores  !== null) setRawScores(scores);
      if (summary !== null) setSummaryData(summary);
      if (jurors  !== null) setAllJurors(jurors);
      setLastRefresh(new Date());
    } catch {
      // Silent — don't flash error on background sync
    }
  };

  // ── Realtime subscription (delegated) ─────────────────────
  // Scope narrowed to score-cluster tables only. Gated by current route so
  // the WS channel is not opened on non-score admin pages.
  const location = useLocation();
  const scoresActive = isScoresActivePath(location.pathname);
  useAdminRealtime({ organizationId, onRefreshRef: bgRefresh, enabled: scoresActive });

  // ── Details invalidation ───────────────────────────────────
  // When rawScores changes, invalidate only the cache entry for the
  // currently selected period (the one the main view was displaying),
  // not every period. This keeps other periods warm across tab switches.
  useEffect(() => {
    const orgId = organizationIdRef.current;
    const periodId = selectedPeriodRef.current;
    if (!orgId || !periodId) return;
    detailsCache.delete(detailsKeyFor(orgId, periodId));
    detailsKeyRef.current = "";
  }, [rawScores]);

  // ── Details fetch (lazy, triggered by scoresView === "details") ─
  const detailsKey = useMemo(
    () => sortedPeriods.map((p) => p.id).join("|"),
    [sortedPeriods]
  );

  useEffect(() => {
    if (scoresView !== "details") return;
    if (!sortedPeriods.length) return;
    const orgId = organizationIdRef.current;
    if (!orgId) return;
    if (detailsKeyRef.current === detailsKey && detailsScores.length) return;
    let cancelled = false;
    setDetailsLoading(true);
    (async () => {
      try {
        // Per-period cache: only fetch what we don't already have.
        // Fetch missing periods in parallel; hits come back instantly.
        const results = await Promise.all(
          sortedPeriods.map(async (period) => {
            const cacheKey = detailsKeyFor(orgId, period.id);
            let cached = detailsCache.get(cacheKey);
            if (!cached) {
              const [scores, summary] = await Promise.all([
                getScores(period.id),
                getProjectSummary(period.id).catch(() => []),
              ]);
              cached = { scores, summary };
              detailsCache.set(cacheKey, cached);
            }
            const summaryMap = new Map(cached.summary.map((p) => [p.id, p]));
            const rows = cached.scores.map((r) => ({
              ...r,
              period: period.name || "",
              students: summaryMap.get(r.projectId)?.students ?? "",
            }));
            return { rows, summary: cached.summary };
          })
        );
        if (cancelled) return;
        setDetailsScores(results.flatMap((r) => r.rows));
        setDetailsSummary(results.flatMap((r) => r.summary));
        detailsKeyRef.current = detailsKey;
      } catch {
        if (!cancelled) {
          setDetailsScores([]);
          setDetailsSummary([]);
        }
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scoresView, detailsKey, sortedPeriods, detailsScores.length, rawScores]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    rawScores,
    summaryData,
    allJurors,
    periodList,
    sortedPeriods,
    detailsScores,
    detailsSummary,
    detailsLoading,
    loading,
    loadError,
    authError,
    lastRefresh,
    fetchData,
    // Exposed so pages (via useAdminContext) can trigger a selective refresh
    // after their own Realtime subscriptions fire (jurors, periods, …).
    bgRefresh,
  };
}
