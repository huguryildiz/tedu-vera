// src/auth/screens/InviteAcceptScreen.jsx — Phase 13
// Admin invite acceptance page — set password, accept invite, join organization.
// Validates token, displays org name + email, requires display name + password.

import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react";
import { getInvitePayload, acceptAdminInvite } from "@/shared/api";
import FbAlert from "@/shared/ui/FbAlert";

export default function InviteAcceptScreen() {
  const { token } = useParams();
  const navigate = useNavigate();

  // Token validation state
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");

  // Form state
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // ── Token validation on mount ──
  useEffect(() => {
    if (!token) {
      setError("Invalid invite link.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const data = await getInvitePayload(token);
        if (data?.error) {
          setError(
            data.error === "invite_expired"
              ? "This invite has expired. Please ask your admin to send a new one."
              : data.error === "invite_not_found"
                ? "This invite link is invalid or has already been used."
                : data.error
          );
        } else {
          setPayload(data);
          // Pre-fill display name from email local part
          // e.g. "john.doe@example.com" → "John Doe"
          const local = (data.email || "").split("@")[0] || "";
          const displayNameFromEmail = local
            .split(/[._-]+/)
            .filter(Boolean)
            .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
            .join(" ");
          setDisplayName(displayNameFromEmail);
        }
      } catch (e) {
        setError(e?.message || "Could not verify invite.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  // ── Validation ──
  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirmPassword;
  const canSubmit = passwordValid && passwordsMatch && displayName.trim();

  // ── Submit handler ──
  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      if (!canSubmit || submitting) return;

      setSubmitting(true);
      setSubmitError("");

      try {
        const result = await acceptAdminInvite(token, password, displayName.trim());
        if (result?.ok || result?.session) {
          // Session established; navigate to admin and reload to pick up session
          navigate("/admin", { replace: true });
          window.location.reload();
        } else {
          // Fallback: redirect to login
          navigate("/login", { replace: true });
        }
      } catch (err) {
        setSubmitError(err?.message || "Could not accept invite. Please try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [canSubmit, submitting, token, password, displayName, navigate]
  );

  // ── Loading state ──
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div className="spinner" />
      </div>
    );
  }

  // ── Error state (invalid/expired token) ──
  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            padding: 32,
            borderRadius: "var(--radius-md, 12px)",
            background: "var(--surface, #1a1a2e)",
            border: "1px solid var(--border, #2a2a4a)",
          }}
        >
          <AlertCircle
            size={48}
            style={{
              color: "var(--danger, #ef4444)",
              marginBottom: 16,
            }}
          />
          <h2
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Invite Unavailable
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 14,
              lineHeight: 1.6,
              marginBottom: 24,
            }}
          >
            {error}
          </p>
          <button
            className="fs-btn fs-btn-primary"
            onClick={() => navigate("/login", { replace: true })}
            style={{ width: "100%" }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ── Accept invite form ──
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 440,
          width: "100%",
          padding: 32,
          borderRadius: "var(--radius-md, 12px)",
          background: "var(--surface, #1a1a2e)",
          border: "1px solid var(--border, #2a2a4a)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <ShieldCheck
            size={40}
            style={{
              color: "var(--accent, #6366f1)",
              marginBottom: 12,
            }}
          />
          <h2
            style={{
              fontSize: 22,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Join {payload?.org_name || "Organization"}
          </h2>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: 13,
            }}
          >
            Set your password to accept the invite for <strong>{payload?.email}</strong>
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Display Name */}
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Display Name
            </label>
            <input
              className="fs-input"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                className="fs-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-tertiary)",
                  padding: 4,
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {password && !passwordValid && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--danger)",
                  marginTop: 4,
                }}
              >
                Password must be at least 8 characters
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                display: "block",
                marginBottom: 4,
              }}
            >
              Confirm Password
            </label>
            <input
              className="fs-input"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              required
            />
            {confirmPassword && !passwordsMatch && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--danger)",
                  marginTop: 4,
                }}
              >
                Passwords do not match
              </div>
            )}
          </div>

          {/* Submit error */}
          {submitError && <FbAlert variant="danger">{submitError}</FbAlert>}

          {/* Submit button */}
          <button
            type="submit"
            className="fs-btn fs-btn-primary"
            disabled={!canSubmit || submitting}
            style={{
              width: "100%",
              marginTop: 4,
            }}
          >
            {submitting ? "Setting up your account…" : "Accept Invite & Join"}
          </button>
        </form>
      </div>
    </div>
  );
}
