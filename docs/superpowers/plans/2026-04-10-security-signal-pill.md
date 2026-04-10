# Security Signal Pill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded green "Secure" badge in the admin Settings Security & Sessions card with a data-driven three-state pill (Secure / Review / At Risk) that opens a verdict-first popover explaining which signals drove the state and links to View Sessions.

**Architecture:** Pure function `computeSecuritySignal.js` in `src/admin/utils/` rolls up four signals (sessionCount, countryDiversity, lastLoginFreshness, expiredSessions) into a single max-severity state plus a generated verdict sentence. Presentational component `SecuritySignalPill.jsx` in `src/admin/components/` renders the pill, owns the popover open/close state and all interaction concerns, and calls an `onReviewSessions` callback. `SettingsPage.jsx` wires the computed signal into the component with a one-line swap. No new API calls, no DB changes, no backend work.

**Tech Stack:** React, Vitest, Testing Library, lucide-react (ChevronDown only), existing CSS variables (`--success`, `--warning`, `--danger`, `--surface-1`, `--border`)

**Spec:** `docs/superpowers/specs/2026-04-10-security-signal-pill-design.md`

---

### Task 1: Add QA catalog entries

Catalog entries must exist before `qaTest()` can reference them — the `qaTest` helper throws at runtime if the ID is missing.

**Files:**
- Modify: `src/test/qa-catalog.json` (append before the closing `]`)

- [ ] **Step 1: Append the fourteen new catalog entries**

Open `src/test/qa-catalog.json`, find the final closing `]`, and insert the following entries as the last items of the array (add a comma after the current last entry):

```json
  {
    "id": "settings.security.signal.01",
    "module": "Admin / Settings",
    "area": "Security Signal",
    "story": "Secure state rollup",
    "scenario": "returns state 'secure' when all four signals are ok",
    "whyItMatters": "A clean account must render the green Secure pill, not fall through to Review.",
    "risk": "False positives would nag users about healthy accounts and erode trust in the signal.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "settings.security.signal.02",
    "module": "Admin / Settings",
    "area": "Security Signal",
    "story": "Review state rollup",
    "scenario": "returns state 'review' when at least one signal is warn and none are bad",
    "whyItMatters": "Amber state is the middle rung — one warn must trigger it, no more and no less.",
    "risk": "Missing the Review transition leaves users with a binary Secure/Risk, losing nuance.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "settings.security.signal.03",
    "module": "Admin / Settings",
    "area": "Security Signal",
    "story": "Risk state rollup",
    "scenario": "returns state 'risk' when any single signal is bad, regardless of other signals",
    "whyItMatters": "One severe red flag must dominate the rollup — max severity wins.",
    "risk": "Averaging severities would dilute real risks behind cleaner signals.",
    "coverageStrength": "High",
    "severity": "critical"
  },
  {
    "id": "settings.security.signal.04",
    "module": "Admin / Settings",
    "area": "Security Signal",
    "story": "Verdict sentence generation",
    "scenario": "verdict reason names the top two non-ok signals when two or more are present",
    "whyItMatters": "Users must immediately see why they are in Review — vague messages defeat the pill.",
    "risk": "A generic 'something is off' message is no better than the old hardcoded badge.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "settings.security.pill.01",
    "module": "Admin / Settings",
    "area": "Security Signal Pill",
    "story": "Popover open/close",
    "scenario": "clicking the pill opens the popover, clicking again closes it",
    "whyItMatters": "The pill's value is the explanation inside — it must be reachable with one click.",
    "risk": "A silent pill hides the reason and regresses to the old decorative badge.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "settings.security.pill.02",
    "module": "Admin / Settings",
    "area": "Security Signal Pill",
    "story": "Keyboard dismissal",
    "scenario": "pressing Escape while the popover is open closes it and returns focus to the pill",
    "whyItMatters": "Keyboard users must be able to dismiss the popover without reaching for the mouse.",
    "risk": "An un-dismissible popover traps screen reader and keyboard users.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "settings.security.pill.03",
    "module": "Admin / Settings",
    "area": "Security Signal Pill",
    "story": "Review sessions action",
    "scenario": "clicking the 'Review sessions' footer link calls onReviewSessions and closes the popover",
    "whyItMatters": "The popover's zero-distance action must work — click, act, done.",
    "risk": "A dead action button wastes the user's intent and makes the feature feel broken.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "settings.security.signal.05",
    "module": "Admin / Settings",
    "area": "Security Signal",
    "story": "Threshold boundaries",
    "scenario": "classifies session count exactly at the warn/bad thresholds correctly",
    "whyItMatters": "Off-by-one bugs at threshold boundaries would silently mislabel accounts.",
    "risk": "Severity misclassification at boundaries erodes trust in the pill.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "settings.security.signal.06",
    "module": "Admin / Settings",
    "area": "Security Signal",
    "story": "Loading state",
    "scenario": "returns state 'loading' and no verdict when loading flag is true",
    "whyItMatters": "The pill must not flash a wrong state before data arrives.",
    "risk": "Flashing 'At Risk' during load scares users with a false alarm.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "settings.security.signal.07",
    "module": "Admin / Settings",
    "area": "Security Signal",
    "story": "Empty session fallback",
    "scenario": "treats empty tracked sessions as one session when last login is fresh",
    "whyItMatters": "Freshly logged-in admins must see Secure, not a scary zero-session state.",
    "risk": "A 'no sessions' edge case would mislabel healthy accounts.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "settings.security.signal.08",
    "module": "Admin / Settings",
    "area": "Security Signal",
    "story": "Null country codes",
    "scenario": "counts country diversity as zero when all sessions lack a country code",
    "whyItMatters": "Missing geo data must not trigger a false country-diversity warning.",
    "risk": "Null country codes counted as distinct countries would false-positive.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "settings.security.signal.09",
    "module": "Admin / Settings",
    "area": "Security Signal",
    "story": "Expired session detection",
    "scenario": "classifies multiple expired sessions as a bad signal and rolls up to risk",
    "whyItMatters": "Expired tokens are a real security signal — the pill must surface them.",
    "risk": "Missing expired-session detection leaves dead tokens unflagged.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "settings.security.pill.04",
    "module": "Admin / Settings",
    "area": "Security Signal Pill",
    "story": "Secure state popover",
    "scenario": "popover in secure state shows All clear header and no verdict banner",
    "whyItMatters": "Users opening a healthy pill must see confirmation, not an empty popover.",
    "risk": "A silent secure popover would feel broken on healthy accounts.",
    "coverageStrength": "High",
    "severity": "normal"
  },
  {
    "id": "settings.security.pill.05",
    "module": "Admin / Settings",
    "area": "Security Signal Pill",
    "story": "Review banner rendering",
    "scenario": "popover in review state renders the amber banner with the generated verdict",
    "whyItMatters": "The banner is the user's first read — it must render the verdict title and reason.",
    "risk": "Missing banner content hides the reason and defeats the feature.",
    "coverageStrength": "High",
    "severity": "normal"
  }
```

