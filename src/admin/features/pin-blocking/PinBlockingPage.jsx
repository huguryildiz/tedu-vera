// src/admin/pages/PinBlockingPage.jsx
// ============================================================
// PIN Blocking page: real backend wiring via usePinBlocking.
// Threshold and lock duration are policy-driven (Security Policy).
// Props: organizationId, selectedPeriodId from AdminLayout.
// ============================================================

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LockOpen, Settings, Check, Clock, AlertCircle, CalendarDays } from "lucide-react";
import "./PinBlockingPage.css";
import { useAdminContext } from "@/admin/shared/useAdminContext";
import { usePinBlocking } from "./usePinBlocking";
import useCardSelection from "@/shared/hooks/useCardSelection";
import { useSecurityPolicy } from "@/auth/shared/SecurityPolicyContext";
import { formatTs } from "@/admin/utils/adminUtils";
import PremiumTooltip from "@/shared/ui/PremiumTooltip";
import FbAlert from "@/shared/ui/FbAlert";
import JurorBadge from "@/admin/shared/JurorBadge";
import UnlockAllModal from "./UnlockAllModal";
import UnlockPinModal from "./UnlockPinModal";

function formatAgo(iso) {
  if (!iso) return "just now";
  const secs = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatRemaining(lockedUntil) {
  if (!lockedUntil) return "—";
  const ms = new Date(lockedUntil) - Date.now();
  if (ms <= 0) return "Expired";
  const totalMins = Math.ceil(ms / 60000);
  if (totalMins < 60) return `${totalMins}m left`;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours < 24) return mins ? `${hours}h ${mins}m left` : `${hours}h left`;
  const days = Math.floor(hours / 24);
  return `${days}d+ left`;
}

function parseFailThreshold(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 5;
}

function parseCooldownMinutes(value) {
  if (typeof value !== "string") return 30;
  const match = value.trim().match(/^(\d+)\s*m$/i);
  if (!match) return 30;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 30;
}

function formatCooldown(minutes) {
  if (minutes >= 60 && minutes % 60 === 0) {
    const h = minutes / 60;
    return `${h} hour${h !== 1 ? "s" : ""}`;
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  }
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}

