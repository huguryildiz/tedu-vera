import { Check, Clock3, QrCode, XCircle } from "lucide-react";
import { formatDateTime as fmtDate } from "@/shared/lib/dateUtils";
import SortIcon from "./SortIcon";

export default function SessionHistoryTable({
  tokenHistory,
  sortedTokenHistory,
  historySortKey,
  historySortDir,
  onSort,
  onDownload,
  rawToken,
  tableRef,
}) {
  const hasTokenHistory = tokenHistory.length > 0;

  return (
    <div className="card" style={{ boxShadow: "var(--shadow-card)" }}>
      <div className="card-header">
        <div className="card-title">Access History</div>
        <span className="text-sm text-muted" style={{ fontWeight: 500 }}>
          {hasTokenHistory
            ? `${tokenHistory.length} token${tokenHistory.length > 1 ? "s" : ""} generated`
            : "No tokens generated"}
        </span>
      </div>
      <div className="table-wrap">
        <table className="entry-history-table table-standard table-pill-balance">
          <thead>
            <tr>
              <th className={`sortable${historySortKey === "access_id" ? " sorted" : ""}`} onClick={() => onSort("access_id")}>
                Reference ID <SortIcon colKey="access_id" sortKey={historySortKey} sortDir={historySortDir} />
              </th>
              <th className={`sortable${historySortKey === "created_at" ? " sorted" : ""}`} onClick={() => onSort("created_at")}>
                Created <SortIcon colKey="created_at" sortKey={historySortKey} sortDir={historySortDir} />
              </th>
              <th className={`sortable${historySortKey === "expires_at" ? " sorted" : ""}`} onClick={() => onSort("expires_at")}>
                Expires <SortIcon colKey="expires_at" sortKey={historySortKey} sortDir={historySortDir} />
              </th>
              <th className={`sortable${historySortKey === "session_count" ? " sorted" : ""}`} onClick={() => onSort("session_count")}>
                Sessions <SortIcon colKey="session_count" sortKey={historySortKey} sortDir={historySortDir} />
              </th>
              <th className={`sortable${historySortKey === "status" ? " sorted" : ""}`} onClick={() => onSort("status")}>
                Status <SortIcon colKey="status" sortKey={historySortKey} sortDir={historySortDir} />
              </th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody ref={tableRef}>
            {hasTokenHistory ? (
              sortedTokenHistory.map((token) => (
                <tr key={token.id} data-card-selectable="" style={token.is_active ? { background: "var(--accent-soft)" } : undefined}>
                  <td className="mono" data-label="Reference ID" style={token.is_active ? { fontWeight: 700, color: "var(--accent)" } : {}}>
                    {token.access_id}
                  </td>
                  <td className="text-sm" data-label="Created" style={{ fontWeight: 500 }}>
                    <span className="vera-datetime-text">{fmtDate(token.created_at)}</span>
                    {typeof token.session_count === "number" && (
                      <span className="ec-hist-sessions-inline">{token.session_count} sessions</span>
                    )}
                  </td>
                  <td className="text-sm col-expires" data-label="Expires"><span className="vera-datetime-text">{fmtDate(token.expires_at)}</span></td>
                  <td className="mono" data-label="Sessions" style={{ fontWeight: 600 }}>
                    {typeof token.session_count === "number" ? token.session_count : "—"}
                  </td>
                  <td data-label="Status">
                    <div className="ec-status-cell">
                      {token.is_active ? (
                        <span className="badge badge-success" style={{ boxShadow: "0 0 0 2px var(--success-soft)" }}>
                          <Check className="badge-ico" />
                          Active
                        </span>
                      ) : token.is_expired ? (
                        <span className="badge badge-neutral">
                          <Clock3 className="badge-ico" />
                          Expired
                        </span>
                      ) : (
                        <span className="badge badge-danger">
                          <XCircle className="badge-ico" />
                          Revoked
                        </span>
                      )}
                      {token.is_revoked && token.revoked_at && (
                        <span className="ec-revoked-at vera-datetime-text">{fmtDate(token.revoked_at)}</span>
                      )}
                    </div>
                  </td>
                  <td className="col-actions text-right" data-label="Actions">
                    {rawToken && token.is_active && (
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ padding: "4px 10px", fontSize: 10, fontWeight: 600 }}
                        onClick={onDownload}
                      >
                        <QrCode size={10} />
                        QR
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-sm text-muted" style={{ textAlign: "center", padding: "18px 0" }}>
                  No tokens generated for this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
