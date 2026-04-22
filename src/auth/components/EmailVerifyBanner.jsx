import { useContext, useState } from "react";
import { MailWarning } from "lucide-react";
import { AuthContext } from "@/auth/AuthProvider";
import { sendEmailVerification } from "@/shared/api";

function formatDeadline(graceEndsAt) {
  if (!graceEndsAt) return null;
  const d = new Date(graceEndsAt);
  if (isNaN(d)) return null;
  // Cron runs daily at 03:00 UTC — deletion happens the day after grace expires
  const deletionDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1));
  return deletionDay.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function EmailVerifyBanner() {
  const auth = useContext(AuthContext);
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  if (!auth?.user || auth.emailVerified || auth.isSuper) return null;

  const deadline = formatDeadline(auth?.graceEndsAt);

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
      <MailWarning size={13} strokeWidth={1.8} className="evb-icon" />
      <span className="evb-body">
        Verify your email — this account will be deleted
        {deadline ? <> on <strong>{deadline}</strong></> : " if not verified"}.
      </span>
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
  );
}
