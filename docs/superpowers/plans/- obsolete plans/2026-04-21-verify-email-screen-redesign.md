# Verify Email Screen Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `VerifyEmailScreen`'s glassmorphism card layout with a Hero/Ambient full-screen design (large circular icon + concentric rings + minimal info card), fix the inline `<svg>` CLAUDE.md violation, and replace raw danger divs with `FbAlert`.

**Architecture:** Two files change — `src/styles/auth.css` (vef-* CSS section replaced in-place) and `src/auth/screens/VerifyEmailScreen.jsx` (JSX structure rewritten, all logic unchanged). No new files created. All state machine logic, API calls, and auto-redirect behaviour are preserved exactly.

**Tech Stack:** React, CSS (vanilla with CSS custom properties), lucide-react, existing FbAlert component.

---

## File Map

| File | Change |
|------|--------|
| `src/styles/auth.css` | Replace lines 861–1052 (entire vef-* section) with new Hero/Ambient CSS |
| `src/auth/screens/VerifyEmailScreen.jsx` | Rewrite JSX structure; add FbAlert import; replace inline SVG with MailCheck |

---

## Task 1: Replace the vef-* CSS section in auth.css

The current `/* VERIFY EMAIL SCREEN */` block runs from line 861 to 1052 in `src/styles/auth.css`. Replace the entire block (from the `/* ═══ VERIFY EMAIL SCREEN */` comment through the closing `@media(max-width:480px)` rule) with the Hero/Ambient CSS below.

**Files:**
- Modify: `src/styles/auth.css:861-1052`

- [ ] **Step 1: Open auth.css and locate the vef section**

  Confirm the block starts at the `/* ═══════════════════════════════════════════════════` line containing "VERIFY EMAIL SCREEN" and ends at line 1052 (`}`). The line just before it (line 860) is blank; the line after (1053) is blank too — leave those blank lines in place.

- [ ] **Step 2: Replace the entire vef section**

  Delete lines 861–1052 and replace with exactly the following:

