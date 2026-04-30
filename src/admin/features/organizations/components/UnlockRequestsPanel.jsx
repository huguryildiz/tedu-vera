import { CheckCircle2, Clock, XCircle } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";
import Pagination from "@/shared/ui/Pagination";
import { formatDateTime } from "@/shared/lib/dateUtils";
import SortIcon from "./SortIcon";
import TenantStatusPill from "./TenantStatusPill";

const UNLOCK_TABS = [
  { key: "pending",  label: "Pending",  icon: Clock },
  { key: "approved", label: "Approved", icon: CheckCircle2 },
  { key: "rejected", label: "Rejected", icon: XCircle },
];

export default function UnlockRequestsPanel({
  unlockTab,
  setUnlockTab,
  unlockError,
  unlockLoading,
  pagedUnlockRows,
  unlockSortKey,
  unlockSortDir,
  onUnlockSort,
  onOpenResolve,
  unlockSafePage,
  unlockTotalPages,
  unlockPageSize,
  sortedUnlockRowsLength,
  setUnlockPage,
  setUnlockPageSize,
}) {
  return (
    <div style={{ paddingTop: 8 }}>
      {unlockError && (
        <FbAlert variant="danger" title="Error">{unlockError}</FbAlert>
      )}

      <div
        role="tablist"
        aria-label="Request status filter"
        style={{ display: "flex", gap: 6, margin: "16px 0", borderBottom: "1px solid var(--border)" }}
      >
        {UNLOCK_TABS.map((t) => {
          const TabIcon = t.icon;
          const active = unlockTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setUnlockTab(t.key)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 14px",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
                color: active ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
              }}
            >
              <TabIcon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-wrap table-wrap--split">
          <table className="organizations-table unlock-requests-table table-dense table-pill-balance">
            <thead>
              <tr>
                <th className={`sortable${unlockSortKey === "organization_name" ? " sorted" : ""}`} onClick={() => onUnlockSort("organization_name")}>Organization <SortIcon colKey="organization_name" sortKey={unlockSortKey} sortDir={unlockSortDir} /></th>
                <th className={`sortable${unlockSortKey === "period_name" ? " sorted" : ""}`} onClick={() => onUnlockSort("period_name")}>Period <SortIcon colKey="period_name" sortKey={unlockSortKey} sortDir={unlockSortDir} /></th>
                <th className={`sortable${unlockSortKey === "requester_name" ? " sorted" : ""}`} onClick={() => onUnlockSort("requester_name")}>Requester <SortIcon colKey="requester_name" sortKey={unlockSortKey} sortDir={unlockSortDir} /></th>
                <th>Reason</th>
                <th className={`sortable${unlockSortKey === "created_at" ? " sorted" : ""}`} onClick={() => onUnlockSort("created_at")}>Requested <SortIcon colKey="created_at" sortKey={unlockSortKey} sortDir={unlockSortDir} /></th>
                <th className={`sortable${unlockSortKey === "status" ? " sorted" : ""}`} onClick={() => onUnlockSort("status")}>Status <SortIcon colKey="status" sortKey={unlockSortKey} sortDir={unlockSortDir} /></th>
                {unlockTab !== "pending" && <th className={`sortable${unlockSortKey === "reviewed_at" ? " sorted" : ""}`} onClick={() => onUnlockSort("reviewed_at")}>Reviewed <SortIcon colKey="reviewed_at" sortKey={unlockSortKey} sortDir={unlockSortDir} /></th>}
                {unlockTab === "pending" && <th style={{ textAlign: "right" }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {unlockLoading && (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
                    Loading…
                  </td>
                </tr>
              )}
              {!unlockLoading && pagedUnlockRows.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>
                    No {unlockTab} requests.
                  </td>
                </tr>
              )}
              {!unlockLoading && pagedUnlockRows.map((r) => (
                <tr key={r.id} data-status={r.status}>
                  <td data-label="Organization">{r.organization_name || "—"}</td>
                  <td data-label="Period"><strong>{r.period_name || "—"}</strong></td>
                  <td data-label="Requester">{r.requester_name || "—"}</td>
                  <td data-label="Reason" style={{ maxWidth: 320, whiteSpace: "normal" }}>
                    <span style={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {r.reason}
                    </span>
                  </td>
                  <td data-label="Requested" className="vera-datetime-text">{formatDateTime(r.created_at)}</td>
                  <td data-label="Status"><TenantStatusPill status={r.status} /></td>
                  {unlockTab !== "pending" && (
                    <td data-label="Reviewed" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      <div>{r.reviewer_name || "—"}</div>
                      <div className="vera-datetime-text">{r.reviewed_at ? formatDateTime(r.reviewed_at) : ""}</div>
                      {r.review_note && (
                        <div style={{ marginTop: 4, fontStyle: "italic" }}>"{r.review_note}"</div>
                      )}
                    </td>
                  )}
                  {unlockTab === "pending" && (
                    <td data-label="Actions" style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ padding: "4px 10px", fontSize: 11.5, borderRadius: 6, marginRight: 6, gap: 4, height: 28, minWidth: 80 }}
                        onClick={() => onOpenResolve(r, "rejected")}
                      >
                        <XCircle size={12} />
                        Reject
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: "4px 10px", fontSize: 11.5, borderRadius: 6, gap: 4, height: 28, minWidth: 80 }}
                        onClick={() => onOpenResolve(r, "approved")}
                      >
                        <CheckCircle2 size={12} />
                        Approve
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Pagination
        currentPage={unlockSafePage}
        totalPages={unlockTotalPages}
        pageSize={unlockPageSize}
        totalItems={sortedUnlockRowsLength}
        onPageChange={setUnlockPage}
        onPageSizeChange={(size) => { setUnlockPageSize(size); setUnlockPage(1); }}
        itemLabel="requests"
      />
    </div>
  );
}
