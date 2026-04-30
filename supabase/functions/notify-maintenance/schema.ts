// Wire-shape schemas for notify-maintenance.
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Request shape ─────────────────────────────────────────────────────────
export const RequestPayloadSchema = z.object({
  message: z.string().optional(),
  startTime: z.string().nullish(),
  endTime: z.string().nullish(),
  mode: z.string().optional(),
  affectedOrgIds: z.array(z.string()).nullish(),
  testRecipient: z.string().optional(),
});

// ── Response shapes ───────────────────────────────────────────────────────
export const SuccessResponseSchema = z.object({
  ok: z.literal(true),
  sent: z.number(),
  total: z.number().optional(),
  errors: z.array(z.string()).optional(),
  test: z.boolean().optional(),
  skipped: z.string().optional(),
});

export const ValidationErrorResponseSchema = z.object({
  error: z.string(),
});

export const InternalErrorResponseSchema = z.object({
  error: z.string(),
});

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
export type InternalErrorResponse = z.infer<typeof InternalErrorResponseSchema>;
