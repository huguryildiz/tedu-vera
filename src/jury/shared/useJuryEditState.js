// src/jury/hooks/useJuryEditState.js
// ============================================================
// Owns edit mode and period lock state, and the polling
// effect that keeps lock status fresh during evaluation.
//
// State:
//   editMode      — true while the juror is re-editing after finalization
//   editAllowed   — true when the DB allows the juror to re-edit
//   editLockActive — true when the period is locked (blocks all writes)
//
// The polling effect runs every 10s during "eval" and every 15s during
// "done". It calls getJurorEditState with the current session token.
// If the session has expired the call fails silently (the next write attempt
// will surface the error via writeGroup's error path).
//
// Parameters (from orchestrator):
//   step               — current step name ("eval"|"done"|…)
//   jurorId            — UUID
//   periodId           — UUID
//   jurorSessionToken  — current session token
// ============================================================

import { useState, useEffect } from "react";
import { getJurorEditState } from "../../shared/api";

export function useJuryEditState({ step, jurorId, periodId, jurorSessionToken }) {
  const [editMode, setEditMode] = useState(false);
  const [editAllowed, setEditAllowed] = useState(false);
  const [editLockActive, setEditLockActive] = useState(false);

  useEffect(() => {
    if ((step !== "done" && step !== "eval") || !jurorId || !periodId) return;
    let alive = true;
    const refreshEditState = async () => {
      try {
        const editState = await getJurorEditState(periodId, jurorId, jurorSessionToken);
        if (!alive) return;
        if (step === "done") setEditAllowed(!!editState?.edit_allowed);
        setEditLockActive(!!editState?.lock_active);
      } catch {}
    };

    refreshEditState();
    const timer = setInterval(refreshEditState, step === "eval" ? 10000 : 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [step, jurorId, periodId, jurorSessionToken]);

  return {
    editMode, setEditMode,
    editAllowed, setEditAllowed,
    editLockActive, setEditLockActive,
  };
}
