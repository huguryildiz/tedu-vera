// Wire-shape schemas for send-entry-token-email.
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Request payload ───────────────────────────────────────────────────────
export const RequestPayloadSchema = z.object({
  recipientEmail: z.string({ required_error: "Missing required fields" }).min(1, "Missing required fields"),
  tokenUrl: z.string({ required_error: "Missing required fields" }).min(1, "Missing required fields"),
  expiresIn: z.string().optional(),
  periodName: z.string().optional(),
  organizationName: z.string().optional(),
  organizationInstitution: z.string().optional(),
  organizationId: z.string().optional(),
  periodId: z.string().optional(),
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
