// Wire-shape schemas for password-reset-email.
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Request payload ───────────────────────────────────────────────────────
export const RequestPayloadSchema = z.object({
  email: z.string({ required_error: "A valid email is required." }).email("A valid email is required."),
});

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;

// ── Response shape ────────────────────────────────────────────────────────
export const SuccessResponseSchema = z.object({
  ok: z.literal(true),
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
