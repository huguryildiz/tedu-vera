// supabase/functions/_shared/audit-log.ts
// ============================================================
// Shared helper for writing audit_logs rows from Edge Functions.
//
// Pattern: every notification / email / server-side admin action calls
// writeEdgeAuditLog(req, { action, organization_id, ... }) after the
// primary work succeeds. The write runs inside the same server-side
// request as the operation — no client crash can drop it.
//
// IP and user-agent are extracted from request headers; the user_id is
// resolved by validating the Authorization JWT via auth.getUser().
// ============================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type ActorType = "admin" | "juror" | "system" | "anonymous";
type Category = "auth" | "access" | "data" | "config" | "security";
type Severity = "info" | "low" | "medium" | "high" | "critical";

export interface EdgeAuditInput {
  action: string;
  organization_id?: string | null;
  user_id?: string | null;
  resource_type?: string | null;
  resource_id?: string | null;
  details?: Record<string, unknown>;
  diff?: Record<string, unknown> | null;
  category?: Category;
  severity?: Severity;
  actor_type?: ActorType;
}

export function getServiceClient(): SupabaseClient | null {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

export async function getUserIdFromAuthHeader(
  client: SupabaseClient,
  req: Request,
): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  try {
    const { data } = await client.auth.getUser(token);
    return data?.user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Extract the real client IP from an Edge Function request.
 *
 * Default behavior (no env): trust the leftmost XFF element. This is fine when
 * the function is reached only through Supabase's edge layer, but breaks if
 * the Edge Function is exposed behind another proxy or if a user injects an
 * X-Forwarded-For header in their own request body.
 *
 * Hardened behavior: set `AUDIT_TRUSTED_PROXY_DEPTH = "N"` to indicate that
 * N trusted proxies sit between the user and the Edge Function. The function
 * then returns `xff[len - 1 - N]` (counting from the right past N trusted
 * hops). Spoofed left-side entries are ignored. (P2.12)
 *
 * Reference: https://datatracker.ietf.org/doc/html/rfc7239 + Express trust-proxy.
 */
function extractClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for") || "";
  const chain = xff.split(",").map((s) => s.trim()).filter(Boolean);

  if (chain.length === 0) {
    return req.headers.get("x-real-ip") || null;
  }

  const depthRaw = Deno.env.get("AUDIT_TRUSTED_PROXY_DEPTH");
  if (depthRaw) {
    const depth = parseInt(depthRaw, 10);
    if (Number.isFinite(depth) && depth >= 0) {
      // (chain.length - 1 - depth) is the client position; clamp to 0 if depth ≥ chain length.
      const idx = Math.max(0, chain.length - 1 - depth);
      return chain[idx] || req.headers.get("x-real-ip") || null;
    }
  }

  return chain[0] || req.headers.get("x-real-ip") || null;
}

function defaultCategory(action: string): Category {
  if (action.startsWith("auth.")) return "auth";
  if (action.startsWith("access.")) return "access";
  if (action.startsWith("config.")) return "config";
  if (action === "organization.status_changed") return "config";
  if (
    action.startsWith("notification.") ||
    action.startsWith("export.") ||
    action.startsWith("backup.") ||
    action.startsWith("token.") ||
    action.startsWith("security.") ||
    action.startsWith("maintenance.")
  ) {
    return "security";
  }
  return "data";
}

function defaultSeverity(action: string): Severity {
  if (action === "auth.admin.password.changed") return "medium";
  if (action === "auth.admin.password.reset.requested") return "low";
  if (action === "notification.admin_invite") return "low";
  if (action === "notification.export_report") return "low";
  if (action === "notification.entry_token") return "low";
  if (action === "notification.juror_pin") return "low";
  if (action === "notification.maintenance") return "medium";
  if (action === "security.pin_reset.requested") return "medium";
  if (action === "config.platform_settings.updated") return "medium";
  if (action === "config.backup_schedule.updated") return "high";
  if (action === "access.admin.session.revoked") return "high";
  if (action === "maintenance.set") return "high";
  if (action === "maintenance.cancelled") return "medium";
  if (action === "data.score.edit_requested") return "low";
  return "info";
}

/**
 * Writes an audit_logs row from an Edge Function.
 * Throws on DB failure — callers must wrap in try/catch and decide whether
 * to propagate or absorb. Service role bypasses RLS.
 */
export async function writeEdgeAuditLog(
  req: Request,
  input: EdgeAuditInput,
): Promise<void> {
  const client = getServiceClient();
  if (!client) {
    throw new Error(`audit-log: service client unavailable for action "${input.action}"`);
  }

  let userId = input.user_id ?? null;
  if (!userId) {
    userId = await getUserIdFromAuthHeader(client, req);
  }

  const ip = extractClientIp(req);
  const ua = req.headers.get("user-agent") || null;

  const row = {
    organization_id: input.organization_id ?? null,
    user_id: userId,
    action: input.action,
    resource_type: input.resource_type ?? null,
    resource_id: input.resource_id ?? null,
    category: input.category ?? defaultCategory(input.action),
    severity: input.severity ?? defaultSeverity(input.action),
    actor_type: input.actor_type ?? "admin",
    details: input.details ?? {},
    diff: input.diff ?? null,
    ip_address: ip,
    user_agent: ua,
  };

  const { error } = await client.from("audit_logs").insert(row);
  if (error) {
    throw new Error(`audit-log: insert failed for "${input.action}": ${error.message}`);
  }
}
