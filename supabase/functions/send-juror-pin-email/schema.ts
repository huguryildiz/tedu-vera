// Wire-shape schemas for send-juror-pin-email.
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Request payload ───────────────────────────────────────────────────────
export const RequestPayloadSchema = z.object({
  recipientEmail: z.string().min(1, "recipientEmail required"),
  jurorName: z.string().min(1, "jurorName required"),
  pin: z.string({ required_error: "Missing required fields" }).min(1, "Missing required fields"),
  jurorAffiliation: z.string().optional(),
  tokenUrl: z.string().optional(),
  periodName: z.string().optional(),
  organizationName: z.string().optional(),
  organizationId: z.string().optional(),
  jurorId: z.string().optional(),
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
  error: z.string(),
});

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
export type InternalErrorResponse = z.infer<typeof InternalErrorResponseSchema>;
