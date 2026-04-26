// Wire-shape schemas for platform-metrics.
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Response shape ────────────────────────────────────────────────────────
export const SuccessResponseSchema = z.object({
  db_size_bytes: z.number(),
  db_size_pretty: z.string(),
  active_connections: z.number(),
  audit_requests_24h: z.number(),
  total_organizations: z.number(),
  total_jurors: z.number(),
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
