// Wire-shape schemas for send-export-report.
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Request payload ───────────────────────────────────────────────────────
export const RequestPayloadSchema = z.object({
  recipients: z.array(z.string()).min(1, "recipients array required and non-empty"),
  fileName: z.string({ required_error: "Missing required fields" }).min(1, "fileName required"),
  fileBase64: z.string({ required_error: "Missing required fields" }).min(1, "fileBase64 required"),
  mimeType: z.string({ required_error: "Missing required fields" }).min(1, "mimeType required"),
  reportTitle: z.string().optional(),
  periodName: z.string().optional(),
  organization: z.string().optional(),
  department: z.string().optional(),
  message: z.string().optional(),
  senderName: z.string().optional(),
  ccSenderEmail: z.boolean().optional(),
  organizationId: z.string().optional(),
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
