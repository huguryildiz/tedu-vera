# Email Verify Banner Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the sticky email-verification banner into an amber lock-notice–style strip with a live countdown timer showing time until account deletion.

**Architecture:** Rewrite `EmailVerifyBanner.jsx` to use a two-column grid layout (left: icon wrap + countdown badge, right: message + resend button). Extend the `evb-*` CSS block in `components.css` to use the lock-notice amber design language, reusing existing `ln-shimmer`, `ln-glow-bar`, and `ln-ring` keyframes.

**Tech Stack:** React, Lucide icons, CSS custom properties, `setInterval`-based countdown.

---

## File Map

| File | Change |
|------|--------|
| `src/auth/components/EmailVerifyBanner.jsx` | Full rewrite — add countdown logic, two-column JSX |
| `src/styles/components.css` | Replace `evb-*` block (lines ~4219–4255) with new amber strip styles |

---

### Task 1: Add `formatCountdown` utility and countdown hook to `EmailVerifyBanner.jsx`

**Files:**
- Modify: `src/auth/components/EmailVerifyBanner.jsx`

- [ ] **Step 1: Replace the file with the new implementation**

Open `src/auth/components/EmailVerifyBanner.jsx` and replace its entire contents with:

```jsx
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

  if (!auth?.user || auth.emailVerified) return null;

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
```

- [ ] **Step 2: Verify the build compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors referencing `EmailVerifyBanner`.

---

### Task 2: Replace the `evb-*` CSS block in `components.css`

**Files:**
- Modify: `src/styles/components.css` (lines ~4219–4255, the `/* ── Email Verify Banner ── */` block)

- [ ] **Step 1: Locate the existing block**

The block starts at the comment `/* ── Email Verify Banner ── */` and ends at:
```css
body:not(.dark-mode) .evb-icon { color: #b45309; }
```

- [ ] **Step 2: Replace the entire `evb-*` block**

Delete from `/* ── Email Verify Banner ── */` through `body:not(.dark-mode) .evb-icon { color: #b45309; }` (inclusive) and replace with:

