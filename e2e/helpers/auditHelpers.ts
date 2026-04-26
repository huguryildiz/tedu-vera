/**
 * Phase 1 audit assertion helpers.
 *
 * The actual `audit_logs` schema (see sql/migrations/002_tables.sql:346 and
 * sql/migrations/006b_rpcs_admin.sql:495 for `_audit_write`) uses these
 * columns:
 *
 *   action          TEXT             — equivalent of "event type"
 *   user_id         UUID             — equivalent of "actor"
 *   organization_id UUID             — tenant scope (NULL for super-admin)
 *   resource_type   TEXT
 *   resource_id     UUID             — equivalent of "target"
 *   details         JSONB            — structured payload
 *   diff            JSONB            — { before, after }
 *
 * The helper API uses semantic names (`eventType`, `actorId`, `targetId`,
 * `payloadIncludes`) so tests read naturally; mapping happens in this file.
 *
 * Phase 1 finding: many "destructive" admin RPCs do NOT call `_audit_write`
 * (e.g. rpc_admin_set_security_policy, rpc_admin_set_pin_policy,
 * rpc_org_admin_cancel_invite). When this helper is asked to assert an
 * audit row that the underlying RPC never writes, it fails — which is the
 * correct behavior. Tests for those flows are intentionally skipped with
 * a backlog note in `phase-1-completion-report.md`.
 */
import { adminClient } from "./supabaseAdmin";

export interface AssertAuditEntryOpts {
  /** action column value (the audit "event type"). */
  eventType: string;
  /** resource_id column value (the audit "target"). Optional. */
  targetId?: string;
  /** user_id column value — sign-in admin's auth.uid(). Optional for system events. */
  actorId?: string;
  /** organization_id scope filter. Pass null to require organization_id IS NULL. */
  orgId?: string | null;
  /** Lookback window in seconds. Defaults to 30. */
  withinSeconds?: number;
  /** Each provided key must equal-match the corresponding key inside details. */
  payloadIncludes?: Record<string, unknown>;
  /** Each provided key must NOT appear inside details (e.g. raw passwords). */
  payloadExcludes?: string[];
}

export interface AuditRow {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  created_at: string;
  category: string | null;
  severity: string | null;
  actor_type: string | null;
  actor_name: string | null;
}

/**
 * Reads up to `limit` most-recent audit_logs rows matching the filters.
 * Service-role client bypasses RLS — suitable for test verification only.
 */
export async function findAuditEntries(
  opts: AssertAuditEntryOpts & { limit?: number },
): Promise<AuditRow[]> {
  const sinceIso = new Date(
    Date.now() - (opts.withinSeconds ?? 30) * 1000,
  ).toISOString();

  let query = adminClient
    .from("audit_logs")
    .select(
      "id, organization_id, user_id, action, resource_type, resource_id, details, diff, created_at, category, severity, actor_type, actor_name",
    )
    .eq("action", opts.eventType)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 5);

  if (opts.targetId) query = query.eq("resource_id", opts.targetId);
  if (opts.actorId) query = query.eq("user_id", opts.actorId);
  if (opts.orgId === null) query = query.is("organization_id", null);
  else if (opts.orgId) query = query.eq("organization_id", opts.orgId);

  const { data, error } = await query;
  if (error) throw new Error(`findAuditEntries failed: ${error.message}`);
  return (data ?? []) as AuditRow[];
}

/** True when every key in `subset` is present in `superset` with the same value. */
function detailsMatch(
  details: Record<string, unknown> | null,
  subset: Record<string, unknown>,
): boolean {
  if (!details) return false;
  for (const [k, v] of Object.entries(subset)) {
    if (!Object.prototype.hasOwnProperty.call(details, k)) return false;
    if (JSON.stringify(details[k]) !== JSON.stringify(v)) return false;
  }
  return true;
}

/**
 * Assert a single audit_logs row exists matching the filters within the
 * lookback window. Throws a descriptive error when no row matches, listing
 * the candidate rows that came closest so tests fail loudly.
 */
export async function assertAuditEntry(
  opts: AssertAuditEntryOpts,
): Promise<AuditRow> {
  const candidates = await findAuditEntries({ ...opts, limit: 10 });

  let matches = candidates;

  if (opts.payloadIncludes) {
    matches = matches.filter((row) =>
      detailsMatch(row.details, opts.payloadIncludes!),
    );
  }

  if (opts.payloadExcludes && opts.payloadExcludes.length > 0) {
    matches = matches.filter((row) => {
      const keys = row.details ? Object.keys(row.details) : [];
      return opts.payloadExcludes!.every((forbidden) => !keys.includes(forbidden));
    });
  }

  if (matches.length === 0) {
    const summary = candidates.slice(0, 3).map((r) => ({
      action: r.action,
      resource_id: r.resource_id,
      user_id: r.user_id,
      details: r.details,
      created_at: r.created_at,
    }));
    throw new Error(
      `assertAuditEntry: no row found for action=${opts.eventType}` +
        (opts.targetId ? ` resource_id=${opts.targetId}` : "") +
        (opts.actorId ? ` user_id=${opts.actorId}` : "") +
        ` within ${opts.withinSeconds ?? 30}s. ` +
        `Candidates: ${JSON.stringify(summary)}`,
    );
  }

  return matches[0];
}

/**
 * Convenience: returns the most recent row matching `eventType` (and optional
 * actor/target/org), or null. Use when a test wants to sample what was
 * actually written before deciding what to assert.
 */
export async function findLatestAuditEntry(
  opts: AssertAuditEntryOpts,
): Promise<AuditRow | null> {
  const rows = await findAuditEntries({ ...opts, limit: 1 });
  return rows[0] ?? null;
}
