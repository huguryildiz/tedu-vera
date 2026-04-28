import "./GraceLockScreen.css";
import { useState } from "react";
import { AlertTriangle, Mail, LogOut } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";
import { sendEmailVerification } from "@/shared/api";

export default function GraceLockScreen({ user, onSignOut }) {
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  async function onResend() {
    setState("sending");
    setErrorMsg("");
    try {
      await sendEmailVerification();
      setState("sent");
    } catch (e) {
      setState("error");
      setErrorMsg("Failed to send verification email. Please try again.");
    }
  }

  return (
    <div className="login-screen">
      <div className="gls-wrap">
        <div className="apply-card gls-card">
          <div className="gls-icon-wrap">
            <AlertTriangle size={28} strokeWidth={1.5} className="gls-icon" />
          </div>
          <h1 className="gls-title">Account Pending Deletion</h1>
          <p className="gls-sub">
            Your email verification grace period has expired. Your account is
            scheduled for automatic deletion — verify your email now to cancel
            the deletion and restore full access.
          </p>

          <div className="gls-email-row">
            <Mail size={14} strokeWidth={2} className="gls-email-icon" />
            <span className="gls-email">{user?.email}</span>
          </div>

          <FbAlert variant="danger" className="gls-alert">
            Your account will be permanently deleted unless you verify your email
            address. Verification will cancel the deletion immediately.
          </FbAlert>

          <div className="gls-actions">
            {state === "sent" ? (
              <div className="gls-sent-msg">
                <Mail size={14} strokeWidth={2} />
                Verification link sent — check your inbox.
              </div>
            ) : (
              <button
                type="button"
                className="gls-btn-primary"
                onClick={onResend}
                disabled={state === "sending"}
              >
                {state === "sending" ? "Sending…" : "Resend verification link"}
              </button>
            )}
            {state === "error" && (
              <FbAlert variant="danger" className="gls-error">{errorMsg}</FbAlert>
            )}
            <button
              type="button"
              className="gls-btn-signout"
              onClick={onSignOut}
            >
              <LogOut size={14} strokeWidth={2} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
