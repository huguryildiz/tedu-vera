// Wire-shape schemas for audit-anomaly-sweep.
//
// Architecture spec § 3.5: every Edge Function owns a co-located schema.ts
// that is the single source of truth for its request and response shapes.
//
// Note: This is a cron-only function with no request body validation.
// Authentication is via X-Cron-Secret header (checked in index.ts).

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Response shape ────────────────────────────────────────────────────────
//
// 200 — { checked: true, window_start: string, logs_scanned: number, anomalies: number, ... }
// 401 — { error: string }                           (bad cron secret)
// 500 — { error: string }                           (unhandled exception)

export const SuccessResponseSchema = z.object({
  checked: z.literal(true),
  window_start: z.string(),
  logs_scanned: z.number(),
  anomalies: z.number(),
  anomalies_skipped_dedup: z.number(),
  write_errors: z.number(),
  chain_ok: z.boolean(),
  chain_error: z.string().nullable(),
});

export const ValidationErrorResponseSchema = z.object({
  error: z.string(),
});

export const InternalErrorResponseSchema = z.object({
  error: z.string(),
});

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
export type InternalErrorResponse = z.infer<typeof InternalErrorResponseSchema>;
