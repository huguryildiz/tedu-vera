// src/admin/pages/AuditLogPage.jsx
// Standalone page for audit log viewing, filtering, and export.

import { useToast } from "../../components/toast/useToast";
import { useAuditLogFilters } from "../hooks/useAuditLogFilters";
import { usePageRealtime } from "../hooks/usePageRealtime";
import { formatAuditTimestamp } from "../utils/auditUtils";
import AuditLogCard from "../settings/AuditLogCard";
import PageShell from "./PageShell";

export default function AuditLogPage({ organizationId }) {
  const _toast = useToast();
  const setMessage = (msg) => { if (msg) _toast.success(msg); };

  const isMobile = typeof window !== "undefined" && window.innerWidth <= 900;

  const audit = useAuditLogFilters({ organizationId, isMobile, setMessage });

  // Realtime: refresh audit log on new entries
  usePageRealtime({
    organizationId,
    channelName: "audit-page-live",
    subscriptions: [
      {
        table: "audit_logs",
        event: "INSERT",
        onPayload: () => audit.scheduleAuditRefresh?.(),
      },
    ],
    deps: [audit.scheduleAuditRefresh],
  });

  const localTimeZone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time";
    } catch {
      return "Local time";
    }
  })();

  return (
    <PageShell
      title="Audit Log"
      description="View administrative actions and security events"
    >
      <AuditLogCard
        isMobile={isMobile}
        isOpen={true}
        onToggle={() => {}}
        auditCardRef={audit.auditCardRef}
        auditScrollRef={audit.auditScrollRef}
        auditSentinelRef={audit.auditSentinelRef}
        auditFilters={audit.auditFilters}
        auditSearch={audit.auditSearch}
        auditRangeError={audit.auditRangeError}
        auditError={audit.auditError}
        auditExporting={audit.auditExporting}
        auditLoading={audit.auditLoading}
        auditHasMore={audit.auditHasMore}
        visibleAuditLogs={audit.visibleAuditLogs}
        showAuditSkeleton={audit.showAuditSkeleton}
        isAuditStaleRefresh={audit.isAuditStaleRefresh}
        hasAuditFilters={audit.hasAuditFilters}
        hasAuditToggle={audit.hasAuditToggle}
        showAllAuditLogs={audit.showAllAuditLogs}
        localTimeZone={localTimeZone}
        AUDIT_COMPACT_COUNT={audit.AUDIT_COMPACT_COUNT}
        supportsInfiniteScroll={audit.supportsInfiniteScroll}
        onSetAuditFilters={audit.setAuditFilters}
        onSetAuditSearch={audit.setAuditSearch}
        onAuditExport={audit.handleAuditExport}
        onToggleShowAll={() => {
          audit.setShowAllAuditLogs((prev) => {
            const next = !prev;
            if (!next && audit.auditScrollRef.current) {
              audit.auditScrollRef.current.scrollTop = 0;
            }
            return next;
          });
        }}
        onAuditLoadMore={audit.handleAuditLoadMore}
        formatAuditTimestamp={formatAuditTimestamp}
      />
    </PageShell>
  );
}
