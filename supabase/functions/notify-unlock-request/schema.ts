// Wire-shape schemas for notify-unlock-request.
//
// Architecture spec § 3.5: every Edge Function owns a co-located schema.ts
// that is the single source of truth for its request and response shapes.
// Both the function (server) and frontend wrappers (client) import from
// here, so a shape change shows up at compile time on whichever side does
// not consume the new schema.
//
// We use Zod for runtime validation. The same exported types serve double
// duty as TypeScript interfaces. Keeping the schemas small and focused on
// the public wire shape — not internal helpers — keeps the surface area
// small enough that Zod-parse cost is irrelevant.
//
// IMPORTANT: this schema is intentionally PERMISSIVE on optional metadata
// fields (period_name, organization_name, requester_name) because callers
// in the SQL wrapper occasionally fail to resolve them and pass null. The
// function tolerates that and falls back to safe defaults; the schema must
// match.

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Request payload ───────────────────────────────────────────────────────

const RequestSubmittedSchema = z.object({
  type: z.literal("request_submitted"),
  request_id: z.string(),
  period_id: z.string().optional(),
  period_name: z.string().nullable().optional(),
  organization_id: z.string().nullable().optional(),
  organization_name: z.string().nullable().optional(),
  requester_user_id: z.string().nullable().optional(),
  requester_name: z.string().nullable().optional(),
  reason: z.string().optional(),
});

const RequestResolvedSchema = z.object({
  type: z.literal("request_resolved"),
  request_id: z.string(),
  period_id: z.string().optional(),
  period_name: z.string().nullable().optional(),
  organization_id: z.string().nullable().optional(),
  organization_name: z.string().nullable().optional(),
  requester_user_id: z.string().nullable().optional(),
  requester_name: z.string().nullable().optional(),
  decision: z.enum(["approved", "rejected"]).optional(),
  review_note: z.string().nullable().optional(),
});

export const RequestPayloadSchema = z.discriminatedUnion("type", [
  RequestSubmittedSchema,
  RequestResolvedSchema,
]);

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;

// ── Response shape ────────────────────────────────────────────────────────
//
// 200 — { ok: true, sent: boolean, error?: string }
// 400 — { error: string }                          (validation failure)
// 500 — { ok: false, error: string }               (unhandled exception)

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
