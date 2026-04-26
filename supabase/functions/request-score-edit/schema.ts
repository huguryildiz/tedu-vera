// Wire-shape schemas for request-score-edit.
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Request payload ───────────────────────────────────────────────────────
export const RequestPayloadSchema = z.object({
  periodId: z.string({ required_error: "Missing required fields" }).min(1, "periodId required"),
  jurorName: z.string({ required_error: "Missing required fields" }).min(1, "jurorName required"),
  sessionToken: z.string({ required_error: "Missing required fields" }).min(1, "sessionToken required"),
  affiliation: z.string().optional(),
});
export type RequestPayload = z.infer<typeof RequestPayloadSchema>;

// ── Response shapes ───────────────────────────────────────────────────────
export const SuccessResponseSchema = z.object({
  ok: z.literal(true),
  sent: z.boolean(),
  error: z.string().optional(),
});
export const ValidationErrorResponseSchema = z.object({
  error: z.string(),
});
export const InternalErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
export type InternalErrorResponse = z.infer<typeof InternalErrorResponseSchema>;
