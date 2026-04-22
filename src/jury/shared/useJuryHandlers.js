// src/jury/hooks/useJuryHandlers.js
// ============================================================
// Thin orchestrator that wires the three sub-hooks for jury
// handler logic. Preserves the original export shape consumed
// by useJuryState.js.
//
// Sub-hooks:
//   useJuryScoreHandlers     — score onChange/onBlur + comment handlers
//   useJurySessionHandlers   — identity, period, PIN, progress flow
//   useJuryLifecycleHandlers — navigation, submission, edit-mode, reset
//
// Utilities:
//   juryHandlerUtils         — deriveEffectiveCriteria, deriveOutcomeLookup
// ============================================================

import { useJuryScoreHandlers } from "./useJuryScoreHandlers";
import { useJurySessionHandlers } from "./useJurySessionHandlers";
import { useJuryLifecycleHandlers } from "./useJuryLifecycleHandlers";
import { deriveEffectiveCriteria, deriveOutcomeLookup } from "./juryHandlerUtils";

export function useJuryHandlers({
  identity,
  session,
  scoring,
  loading,
  workflow,
  editState,
  autosave,
  stateRef,
  setSubmitError,
}) {
  // Derive effective criteria: period config (if set) or static config fallback.
  const effectiveCriteria = deriveEffectiveCriteria(loading.criteriaConfig);
  const outcomeLookup = deriveOutcomeLookup(loading.outcomeConfig);

  const scoreHandlers = useJuryScoreHandlers({
    scoring,
    editState,
    autosave,
    effectiveCriteria,
  });

  const sessionHandlers = useJurySessionHandlers({
    identity,
    session,
    scoring,
    loading,
    workflow,
    editState,
    autosave,
    stateRef,
  });

  const lifecycleHandlers = useJuryLifecycleHandlers({
    identity,
    session,
    scoring,
    loading,
    workflow,
    editState,
    autosave,
    stateRef,
    effectiveCriteria,
    setSubmitError,
  });

  return {
    ...scoreHandlers,
    ...sessionHandlers,
    ...lifecycleHandlers,
    effectiveCriteria,
    outcomeLookup,
  };
}