- [ ] **Step 2: Verify the JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('src/test/qa-catalog.json','utf8')); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/test/qa-catalog.json
git commit -m "test(qa): add catalog entries for security signal pill"
```

---

### Task 2: Write failing unit tests for `computeSecuritySignal`

TDD: tests first. All tests should fail with "Cannot find module" or equivalent because the file does not exist yet.

**Files:**
- Create: `src/admin/__tests__/computeSecuritySignal.test.js`

- [ ] **Step 1: Create the test file**

```js
// src/admin/__tests__/computeSecuritySignal.test.js
import { describe, expect } from "vitest";
import { qaTest } from "../../test/qaTest.js";
import {
  computeSecuritySignal,
  SESSION_COUNT_WARN,
  SESSION_COUNT_BAD,
  COUNTRY_WARN,
  COUNTRY_BAD,
  LAST_LOGIN_WARN_DAYS,
  LAST_LOGIN_BAD_DAYS,
  EXPIRED_WARN,
  EXPIRED_BAD,
} from "../utils/computeSecuritySignal.js";

const NOW = new Date("2026-04-10T12:00:00.000Z").getTime();

function buildSession(overrides = {}) {
  return {
    id: "s1",
    device_id: "d1",
    country_code: "TR",
    expires_at: new Date(NOW + 3600_000).toISOString(),
    ...overrides,
  };
}

