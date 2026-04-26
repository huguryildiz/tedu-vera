// Wire-shape schemas for email-verification-confirm.
//
// Architecture spec § 3.5: every Edge Function owns a co-located schema.ts
// that is the single source of truth for its request and response shapes.

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Request payload ───────────────────────────────────────────────────────

export const RequestPayloadSchema = z.object({
  token: z.string({ required_error: "token is required and must be a string", invalid_type_error: "token is required and must be a string" }),
});

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;

// ── Response shape ────────────────────────────────────────────────────────
//
// 200 — { ok: true }
// 400 — { error: string }                           (invalid token format, missing token, invalid JSON)
// 404 — { error: string }                           (token not found)
// 410 — { error: string }                           (token already used or expired)
// 500 — { error: string }                           (unhandled exception)

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
