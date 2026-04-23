// src/types/jury.d.ts
// Type definitions for jury evaluation flow shapes.

/** The sequential steps in the jury evaluation workflow. */
export type JuryStep =
  | "identity"
  | "period"
  | "pin"
  | "pin_reveal"
  | "progress_check"
  | "eval"
  | "done";

/** Juror identity entered at the identity step. */
export interface JurorIdentity {
  juryName: string;
  juryDept: string;
}

/** Juror session state after PIN verification. */
export interface JurorSession {
  jurorId: string | null;
  jurorSessionToken: string | null;
  issuedPin: string | null;
}

/** Progress check state for in-progress or completed sessions. */
export interface ProgressCheck {
  hasInProgress: boolean;
  hasCompleted: boolean;
  completedCount: number;
  totalCount: number;
}

/** A project as seen in the jury evaluation flow. */
export interface JuryProject {
  id: string;
  group_no: string;
  project_title: string;
  group_students: string;
}