```css
/* ═══════════════════════════════════════════════════
   VERIFY EMAIL SCREEN — Hero/Ambient
   ═══════════════════════════════════════════════════ */

/* ── Keyframes ── */
@keyframes ring-pulse{
  0%,100%{transform:scale(0.92);opacity:0.18}
  50%{transform:scale(1.08);opacity:0.45}
}
@keyframes ring-emit{
  0%{transform:scale(0.85);opacity:0.5}
  100%{transform:scale(1.12);opacity:0}
}
@keyframes icon-pop{
  0%{transform:scale(0);opacity:0}
  75%{transform:scale(1.15);opacity:1}
  100%{transform:scale(1);opacity:1}
}
@keyframes icon-shake{
  0%{transform:translateX(0)}
  15%{transform:translateX(-6px)}
  30%{transform:translateX(6px)}
  45%{transform:translateX(-4px)}
  60%{transform:translateX(4px)}
  75%{transform:translateX(-2px)}
  90%{transform:translateX(2px)}
  100%{transform:translateX(0)}
}
@keyframes dot-bounce{
  0%,80%,100%{transform:translateY(0)}
  40%{transform:translateY(-8px)}
}
@keyframes vef-spin{to{transform:rotate(360deg)}}
@keyframes vef-redirect-pulse{
  0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(34,197,94,0.45)}
  50%{opacity:0.75;box-shadow:0 0 0 5px rgba(34,197,94,0)}
}

/* ── Full-screen layout ── */
.vef-screen{
  min-height:100dvh;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:40px 16px;
  background:linear-gradient(155deg,#050912 0%,#0c1528 30%,#111e38 50%,#0a1020 75%,#050912 100%);
  position:relative;overflow:hidden;
}

/* ── Ambient radial glow (behind rings) ── */
.vef-ambient-glow{position:absolute;inset:0;pointer-events:none}
.vef-ambient-glow::after{
  content:'';position:absolute;top:35%;left:50%;transform:translate(-50%,-50%);
  width:640px;height:640px;
}
.vef-ambient-glow--pending::after{background:radial-gradient(circle,rgba(99,102,241,0.13) 0%,transparent 65%)}
.vef-ambient-glow--success::after{background:radial-gradient(circle,rgba(34,197,94,0.11) 0%,transparent 65%)}
.vef-ambient-glow--error::after{background:radial-gradient(circle,rgba(239,68,68,0.11) 0%,transparent 65%)}

/* ── VERA logo ── */
.vef-logo{
  display:flex;align-items:center;justify-content:center;gap:9px;
  margin-bottom:20px;position:relative;z-index:1;
}
.vef-logo-diamond{
  width:18px;height:18px;flex-shrink:0;
  background:linear-gradient(135deg,#6366f1,#8b5cf6);
  clip-path:polygon(50% 0%,100% 50%,50% 100%,0% 50%);
}
.vef-logo-text{
  font-size:15px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;
  background:linear-gradient(135deg,#ffffff 0%,#c4b5fd 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}

/* ── Hero zone (rings + icon) ── */
.vef-hero{
  position:relative;display:flex;align-items:center;justify-content:center;
  width:240px;height:240px;margin-bottom:28px;
}

/* ── Concentric rings ── */
.vef-ring{
  position:absolute;border-radius:50%;border:1px solid;pointer-events:none;
}
.vef-ring--1{width:128px;height:128px}
.vef-ring--2{width:176px;height:176px}
.vef-ring--3{width:224px;height:224px}

.vef-ring--pending{
  border-color:rgba(99,102,241,0.35);
  animation:ring-pulse 2s ease-in-out infinite;
}
.vef-ring--2.vef-ring--pending{animation-delay:0.5s}
.vef-ring--3.vef-ring--pending{animation-delay:1s}

.vef-ring--success{
  border-color:rgba(34,197,94,0.45);
  animation:ring-emit 0.8s ease-out 1 both;
}
.vef-ring--2.vef-ring--success{animation-delay:0.15s}
.vef-ring--3.vef-ring--success{animation-delay:0.3s}

.vef-ring--error{border-color:rgba(239,68,68,0.22)}

/* ── Icon circle ── */
.vef-icon-circle{
  position:relative;z-index:1;
  width:96px;height:96px;border-radius:50%;
  display:grid;place-items:center;border:1px solid;
}
.vef-icon-circle--pending{
  background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(124,58,237,0.14));
  border-color:rgba(99,102,241,0.3);color:#a5b4fc;
}
.vef-icon-circle--success{
  background:linear-gradient(135deg,rgba(34,197,94,0.18),rgba(16,185,129,0.14));
  border-color:rgba(34,197,94,0.3);color:#4ade80;
  animation:icon-pop 0.4s ease-out both;
}
.vef-icon-circle--error{
  background:linear-gradient(135deg,rgba(239,68,68,0.18),rgba(220,38,38,0.12));
  border-color:rgba(239,68,68,0.3);color:#f87171;
  animation:icon-shake 0.5s ease-out both;
}

/* ── Spin (Loader2 + resend icon) ── */
.vef-spin{animation:vef-spin 0.8s linear infinite;display:block}

/* ── Body (title + subtitle below hero) ── */
.vef-body{text-align:center;margin-bottom:24px;position:relative;z-index:1}
.vef-title{
  font-size:26px;font-weight:700;margin-bottom:8px;
  background:linear-gradient(135deg,#ffffff 0%,#93c5fd 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.vef-title--success{
  background:linear-gradient(135deg,#ffffff 0%,#86efac 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.vef-title--error{
  background:linear-gradient(135deg,#ffffff 0%,#fca5a5 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.vef-sub{font-size:14px;color:#64748b;line-height:1.5}

/* ── Info card (secondary content below body) ── */
.vef-info-card{
  width:100%;max-width:380px;
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.08);
  border-radius:16px;padding:20px;
  position:relative;z-index:1;
}

/* ── Pending: dot bounce ── */
.vef-dots{
  display:flex;align-items:center;justify-content:center;gap:7px;margin-bottom:16px;
}
.vef-dots span{
  width:7px;height:7px;border-radius:50%;
  background:rgba(99,102,241,0.4);
  animation:dot-bounce 1.4s ease-in-out infinite;
}
.vef-dots span:nth-child(2){animation-delay:0.2s}
.vef-dots span:nth-child(3){animation-delay:0.4s}

/* ── Info hint ── */
.vef-info-hint{
  display:flex;align-items:flex-start;gap:9px;padding:12px 14px;
  background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.12);
  border-radius:10px;text-align:left;
}
.vef-info-hint svg{flex-shrink:0;color:#60a5fa;margin-top:1px}
.vef-info-hint p{
  font-size:12px;color:#94a3b8;line-height:1.55;margin:0;
  text-align:justify;text-justify:inter-word;
}
.vef-info-hint strong{color:#e2e8f0;font-weight:600}

/* ── Email row (success) ── */
.vef-email-row{
  display:inline-flex;align-items:center;gap:7px;
  padding:7px 14px;border-radius:20px;
  background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.09);
  font-size:12.5px;color:#94a3b8;font-weight:500;
  margin:0 auto 14px;
}
.vef-email-row svg{color:#64748b;flex-shrink:0}

/* ── Redirect hint (success) ── */
.vef-redirect-hint{
  display:flex;align-items:center;justify-content:center;gap:8px;
  font-size:12px;color:#64748b;font-style:italic;
}
.vef-redirect-dot{
  width:7px;height:7px;border-radius:50%;background:#22c55e;flex-shrink:0;
  animation:vef-redirect-pulse 1.2s ease-in-out infinite;
}

/* ── Sent confirmation (after resend) ── */
.vef-sent-msg{
  display:flex;align-items:center;justify-content:center;gap:7px;
  font-size:12.5px;color:#4ade80;font-weight:500;
  padding:10px 0;margin-bottom:8px;
}
.vef-sent-msg svg{flex-shrink:0}

/* ── Resend button (layout only; apply-submit provides the visual) ── */
.vef-resend-btn{
  display:flex;align-items:center;justify-content:center;gap:7px;
  margin-bottom:10px;
}
.vef-resend-btn:disabled{opacity:0.65;cursor:not-allowed}

/* ── Ghost "Back to dashboard" button ── */
.vef-btn-ghost{
  width:100%;display:flex;align-items:center;justify-content:center;gap:7px;
  padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.09);
  background:rgba(255,255,255,0.04);
  color:#64748b;font-size:13px;font-weight:500;font-family:var(--font);
  cursor:pointer;transition:background .15s,color .15s,border-color .15s;margin-top:8px;
}
.vef-btn-ghost:hover{background:rgba(255,255,255,0.08);color:#94a3b8;border-color:rgba(255,255,255,0.14)}

/* ── Watermark ── */
.vef-watermark{
  position:absolute;bottom:20px;
  font-size:11px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;
  color:rgba(255,255,255,0.07);pointer-events:none;
}

/* ── Reduced motion ── */
@media(prefers-reduced-motion:reduce){
  .vef-ring--pending,
  .vef-ring--success,
  .vef-icon-circle--success,
  .vef-icon-circle--error{animation:none}
}

/* ── Mobile ── */
@media(max-width:480px){
  .vef-hero{width:200px;height:200px}
  .vef-ring--1{width:104px;height:104px}
  .vef-ring--2{width:148px;height:148px}
  .vef-ring--3{width:192px;height:192px}
  .vef-icon-circle{width:72px;height:72px}
  .vef-info-card{padding:16px}
  .vef-title{font-size:22px}
}

/* ── Light mode overrides ── */
body:not(.dark-mode) .vef-screen{
  background:linear-gradient(155deg,#f8fafc 0%,#f1f5f9 50%,#e8eef5 100%);
}
body:not(.dark-mode) .vef-logo-text{
  background:linear-gradient(135deg,#0f172a 0%,#4f46e5 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
body:not(.dark-mode) .vef-logo-diamond{background:linear-gradient(135deg,#4f46e5,#7c3aed)}
body:not(.dark-mode) .vef-title{
  background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
body:not(.dark-mode) .vef-title--success{
  background:linear-gradient(135deg,#0f172a 0%,#16a34a 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
body:not(.dark-mode) .vef-title--error{
  background:linear-gradient(135deg,#0f172a 0%,#dc2626 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
body:not(.dark-mode) .vef-sub{color:#475569}
body:not(.dark-mode) .vef-info-card{background:#ffffff;border-color:#e2e8f0}
body:not(.dark-mode) .vef-dots span{background:rgba(99,102,241,0.25)}
body:not(.dark-mode) .vef-info-hint{background:rgba(59,130,246,0.05);border-color:rgba(59,130,246,0.14)}
body:not(.dark-mode) .vef-info-hint svg{color:#3b82f6}
body:not(.dark-mode) .vef-info-hint p{color:#64748b}
body:not(.dark-mode) .vef-info-hint strong{color:#1e293b}
body:not(.dark-mode) .vef-icon-circle--pending{
  background:linear-gradient(135deg,rgba(99,102,241,0.08),rgba(124,58,237,0.06));
  border-color:rgba(99,102,241,0.2);color:#6366f1;
}
body:not(.dark-mode) .vef-icon-circle--success{
  background:linear-gradient(135deg,#f0fdf4,#dcfce7);
  border-color:rgba(34,197,94,0.2);color:#16a34a;
}
body:not(.dark-mode) .vef-icon-circle--error{
  background:linear-gradient(135deg,#fef2f2,#fee2e2);
  border-color:rgba(239,68,68,0.2);color:#dc2626;
}
body:not(.dark-mode) .vef-ring--pending{border-color:rgba(99,102,241,0.22)}
body:not(.dark-mode) .vef-ring--success{border-color:rgba(34,197,94,0.28)}
body:not(.dark-mode) .vef-ring--error{border-color:rgba(239,68,68,0.18)}
body:not(.dark-mode) .vef-email-row{background:#f8fafc;border-color:#e2e8f0;color:#64748b}
body:not(.dark-mode) .vef-email-row svg{color:#94a3b8}
body:not(.dark-mode) .vef-redirect-hint{color:#94a3b8}
body:not(.dark-mode) .vef-sent-msg{color:#16a34a}
body:not(.dark-mode) .vef-btn-ghost{background:#f8fafc;border-color:#e2e8f0;color:#64748b}
body:not(.dark-mode) .vef-btn-ghost:hover{background:#f1f5f9;color:#475569;border-color:#cbd5e1}
body:not(.dark-mode) .vef-watermark{color:rgba(0,0,0,0.07)}
body:not(.dark-mode) .vef-ambient-glow--pending::after{background:radial-gradient(circle,rgba(99,102,241,0.07) 0%,transparent 65%)}
body:not(.dark-mode) .vef-ambient-glow--success::after{background:radial-gradient(circle,rgba(34,197,94,0.07) 0%,transparent 65%)}
body:not(.dark-mode) .vef-ambient-glow--error::after{background:radial-gradient(circle,rgba(239,68,68,0.07) 0%,transparent 65%)}
```

