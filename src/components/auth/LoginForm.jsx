// src/components/auth/LoginForm.jsx
// ============================================================
// Phase C.4: Admin email/password login form.
// Replaces the old single-password admin login.
// ============================================================

import { useState } from "react";
import { EyeIcon, EyeOffIcon, AlertCircleIcon, ShieldUserIcon } from "../../shared/Icons";

export default function LoginForm({ onLogin, onSwitchToRegister, onForgotPassword, error: externalError, loading: externalLoading }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isLoading = loading || externalLoading;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
    } catch (err) {
      setError(err?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const displayError = externalError || error;

  return (
    <form onSubmit={handleSubmit} className="admin-auth-form">
      <div className="admin-auth-header">
        <div className="premium-icon-square" aria-hidden="true"><ShieldUserIcon /></div>
        <h2 className="admin-auth-title">Admin Panel</h2>
        <p className="admin-auth-subtitle">Sign in to manage your department.</p>
      </div>

      {displayError && (
        <div className="admin-auth-error">
          <AlertCircleIcon size={16} />
          <span>{displayError}</span>
        </div>
      )}

      <label className="admin-auth-label">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@university.edu"
          autoComplete="email"
          autoFocus
          disabled={isLoading}
          className="admin-auth-input"
        />
      </label>

      <label className="admin-auth-label">
        Password
        <div className="admin-auth-pass-wrap">
          <input
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            disabled={isLoading}
            className="admin-auth-input"
          />
          <button
            type="button"
            onClick={() => setShowPass(!showPass)}
            className="admin-auth-toggle-pass"
            tabIndex={-1}
          >
            {showPass ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
          </button>
        </div>
      </label>

      <button type="submit" disabled={isLoading} className="admin-auth-submit">
        {isLoading ? "Signing in…" : "Sign In"}
      </button>

      {onForgotPassword && (
        <div className="admin-auth-forgot">
          <button type="button" onClick={onForgotPassword} className="admin-auth-link">
            Forgot your password?
          </button>
        </div>
      )}

      <p className="admin-auth-switch">
        Don&apos;t have an account?{" "}
        <button type="button" onClick={onSwitchToRegister} className="admin-auth-link">
          Apply for access
        </button>
      </p>
    </form>
  );
}
