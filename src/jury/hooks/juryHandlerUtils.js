// src/jury/hooks/juryHandlerUtils.js
// ============================================================
// Tiny utility that derives effectiveCriteria and outcomeLookup
// from period configurations. Used by the useJuryHandlers orchestrator
// and individual sub-hooks that need criteria information.
// ============================================================

import { getActiveCriteria, buildOutcomeLookup } from "../../shared/criteriaHelpers";

export function deriveEffectiveCriteria(criteriaConfig) {
  return getActiveCriteria(criteriaConfig);
}

export function deriveOutcomeLookup(outcomeConfig) {
  return buildOutcomeLookup(outcomeConfig);
}