- [ ] **Step 3: Verify no orphan vef-* selectors remain**

  Run:
  ```bash
  grep -n "vef-card\|vef-check-svg\|vef-check-path\|vef-draw\|vef-danger-alert\|apply-icon-wrap\.vef-icon\|apply-title\.vef-title" src/styles/auth.css
  ```
  Expected output: no lines (all removed by the replacement above).

---

## Task 2: Rewrite VerifyEmailScreen.jsx

Replace the entire file content. All hook/logic code is unchanged — only the JSX structure changes.

**Files:**
- Modify: `src/auth/screens/VerifyEmailScreen.jsx`

- [ ] **Step 1: Replace the file with the new implementation**

  Write the following as the complete file:

```jsx
import { useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { MailCheck, MailWarning, Loader2, Mail, Info, RefreshCw, LogIn } from "lucide-react";
import { confirmEmailVerification, sendEmailVerification } from "@/shared/api";
import { AuthContext } from "@/auth/AuthProvider";
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

  useEffect(() => {
    const token = search.get("token");
    if (!token) { setState("error"); setErrorMsg("Missing token."); return; }
    confirmEmailVerification(token)
      .then(() => {
        setState("success");
        auth?.refreshEmailVerified?.();
      })
      .catch((e) => {
        setState("error");
        setErrorMsg(normalize(e?.message));
      });
  }, [search, auth]);

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
      setErrorMsg(String(e?.message || "Failed to send. Try again."));
    }
  }

  return (
    <div className="vef-screen">
      <div className={`vef-ambient-glow vef-ambient-glow--${state}`} aria-hidden />

      <div className="vef-logo">
        <div className="vef-logo-diamond" aria-hidden />
        <span className="vef-logo-text">VERA</span>
      </div>

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

      <div className="vef-body" role="status" aria-live="polite">
        {state === "pending" && (
          <>
            <div className="vef-title">Verifying your email</div>
            <div className="vef-sub">Just a moment — we&apos;re confirming your address.</div>
          </>
        )}
        {state === "success" && (
          <>
            <div className="vef-title vef-title--success">Email verified</div>
            <div className="vef-sub">Your address is confirmed. Full access is now unlocked.</div>
          </>
        )}
        {state === "error" && (
          <>
            <div className="vef-title vef-title--error">Verification failed</div>
            <div className="vef-sub">We couldn&apos;t verify your email address.</div>
          </>
        )}
      </div>

      <div className="vef-info-card">
        {state === "pending" && (
          <>
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

      <div className="vef-watermark" aria-hidden>VERA</div>
    </div>
  );
}

function normalize(raw) {
  const m = String(raw || "").toLowerCase();
  if (m.includes("expired"))      return "This verification link has expired. Request a new one from the banner in your dashboard.";
  if (m.includes("already_used")) return "This link has already been used.";
  if (m.includes("not_found"))    return "This link is invalid or has already expired.";
  return "Could not verify your email. Please request a new link.";
}
```

