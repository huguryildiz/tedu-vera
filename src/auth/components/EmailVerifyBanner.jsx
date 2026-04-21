import { useContext, useState, useEffect } from "react";
import { MailWarning } from "lucide-react";
import { AuthContext } from "@/auth/AuthProvider";
import { sendEmailVerification } from "@/shared/api";

function formatCountdown(graceEndsAt) {
  if (!graceEndsAt) return "7 DAYS";
  const ms = new Date(graceEndsAt) - Date.now();
  if (ms <= 0) return "SOON";
  const totalSecs = Math.floor(ms / 1000);
  const totalHours = Math.floor(totalSecs / 3600);
  const days = Math.floor(totalHours / 24);
  if (totalHours >= 24) return days === 1 ? "1 DAY" : `${days} DAYS`;
  if (totalHours >= 1) {
    const mins = Math.floor((totalSecs % 3600) / 60);
    return `${totalHours}h ${String(mins).padStart(2, "0")}m`;
  }
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

export default function EmailVerifyBanner() {
  const auth = useContext(AuthContext);
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");
  const [countdown, setCountdown] = useState(() => formatCountdown(auth?.graceEndsAt ?? null));

  useEffect(() => {
    if (!auth?.graceEndsAt) return;
    const id = setInterval(() => setCountdown(formatCountdown(auth.graceEndsAt)), 1000);
    return () => clearInterval(id);
  }, [auth?.graceEndsAt]);

  if (!auth?.user || auth.emailVerified || auth.isSuper) return null;

  async function onResend() {
    setState("sending");
    setErrorMsg("");
    try {
      await sendEmailVerification();
      setState("sent");
    } catch (e) {
      setState("error");
      setErrorMsg(String(e?.message || "Failed to send. Try again."));
    }
  }

  return (
    <div className="evb-wrap" role="status" aria-live="polite">
      <div className="evb-left">
        <div className="evb-icon-wrap">
          <MailWarning size={18} strokeWidth={1.8} />
        </div>
        <div className="evb-badge">{countdown}</div>
      </div>
      <div className="evb-content">
        <div className="evb-body">
          Verify your email — unverified accounts are automatically deleted after 7 days.
        </div>
        <div className="evb-action">
          {state === "sent" ? (
            <span className="evb-sent">Link sent — check your inbox.</span>
          ) : (
            <button
              type="button"
              className="evb-btn"
              onClick={onResend}
              disabled={state === "sending"}
            >
              {state === "sending" ? "Sending…" : "Resend link"}
            </button>
          )}
          {state === "error" && <span className="evb-error">{errorMsg}</span>}
        </div>
      </div>
    </div>
  );
}
