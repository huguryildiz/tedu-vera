// Wire-shape schemas for log-export-event.
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Request shape ─────────────────────────────────────────────────────────
export const RequestPayloadSchema = z.object({
  action: z.string().refine(
    (val) => val.startsWith("export."),
    "action must start with 'export.'"
  ),
  organizationId: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});

// ── Response shapes ───────────────────────────────────────────────────────
export const SuccessResponseSchema = z.object({
  ok: z.literal(true),
});

export const ValidationErrorResponseSchema = z.object({
  error: z.string(),
});

export const InternalErrorResponseSchema = z.object({
  error: z.string(),
  details: z.string().optional(),
});

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
export type InternalErrorResponse = z.infer<typeof InternalErrorResponseSchema>;
