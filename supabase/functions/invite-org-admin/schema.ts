// Wire-shape schemas for invite-org-admin.
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Request shape ─────────────────────────────────────────────────────────
export const RequestPayloadSchema = z.object({
  org_id: z.string({ required_error: "Missing required field: org_id" }).min(1, "org_id is required"),
  email: z.string().email("A valid email is required."),
  approval_flow: z.boolean().optional(),
});

// ── Response shapes ───────────────────────────────────────────────────────
export const SuccessResponseSchema = z.object({
  status: z.enum(["invited", "added", "reinvited"]),
  user_id: z.string(),
  email: z.string().optional(),
});

export const ValidationErrorResponseSchema = z.object({
  error: z.string(),
});

export const InternalErrorResponseSchema = z.object({
  error: z.string(),
});

export const DuplicateResponseSchema = z.object({
  error: z.string(),
  status: z.string().optional(),
});

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
export type InternalErrorResponse = z.infer<typeof InternalErrorResponseSchema>;
export type DuplicateResponse = z.infer<typeof DuplicateResponseSchema>;
