// Canonical e2e audit helper entry point.
// Full implementation lives in auditHelpers.ts; this file adds the
// expectAuditRow() adapter expected by the step-5 brief and re-exports
// the richer assertAuditEntry / findAuditEntries surface.
export {
  type AssertAuditEntryOpts,
  type AuditRow,
  findAuditEntries,
  assertAuditEntry,
  findLatestAuditEntry,
} from "./auditHelpers";

import { assertAuditEntry } from "./auditHelpers";

export async function expectAuditRow(opts: {
  action: string;
  actorEmail?: string;
  detailKey?: string;
  detailValue?: string;
  sinceMs?: number;
}): Promise<void> {
  const payloadIncludes: Record<string, unknown> | undefined =
    opts.detailKey !== undefined && opts.detailValue !== undefined
      ? { [opts.detailKey]: opts.detailValue }
      : undefined;

  await assertAuditEntry({
    eventType: opts.action,
    withinSeconds: Math.round((opts.sinceMs ?? 60_000) / 1000),
    payloadIncludes,
  });
}
