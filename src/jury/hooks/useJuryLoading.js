// src/jury/hooks/useJuryLoading.js
// ============================================================
// Owns period/project loading state and the abort/lock refs
// that protect in-flight requests.
//
// State:
//   loadingState         — null | { stage: "loading"|"error", message: string }
//   periods              — active period list (from listPeriods)
//   periodId             — selected period UUID
//   periodName           — selected period display name
//   criteriaConfig       — criteria_config from the selected period ([])
//   currentPeriodInfo    — result of getCurrentPeriod() (for landing page)
//   activeProjectCount   — project count in the active period (landing page)
//   progressCheck        — null | progress data for SheetsProgressDialog
//   projects             — current project list for eval step
//
// Refs:
//   loadAbortRef         — AbortController for active data-load; replaced on
//                          each new _loadPeriod or listPeriods call so
//                          stale in-flight fetches are cancelled.
//   periodSelectLockRef  — Prevents concurrent period selections (e.g. double-
//                          tap). Intentionally NOT reset on success: once the
//                          juror advances past period selection the lock is
//                          permanent for the session. Only reset on error or
//                          on resetAll().
//
// The _loadPeriod function itself lives in the orchestrator because it writes
// to state owned by multiple hooks (scoring, editState, workflow, identity).
//
// The on-mount useEffect that fetches currentPeriodInfo lives here because
// all its state is owned by this hook.
// ============================================================

import { useState, useEffect, useRef } from "react";
import { getCurrentPeriod, listProjects, listPeriods, verifyEntryToken } from "../../shared/api";
import { getJuryAccess } from "../../shared/storage";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
const DEMO_ENTRY_TOKEN = import.meta.env.VITE_DEMO_ENTRY_TOKEN || "";

export function useJuryLoading() {
  const [loadingState, setLoadingState] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [periodId, setPeriodId] = useState("");
  const [periodName, setPeriodName] = useState("");
  const [criteriaConfig, setCriteriaConfig] = useState([]);
  const [outcomeConfig, setOutcomeConfig] = useState([]);
  const [currentPeriodInfo, setCurrentPeriodInfo] = useState(null);
  const [activeProjectCount, setActiveProjectCount] = useState(null);
  const [progressCheck, setProgressCheck] = useState(null);
  const [projects, setProjects] = useState([]);

  const loadAbortRef = useRef(null);
  const periodSelectLockRef = useRef(false);

  // Fetch the active period info on mount for the landing page display.
  // This effect is independent of all other state and can safely live here.
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const run = async () => {
      try {
        // Demo mode: resolve period via entry token so demo tenant is always shown.
        if (DEMO_MODE && DEMO_ENTRY_TOKEN) {
          const tokenRes = await verifyEntryToken(DEMO_ENTRY_TOKEN);
          if (!alive) return;
          if (tokenRes?.ok && tokenRes?.period_id) {
            const periods = await listPeriods(ctrl.signal);
            if (!alive) return;
            const res = (periods || []).find((p) => p.id === tokenRes.period_id) || null;
            setCurrentPeriodInfo(res);
            if (res?.id) {
              try {
                const projectList = await listProjects(res.id, null, ctrl.signal);
                if (!alive) return;
                setActiveProjectCount(projectList.length);
              } catch (e) {
                if (e?.name === "AbortError") return;
                if (alive) setActiveProjectCount(null);
              }
            }
            return;
          }
        }

        const grantedPeriodId = getJuryAccess();
        let res = await getCurrentPeriod(ctrl.signal, grantedPeriodId);
        if (!res && grantedPeriodId) {
          const periods = await listPeriods(ctrl.signal);
          res = (periods || []).find((p) => p.id === grantedPeriodId) || null;
        }
        if (!alive) return;
        setCurrentPeriodInfo(res || null);
        if (res?.id) {
          try {
            const projectList = await listProjects(res.id, null, ctrl.signal);
            if (!alive) return;
            setActiveProjectCount(projectList.length);
          } catch (e) {
            if (e?.name === "AbortError") return;
            if (alive) setActiveProjectCount(null);
          }
        } else {
          setActiveProjectCount(null);
        }
      } catch (e) {
        if (e?.name === "AbortError") return;
        if (alive) setActiveProjectCount(null);
      }
    };
    run();
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, []);

  return {
    loadingState, setLoadingState,
    periods, setPeriods,
    periodId, setPeriodId,
    periodName, setPeriodName,
    criteriaConfig, setCriteriaConfig,
    outcomeConfig, setOutcomeConfig,
    currentPeriodInfo,
    activeProjectCount, setActiveProjectCount,
    progressCheck, setProgressCheck,
    projects, setProjects,
    loadAbortRef,
    periodSelectLockRef,
  };
}
