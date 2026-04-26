// Wire-shape schemas for on-auth-event.
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Response shape ────────────────────────────────────────────────────────
export const SuccessResponseSchema = z.object({
  ok: z.boolean(),
  action: z.string().optional(),
  skipped: z.boolean().optional(),
  error: z.string().optional(),
});

// Webhook-auth rejection or payload parse error (always 200 to prevent retry loops)
export const ValidationErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});

// Audit insert failure or unexpected error (always 200 to prevent retry loops)
export const InternalErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
export type InternalErrorResponse = z.infer<typeof InternalErrorResponseSchema>;
