// Wire-shape schemas for audit-log-sink.
//
// Architecture spec § 3.5: every Edge Function owns a co-located schema.ts
// that is the single source of truth for its request and response shapes.
//
// Note: This is a webhook-only function with no request body validation.
// All responses return 200 (to prevent Supabase webhook retries).

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Response shape ────────────────────────────────────────────────────────
//
// All paths return 200 — failures communicated via ok: false and optional fields:
// 200 — { ok: boolean, skipped?: boolean, reason?: string, sink_status?: number, error?: string }

export const SuccessResponseSchema = z.object({
  ok: z.boolean(),
  skipped: z.boolean().optional(),
  reason: z.string().optional(),
  sink_status: z.number().optional(),
  error: z.string().optional(),
});

// Webhook-auth rejection (always 200 to prevent retry loops)
export const ValidationErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});

// Sink network/transport failure (always 200 to prevent retry loops)
export const InternalErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string().optional(),
  sink_status: z.number().optional(),
});

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
export type InternalErrorResponse = z.infer<typeof InternalErrorResponseSchema>;
