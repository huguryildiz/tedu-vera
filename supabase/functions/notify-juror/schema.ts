// Wire-shape schemas for notify-juror.
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Request shape ─────────────────────────────────────────────────────────
export const RequestPayloadSchema = z.object({
  juror_id: z.string({ required_error: "juror_id and period_id are required" }).min(1, "juror_id and period_id are required"),
  period_id: z.string({ required_error: "juror_id and period_id are required" }).min(1, "juror_id and period_id are required"),
});

// ── Response shapes ───────────────────────────────────────────────────────
export const SuccessResponseSchema = z.object({
  ok: z.literal(true),
  sent: z.literal(true),
});

export const ValidationErrorResponseSchema = z.object({
  error: z.string(),
});

export const InternalErrorResponseSchema = z.object({
  ok: z.literal(false),
  sent: z.literal(false),
  error: z.string(),
});

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
export type InternalErrorResponse = z.infer<typeof InternalErrorResponseSchema>;
