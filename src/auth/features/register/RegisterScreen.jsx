import "./RegisterScreen.css";
import { useContext, useEffect, useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { UserPlus, Eye, EyeOff, Check, AlertCircle, Icon } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";
import { checkEmailAvailable } from "@/shared/api";
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

function normalizeError(raw) {
  const m = String(raw || "").toLowerCase();
  if (!m) return "Failed to complete registration. Please try again.";
  if (m.includes("email_already_registered") || m.includes("user already")) return "This email is already registered. Please sign in.";
  if (m.includes("email_required")) return "Your email is required.";
  if (m.includes("name_required")) return "Full name is required.";
  if (m.includes("org_name_required")) return "Organization name is required.";
  if (m.includes("org_name_taken")) return "An organization with that name already exists. Please use a different name.";
  if (m.includes("org_creation_failed")) return "Failed to set up your organization. Please try again.";
  return "Failed to complete registration. Please try again.";
}

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

export default function RegisterScreen({ onSwitchToLogin, onReturnHome, error: externalError }) {
  const navigate = useNavigate();
  const location = useLocation();
  const base = location.pathname.startsWith("/demo") ? "/demo" : "";
  const auth = useContext(AuthContext);
  const goLogin = onSwitchToLogin || (() => navigate(`${base}/login`));
  const goHome = onReturnHome || (() => navigate("/"));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [emailCheck, setEmailCheck] = useState({ status: "idle", message: "" });

  // Authenticated users that somehow land on /register (e.g. clicking the
  // Register link while already signed in, or a stale tab) should be sent to
  // /admin where AdminRouteLayout handles the right next step via its gates
  // (CompleteProfileForm for incomplete profiles, PendingReviewGate for
  // pending join requests, or the admin panel for active members).
  // Skip in demo mode: the demo admin is always auto-logged-in so this would
  // immediately redirect away from /demo/register on every visit.
  const isDemo = location.pathname.startsWith("/demo");

  // useShakeOnError must be called unconditionally before any early returns.
  const internalError = (error || "").trim();
  const externalNormalized = externalError ? normalizeError(String(externalError).trim()) : "";
  const displayError = internalError || externalNormalized;
  const submitBtnRef = useShakeOnError(displayError);

  // While auth is resolving, show the same background as the auth forms so
  // the redirect to /admin (fired once auth settles) has no visible flash.
  if (!isDemo && auth?.loading) return <div className="apply-screen" aria-busy="true" />;

  // Any authenticated user landing here is forwarded to /admin — that route
  // owns the profile/pending/admin gating logic, so /register doesn't have
  // to duplicate it.
  if (!isDemo && auth?.user) {
    return <Navigate to={`${base}/admin`} replace />;
  }

  const isEmailFormatValid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const markTouched = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  async function handleEmailBlur() {
    markTouched("email");
    const trimmed = email.trim();
    if (!isEmailFormatValid(trimmed)) return;
    setEmailCheck({ status: "checking", message: "" });
    try {
      const result = await checkEmailAvailable(trimmed);
      if (result?.available) setEmailCheck({ status: "available", message: "" });
      else setEmailCheck({ status: "taken", message: "This email is already registered. Please sign in." });
    } catch { setEmailCheck({ status: "idle", message: "" }); }
  }

  const validations = {
    name: fullName.trim().length > 0,
    email: isEmailFormatValid(email) && emailCheck.status !== "taken",
    org: orgName.trim().length > 0,
    password: isStrongPassword(password),
    confirm: password === confirmPassword && confirmPassword.length > 0,
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!fullName.trim()) return setError("Full name is required.");
    if (!email.trim()) return setError("Work email is required.");
    if (!orgName.trim()) return setError("Organization name is required.");
    if (!password) return setError("Password is required.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (!isStrongPassword(password)) return setError(PASSWORD_POLICY_ERROR_TEXT);
    if (emailCheck.status === "taken") return setError(emailCheck.message);

    setLoading(true);
    try {
      await auth.signUp(email.trim(), password, {
        name: fullName.trim(),
        orgName: orgName.trim(),
      });
      navigate(`${base}/admin`, { replace: true });
    } catch (err) {
      setError(normalizeError(err?.message || err?.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="apply-screen">
      <div className="apply-wrap">
        <div className="apply-card">
          <div className="apply-header">
            <div className="apply-icon-wrap"><UserPlus size={24} strokeWidth={1.5} /></div>
            <div className="apply-title">Create your workspace</div>
            <div className="apply-sub">Register your organization to start evaluating projects.</div>
          </div>

          <div className="apply-progress">
            {["name", "email", "org", "password", "confirm"].map((key) => (
              <div key={key} className={`apply-progress-bar${validations[key] ? " apply-progress-bar--filled" : ""}`} />
            ))}
          </div>

          {displayError && (
            <FbAlert variant="danger" style={{ marginBottom: "16px" }}>{displayError}</FbAlert>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <FieldText id="reg-name" label="Full Name" placeholder="Dr. Jane Doe"
              value={fullName} onChange={setFullName} onBlur={() => markTouched("name")}
              touched={touched.name} valid={validations.name}
              errorText="Full name is required." disabled={loading} />

            <FieldEmail id="reg-email" value={email}
              onChange={(v) => { setEmail(v); setEmailCheck({ status: "idle", message: "" }); }}
              onBlur={handleEmailBlur}
              touched={touched.email} valid={validations.email} checkStatus={emailCheck}
              disabled={loading} />

            <FieldText id="reg-org" label="Organization" placeholder="e.g., TED University — Electrical Engineering"
              value={orgName} onChange={setOrgName} onBlur={() => markTouched("org")}
              touched={touched.org} valid={validations.org} autoComplete="organization"
              errorText="Organization name is required." disabled={loading} />

            <FieldPassword id="reg-password" label="Password" value={password} onChange={setPassword}
              onBlur={() => markTouched("password")} touched={touched.password} valid={validations.password}
              show={showPass} setShow={setShowPass} placeholder={PASSWORD_POLICY_PLACEHOLDER} disabled={loading}>
              <PasswordStrengthBlock password={password} />
            </FieldPassword>

            <div className={`apply-field${touched.confirm && validations.confirm ? " apply-field--valid" : touched.confirm && !validations.confirm ? " apply-field--invalid" : ""}`} style={{ marginBottom: "24px" }}>
              <div className="apply-label-row">
                <label className="apply-label" htmlFor="reg-confirm" style={{ marginBottom: 0 }}>Confirm Password</label>
                {touched.confirm && validations.confirm && (
                  <span className="apply-valid-check"><Check size={12} strokeWidth={2.5} /></span>
                )}
              </div>
              <div className="apply-pw-wrap">
                <input id="reg-confirm" className="apply-input"
                  type={showConfirmPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onBlur={() => markTouched("confirm")}
                  placeholder="Re-enter password" autoComplete="new-password" disabled={loading} />
                <button type="button" className="apply-pw-toggle" tabIndex={-1}
                  onClick={() => setShowConfirmPass((v) => !v)}
                  aria-label={showConfirmPass ? "Hide password" : "Show password"}>
                  {showConfirmPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <div className="reg-pw-mismatch">Passwords do not match</div>
              )}
              {confirmPassword && password === confirmPassword && password.length > 0 && (
                <div className="reg-pw-match"><Check size={12} strokeWidth={3} />Passwords match</div>
              )}
            </div>

            <button ref={submitBtnRef} type="submit" className="apply-submit" disabled={loading}>
              {loading ? "Creating…" : "Create workspace"}
            </button>
          </form>
        </div>

        <div className="apply-footer">
          Already have an account? <button type="button" onClick={goLogin} className="form-link">Sign in</button>
        </div>
        <div className="apply-footer" style={{ marginTop: 4 }}>
          Joining an existing organization? Ask your admin for an invite link.
        </div>
        <div className="login-footer" style={{ marginTop: 8 }}>
          <button type="button" onClick={goHome} className="form-link">&larr; Return Home</button>
        </div>
      </div>
    </div>
  );
}

/* ── Small field components kept in-file to avoid over-fragmentation. ── */
function FieldText({ id, label, placeholder, value, onChange, onBlur, touched, valid, errorText, autoComplete, disabled }) {
  return (
    <div className={`apply-field${touched && valid ? " apply-field--valid" : touched && !valid ? " apply-field--invalid" : ""}`}>
      <div className="apply-label-row">
        <label className="apply-label" htmlFor={id} style={{ marginBottom: 0 }}>{label}</label>
        {touched && valid && <span className="apply-valid-check"><Check size={12} strokeWidth={2.5} /></span>}
      </div>
      <input id={id} className="apply-input" type="text" value={value}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
        placeholder={placeholder} autoComplete={autoComplete} disabled={disabled} />
      {touched && !valid && <div className="apply-field-error"><AlertCircle size={12} strokeWidth={2} />{errorText}</div>}
    </div>
  );
}

function FieldEmail({ id, value, onChange, onBlur, touched, valid, checkStatus, disabled }) {
  const status = checkStatus.status;
  return (
    <div className={`apply-field${touched && valid && status === "available" ? " apply-field--valid" : touched && (!valid || status === "taken") ? " apply-field--invalid" : ""}`}>
      <div className="apply-label-row">
        <label className="apply-label" htmlFor={id} style={{ marginBottom: 0 }}>Email</label>
        {touched && valid && status === "available" && (
          <span className="apply-valid-check"><Check size={12} strokeWidth={2.5} /></span>
        )}
      </div>
      <div style={{ position: "relative" }}>
        <input id={id} className="apply-input" type="email" value={value}
          onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
          placeholder="jane.doe@university.edu" autoComplete="email" disabled={disabled} />
        {status === "checking" && <span className="apply-email-checking" aria-label="Checking email…" />}
      </div>
      {touched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && (
        <div className="apply-field-error"><AlertCircle size={12} strokeWidth={2} />Valid email is required.</div>
      )}
      {status === "taken" && (
        <div className="apply-field-error"><AlertCircle size={12} strokeWidth={2} />{checkStatus.message}</div>
      )}
    </div>
  );
}

function FieldPassword({ id, label, value, onChange, onBlur, touched, valid, show, setShow, placeholder, disabled, children }) {
  return (
    <div className={`apply-field${touched && valid ? " apply-field--valid" : touched && !valid ? " apply-field--invalid" : ""}`}>
      <div className="apply-label-row">
        <label className="apply-label" htmlFor={id} style={{ marginBottom: 0 }}>{label}</label>
        {touched && valid && <span className="apply-valid-check"><Check size={12} strokeWidth={2.5} /></span>}
      </div>
      <div className="apply-pw-wrap">
        <input id={id} className="apply-input" type={show ? "text" : "password"}
          value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur}
          placeholder={placeholder} autoComplete="new-password" disabled={disabled} />
        <button type="button" className="apply-pw-toggle" tabIndex={-1}
          onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {children}
    </div>
  );
}