export default function PinBlockingPage() {
  const { selectedPeriodId, organizationId, periodName } = useAdminContext();
  const policy = useSecurityPolicy();
  const navigate = useNavigate();
  const [unlockAllOpen, setUnlockAllOpen] = useState(false);
  const lockScopeRef = useCardSelection();
  const {
    lockedJurors,
    todayLockEvents,
    atRiskCount,
    loading,
    error,
    loadLockedJurors,
    handleUnlock,
    handleUnlockAll,
    unlockModal,
    closeUnlockModal,
  } = usePinBlocking({ periodId: selectedPeriodId });

  useEffect(() => {
    loadLockedJurors();
    const id = setInterval(() => loadLockedJurors({ silent: true }), 30000);
    return () => clearInterval(id);
  }, [loadLockedJurors]);

  const noPeriod = !selectedPeriodId;
  const failThreshold = parseFailThreshold(policy?.maxPinAttempts);
  const cooldownMinutes = parseCooldownMinutes(policy?.pinLockCooldown);
  const cooldownLabel = formatCooldown(cooldownMinutes);

  const totalActive = lockedJurors.length;

  const nextAutoUnlock = (() => {
    if (loading) return null;
    if (lockedJurors.length === 0) return null;
    const times = lockedJurors
      .filter((j) => j.lockedUntil)
      .map((j) => new Date(j.lockedUntil).getTime());
    if (times.length === 0) return null;
    const earliest = Math.min(...times);
    const ms = earliest - Date.now();
    if (ms <= 0) return "Expiring";
    const totalMins = Math.ceil(ms / 60000);
    if (totalMins < 60) return `${totalMins}m`;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  })();

  return (
    <div className="page pin-lock-page">
      <div className="page-title">PIN Blocking</div>
      <div className="page-desc" style={{ marginBottom: 14 }}>
        Monitor temporary PIN lockouts, review risk signals, and unlock juror access when required.
      </div>

      {/* Lock policy alert */}
      <FbAlert variant="warning" style={{ marginBottom: 12 }} title="Lock policy is active">
        Jurors are locked for {cooldownLabel} after {failThreshold} failed attempt{failThreshold !== 1 ? "s" : ""}.
        Manual unlock is logged in Audit Log.{" "}
        <button
          type="button"
          onClick={() => navigate("../audit-log")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            font: "inherit",
            color: "var(--primary, #2563eb)",
            fontWeight: 500,
            textDecoration: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
            marginLeft: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
        >
          View Audit Log →
        </button>
      </FbAlert>

      {noPeriod ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="vera-es-page-prompt">
            <div className="vera-es-ghost-rows" aria-hidden="true">
              <div className="vera-es-ghost-row">
                <div className="vera-es-ghost-bar" style={{ width: "20%" }} /><div className="vera-es-ghost-bar" style={{ width: "24%" }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "18%" }} />
              </div>
              <div className="vera-es-ghost-row">
                <div className="vera-es-ghost-bar" style={{ width: "14%" }} /><div className="vera-es-ghost-bar" style={{ width: "30%" }} /><div className="vera-es-ghost-spacer" /><div className="vera-es-ghost-bar" style={{ width: "14%" }} />
              </div>
            </div>
            <div className="vera-es-icon">
              <CalendarDays size={22} strokeWidth={1.8}/>
            </div>
            <p className="vera-es-page-prompt-title">Select an Evaluation Period</p>
            <p className="vera-es-page-prompt-desc">Choose an evaluation period from the selector above to view PIN lockout status and manage blocked jurors.</p>
          </div>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="scores-kpi-strip">
            <div className="scores-kpi-item">
              <div className={`scores-kpi-item-value${totalActive > 0 ? " kpi-danger" : " kpi-success"}`}>
                {loading ? "—" : totalActive > 0 ? totalActive : <Check size={18} strokeWidth={2.5} />}
              </div>
              <div className="scores-kpi-item-label">
                {!loading && totalActive === 0 ? "All Clear" : "Currently Locked"}
              </div>
            </div>
            <div className="scores-kpi-item">
              <div className="scores-kpi-item-value">
                {loading ? "—" : nextAutoUnlock ?? "—"}
              </div>
              <div className="scores-kpi-item-label">Next Auto-Unlock</div>
            </div>
            <div className="scores-kpi-item">
              <div className="scores-kpi-item-value">
                <span className="accent">{loading ? "—" : todayLockEvents}</span>
              </div>
              <div className="scores-kpi-item-label">Jurors Locked Today</div>
            </div>
            <div className="scores-kpi-item" style={{ borderRight: "none" }}>
              <div className={`scores-kpi-item-value${atRiskCount > 0 ? " kpi-warning" : ""}`}>
                {loading ? "—" : atRiskCount}
              </div>
              <div className="scores-kpi-item-label">At Risk</div>
            </div>
          </div>

          {error && (
            <FbAlert variant="danger" style={{ marginBottom: 12 }}>
              {error}
            </FbAlert>
          )}

          {/* Active Lockouts */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-header">
              <div>
                <div className="card-title" style={{ display: "flex", alignItems: "center" }}>
                  Active Lockouts
                  {totalActive > 0 && <span className="pin-count-pill">{totalActive}</span>}
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 1 }}>
                  Jurors currently blocked from PIN entry
                </div>
              </div>
              <button
                className="btn btn-sm"
                style={{ background: "var(--danger)", color: "#fff" }}
                disabled={totalActive === 0 || loading}
                onClick={() => setUnlockAllOpen(true)}
              >
                <LockOpen size={14} />
                Unlock All
              </button>
            </div>
            <div className="table-wrap">
              <table className="pin-lock-table table-standard table-pill-balance">
                <thead>
                  <tr>
                    <th>Juror</th>
                    <th>Failed Attempts</th>
                    <th>Lock Started</th>
                    <th>Unlock ETA</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody ref={lockScopeRef}>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="text-sm text-muted" style={{ textAlign: "center", padding: "18px 0" }}>
                        Loading…
                      </td>
                    </tr>
                  ) : lockedJurors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-sm text-muted" style={{ textAlign: "center", padding: "18px 0" }}>
                        No active lockouts.
                      </td>
                    </tr>
                  ) : (
                    lockedJurors.map((j) => (
                      <tr key={j.jurorId} data-card-selectable="">
                        <td data-label="Juror">
                          <JurorBadge name={j.jurorName} affiliation={j.affiliation} size="sm" />
                        </td>
                        <td className={`col-fails${!j.failedAttempts ? " missing" : ""}`} data-label="Failed Attempts">
                          <span className="fails-desktop">{j.failedAttempts ?? "—"}</span>
                          <span className="fails-mobile">
                            <AlertCircle size={10} strokeWidth={2} />
                            Failed: <strong>{j.failedAttempts ?? "—"}</strong>
                          </span>
                        </td>
                        <td className="col-lock-started" data-label="Lock Started">
                          <span className="lock-desktop vera-datetime-text">{formatTs(j.lockedAt)}</span>
                          <span className="lock-mobile">
                            <Clock size={10} strokeWidth={2} />
                            <PremiumTooltip text={formatTs(j.lockedAt)} position="top">
                              <span style={{ cursor: "default" }}>Locked {formatAgo(j.lockedAt)}</span>
                            </PremiumTooltip>
                          </span>
                        </td>
                        <td data-label="Unlock ETA">
                          {(() => {
                            const text = formatRemaining(j.lockedUntil);
                            const expired = !j.lockedUntil || text === "Expired";
                            return (
                              <span className={`pin-eta-pill${expired ? " expired" : ""}`}>
                                <span className="pin-eta-dot" />
                                {text}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="col-actions text-right" data-label="Action">
                          <button
                            data-testid={`pin-blocking-unlock-${j.jurorId}`}
                            className="btn btn-outline btn-sm"
                            onClick={() => handleUnlock(j.jurorId)}
                          >
                            Unlock
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Policy Snapshot */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Policy Snapshot</div>
            <div className="text-xs text-muted" style={{ marginTop: 1 }}>
              Applies to all jury access channels
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("../settings")}
            className="pin-policy-edit-btn"
          >
            <Settings size={13} strokeWidth={2} />
            Edit in Security Settings
          </button>
        </div>
        <div className="pin-policy-grid" style={{ padding: "14px 16px" }}>
          <div className="pin-policy-item">
            <div className="pin-policy-label">Max failed attempts</div>
            <div className="pin-policy-value">
              {failThreshold} attempt{failThreshold !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="pin-policy-item">
            <div className="pin-policy-label">Temporary lock duration</div>
            <div className="pin-policy-value">{cooldownLabel}</div>
          </div>
          <div className="pin-policy-item">
            <div className="pin-policy-label">Audit integration</div>
            <div className="pin-policy-value success">
              <Check size={14} strokeWidth={2.5} />
              Enabled
            </div>
          </div>
        </div>
      </div>

      <UnlockAllModal
        open={unlockAllOpen}
        onClose={() => setUnlockAllOpen(false)}
        lockedCount={totalActive}
        onConfirm={handleUnlockAll}
      />

      <UnlockPinModal
        open={!!unlockModal}
        onClose={closeUnlockModal}
        pin={unlockModal?.pin || ""}
        jurorId={unlockModal?.jurorId}
        jurorName={unlockModal?.jurorName || ""}
        affiliation={unlockModal?.affiliation || ""}
        email={unlockModal?.email || ""}
        periodId={selectedPeriodId}
        periodName={periodName}
        organizationId={organizationId}
      />
    </div>
  );
}