describe("computeSecuritySignal", () => {
  qaTest("settings.security.signal.01", () => {
    const result = computeSecuritySignal({
      adminSessions: [buildSession()],
      lastLoginAt: new Date(NOW - 2 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.state).toBe("secure");
    expect(result.verdict.title).toBeNull();
    expect(result.verdict.reason).toBeNull();
    expect(result.signals.sessionCount.severity).toBe("ok");
    expect(result.signals.countryDiversity.severity).toBe("ok");
    expect(result.signals.lastLoginFreshness.severity).toBe("ok");
    expect(result.signals.expiredSessions.severity).toBe("ok");
  });

  qaTest("settings.security.signal.02", () => {
    const sessions = Array.from({ length: SESSION_COUNT_WARN }, (_, i) =>
      buildSession({ id: `s${i}`, device_id: `d${i}` }),
    );
    const result = computeSecuritySignal({
      adminSessions: sessions,
      lastLoginAt: new Date(NOW - 2 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.state).toBe("review");
    expect(result.signals.sessionCount.severity).toBe("warn");
    expect(result.verdict.title).toBe("This account needs a review.");
    expect(result.verdict.reason).toContain("active sessions");
  });

  qaTest("settings.security.signal.03", () => {
    const sessions = Array.from({ length: SESSION_COUNT_BAD }, (_, i) =>
      buildSession({ id: `s${i}`, device_id: `d${i}` }),
    );
    const result = computeSecuritySignal({
      adminSessions: sessions,
      lastLoginAt: new Date(NOW - 2 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.state).toBe("risk");
    expect(result.signals.sessionCount.severity).toBe("bad");
    expect(result.verdict.title).toBe("This account is at risk.");
  });

  qaTest("settings.security.signal.04", () => {
    const sessions = [
      buildSession({ id: "s1", device_id: "d1", country_code: "TR" }),
      buildSession({ id: "s2", device_id: "d2", country_code: "DE" }),
      buildSession({ id: "s3", device_id: "d3", country_code: "TR" }),
      buildSession({ id: "s4", device_id: "d4", country_code: "TR" }),
    ];
    const result = computeSecuritySignal({
      adminSessions: sessions,
      lastLoginAt: new Date(NOW - 21 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.state).toBe("review");
    expect(result.verdict.reason).toMatch(/active sessions.*and.*days of inactivity/);
  });
});

describe("computeSecuritySignal — thresholds", () => {
  qaTest("settings.security.signal.05", () => {
    const warnBoundary = computeSecuritySignal({
      adminSessions: Array.from({ length: SESSION_COUNT_WARN - 1 }, (_, i) =>
        buildSession({ id: `s${i}`, device_id: `d${i}` }),
      ),
      lastLoginAt: new Date(NOW - 1 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(warnBoundary.signals.sessionCount.severity).toBe("ok");

    const badBoundary = computeSecuritySignal({
      adminSessions: Array.from({ length: SESSION_COUNT_BAD }, (_, i) =>
        buildSession({ id: `s${i}`, device_id: `d${i}` }),
      ),
      lastLoginAt: new Date(NOW - 1 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(badBoundary.signals.sessionCount.severity).toBe("bad");
  });
});

describe("computeSecuritySignal — loading and edge cases", () => {
  qaTest("settings.security.signal.06", () => {
    const result = computeSecuritySignal({
      adminSessions: [],
      lastLoginAt: null,
      loading: true,
      now: NOW,
    });
    expect(result.state).toBe("loading");
    expect(result.verdict.title).toBeNull();
  });

  qaTest("settings.security.signal.07", () => {
    // Empty sessions but fresh login → treat as 1 session, secure
    const result = computeSecuritySignal({
      adminSessions: [],
      lastLoginAt: new Date(NOW - 2 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.state).toBe("secure");
    expect(result.signals.sessionCount.value).toBe(1);
  });

  qaTest("settings.security.signal.08", () => {
    // All sessions have null country_code → diversity value 0, severity ok
    const result = computeSecuritySignal({
      adminSessions: [
        buildSession({ country_code: null }),
        buildSession({ id: "s2", device_id: "d2", country_code: null }),
      ],
      lastLoginAt: new Date(NOW - 2 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.signals.countryDiversity.value).toBe(0);
    expect(result.signals.countryDiversity.severity).toBe("ok");
  });

  qaTest("settings.security.signal.09", () => {
    // Expired sessions only: 2 expired → bad
    const result = computeSecuritySignal({
      adminSessions: [
        buildSession({ expires_at: new Date(NOW - 3600_000).toISOString() }),
        buildSession({ id: "s2", device_id: "d2", expires_at: new Date(NOW - 7200_000).toISOString() }),
      ],
      lastLoginAt: new Date(NOW - 2 * 86400_000).toISOString(),
      loading: false,
      now: NOW,
    });
    expect(result.signals.expiredSessions.value).toBe(2);
    expect(result.signals.expiredSessions.severity).toBe("bad");
    expect(result.state).toBe("risk");
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- --run src/admin/__tests__/computeSecuritySignal.test.js`
Expected: All tests FAIL with `Failed to resolve import "../utils/computeSecuritySignal.js"` or similar module-not-found error.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/admin/__tests__/computeSecuritySignal.test.js
git commit -m "test(admin): add failing tests for computeSecuritySignal helper"
```

---

### Task 3: Implement `computeSecuritySignal` helper

**Files:**
- Create: `src/admin/utils/computeSecuritySignal.js`

- [ ] **Step 1: Create the helper file**

```js
// src/admin/utils/computeSecuritySignal.js
// ============================================================
// Pure rollup of four security signals into a single pill state
// plus a generated verdict sentence. No React, no Supabase.
// ============================================================

export const SESSION_COUNT_WARN = 3;  // 3–4 → warn
export const SESSION_COUNT_BAD = 5;   // 5+   → bad
export const COUNTRY_WARN = 2;        // 2    → warn
export const COUNTRY_BAD = 3;         // 3+   → bad
export const LAST_LOGIN_WARN_DAYS = 15;
export const LAST_LOGIN_BAD_DAYS = 46;
export const EXPIRED_WARN = 1;
export const EXPIRED_BAD = 2;

const SEVERITY_RANK = { ok: 0, warn: 1, bad: 2 };
const RANK_TO_STATE = { 0: "secure", 1: "review", 2: "risk" };

function classifySessionCount(n) {
  if (n >= SESSION_COUNT_BAD) return "bad";
  if (n >= SESSION_COUNT_WARN) return "warn";
  return "ok";
}

function classifyCountryDiversity(n) {
  if (n >= COUNTRY_BAD) return "bad";
  if (n >= COUNTRY_WARN) return "warn";
  return "ok";
}

function classifyLastLogin(days) {
  if (days == null) return "warn";
  if (days >= LAST_LOGIN_BAD_DAYS) return "bad";
  if (days >= LAST_LOGIN_WARN_DAYS) return "warn";
  return "ok";
}

function classifyExpired(n) {
  if (n >= EXPIRED_BAD) return "bad";
  if (n >= EXPIRED_WARN) return "warn";
  return "ok";
}

function daysBetween(laterMs, earlierMs) {
  if (!Number.isFinite(laterMs) || !Number.isFinite(earlierMs)) return null;
  return Math.floor((laterMs - earlierMs) / 86400_000);
}

function countCountries(sessions) {
  const set = new Set();
  for (const s of sessions) {
    const c = s?.country_code;
    if (c && typeof c === "string" && c.trim()) set.add(c.trim().toUpperCase());
  }
  return set.size;
}

function countExpired(sessions, nowMs) {
  let n = 0;
  for (const s of sessions) {
    const exp = Date.parse(s?.expires_at || "");
    if (Number.isFinite(exp) && exp < nowMs) n += 1;
  }
  return n;
}

// Build the one- or two-signal verdict reason string.
// Order: bad signals first, then warn, in the canonical signal order.
function buildVerdict(state, signals) {
  if (state === "secure" || state === "loading") {
    return { title: null, reason: null };
  }

  const title =
    state === "risk"
      ? "This account is at risk."
      : "This account needs a review.";

  const order = [
    "sessionCount",
    "countryDiversity",
    "lastLoginFreshness",
    "expiredSessions",
  ];
  const phrase = {
    sessionCount: (v) => `${v} active sessions`,
    countryDiversity: (v) => `${v} countries`,
    lastLoginFreshness: (v) => `${v} days of inactivity`,
    expiredSessions: (v) => `${v} expired sessions`,
  };

  const bads = order.filter((k) => signals[k].severity === "bad");
  const warns = order.filter((k) => signals[k].severity === "warn");
  const ranked = [...bads, ...warns].slice(0, 2);

  if (ranked.length === 0) {
    return { title, reason: null };
  }

  const parts = ranked.map((k) => phrase[k](signals[k].value));
  const joined = parts.length === 2 ? `${parts[0]} and ${parts[1]}` : parts[0];
  const stateWord = state === "risk" ? "At Risk" : "Review";
  const reason = `${joined} pushed this account to ${stateWord}.`;
  // Capitalize first letter of the joined phrase
  const capitalized = reason.charAt(0).toUpperCase() + reason.slice(1);

  return { title, reason: capitalized };
}

export function computeSecuritySignal({
  adminSessions,
  lastLoginAt,
  loading,
  now = Date.now(),
}) {
  if (loading) {
    return {
      state: "loading",
      signals: {
        sessionCount: { value: 0, severity: "ok" },
        countryDiversity: { value: 0, severity: "ok" },
        lastLoginFreshness: { value: null, severity: "ok" },
        expiredSessions: { value: 0, severity: "ok" },
      },
      verdict: { title: null, reason: null },
    };
  }

  const sessions = Array.isArray(adminSessions) ? adminSessions : [];
  // Empty tracked sessions → treat current browser as 1 session so the pill
  // is not misleading for freshly logged-in admins before session tracking
  // has populated `admin_user_sessions`.
  const sessionCountValue = sessions.length > 0 ? sessions.length : 1;

  const countryValue = countCountries(sessions);
  const expiredValue = countExpired(sessions, now);

  const lastLoginMs = Date.parse(lastLoginAt || "");
  const lastLoginDays = Number.isFinite(lastLoginMs)
    ? daysBetween(now, lastLoginMs)
    : null;

  const signals = {
    sessionCount: {
      value: sessionCountValue,
      severity: classifySessionCount(sessionCountValue),
    },
    countryDiversity: {
      value: countryValue,
      severity: classifyCountryDiversity(countryValue),
    },
    lastLoginFreshness: {
      value: lastLoginDays,
      severity: classifyLastLogin(lastLoginDays),
    },
    expiredSessions: {
      value: expiredValue,
      severity: classifyExpired(expiredValue),
    },
  };

  const maxRank = Math.max(
    ...Object.values(signals).map((s) => SEVERITY_RANK[s.severity] ?? 0),
  );
  const state = RANK_TO_STATE[maxRank];

  return {
    state,
    signals,
    verdict: buildVerdict(state, signals),
  };
}
```

- [ ] **Step 2: Run the tests and verify they pass**

Run: `npm test -- --run src/admin/__tests__/computeSecuritySignal.test.js`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/admin/utils/computeSecuritySignal.js
git commit -m "feat(admin): add computeSecuritySignal helper with signal rollup"
```

---

### Task 4: Write failing tests for `SecuritySignalPill` component

**Files:**
- Create: `src/admin/__tests__/SecuritySignalPill.test.jsx`

- [ ] **Step 1: Create the test file**

```jsx
// src/admin/__tests__/SecuritySignalPill.test.jsx
import { describe, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { qaTest } from "../../test/qaTest.js";
import SecuritySignalPill from "../components/SecuritySignalPill.jsx";

vi.mock("../../shared/lib/supabaseClient", () => ({ supabase: {} }));

function makeSignal(overrides = {}) {
  return {
    state: "secure",
    signals: {
      sessionCount: { value: 1, severity: "ok" },
      countryDiversity: { value: 1, severity: "ok" },
      lastLoginFreshness: { value: 2, severity: "ok" },
      expiredSessions: { value: 0, severity: "ok" },
    },
    verdict: { title: null, reason: null },
    ...overrides,
  };
}

describe("SecuritySignalPill", () => {
  qaTest("settings.security.pill.01", () => {
    const signal = makeSignal({
      state: "review",
      verdict: {
        title: "This account needs a review.",
        reason: "4 active sessions pushed this account to Review.",
      },
      signals: {
        sessionCount: { value: 4, severity: "warn" },
        countryDiversity: { value: 1, severity: "ok" },
        lastLoginFreshness: { value: 2, severity: "ok" },
        expiredSessions: { value: 0, severity: "ok" },
      },
    });
    render(<SecuritySignalPill signal={signal} onReviewSessions={() => {}} />);

    // Popover is closed initially
    expect(screen.queryByRole("dialog")).toBeNull();

    // Click opens the popover
    fireEvent.click(screen.getByRole("button", { name: /security signal/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("This account needs a review.")).toBeInTheDocument();

    // Click again closes it
    fireEvent.click(screen.getByRole("button", { name: /security signal/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  qaTest("settings.security.pill.02", () => {
    const signal = makeSignal({ state: "review", verdict: { title: "Needs review.", reason: "Reason." } });
    render(<SecuritySignalPill signal={signal} onReviewSessions={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /security signal/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  qaTest("settings.security.pill.03", () => {
    const onReview = vi.fn();
    const signal = makeSignal({ state: "risk", verdict: { title: "At risk.", reason: "Reason." } });
    render(<SecuritySignalPill signal={signal} onReviewSessions={onReview} />);

    fireEvent.click(screen.getByRole("button", { name: /security signal/i }));
    const footerBtn = screen.getByRole("button", { name: /review sessions/i });
    fireEvent.click(footerBtn);
    expect(onReview).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  qaTest("settings.security.pill.04", () => {
    // Secure state: no verdict banner, but popover still opens with All clear header
    const signal = makeSignal();
    render(<SecuritySignalPill signal={signal} onReviewSessions={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /security signal/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/all security signals are clear/i)).toBeInTheDocument();
    // No verdict title rendered for secure state
    expect(screen.queryByText(/needs a review/i)).toBeNull();
    expect(screen.queryByText(/is at risk/i)).toBeNull();
  });

  qaTest("settings.security.pill.05", () => {
    // Review state renders the amber banner title
    const signal = makeSignal({
      state: "review",
      verdict: {
        title: "This account needs a review.",
        reason: "4 active sessions pushed this account to Review.",
      },
      signals: {
        sessionCount: { value: 4, severity: "warn" },
        countryDiversity: { value: 1, severity: "ok" },
        lastLoginFreshness: { value: 2, severity: "ok" },
        expiredSessions: { value: 0, severity: "ok" },
      },
    });
    render(<SecuritySignalPill signal={signal} onReviewSessions={() => {}} />);
    expect(screen.getByRole("button", { name: /security signal: review/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /security signal/i }));
    expect(screen.getByText("This account needs a review.")).toBeInTheDocument();
    expect(
      screen.getByText("4 active sessions pushed this account to Review."),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- --run src/admin/__tests__/SecuritySignalPill.test.jsx`
Expected: All tests FAIL with `Failed to resolve import "../components/SecuritySignalPill.jsx"`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/admin/__tests__/SecuritySignalPill.test.jsx
git commit -m "test(admin): add failing tests for SecuritySignalPill component"
```

---

### Task 5: Implement `SecuritySignalPill` component

**Files:**
- Create: `src/admin/components/SecuritySignalPill.jsx`

- [ ] **Step 1: Create the component file**

```jsx
// src/admin/components/SecuritySignalPill.jsx
// ============================================================
// Data-driven pill for the Security & Sessions card.
// Three states: secure | review | risk.
// Opens a verdict-first popover on click. Footer action links
// to the View Sessions drawer via onReviewSessions callback.
// ============================================================

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

const STATE_META = {
  loading: {
    label: "—",
    tone: "neutral",
    ariaLabel: "Security signal: loading",
  },
  secure: {
    label: "Secure",
    tone: "success",
    ariaLabel: "Security signal: Secure. Click to see details.",
  },
  review: {
    label: "Review",
    tone: "warning",
    ariaLabel: "Security signal: Review. Click to see details.",
  },
  risk: {
    label: "At Risk",
    tone: "danger",
    ariaLabel: "Security signal: At Risk. Click to see details.",
  },
};

const FACTOR_ORDER = [
  { key: "sessionCount", label: "Active sessions", tag: { ok: "ok", warn: "high", bad: "very high" }, format: (v) => `${v}` },
  { key: "countryDiversity", label: "Countries", tag: { ok: "ok", warn: "mixed", bad: "mixed" }, format: (v) => `${v || 0}` },
  { key: "lastLoginFreshness", label: "Last login", tag: { ok: "ok", warn: "stale", bad: "inactive" }, format: (v) => (v == null ? "—" : `${v}d`) },
  { key: "expiredSessions", label: "Expired sessions", tag: { ok: "ok", warn: "some", bad: "many" }, format: (v) => `${v}` },
];

const TONE_CLASS = {
  success: "sec-pill--success",
  warning: "sec-pill--warning",
  danger: "sec-pill--danger",
  neutral: "sec-pill--neutral",
};

export default function SecuritySignalPill({ signal, onReviewSessions }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const popoverRef = useRef(null);
  const dialogId = useId();

  const state = signal?.state || "loading";
  const meta = STATE_META[state] || STATE_META.loading;
  const isLoading = state === "loading";

  const handleToggle = useCallback(() => {
    if (isLoading) return;
    setOpen((prev) => !prev);
  }, [isLoading]);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Return focus to the button for keyboard users
    if (buttonRef.current) buttonRef.current.focus();
  }, []);

  const handleReview = useCallback(() => {
    if (typeof onReviewSessions === "function") onReviewSessions();
    setOpen(false);
  }, [onReviewSessions]);

  // Outside click + Escape handling
  useEffect(() => {
    if (!open) return undefined;

    function onDocClick(e) {
      const pop = popoverRef.current;
      const btn = buttonRef.current;
      if (!pop || !btn) return;
      if (pop.contains(e.target) || btn.contains(e.target)) return;
      setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        e.stopPropagation();
        handleClose();
      }
    }

    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, handleClose]);

  return (
    <div className="sec-pill-wrap" style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={buttonRef}
        type="button"
        className={`sec-pill ${TONE_CLASS[meta.tone] || TONE_CLASS.neutral}`}
        aria-label={meta.ariaLabel}
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={handleToggle}
        disabled={isLoading}
      >
        <span className="sec-pill-dot" aria-hidden="true" />
        <span className="sec-pill-label">{meta.label}</span>
        <ChevronDown className="sec-pill-chev" aria-hidden="true" />
      </button>

      {open && signal && (
        <div
          ref={popoverRef}
          id={dialogId}
          className={`sec-popover sec-popover--${meta.tone}`}
          role="dialog"
          aria-labelledby={`${dialogId}-title`}
        >
          {state === "secure" ? (
            <div className="sec-popover-clear">
              <div className="sec-popover-clear-icon" aria-hidden="true">
                <Check size={12} />
              </div>
              <span id={`${dialogId}-title`} className="sec-popover-clear-text">
                All security signals are clear.
              </span>
            </div>
          ) : (
            <div className="sec-popover-banner">
              <div id={`${dialogId}-title`} className="sec-popover-verdict">
                {signal.verdict?.title}
              </div>
              {signal.verdict?.reason && (
                <div className="sec-popover-reason">{signal.verdict.reason}</div>
              )}
            </div>
          )}

          <div className="sec-popover-body">
            {FACTOR_ORDER.map((factor) => {
              const s = signal.signals?.[factor.key];
              if (!s) return null;
              const tag = factor.tag[s.severity] || s.severity;
              return (
                <div key={factor.key} className="sec-factor-row">
                  <div className="sec-factor-label">{factor.label}</div>
                  <div className={`sec-factor-value sec-factor-value--${s.severity}`}>
                    {factor.format(s.value)} · {tag}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sec-popover-footer">
            <button
              type="button"
              className="sec-popover-action"
              onClick={handleReview}
            >
              Review sessions →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run component tests and verify they pass**

Run: `npm test -- --run src/admin/__tests__/SecuritySignalPill.test.jsx`
Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/admin/components/SecuritySignalPill.jsx
git commit -m "feat(admin): add SecuritySignalPill component with verdict popover"
```

---

### Task 6: Add component styles

The component uses several classes that need CSS. Add them to the existing `src/styles/components.css` so they follow the project's CSS token system and dark-mode conventions.

**Files:**
- Modify: `src/styles/components.css` (append at end)

- [ ] **Step 1: Locate the end of components.css**

Run: `wc -l src/styles/components.css`
Expected: prints a line count; note it for the next step.

- [ ] **Step 2: Append the styles**

Append to the end of `src/styles/components.css`:

```css
/* ── Security Signal Pill ───────────────────────────────────── */

.sec-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  font-family: inherit;
  border: 1px solid transparent;
  cursor: pointer;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
  background: var(--surface-1);
  color: var(--text-primary);
}
.sec-pill:hover:not(:disabled) {
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}
.sec-pill:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--btn-focus-ring-brand, rgba(59, 130, 246, 0.35));
}
.sec-pill:disabled {
  cursor: default;
  opacity: 0.6;
}
.sec-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.sec-pill-chev {
  width: 10px;
  height: 10px;
  opacity: 0.55;
  margin-left: 1px;
}

.sec-pill--success {
  background: rgba(22, 163, 74, 0.10);
  color: #15803d;
  border-color: rgba(22, 163, 74, 0.25);
}
.sec-pill--warning {
  background: rgba(234, 179, 8, 0.12);
  color: #a16207;
  border-color: rgba(234, 179, 8, 0.30);
}
.sec-pill--danger {
  background: rgba(225, 29, 72, 0.10);
  color: #be123c;
  border-color: rgba(225, 29, 72, 0.25);
}
.sec-pill--neutral {
  background: var(--surface-1);
  color: var(--text-tertiary);
  border-color: var(--border);
}

body.dark-mode .sec-pill--success { color: #4ade80; }
body.dark-mode .sec-pill--warning { color: #fbbf24; }
body.dark-mode .sec-pill--danger  { color: #fb7185; }

/* ── Popover ── */
.sec-popover {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 300px;
  background: var(--surface-1);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow:
    0 10px 30px -10px rgba(15, 23, 42, 0.25),
    0 2px 6px rgba(15, 23, 42, 0.05);
  z-index: 20;
  overflow: hidden;
  font-family: inherit;
}
.sec-popover::before {
  content: "";
  position: absolute;
  top: -5px;
  right: 18px;
  width: 10px;
  height: 10px;
  background: inherit;
  border-left: 1px solid var(--border);
  border-top: 1px solid var(--border);
  transform: rotate(45deg);
}
body.dark-mode .sec-popover {
  background: var(--surface-2, #1f2937);
  border-color: var(--border);
}

.sec-popover-banner {
  padding: 11px 13px;
  border-bottom: 1px solid var(--border);
}
.sec-popover--warning .sec-popover-banner {
  background: rgba(234, 179, 8, 0.10);
  border-bottom-color: rgba(234, 179, 8, 0.25);
}
.sec-popover--danger .sec-popover-banner {
  background: rgba(225, 29, 72, 0.08);
  border-bottom-color: rgba(225, 29, 72, 0.22);
}
.sec-popover--warning::before { background: rgba(234, 179, 8, 0.10); }
.sec-popover--danger::before  { background: rgba(225, 29, 72, 0.08); }

.sec-popover-verdict {
  font-size: 12px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--text-primary);
}
body:not(.dark-mode) .sec-popover--warning .sec-popover-verdict { color: #854d0e; }
body:not(.dark-mode) .sec-popover--danger  .sec-popover-verdict { color: #9f1239; }
.sec-popover-reason {
  font-size: 10.5px;
  line-height: 1.4;
  color: var(--text-tertiary);
  margin-top: 3px;
}
body:not(.dark-mode) .sec-popover--warning .sec-popover-reason { color: #a16207; }
body:not(.dark-mode) .sec-popover--danger  .sec-popover-reason { color: #be123c; }

.sec-popover-clear {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 13px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-1);
}
.sec-popover-clear-icon {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(22, 163, 74, 0.14);
  color: #15803d;
}
body.dark-mode .sec-popover-clear-icon { color: #4ade80; }
.sec-popover-clear-text {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-secondary);
}

.sec-popover-body {
  padding: 8px 13px;
}
.sec-factor-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
}
.sec-factor-row:last-child { border-bottom: none; }
.sec-factor-label {
  color: var(--text-secondary);
  font-weight: 500;
}
.sec-factor-value {
  font-family: var(--mono);
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 4px;
  letter-spacing: 0.2px;
}
.sec-factor-value--ok   { background: rgba(22, 163, 74, 0.10); color: #15803d; }
.sec-factor-value--warn { background: rgba(234, 179, 8, 0.15); color: #a16207; }
.sec-factor-value--bad  { background: rgba(225, 29, 72, 0.10); color: #be123c; }

body.dark-mode .sec-factor-value--ok   { color: #4ade80; }
body.dark-mode .sec-factor-value--warn { color: #fbbf24; }
body.dark-mode .sec-factor-value--bad  { color: #fb7185; }

.sec-popover-footer {
  padding: 9px 13px;
  border-top: 1px solid var(--border);
  background: var(--surface-2, var(--surface-1));
}
.sec-popover-action {
  background: none;
  border: none;
  padding: 0;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--accent, #3b82f6);
  cursor: pointer;
  font-family: inherit;
}
.sec-popover-action:hover { text-decoration: underline; }
.sec-popover-action:focus-visible {
  outline: none;
  text-decoration: underline;
  box-shadow: 0 0 0 2px var(--btn-focus-ring-brand, rgba(59, 130, 246, 0.35));
  border-radius: 2px;
}

/* Narrow viewport: anchor popover to card edge instead of pill */
@media (max-width: 420px) {
  .sec-popover {
    right: -8px;
    width: calc(100vw - 28px);
    max-width: 340px;
  }
}
```

- [ ] **Step 3: Re-run component tests to confirm no regression**

Run: `npm test -- --run src/admin/__tests__/SecuritySignalPill.test.jsx`
Expected: All tests PASS (CSS has no effect on tests, but confirm no import/build break).

- [ ] **Step 4: Commit**

```bash
git add src/styles/components.css
git commit -m "feat(styles): add security signal pill and popover styles"
```

---

### Task 7: Wire `SecuritySignalPill` into `SettingsPage`

**Files:**
- Modify: `src/admin/pages/SettingsPage.jsx`

- [ ] **Step 1: Add imports at the top of the file**

Find the existing import block at the top of `src/admin/pages/SettingsPage.jsx` (around lines 1–20). Add these two imports near the other admin component imports:

```jsx
import SecuritySignalPill from "../components/SecuritySignalPill.jsx";
import { computeSecuritySignal } from "../utils/computeSecuritySignal.js";
```

- [ ] **Step 2: Compute the signal inside the component**

Find the block where `adminSessions`, `adminSessionsLoading`, `sessionCount`, and `lastLoginAt` are declared (currently around lines 101–118). After the `sessionCount` line, add:

```jsx
  const securitySignal = useMemo(
    () => computeSecuritySignal({
      adminSessions,
      lastLoginAt,
      loading: loading || adminSessionsLoading,
    }),
    [adminSessions, lastLoginAt, loading, adminSessionsLoading],
  );
```

If `useMemo` is not already imported from React in this file, add it to the existing React import.

- [ ] **Step 3: Replace the hardcoded pill**

Find the Security & Sessions card header (currently around lines 333–340):

```jsx
              <div className="card-header" style={{ marginBottom: 8 }}>
                <div className="card-title">Security &amp; Sessions</div>
                <span className="badge badge-success">
                  <span className="status-dot dot-success" />
                  Secure
                </span>
              </div>
```

Replace the entire `<span className="badge badge-success">...</span>` block with:

```jsx
                <SecuritySignalPill
                  signal={securitySignal}
                  onReviewSessions={() => setViewSessionsOpen(true)}
                />
```

Final header block should look like:

```jsx
              <div className="card-header" style={{ marginBottom: 8 }}>
                <div className="card-title">Security &amp; Sessions</div>
                <SecuritySignalPill
                  signal={securitySignal}
                  onReviewSessions={() => setViewSessionsOpen(true)}
                />
              </div>
```

- [ ] **Step 4: Verify the imports are correct**

Run: `npm run build`
Expected: Build succeeds with no errors. If `useMemo` was missing from the React import, the build will fail — add it and re-run.

- [ ] **Step 5: Run all admin tests to confirm no regression**

Run: `npm test -- --run src/admin/__tests__/`
Expected: All tests PASS (existing Settings tests should continue to pass since the structural change is additive).

- [ ] **Step 6: Commit**

```bash
git add src/admin/pages/SettingsPage.jsx
git commit -m "feat(admin): replace hardcoded Secure badge with data-driven SecuritySignalPill"
```

---

### Task 8: Manual verification in the live app

Per the "verify against live app" rule, smoke-test the feature in the running app before claiming done.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: Vite starts on `http://localhost:5173`.

- [ ] **Step 2: Log in as an admin and open Settings**

Navigate to `http://localhost:5173?admin`, log in, then open the Settings tab.

- [ ] **Step 3: Verify the Secure state (happy path)**

With a fresh session, the pill should read **Secure** in green. Click it — a popover should open with:

- No verdict banner
- Header line: "All security signals are clear." with a green check icon
- Four factor rows (Active sessions, Countries, Last login, Expired sessions) all showing green `ok` tags
- "Review sessions →" footer link

Click the footer link — the `ViewSessionsDrawer` should open and the popover should close.

- [ ] **Step 4: Verify Escape closes the popover**

Open the popover again. Press `Escape`. The popover should close and focus should return to the pill.

- [ ] **Step 5: Verify outside click closes the popover**

Open the popover again. Click anywhere outside it (e.g. on the Profile card). The popover should close.

- [ ] **Step 6: Verify dark mode contrast**

Toggle the app into dark mode. Open the popover. Verify:

- Pill label, dot, and chevron are all readable
- Popover background is the dark surface, not white
- Factor value tags (`ok`, `stale`, etc.) are still legible
- Verdict banner (if any) has readable title and reason text

- [ ] **Step 7: Verify loading state**

Hard-refresh the Settings page. For the brief moment before `adminSessions` loads, the pill should render in the neutral/loading state with a `—` label and be un-clickable. (If the load is too fast to see, this step can be verified by checking that `isLoading` disables the button — which is already covered by the component code.)

- [ ] **Step 8: Run the no-native-select check**

Run: `npm run check:no-native-select`
Expected: `OK: no native <select> usage found in src/**/*.jsx|tsx`

- [ ] **Step 9: Run the full test suite once**

Run: `npm test -- --run`
Expected: All tests PASS.

- [ ] **Step 10: No commit for this task** — verification only. If any step fails, fix the root cause and re-verify before continuing.

---

## Summary of deliverables

| File | Change |
|---|---|
| `src/test/qa-catalog.json` | 7 new catalog entries |
| `src/admin/__tests__/computeSecuritySignal.test.js` | New test file (pure function coverage) |
| `src/admin/utils/computeSecuritySignal.js` | New helper — signal rollup + verdict generator |
| `src/admin/__tests__/SecuritySignalPill.test.jsx` | New test file (component coverage) |
| `src/admin/components/SecuritySignalPill.jsx` | New component |
| `src/styles/components.css` | Appended pill + popover styles |
| `src/admin/pages/SettingsPage.jsx` | Import, `useMemo` signal computation, pill swap |

Total: 4 new files, 3 modified files, 8 commits.

No DB migration, no new RPCs, no backend changes, no new dependencies.