- [ ] **Step 2: Verify no inline SVG elements remain**

  Run:
  ```bash
  grep -n "<svg\|<path\|<circle\|<rect" src/auth/screens/VerifyEmailScreen.jsx
  ```
  Expected output: no lines.

---

## Task 3: Run tests and check build

- [ ] **Step 1: Run the verify-email test suite**

  Run:
  ```bash
  npm test -- --run src/auth/__tests__/VerifyEmailScreen.test.jsx
  ```

  Expected output:
  ```
  ✓ auth.verify_email.success
  ✓ auth.verify_email.expired
  Test Files  1 passed
  ```

  Both tests check for title text ("Verifying your email", "Email verified", "expired") which is unchanged in the new JSX — they must pass without modification.

- [ ] **Step 2: Run full unit test suite to catch regressions**

  Run:
  ```bash
  npm test -- --run
  ```

  Expected: all tests pass (same count as before this change).

- [ ] **Step 3: Run native-select check**

  Run:
  ```bash
  npm run check:no-native-select
  ```

  Expected: no violations reported for VerifyEmailScreen.

- [ ] **Step 4: Start dev server and visually inspect all three states**

  Run `npm run dev` and navigate to `/verify-email` with and without a `?token=` param.

  Checklist:
  - [ ] Pending state: indigo rings pulse, Loader2 spins, 3 dots bounce, info hint visible
  - [ ] Success state (mock or real token): green rings emit once, MailCheck icon pops in, email row + redirect hint visible
  - [ ] Error state (no token → immediate error): red static rings, MailWarning shakes, FbAlert shows error message, resend button uses `apply-submit` styling, ghost button visible
  - [ ] No horizontal scrollbar on desktop
  - [ ] Mobile 375px: rings and icon circle scale down, info card has 16px padding
  - [ ] Light mode (toggle): background goes light, all text/ring colors update via light-mode overrides
  - [ ] `prefers-reduced-motion`: ring and icon animations stop; spinner still spins
