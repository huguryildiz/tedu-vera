// src/admin/drawers/ViewSessionsDrawer.jsx
// Drawer: inspect tracked admin sessions (device-scoped).
//
// Props:
//   open            — boolean
//   onClose         — () => void
//   sessions        — admin_user_sessions rows
//   loading         — boolean
//   currentDeviceId — current browser device_id

import Drawer from "@/shared/ui/Drawer";
import { maskIpAddress, normalizeCountryCode } from "@/shared/lib/adminSession";

function formatAbsoluteDate(ts) {
  if (!ts) return "Unknown";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelative(ts) {
  if (!ts) return "Unknown";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatAbsoluteDate(ts);
}

function describeDevice(session) {
  const browser = session?.browser || "Unknown";
  const os = session?.os || "Unknown";
  return `${browser} / ${os}`;
}

export default function ViewSessionsDrawer({ open, onClose, sessions = [], loading = false, currentDeviceId = "" }) {
  const sortedSessions = Array.isArray(sessions)
    ? [...sessions].sort((a, b) => {
      const aMs = Date.parse(a?.last_activity_at || "");
      const bMs = Date.parse(b?.last_activity_at || "");
      const safeA = Number.isNaN(aMs) ? 0 : aMs;
      const safeB = Number.isNaN(bMs) ? 0 : bMs;
      return safeB - safeA;
    })
    : [];
  const totalSessions = sortedSessions.length;

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 9, display: "grid", placeItems: "center",
                background: "rgba(22,163,74,0.08)", border: "1px solid rgba(22,163,74,0.12)",
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" style={{ width: 17, height: 17 }}>
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Active Sessions</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                {totalSessions} device{totalSessions !== 1 ? "s" : ""} currently tracked
              </div>
            </div>
          </div>
          <button className="fs-close" type="button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="fs-drawer-body" style={{ gap: 10 }}>
        {loading && (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-quaternary)", fontSize: 12 }}>
            Loading sessions...
          </div>
        )}
        {!loading && sortedSessions.length === 0 && (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-quaternary)", fontSize: 12 }}>
            No sessions found.
          </div>
        )}
        {!loading && sortedSessions.map((session) => {
          const isCurrent = session?.device_id === currentDeviceId;
          const usedSignedInFallback = !session?.signed_in_at && !!session?.first_seen_at;
          const signedInAt = session?.signed_in_at || session?.first_seen_at || null;

          return (
          <div
            key={session.id}
            className={`fs-session-card${isCurrent ? " current" : ""}`}
          >
            <div className="fs-session-card-header">
              <div className="fs-session-card-name">
                {describeDevice(session)}
              </div>
              {isCurrent && (
                <span className="badge badge-success" style={{ fontSize: 9 }}>
                  Current Session
                </span>
              )}
            </div>
            <div className="fs-session-card-meta">
              <div><strong>Device/Browser/OS:</strong> {describeDevice(session)}</div>
              <div><strong>IP:</strong> {maskIpAddress(session?.ip_address)}</div>
              <div><strong>Country:</strong> {normalizeCountryCode(session?.country_code)}</div>
              <div>
                <strong>Signed in at:</strong> {formatAbsoluteDate(signedInAt)}
                {usedSignedInFallback && (
                  <span
                    style={{ marginLeft: 6, color: "var(--text-quaternary)", cursor: "help" }}
                    title="Exact sign-in timestamp unavailable. Showing first seen timestamp."
                    aria-label="signed-in-fallback-info"
                  >
                    (first seen)
                  </span>
                )}
              </div>
              <div><strong>Last activity:</strong> {formatRelative(session?.last_activity_at)}</div>
              <div><strong>Auth method:</strong> {session?.auth_method || "Unknown"}</div>
              <div><strong>Expires at:</strong> {formatAbsoluteDate(session?.expires_at)}</div>
            </div>
          </div>
        );
        })}
      </div>

      <div className="fs-drawer-footer">
        <div style={{ flex: 1, fontSize: 11, color: "var(--text-tertiary)" }}>{totalSessions} session(s)</div>
        <button className="fs-btn fs-btn-secondary" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Drawer>
  );
}
