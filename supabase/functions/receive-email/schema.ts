// Wire-shape schemas for receive-email.
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ── Response shape ────────────────────────────────────────────────────────
export const SuccessResponseSchema = z.object({
  ok: z.literal(true),
});

export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
