// src/components/auth/ForgotPasswordForm.jsx
// ============================================================
// Phase C.4: Forgot-password form — sends a Supabase Auth
// password reset email via resetPasswordForEmail().
// ============================================================

import { useState } from "react";
import { AlertCircleIcon, MailIcon, CheckCircle2Icon } from "../../shared/Icons";

export default function ForgotPasswordForm({ onResetPassword, onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onResetPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(err?.message || "Failed to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="admin-auth-form">
        <div className="admin-auth-header">
          <div className="premium-icon-square premium-icon-square--success" aria-hidden="true">
            <CheckCircle2Icon />
          </div>
          <h2 className="admin-auth-title">Check Your Email</h2>
          <p className="admin-auth-subtitle">
            We sent a password reset link to <strong>{email}</strong>.
            Check your inbox and follow the link to set a new password.
          </p>
        </div>

        <button type="button" onClick={onBackToLogin} className="admin-auth-submit">
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="admin-auth-form">
      <div className="admin-auth-header">
        <div className="premium-icon-square" aria-hidden="true"><MailIcon /></div>
        <h2 className="admin-auth-title">Reset Password</h2>
        <p className="admin-auth-subtitle">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      {error && (
        <div className="admin-auth-error">
          <AlertCircleIcon size={16} />
          <span>{error}</span>
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
          disabled={loading}
          className="admin-auth-input"
        />
      </label>

      <button type="submit" disabled={loading} className="admin-auth-submit">
        {loading ? "Sending…" : "Send Reset Link"}
      </button>

      <div className="admin-auth-forgot">
        <button type="button" onClick={onBackToLogin} className="admin-auth-home-link">
          ← Back to Sign In
        </button>
      </div>
    </form>
  );
}
