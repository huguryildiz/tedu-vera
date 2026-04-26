// Wire-shape schemas for admin-session-touch.
//
// Architecture spec § 3.5: every Edge Function owns a co-located schema.ts
// that is the single source of truth for its request and response shapes.

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Request payload ───────────────────────────────────────────────────────

export const RequestPayloadSchema = z.object({
  deviceId: z.string({ required_error: "deviceId is required" }),
  signedInAt: z.string().optional(),
  expiresAt: z.string().optional(),
  userAgent: z.string().optional(),
  browser: z.string().optional(),
  os: z.string().optional(),
  authMethod: z.string().optional(),
});

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;

// ── Response shape ────────────────────────────────────────────────────────
//
// 200 — { ok: true, session: <session row object> }
// 400 — { error: string }                           (missing deviceId)
// 401 — { error: string }                           (auth failure)
// 500 — { error: string }                           (unhandled exception)

export const SuccessResponseSchema = z.object({
  ok: z.literal(true),
  session: z.record(z.unknown()),
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
