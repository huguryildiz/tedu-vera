// src/auth/ResetPasswordScreen.jsx — Phase 12
// Create-new-password form with strength validation and done state, using vera.css design tokens.
// Replaces src/components/auth/ResetPasswordCreateForm.jsx.

import { useContext, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, AlertCircle, CheckCircle2, Icon } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";
import { AuthContext } from "@/auth/shared/AuthProvider";
import useShakeOnError from "@/shared/hooks/useShakeOnError";
import {
  evaluatePassword,
  getStrengthMeta,
  isStrongPassword,
  PASSWORD_POLICY_ERROR_TEXT,
  PASSWORD_POLICY_PLACEHOLDER,
  PASSWORD_REQUIREMENTS,
} from "@/shared/passwordPolicy";

function PwdCheckIcon() {
  return (
    <Icon iconNode={[]} className="pwd-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

function PasswordStrengthBlock({ password }) {
  if (!password) return null;
  const { checks, score } = evaluatePassword(password);
  const { label, color, pct } = getStrengthMeta(score);
  return (
    <>
      <div className="pwd-strength">
        <div className="pwd-strength-bar">
          <div className="pwd-strength-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
        <span className="pwd-strength-label" style={{ color }}>{label}</span>
      </div>
      <div className="pwd-checklist">
        {PASSWORD_REQUIREMENTS.map(({ key, label: reqLabel }) => (
          <div key={key} className={`pwd-check${checks[key] ? " pass" : ""}`}>
            <PwdCheckIcon />
            {reqLabel}
          </div>
        ))}
      </div>
    </>
  );
}

export default function ResetPasswordScreen({ onUpdatePassword, onBackToLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith("/demo") ? "/demo" : "";
  const auth = useContext(AuthContext);
  const doUpdatePassword = onUpdatePassword || auth?.updatePassword || (async () => {
    throw new Error("Password update is not configured in this screen context.");
  });
  const goLogin = onBackToLogin || (() => navigate(`${base}/login`));
  const goForgotPassword = () => navigate(`${base}/forgot-password`);

  // Capture the URL hash on first render — Supabase clears it after processing,
  // so we must read it before it disappears.
  const hasRecoveryToken = useRef(
    typeof window !== "undefined" &&
    (window.location.hash.includes("type=recovery") ||
      new URLSearchParams(window.location.search).get("type") === "recovery")
  );
  // Also valid if the user already has an active session (e.g. they reloaded after
  // Supabase established the recovery session). Defer the check until auth is done loading
  // to avoid a false "invalid" flash while the session bootstraps.
  const authLoading = !!auth?.loading;
  const hasSession = !!auth?.session;
  const isValidAccess = authLoading || hasRecoveryToken.current || hasSession;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const submitBtnRef = useShakeOnError(error);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!isStrongPassword(password)) {
      setError(PASSWORD_POLICY_ERROR_TEXT);
      return;
    }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await doUpdatePassword(password);
      setDone(true);
    } catch (err) {
      setError("Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isValidAccess) {
    return (
      <div className="login-screen">
        <div style={{ width: "400px", maxWidth: "92vw" }}>
          <div className="login-card">
            <div className="login-header">
              <div className="login-icon-wrap" style={{ background: "rgba(239,68,68,0.12)" }}>
                <AlertCircle size={26} strokeWidth={1.5} stroke="var(--fb-danger-text, #ef4444)" aria-hidden="true" />
              </div>
              <div className="login-title">Invalid Reset Link</div>
              <div className="login-sub">This password reset link is invalid or has already expired.</div>
            </div>
            <FbAlert variant="warning" style={{ marginBottom: "20px" }}>
              Reset links expire after a short period and can only be used once. Request a new one to continue.
            </FbAlert>
            <button type="button" className="btn btn-primary" style={{ width: "100%" }} onClick={goForgotPassword}>
              Request a New Reset Link
            </button>
          </div>
          <div className="login-footer">
            <button type="button" onClick={goLogin} className="form-link">
              ← Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <div style={{ width: "400px", maxWidth: "92vw" }}>
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon-wrap">
              <Icon
                iconNode={[]}
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="m9 12 2 2 4-4"/>
              </Icon>
            </div>
            <div className="login-title">Create New Password</div>
            <div className="login-sub">Set a new password for your admin account.</div>
          </div>

          {!done ? (
            <form onSubmit={handleSubmit} noValidate>
              {error && (
                <FbAlert variant="danger" style={{ marginBottom: "16px" }}>
                  {error}
                </FbAlert>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="reset-pass">New Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="reset-pass"
                    data-testid="reset-password"
                    className="form-input"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={PASSWORD_POLICY_PLACEHOLDER}
                    autoComplete="new-password"
                    disabled={loading}
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", padding: 0, cursor: "pointer",
                      color: "var(--text-tertiary)", display: "flex", alignItems: "center",
                    }}
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <PasswordStrengthBlock password={password} />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reset-confirm">Confirm Password</label>
                <div style={{ position: "relative" }}>
                  <input
                    id="reset-confirm"
                    data-testid="reset-confirm"
                    className="form-input"
                    type={showConfirmPass ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    autoComplete="new-password"
                    disabled={loading}
                    style={{ paddingRight: "40px" }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirmPass((v) => !v)}
                    aria-label={showConfirmPass ? "Hide password" : "Show password"}
                    style={{
                      position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", padding: 0, cursor: "pointer",
                      color: "var(--text-tertiary)", display: "flex", alignItems: "center",
                    }}
                  >
                    {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "5px", fontSize: "11px", color: "var(--danger)" }}>
                    <AlertCircle size={12} strokeWidth={2} />
                    Passwords do not match
                  </div>
                )}
                {confirmPassword && password === confirmPassword && password.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", marginTop: "5px", fontSize: "11px", color: "var(--success)" }}>
                    <CheckCircle2 size={12} strokeWidth={2.5} />
                    Passwords match
                  </div>
                )}
              </div>

              <button ref={submitBtnRef} data-testid="reset-submit" type="submit" className="btn btn-primary" disabled={loading} style={{ width: "100%" }}>
                {loading ? "Updating…" : "Update Password"}
              </button>
            </form>
          ) : (
            <div data-testid="reset-success" style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{
                width: "48px", height: "48px", borderRadius: "50%",
                background: "rgba(22,163,74,0.1)", display: "inline-grid",
                placeItems: "center", marginBottom: "14px",
              }}>
                <CheckCircle2 size={24} stroke="#16a34a" strokeWidth={2} aria-hidden="true" />
              </div>
              <div className="auth-state-title">Password Updated</div>
              <div className="auth-state-desc">Your password has been updated. You can now sign in.</div>
              <button type="button" className="btn btn-primary" style={{ marginTop: "16px" }} onClick={goLogin}>
                Back to Sign In
              </button>
            </div>
          )}
        </div>

        {!done && (
          <div className="login-footer">
            <button type="button" onClick={goLogin} className="form-link">
              ← Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
