// src/auth/RegisterScreen.jsx — Phase 12
// Premium apply-for-access form with Google OAuth flow badge,
// password strength indicator, and success state.

import { useContext, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { UserPlus, Eye, EyeOff, Check, Info, Icon, Building2, Plus } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";
import { checkEmailAvailable, listOrganizationsPublic } from "@/shared/api";
import { requestToJoinOrg } from "@/shared/api";
import { AuthContext } from "@/auth/AuthProvider";
import GroupedCombobox from "@/shared/ui/GroupedCombobox";
import useShakeOnError from "@/shared/hooks/useShakeOnError";
import {
  evaluatePassword,
  isStrongPassword,
  PASSWORD_POLICY_ERROR_TEXT,
  PASSWORD_POLICY_PLACEHOLDER,
} from "@/shared/passwordPolicy";


const normalizeError = (raw) => {
  const msg = String(raw || "").toLowerCase().trim();
  if (!msg) return "Could not complete registration. Please try again.";
  if (msg.includes("email_already_registered")) return "This email is already registered. Please sign in.";
  if (msg.includes("email_required")) return "Your email is required.";
  if (msg.includes("name_required")) return "Full name is required.";
  if (msg.includes("org_name_required")) return "Organization name is required.";
  if (msg.includes("org_name_taken")) return "An organization with that name already exists. Please use a different name.";
  if (msg.includes("org_creation_failed")) return "Could not create your organization. Please try again.";
  if (msg.includes("already_member")) return "You are already a member of this organization.";
  if (msg.includes("already_requested")) return "You have already submitted a join request for this organization.";
  if (msg.includes("org_not_found")) return "The selected organization could not be found.";
  if (msg.includes("join_request_failed")) return "Could not submit your join request. Please try again.";
  return String(raw);
};

const extractErrorText = (err) => {
  if (!err) return "";
  return [err.message, err.details, err.hint, err.code ? `code:${err.code}` : ""].filter(Boolean).join(" | ");
};

/* ── Google badge ── */
const GOOGLE_ICON = (
  <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

/* ── Password Strength ── */
function getPasswordStrength(password) {
  if (!password) return { level: 0, label: "" };
  const { score } = evaluatePassword(password);

  if (score <= 1) return { level: 1, label: "Weak" };
  if (score <= 2) return { level: 2, label: "Fair" };
  if (score <= 4) return { level: 3, label: "Good" };
  return { level: 4, label: "Strong" };
}

function PasswordStrengthBar({ password }) {
  const { level, label } = getPasswordStrength(password);
  if (!password) return null;
  const colors = ["", "reg-pw-weak", "reg-pw-fair", "reg-pw-good", "reg-pw-strong"];
  return (
    <div className="reg-pw-strength">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className={`reg-pw-bar ${i <= level ? colors[level] : ""}`} />
      ))}
      <span className={`reg-pw-label ${colors[level]}`}>{label}</span>
    </div>
  );
}

