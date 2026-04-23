// src/types/criteria.d.ts
// Type definitions for evaluation criteria domain shapes.

/** A single rubric band defining a score range and description. */
export interface RubricBand {
  level: string;
  min: number | string;
  max: number | string;
  desc: string;
  range?: string;
}

/** A criterion as stored in config.js (static seed). */
export interface Criterion {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  outcomes: string[];
  max: number;
  blurb: string;
  rubric: RubricBand[];
}

/** A criterion as stored in period criteria_template JSONB. */
export interface CriterionTemplate {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  max: number;
  blurb: string;
  outcomes: string[];
  mudek_outcomes?: string[];
  rubric: RubricBand[];
}

/** The full criteria template array stored per period. */
export type CriteriaTemplate = CriterionTemplate[];

/** An outcome definition. */
export interface OutcomeDefinition {
  id: string;
  code: string;
  desc_en?: string;
  desc_tr?: string;
}

/** Internal form row shape used by CriteriaManager editor. */
export interface CriterionRow {
  _id: string;
  _key: string;
  label: string;
  shortLabel: string;
  color: string;
  max: string;
  blurb: string;
  outcomes: string[];
  rubric: RubricBand[];
  _expanded: boolean;
  _outcomeOpen: boolean;
  _rubricOpen: boolean;
  _rubricTouched: boolean;
  _fieldTouched: Record<string, boolean>;
}
