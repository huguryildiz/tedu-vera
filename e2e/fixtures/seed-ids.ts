/**
 * Canonical source of hardcoded UUIDs shared across E2E specs.
 * All IDs here refer to rows in the demo Supabase database.
 * Edit this file (not individual specs) when demo seed changes.
 */

// ── Organizations ──────────────────────────────────────────────────────────
/** Main demo org used for rankings, periods, tenant-admin, tenant-application tests */
export const E2E_PERIODS_ORG_ID = "b2c3d4e5-f6a7-8901-bcde-f12345678901";

/** Second org used for projects import, cross-tenant isolation probes */
export const E2E_PROJECTS_ORG_ID = "c3d4e5f6-a7b8-9012-cdef-123456789012";

/** Org with a 3-state period lifecycle (published → open → closed) */
export const E2E_LIFECYCLE_ORG_ID = "d4e5f6a7-b8c9-0123-def0-234567890123";

/** Org used for setup-wizard tests (setup_completed_at = null) */
export const E2E_WIZARD_ORG_ID = "e5f6a7b8-c9d0-1234-ef01-345678901234";

/** Demo org ID (same as E2E_PERIODS_ORG_ID; kept as alias for clarity in tenant-application tests) */
export const DEMO_ORG_ID = E2E_PERIODS_ORG_ID;

/** Org used by criteria / pin-blocking / outcomes tests (f7340e37 org) */
export const E2E_CRITERIA_ORG_ID = "f7340e37-9349-4210-8d6b-073a5616bf49";

// ── Evaluation periods ──────────────────────────────────────────────────────
/** Active evaluation period for jury evaluate tests */
export const EVAL_PERIOD_ID = "a0d6f60d-ece4-40f8-aca2-955b4abc5d88";

/** Period used by criteria + pin-blocking tests */
export const E2E_CRITERIA_PERIOD_ID = "cccccccc-0004-4000-c000-000000000004";

/** Period used by outcomes tests */
export const E2E_OUTCOMES_PERIOD_ID = "cccccccc-0005-4000-c000-000000000005";

// ── Jurors ──────────────────────────────────────────────────────────────────
export const EVAL_JURORS = [
  { id: "b3aa250b-3049-4788-9c68-5fa0e8aec86a", name: "E2E Eval Render" },
  { id: "bbbbbbbb-e2e0-4000-b000-000000000001", name: "E2E Eval Blur" },
  { id: "bbbbbbbb-e2e0-4000-b000-000000000002", name: "E2E Eval Submit" },
] as const;

/** Juror used to test PIN lockout in pin-blocking spec */
export const LOCKED_JUROR_ID = "eeeeeeee-0001-4000-e000-000000000001";

// ── Entry tokens ────────────────────────────────────────────────────────────
export const E2E_ENTRY_TOKEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