export default function RegisterScreen({ onRegister, onSwitchToLogin, onReturnHome, error: externalError }) {
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith("/demo") ? "/demo" : "";
  const auth = useContext(AuthContext);
  const authUser = auth?.user || null;
  const authLoading = !!auth?.loading;
  const profileIncomplete = !!auth?.profileIncomplete;
  const isGoogleApplicationFlow = !!authUser && profileIncomplete;
  const doRegister = onRegister || auth?.signUp || (async () => {
    throw new Error("Registration is not configured in this screen context.");
  });
  const doCompleteProfile = auth?.completeProfile;
  const goLogin = onSwitchToLogin || (() => navigate(`${base}/login`));
  const goHome = onReturnHome || (() => navigate("/"));

  const [fullName, setFullName] = useState(() => String(authUser?.name || "").trim());
  const [email, setEmail] = useState(() => String(authUser?.email || "").trim());
  const [orgName, setOrgName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submittedDept, setSubmittedDept] = useState("");

  // Org discovery: "create" (new org) or "join" (existing org)
  const [orgMode, setOrgMode] = useState("create");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [orgOptions, setOrgOptions] = useState([]);
  const [joinRequestSubmitted, setJoinRequestSubmitted] = useState(false);

  const isValidPassword = isStrongPassword;
  const passwordPlaceholder = PASSWORD_POLICY_PLACEHOLDER;

  useEffect(() => {
    if (!authLoading && authUser && !profileIncomplete) {
      navigate(`${base}/admin`, { replace: true });
    }
  }, [authLoading, authUser, profileIncomplete, navigate]);

  useEffect(() => {
    if (!authUser) return;
    if (!email.trim() && authUser.email) setEmail(String(authUser.email));
    if (!fullName.trim() && authUser.name) setFullName(String(authUser.name));
  }, [authUser, email, fullName]);

  // Load existing organizations for discovery dropdown
  useEffect(() => {
    let active = true;
    listOrganizationsPublic()
      .then((orgs) => {
        if (!active) return;
        setOrgOptions(
          orgs.map((o) => ({
            value: o.id,
            label: o.name,
            group: o.institution || "Other",
          }))
        );
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const [touched, setTouched] = useState({});
  const markTouched = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const [emailCheck, setEmailCheck] = useState({ status: "idle", message: "" });
  // status: "idle" | "checking" | "available" | "taken"

  const isEmailFormatValid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  async function handleEmailBlur() {
    markTouched("email");
    const trimmed = email.trim();
    if (!isEmailFormatValid(trimmed) || isGoogleApplicationFlow) return;
    setEmailCheck({ status: "checking", message: "" });
    try {
      const result = await checkEmailAvailable(trimmed);
      if (result?.available) {
        setEmailCheck({ status: "available", message: "" });
      } else {
        const reason = result?.reason || "";
        const msg =
          reason === "email_already_registered"
            ? "This email is already registered. Please sign in."
            : reason === "application_already_pending"
              ? "You already have a pending application with this email."
              : "This email is not available.";
        setEmailCheck({ status: "taken", message: msg });
      }
    } catch {
      setEmailCheck({ status: "idle", message: "" });
    }
  }

  const validations = {
    name: fullName.trim().length > 0,
    email: isEmailFormatValid(email) && emailCheck.status !== "taken",
    org: orgMode === "join" ? !!selectedOrgId : orgName.trim().length > 0,
    password: isValidPassword(password),
    confirm: password === confirmPassword && confirmPassword.length > 0,
  };

  const fieldKeys = isGoogleApplicationFlow
    ? ["name", "email", "org"]
    : ["name", "email", "org", "password", "confirm"];

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) { setError("Full name is required."); return; }
    if (!email.trim()) { setError("Work email is required."); return; }
    if (orgMode === "join") {
      if (!selectedOrgId) { setError("Please select an organization to join."); return; }
    } else {
      if (!orgName.trim()) { setError("Organization name is required."); return; }
    }
    if (!isGoogleApplicationFlow) {
      if (!password) { setError("Password is required."); return; }
      if (password !== confirmPassword) { setError("Passwords do not match."); return; }
      if (!isValidPassword(password)) {
        setError(PASSWORD_POLICY_ERROR_TEXT);
        return;
      }
    }

    if (emailCheck.status === "taken") {
      setError(emailCheck.message || "This email is not available.");
      return;
    }

    setLoading(true);
    try {
      if (isGoogleApplicationFlow) {
        if (typeof doCompleteProfile !== "function") {
          throw new Error("Profile completion is not configured.");
        }
        if (orgMode === "join") {
          await doCompleteProfile({ name: fullName.trim(), joinOrgId: selectedOrgId });
        } else {
          await doCompleteProfile({ name: fullName.trim(), orgName: orgName.trim(), institution: "", department: "" });
          navigate(`${base}/admin`, { replace: true });
          return;
        }
      } else {
        // Email/password path: register first, then join request happens after email confirmation + login
        const payload = {
          name: fullName.trim(),
          orgName: orgMode === "join" ? "" : orgName.trim(),
          institution: "",
          department: "",
          joinOrgId: orgMode === "join" ? selectedOrgId : undefined,
        };
        await doRegister(email.trim(), password, payload);
      }

      if (orgMode === "join") {
        const selectedLabel = orgOptions.find((o) => String(o.value) === String(selectedOrgId))?.label || "";
        setSubmittedEmail(email.trim());
        setSubmittedDept(selectedLabel);
        setJoinRequestSubmitted(true);
        setSubmitted(true);
      } else {
        setSubmittedEmail(email.trim());
        setSubmittedDept(orgName.trim());
        setSubmitted(true);
      }
    } catch (err) {
      setError(normalizeError(extractErrorText(err) || "Registration could not be completed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  const rawDisplayError = (error || externalError || "").trim();
  const displayError = rawDisplayError ? normalizeError(rawDisplayError) : "";
  const submitBtnRef = useShakeOnError(displayError);

  /* ── Success State ── */
  if (submitted) {
    return (
      <div className="apply-screen">
        <div className="apply-wrap">
          <div className="apply-card apply-success-card">
            <div className="apply-success-icon">
              <Icon
                iconNode={[]}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" opacity="0.3"/>
                <path className="check-path" d="M8 12.5l2.5 3 5.5-6.5"/>
              </Icon>
            </div>
            <div className="apply-success-title">
              {joinRequestSubmitted ? "Request Submitted" : "Check Your Email"}
            </div>
            <div className="apply-success-sub">
              {joinRequestSubmitted
                ? "Your request to join the organization has been submitted. An administrator will review and approve your access."
                : "Your account has been created. Click the confirmation link in your email to activate it, then sign in to complete your profile."}
            </div>

            <div className="apply-detail-card">
              <div className="apply-detail-row">
                <span className="apply-detail-label">Email</span>
                <span className="apply-detail-value">{submittedEmail}</span>
              </div>
              <div className="apply-detail-row">
                <span className="apply-detail-label">Organization</span>
                <span className="apply-detail-value">{submittedDept}</span>
              </div>
            </div>

            <div className="apply-info-hint">
              <Info size={16} />
              <p>Check your inbox at <strong>{submittedEmail}</strong> for a confirmation link.</p>
            </div>

            <button
              type="button"
              className="btn btn-primary"
              onClick={goLogin}
            >
              Back to Sign In
            </button>

            <div className="login-footer" style={{ marginTop: "16px" }}>
              <button type="button" onClick={goHome} className="form-link">
                &larr; Return Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Form State ── */
  return (
    <div className="apply-screen">
      <div className="apply-wrap">
        <div className="apply-card">
          {/* Header */}
          <div className="apply-header">
            <div className="apply-icon-wrap">
              <UserPlus size={24} strokeWidth={1.5} />
            </div>
            <div className="apply-title">Apply for Access</div>
            <div className="apply-sub">
              {isGoogleApplicationFlow
                ? "Complete your application to request admin access."
                : "Register your department to start evaluating."}
            </div>
          </div>

          {/* Google badge */}
          {isGoogleApplicationFlow && (
            <div className="reg-google-badge-wrap">
              <div className="reg-google-badge">
                {GOOGLE_ICON}
                Signed in with Google
              </div>
            </div>
          )}

          {/* Progress indicator */}
          <div className="apply-progress">
            {fieldKeys.map((key) => (
              <div
                key={key}
                className={`apply-progress-bar${validations[key] ? " apply-progress-bar--filled" : ""}`}
              />
            ))}
          </div>

          {displayError && (
            <FbAlert variant="danger" style={{ marginBottom: "16px" }}>
              {displayError}
            </FbAlert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className={`apply-field${touched.name && validations.name ? " apply-field--valid" : touched.name && !validations.name ? " apply-field--invalid" : ""}`}>
              <div className="apply-label-row">
                <label className="apply-label" htmlFor="reg-name" style={{ marginBottom: 0 }}>Full Name</label>
                {touched.name && validations.name && (
                  <span className="apply-valid-check"><Check size={12} strokeWidth={2.5} /></span>
                )}
              </div>
              <input
                id="reg-name"
                className="apply-input"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onBlur={() => markTouched("name")}
                placeholder="Dr. Jane Doe"
                disabled={loading}
              />
              {touched.name && !validations.name && (
                <div className="apply-field-error">Full name is required.</div>
              )}
            </div>

            <div className={`apply-field${(touched.email && validations.email && emailCheck.status === "available") ? " apply-field--valid" : (touched.email && (!validations.email || emailCheck.status === "taken")) ? " apply-field--invalid" : ""}`}>
              <div className="apply-label-row">
                <label className="apply-label" htmlFor="reg-email" style={{ marginBottom: 0 }}>Institutional Email</label>
                {touched.email && validations.email && emailCheck.status === "available" && (
                  <span className="apply-valid-check"><Check size={12} strokeWidth={2.5} /></span>
                )}
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="reg-email"
                  className="apply-input"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailCheck({ status: "idle", message: "" }); }}
                  onBlur={handleEmailBlur}
                  placeholder="jane.doe@university.edu"
                  autoComplete="email"
                  disabled={loading || isGoogleApplicationFlow}
                />
                {emailCheck.status === "checking" && (
                  <span className="apply-email-checking" aria-label="Checking email…" />
                )}
              </div>
              {touched.email && !isEmailFormatValid(email) && (
                <div className="apply-field-error">Valid email is required.</div>
              )}
              {emailCheck.status === "taken" && (
                <div className="apply-field-error">{emailCheck.message}</div>
              )}
            </div>

            {/* Org mode toggle */}
            <div className="apply-field">
              <div className="apply-label-row">
                <label className="apply-label" style={{ marginBottom: 0 }}>Organization</label>
                {touched.org && validations.org && (
                  <span className="apply-valid-check"><Check size={12} strokeWidth={2.5} /></span>
                )}
              </div>
              <div className="reg-org-toggle">
                <button
                  type="button"
                  className={`reg-org-toggle-btn${orgMode === "create" ? " reg-org-toggle-btn--active" : ""}`}
                  onClick={() => { setOrgMode("create"); setSelectedOrgId(""); }}
                  disabled={loading}
                >
                  <Plus size={14} strokeWidth={2} />
                  Create New
                </button>
                <button
                  type="button"
                  className={`reg-org-toggle-btn${orgMode === "join" ? " reg-org-toggle-btn--active" : ""}`}
                  onClick={() => { setOrgMode("join"); setOrgName(""); markTouched("org"); }}
                  disabled={loading || orgOptions.length === 0}
                >
                  <Building2 size={14} strokeWidth={2} />
                  Join Existing
                </button>
              </div>

              {orgMode === "create" ? (
                <input
                  id="reg-org-name"
                  className="apply-input"
                  type="text"
                  value={orgName}
                  onChange={(e) => { setOrgName(e.target.value); markTouched("org"); }}
                  onBlur={() => markTouched("org")}
                  placeholder="e.g., TED University — Electrical Engineering"
                  autoComplete="organization"
                  disabled={loading}
                />
              ) : (
                <GroupedCombobox
                  id="reg-org-join"
                  value={selectedOrgId}
                  onChange={(v) => { setSelectedOrgId(v); markTouched("org"); }}
                  options={orgOptions}
                  placeholder="Search organizations…"
                  emptyMessage="No organizations found."
                  disabled={loading}
                  ariaLabel="Select organization to join"
                />
              )}

              {touched.org && !validations.org && (
                <div className="apply-field-error">
                  {orgMode === "join" ? "Please select an organization." : "Organization name is required."}
                </div>
              )}
            </div>

            {!isGoogleApplicationFlow && (
              <>
                <div className={`apply-field${touched.password && validations.password ? " apply-field--valid" : touched.password && !validations.password ? " apply-field--invalid" : ""}`}>
                  <div className="apply-label-row">
                    <label className="apply-label" htmlFor="reg-password" style={{ marginBottom: 0 }}>Password</label>
                    {touched.password && validations.password && (
                      <span className="apply-valid-check"><Check size={12} strokeWidth={2.5} /></span>
                    )}
                  </div>
                  <div className="apply-pw-wrap">
                    <input
                      id="reg-password"
                      className="apply-input"
                      type={showPass ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => markTouched("password")}
                      placeholder={passwordPlaceholder}
                      autoComplete="new-password"
                      disabled={loading}
                    />
                    <button type="button" className="apply-pw-toggle" tabIndex={-1} onClick={() => setShowPass((v) => !v)} aria-label={showPass ? "Hide password" : "Show password"}>
                      {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <PasswordStrengthBar
                    password={password}
                  />
                </div>

                <div className={`apply-field${touched.confirm && validations.confirm ? " apply-field--valid" : touched.confirm && !validations.confirm ? " apply-field--invalid" : ""}`} style={{ marginBottom: "24px" }}>
                  <div className="apply-label-row">
                    <label className="apply-label" htmlFor="reg-confirm" style={{ marginBottom: 0 }}>Confirm Password</label>
                    {touched.confirm && validations.confirm && (
                      <span className="apply-valid-check"><Check size={12} strokeWidth={2.5} /></span>
                    )}
                  </div>
                  <div className="apply-pw-wrap">
                    <input
                      id="reg-confirm"
                      className="apply-input"
                      type={showConfirmPass ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onBlur={() => markTouched("confirm")}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      disabled={loading}
                    />
                    <button type="button" className="apply-pw-toggle" tabIndex={-1} onClick={() => setShowConfirmPass((v) => !v)} aria-label={showConfirmPass ? "Hide password" : "Show password"}>
                      {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <div className="reg-pw-mismatch">Passwords do not match</div>
                  )}
                  {confirmPassword && password === confirmPassword && password.length > 0 && (
                    <div className="reg-pw-match">
                      <Check size={12} strokeWidth={3} />
                      Passwords match
                    </div>
                  )}
                </div>
              </>
            )}

            <button ref={submitBtnRef} type="submit" className="apply-submit" disabled={loading}>
              {loading
                ? "Submitting…"
                : isGoogleApplicationFlow
                  ? "Submit Application"
                  : "Register"}
            </button>
          </form>
        </div>

        {!isGoogleApplicationFlow && (
          <div className="apply-footer">
            Already have an account?{" "}
            <button type="button" onClick={goLogin} className="form-link">
              Sign in
            </button>
          </div>
        )}
        <div className="login-footer" style={{ marginTop: "8px" }}>
          <button type="button" onClick={goHome} className="form-link">
            &larr; Return Home
          </button>
        </div>
      </div>
    </div>
  );
}