```css
/* ── Email Verify Banner ── */
.evb-wrap {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  display: grid;
  grid-template-columns: auto 1fr;
  overflow: hidden;
  border-bottom: 1px solid rgba(245, 158, 11, 0.25);
  background: linear-gradient(
    135deg,
    rgba(254, 243, 199, 0.85) 0%,
    rgba(255, 251, 235, 0.75) 50%,
    rgba(254, 252, 232, 0.80) 100%
  );
}

/* Reuses ln-shimmer keyframe defined in .lock-notice::before block */
.evb-wrap::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.35) 45%,
    rgba(255, 255, 255, 0.55) 50%,
    rgba(255, 255, 255, 0.35) 55%,
    transparent 100%
  );
  background-size: 200% 100%;
  animation: ln-shimmer 3.5s ease-in-out infinite;
  pointer-events: none;
}

/* Reuses ln-glow-bar keyframe defined in .lock-notice::after block */
.evb-wrap::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(245, 158, 11, 0.50) 25%,
    rgba(251, 191, 36, 0.80) 50%,
    rgba(245, 158, 11, 0.50) 75%,
    transparent 100%
  );
  animation: ln-glow-bar 2.8s ease-in-out infinite;
}

.evb-left {
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: linear-gradient(180deg, rgba(245, 158, 11, 0.08), rgba(245, 158, 11, 0.03));
  border-right: 1px solid rgba(245, 158, 11, 0.13);
  min-width: 68px;
}

.evb-icon-wrap {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(245, 158, 11, 0.11);
  border: 1px solid rgba(245, 158, 11, 0.22);
  display: grid;
  place-items: center;
  box-shadow:
    0 0 14px rgba(245, 158, 11, 0.18),
    0 2px 5px rgba(245, 158, 11, 0.12);
}

.evb-icon-wrap svg {
  color: #b45309;
  width: 18px;
  height: 18px;
}

/* Reuses ln-ring keyframe defined in .lock-notice-icon-wrap::after block */
.evb-icon-wrap::after {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: 15px;
  border: 1.5px solid rgba(245, 158, 11, 0.25);
  animation: ln-ring 2.8s ease-out infinite;
  pointer-events: none;
}

.evb-badge {
  font-family: var(--mono);
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #92400e;
  background: rgba(245, 158, 11, 0.11);
  border: 1px solid rgba(245, 158, 11, 0.22);
  padding: 2px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.evb-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
}

.evb-body {
  flex: 1 1 auto;
  font-size: 13px;
  color: #92400e;
  text-align: justify;
  text-justify: inter-word;
  line-height: 1.45;
}

.evb-action { display: flex; gap: 8px; align-items: center; flex: 0 0 auto; }

.evb-btn {
  background: transparent;
  border: 1px solid rgba(245, 158, 11, 0.35);
  color: #92400e;
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease;
}
.evb-btn:hover:not(:disabled) { background: rgba(245, 158, 11, 0.10); }
.evb-btn:disabled { opacity: 0.55; cursor: not-allowed; }
.evb-sent { color: var(--success, #059669); font-size: 12px; white-space: nowrap; }
.evb-error { color: var(--danger); font-size: 12px; }

/* ── Dark mode ── */
.dark-mode .evb-wrap {
  border-bottom-color: rgba(251, 191, 36, 0.20);
  background: linear-gradient(
    135deg,
    rgba(251, 191, 36, 0.07) 0%,
    rgba(30, 24, 10, 0.60)   50%,
    rgba(251, 191, 36, 0.05) 100%
  );
}
.dark-mode .evb-left {
  background: linear-gradient(180deg, rgba(251, 191, 36, 0.09), rgba(251, 191, 36, 0.03));
  border-right-color: rgba(251, 191, 36, 0.12);
}
.dark-mode .evb-icon-wrap {
  background: rgba(251, 191, 36, 0.12);
  border-color: rgba(251, 191, 36, 0.26);
  box-shadow:
    0 0 14px rgba(251, 191, 36, 0.20),
    0 2px 5px rgba(251, 191, 36, 0.12);
}
.dark-mode .evb-icon-wrap svg { color: #fcd34d; }
.dark-mode .evb-icon-wrap::after { border-color: rgba(251, 191, 36, 0.22); }
.dark-mode .evb-badge {
  color: #fcd34d;
  background: rgba(251, 191, 36, 0.12);
  border-color: rgba(251, 191, 36, 0.24);
}
.dark-mode .evb-body { color: #fde68a; }
.dark-mode .evb-btn {
  border-color: rgba(251, 191, 36, 0.30);
  color: #fcd34d;
}
.dark-mode .evb-btn:hover:not(:disabled) { background: rgba(251, 191, 36, 0.10); }

/* ── Light mode text ── */
body:not(.dark-mode) .evb-wrap { color: #78350f; }

/* ── Mobile: stack vertically ── */
@media (max-width: 640px) {
  .evb-wrap { grid-template-columns: 1fr; }
  .evb-left {
    flex-direction: row;
    border-right: none;
    border-bottom: 1px solid rgba(245, 158, 11, 0.13);
    padding: 8px 14px;
    justify-content: flex-start;
    min-width: unset;
  }
  .evb-content {
    flex-direction: column;
    align-items: flex-start;
    padding: 10px 14px 12px;
    gap: 8px;
  }
}
```

- [ ] **Step 3: Verify the build compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no CSS errors.

- [ ] **Step 4: Run tests**

```bash
npm test -- --run 2>&1 | tail -30
```

Expected: all tests pass (no tests reference the deleted `.evb-icon` class).

---

### Task 3: Visual verification in browser

**Files:** none (read-only verification step)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Log in as an unverified user and verify the banner**

Open `http://localhost:5173` in a browser. Sign in with an account that has not verified its email (or temporarily set `auth.emailVerified` to `false` in AuthProvider for testing).

Expected:
- Banner renders at the top as a sticky strip
- Left column shows `MailWarning` icon in an amber rounded square with pulsing ring
- Countdown badge below the icon shows (e.g. `7 DAYS` if `graceEndsAt` is null, or live time if set)
- Right side shows message text and "Resend link" button
- Amber gradient background with sweeping shimmer and glowing bottom bar
- Dark mode toggle switches to dark amber palette
- Mobile (≤640px): icon row stacks above content row, no right border

- [ ] **Step 3: Verify countdown ticks**

If `graceEndsAt` is set on the test account, watch the badge for 3 seconds. Expected: seconds digit updates every second when in `Xm Ys` range.

- [ ] **Step 4: Verify resend button states**

Click "Resend link". Expected: button text changes to "Sending…" then "Link sent — check your inbox." appears in its place.
