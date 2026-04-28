import "./VerifyEmailScreen.css";
import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { MailCheck, MailWarning, Loader2, Mail, Info, RefreshCw, LogIn } from "lucide-react";
import { confirmEmailVerification, sendEmailVerification } from "@/shared/api";
import { AuthContext } from "@/auth/shared/AuthProvider";
import FbAlert from "@/shared/ui/FbAlert";

export default function VerifyEmailScreen() {
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useContext(AuthContext);
  const [state, setState] = useState("pending"); // pending | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [resendState, setResendState] = useState("idle"); // idle | sending | sent | error

  const isDemo = location.pathname.startsWith("/demo");
  const dashPath = isDemo ? "/demo/admin" : "/admin";

  const authRef = useRef(auth);
  useEffect(() => { authRef.current = auth; }, [auth]);

  useEffect(() => {
    let cancelled = false;
    const token = search.get("token");
    if (!token) { setState("error"); setErrorMsg("Verification link is invalid or missing."); return; }
    confirmEmailVerification(token)
      .then(() => {
        if (cancelled) return;
        setState("success");
        authRef.current?.refreshEmailVerified?.();
      })
      .catch((e) => {
        if (cancelled) return;
        setState("error");
        setErrorMsg(normalize(e?.message));
      });
    return () => { cancelled = true; };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state !== "success") return;
    const id = setTimeout(() => navigate(dashPath, { replace: true }), 2000);
    return () => clearTimeout(id);
  }, [state, navigate, dashPath]);

  async function onResend() {
    setResendState("sending");
    try {
      await sendEmailVerification();
      setResendState("sent");
    } catch (e) {
      setResendState("error");
      setErrorMsg("Failed to resend verification email.");
    }
  }

  return (
    <div className="vef-screen">
      <div className={`vef-ambient-glow vef-ambient-glow--${state}`} aria-hidden />


      <div className="vef-info-card" role="status" aria-live="polite">
        <div className="vef-hero" aria-hidden>
          <div className={`vef-ring vef-ring--3 vef-ring--${state}`} />
          <div className={`vef-ring vef-ring--2 vef-ring--${state}`} />
          <div className={`vef-ring vef-ring--1 vef-ring--${state}`} />
          <div className={`vef-icon-circle vef-icon-circle--${state}`}>
            {state === "pending" && <Loader2 size={32} strokeWidth={2} className="vef-spin" />}
            {state === "success" && <MailCheck size={32} strokeWidth={1.8} />}
            {state === "error"   && <MailWarning size={32} strokeWidth={1.8} />}
          </div>
        </div>
        {state === "pending" && (
          <>
            <div className="vef-title">Verifying your email</div>
            <div className="vef-sub">Just a moment — we&apos;re confirming your address.</div>
            <div className="vef-dots" aria-hidden>
              <span /><span /><span />
            </div>
            <div className="vef-info-hint">
              <Info size={14} strokeWidth={2} />
              <p>
                This link is <strong>single-use</strong> and expires 24 hours after it was
                sent. If verification fails, request a new link from the banner inside your
                dashboard.
              </p>
            </div>
          </>
        )}

        {state === "success" && (
          <>
            <div className="vef-title vef-title--success">Email verified</div>
            <div className="vef-sub">Your address is confirmed. Full access is now unlocked.</div>
            {auth?.user?.email && (
              <div className="vef-email-row">
                <Mail size={13} strokeWidth={2} />
                <span>{auth.user.email}</span>
              </div>
            )}
            <div className="vef-redirect-hint">
              <span className="vef-redirect-dot" aria-hidden />
              Redirecting to dashboard…
            </div>
          </>
        )}

        {state === "error" && (
          <>
            <div className="vef-title vef-title--error">Verification failed</div>
            <div className="vef-sub">We couldn&apos;t verify your email address.</div>
            <FbAlert variant="danger">{errorMsg}</FbAlert>

            {resendState === "sent" ? (
              <div className="vef-sent-msg">
                <Mail size={13} strokeWidth={2} />
                Verification link sent — check your inbox.
              </div>
            ) : (
              <button
                type="button"
                className="apply-submit vef-resend-btn"
                onClick={onResend}
                disabled={resendState === "sending"}
              >
                <RefreshCw size={13} strokeWidth={2.2} className={resendState === "sending" ? "vef-spin" : ""} />
                {resendState === "sending" ? "Sending…" : "Resend verification link"}
              </button>
            )}

            {resendState === "error" && (
              <FbAlert variant="danger" style={{ marginTop: 8 }}>{errorMsg}</FbAlert>
            )}

            <button
              type="button"
              className="vef-btn-ghost"
              onClick={() => navigate(dashPath)}
            >
              <LogIn size={13} strokeWidth={2} />
              Back to dashboard
            </button>
          </>
        )}
      </div>


    </div>
  );
}

function normalize(raw) {
  const m = String(raw || "").toLowerCase();
  if (m.includes("expired"))      return "This verification link has expired. Request a new one from the banner in your dashboard.";
  if (m.includes("already_used")) return "This link has already been used.";
  if (m.includes("not_found"))    return "This link is invalid or has already expired.";
  return "Failed to verify your email. Please request a new link.";
}
