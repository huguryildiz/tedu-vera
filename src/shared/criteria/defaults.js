// src/shared/criteria/defaults.js
// ============================================================
// Seed builders for criteria_config and outcome_config.
// Used when creating a new evaluation period.
// ============================================================

import { CRITERIA, MUDEK_OUTCOMES } from "../../config";
import { _codeToId } from "./criteriaHelpers";

/**
 * Build the default `criteria_config` seed array from config.
 * Used when creating a new evaluation period. Includes the full rich shape
 * (shortLabel, color, blurb, mudek, rubric) + legacy compat fields.
 */
export function defaultCriteriaConfig() {
  return CRITERIA.map((c) => ({
    key:            c.id,
    label:          c.label,
    shortLabel:     c.shortLabel ?? c.label,
    color:          c.color ?? "#94A3B8",
    max:            c.max,
    blurb:          c.blurb ?? "",
    mudek:          c.mudek ?? [],                    // primary
    mudek_outcomes: (c.mudek || []).map(_codeToId),   // legacy compat
    rubric:         c.rubric ?? [],
  }));
}

/**
 * Build the default `outcome_config` seed array from config.
 * Used when creating a new evaluation period.
 */
export function defaultOutcomeConfig() {
  return Object.entries(MUDEK_OUTCOMES).map(([code, desc]) => ({
    id:      _codeToId(code),
    code,
    desc_en: desc.en,
    desc_tr: desc.tr,
  }));
}
