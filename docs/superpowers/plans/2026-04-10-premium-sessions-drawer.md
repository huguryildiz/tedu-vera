# Premium Active Sessions Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the ViewSessionsDrawer to a premium identity-card layout (Option B) with a left accent bar (Option C) and a hover-triggered Revoke button for non-current sessions.

**Architecture:** The drawer receives an `onRevoke(id)` callback from SettingsPage. A new `deleteAdminSession` API function deletes the row (requires a DELETE RLS policy migration). The card layout replaces the flat key-value list with a device icon + pill badges + a 3px left accent bar.

**Tech Stack:** React, Supabase (RLS policy + `supabase.from().delete()`), CSS custom properties, Lucide icons via `lucide-react`.

---

## File Map

| File | Change |
|---|---|
| `sql/migrations/024_admin_sessions_delete_policy.sql` | CREATE — DELETE RLS policy for `admin_user_sessions` |
| `src/shared/api/admin/sessions.js` | ADD `deleteAdminSession(id)` |
| `src/shared/api/index.js` | RE-EXPORT `deleteAdminSession` |
| `src/admin/drawers/ViewSessionsDrawer.jsx` | REDESIGN — identity card layout |
| `src/styles/drawers.css` | ADD new `.fs-session-card-*` classes |
| `src/admin/pages/SettingsPage.jsx` | WIRE `onRevoke` callback |
| `src/admin/__tests__/ViewSessionsDrawer.test.jsx` | UPDATE existing test + ADD revoke test |

---

## Task 1: DB migration — DELETE RLS policy

**Files:**
- Create: `sql/migrations/024_admin_sessions_delete_policy.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- sql/migrations/024_admin_sessions_delete_policy.sql
-- Allow authenticated users to delete their own session rows (device revocation).

GRANT DELETE ON admin_user_sessions TO authenticated;

CREATE POLICY "admin_user_sessions_delete_own" ON admin_user_sessions
  FOR DELETE
  USING (user_id = auth.uid());
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with the SQL above against the production project.

- [ ] **Step 3: Verify via MCP**

Use `mcp__claude_ai_Supabase__execute_sql` to confirm:
```sql
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'admin_user_sessions';
```
Expected: rows for `select_own` and `delete_own` both present.

---

## Task 2: API — `deleteAdminSession`

**Files:**
- Modify: `src/shared/api/admin/sessions.js`
- Modify: `src/shared/api/index.js`

- [ ] **Step 1: Write the failing test**

In `src/admin/__tests__/ViewSessionsDrawer.test.jsx`, add a new `describe` block (do not touch the existing test):

```js
import { vi, describe, it, expect } from "vitest";

// at the top of the file, alongside existing imports:
// (the existing supabase mock is NOT present — add it)
vi.mock("../../shared/lib/supabaseClient", () => ({ supabase: {} }));
```

Add this describe block after the existing one:

```js
describe("deleteAdminSession", () => {
  it("calls supabase delete with correct id", async () => {
    const mockDelete = vi.fn().mockResolvedValue({ error: null });
    const mockEq = vi.fn(() => ({ error: null }));
    const mockFrom = vi.fn(() => ({ delete: () => ({ eq: mockEq }) }));

    // Dynamically import after mock is set
    const { supabase } = await import("../../shared/lib/supabaseClient");
    supabase.from = mockFrom;

    const { deleteAdminSession } = await import("../../shared/api/admin/sessions");
    await deleteAdminSession("test-uuid-123");

    expect(mockFrom).toHaveBeenCalledWith("admin_user_sessions");
    expect(mockEq).toHaveBeenCalledWith("id", "test-uuid-123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run src/admin/__tests__/ViewSessionsDrawer.test.jsx
```

Expected: FAIL — `deleteAdminSession is not a function` or similar.

- [ ] **Step 3: Implement `deleteAdminSession` in sessions.js**

Append to `src/shared/api/admin/sessions.js`:

```js
export async function deleteAdminSession(id) {
  const { error } = await supabase
    .from("admin_user_sessions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 4: Re-export from index.js**

In `src/shared/api/index.js`, find the line that exports from `./admin/sessions` (or `./admin/` barrel). Add `deleteAdminSession` to that export:

```js
export { touchAdminSession, listAdminSessions, deleteAdminSession } from "./admin/sessions";
```

If sessions is not yet exported from index.js, add the line above alongside the other admin exports.

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- --run src/admin/__tests__/ViewSessionsDrawer.test.jsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add sql/migrations/024_admin_sessions_delete_policy.sql \
        src/shared/api/admin/sessions.js \
        src/shared/api/index.js \
        src/admin/__tests__/ViewSessionsDrawer.test.jsx
git commit -m "feat(sessions): add deleteAdminSession API + RLS delete policy"
```

---

## Task 3: CSS — premium card classes

**Files:**
- Modify: `src/styles/drawers.css` (session card section, lines ~507-512)

- [ ] **Step 1: Replace the session card CSS block**

Find the existing block:
```css
/* Session card */
.fs-session-card { padding: 10px 14px; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg-card); margin-bottom: 8px; }
.fs-session-card.current { border-color: rgba(22, 163, 74, 0.25); background: rgba(22, 163, 74, 0.02); }
.fs-session-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.fs-session-card-name { font-size: 12px; font-weight: 600; color: var(--text-primary); }
.fs-session-card-meta { font-size: 11px; color: var(--text-tertiary); display: flex; flex-direction: column; gap: 2px; }
```

Replace with:
```css
/* Session card — premium identity card */
.fs-session-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border);
  background: var(--bg-card);
  margin-bottom: 8px;
  position: relative;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.fs-session-card:hover { box-shadow: var(--shadow-card); }
.fs-session-card.current { border-color: rgba(22,163,74,0.25); border-left-color: var(--success); background: rgba(22,163,74,0.02); }
.fs-session-card-icon {
  width: 38px; height: 38px; border-radius: 9px;
  background: var(--surface-1); border: 1px solid var(--border);
  display: grid; place-items: center;
  color: var(--text-secondary); flex-shrink: 0;
}
.fs-session-card-icon svg { width: 18px; height: 18px; }
.fs-session-card.current .fs-session-card-icon { background: rgba(22,163,74,0.08); border-color: rgba(22,163,74,0.18); color: var(--success); }
.fs-session-card-body { flex: 1; min-width: 0; }
.fs-session-card-name { font-size: 12.5px; font-weight: 700; color: var(--text-primary); margin-bottom: 3px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.fs-session-card-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--success); flex-shrink: 0; }
.fs-session-card-sub { font-size: 10.5px; color: var(--text-tertiary); margin-bottom: 6px; }
.fs-session-card-pills { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 5px; }
.fs-session-pill {
  font-size: 10px; font-weight: 600;
  padding: 1px 7px; border-radius: 99px;
  border: 1px solid var(--border);
  background: var(--surface-1); color: var(--text-secondary);
}
.fs-session-pill.success { background: rgba(22,163,74,0.08); border-color: rgba(22,163,74,0.22); color: var(--success); }
.fs-session-pill.accent  { background: var(--accent-soft); border-color: rgba(99,102,241,0.22); color: var(--accent); }
.fs-session-pill.warning { background: rgba(234,179,8,0.08); border-color: rgba(234,179,8,0.22); color: #b45309; }
.fs-session-card-meta { font-size: 10.5px; color: var(--text-quaternary); line-height: 1.5; }
.fs-session-card-actions {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s;
}
.fs-session-card:hover .fs-session-card-actions { opacity: 1; }
.fs-session-revoke-btn {
  font-size: 10.5px; font-weight: 600;
  padding: 3px 9px; border-radius: var(--radius-sm);
  border: 1px solid rgba(225,29,72,0.25);
  background: rgba(225,29,72,0.04); color: var(--danger);
  cursor: pointer; transition: background 0.15s, border-color 0.15s;
  white-space: nowrap;
}
.fs-session-revoke-btn:hover { background: rgba(225,29,72,0.1); border-color: rgba(225,29,72,0.4); }
/* Dark mode overrides for session pills */
.dark-mode .fs-session-pill.warning { color: #fbbf24; }
```

- [ ] **Step 2: Verify no native `<select>` introduced**

```bash
npm run check:no-native-select
```

Expected: `OK: no native <select> usage found in src/**/*.jsx|tsx`

---

## Task 4: Component — redesign ViewSessionsDrawer

**Files:**
- Modify: `src/admin/drawers/ViewSessionsDrawer.jsx`

**Design spec:**
- Left 3px accent bar: green for current session, default border for others (handled by CSS class)
- Device icon: laptop SVG for macOS/Windows/Linux, phone SVG for iOS/Android, monitor SVG as fallback
- Active dot: green pulsing dot next to name for current session
- Pills row: `[Current Session]` (success) | `[{auth_method}]` (accent) | `[Exp: {relative}]` (warning if < 2h, else default)
- Sub line: `{maskedIp} · {country}`
- Meta line: `Signed in {absolute} · Last active {relative}`
- Revoke button: visible on hover, only for non-current sessions; calls `onRevoke(session.id)`
- Fallback note for `signed_in_at` → `(first seen)` tooltip preserved (aria-label kept for test)

- [ ] **Step 1: Rewrite the component**

Replace the full contents of `src/admin/drawers/ViewSessionsDrawer.jsx` with:

```jsx
// src/admin/drawers/ViewSessionsDrawer.jsx
// Drawer: inspect tracked admin sessions (device-scoped).
//
// Props:
//   open            — boolean
//   onClose         — () => void
//   sessions        — admin_user_sessions rows
//   loading         — boolean
//   currentDeviceId — current browser device_id
//   onRevoke        — (id: string) => Promise<void>  (optional)

import Drawer from "@/shared/ui/Drawer";
import { maskIpAddress, normalizeCountryCode } from "@/shared/lib/adminSession";

function formatAbsoluteDate(ts) {
  if (!ts) return "Unknown";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatRelative(ts) {
  if (!ts) return "Unknown";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "Unknown";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatAbsoluteDate(ts);
}

function describeDevice(session) {
  const browser = session?.browser || "Unknown";
  const os = session?.os || "Unknown";
  return `${browser} / ${os}`;
}

function isExpiringWithinHours(ts, hours) {
  if (!ts) return false;
  const remaining = new Date(ts).getTime() - Date.now();
  return remaining > 0 && remaining < hours * 3600000;
}

function DeviceIcon({ os }) {
  const lower = (os || "").toLowerCase();
  if (lower === "ios" || lower === "android") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="5" y="2" width="14" height="20" rx="2" />
        <circle cx="12" cy="18" r="1" />
      </svg>
    );
  }
  if (lower === "macos" || lower === "windows" || lower === "linux") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

export default function ViewSessionsDrawer({
  open,
  onClose,
  sessions = [],
  loading = false,
  currentDeviceId = "",
  onRevoke,
}) {
  const sortedSessions = Array.isArray(sessions)
    ? [...sessions].sort((a, b) => {
        const aMs = Date.parse(a?.last_activity_at || "");
        const bMs = Date.parse(b?.last_activity_at || "");
        return (Number.isNaN(bMs) ? 0 : bMs) - (Number.isNaN(aMs) ? 0 : aMs);
      })
    : [];
  const totalSessions = sortedSessions.length;

  return (
    <Drawer open={open} onClose={onClose}>
      <div className="fs-drawer-header">
        <div className="fs-drawer-header-row">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="fs-icon identity">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Active Sessions</div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                {totalSessions} device{totalSessions !== 1 ? "s" : ""} currently tracked
              </div>
            </div>
          </div>
          <button className="fs-close" type="button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="fs-drawer-body" style={{ gap: 0 }}>
        {loading && (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-quaternary)", fontSize: 12 }}>
            Loading sessions...
          </div>
        )}
        {!loading && sortedSessions.length === 0 && (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-quaternary)", fontSize: 12 }}>
            No sessions found.
          </div>
        )}
        {!loading && sortedSessions.map((session) => {
          const isCurrent = session?.device_id === currentDeviceId;
          const usedSignedInFallback = !session?.signed_in_at && !!session?.first_seen_at;
          const signedInAt = session?.signed_in_at || session?.first_seen_at || null;
          const expiringSoon = isExpiringWithinHours(session?.expires_at, 2);
          const maskedIp = maskIpAddress(session?.ip_address);
          const country = normalizeCountryCode(session?.country_code);

          return (
            <div key={session.id} className={`fs-session-card${isCurrent ? " current" : ""}`}>
              <div className="fs-session-card-icon">
                <DeviceIcon os={session?.os} />
              </div>

              <div className="fs-session-card-body">
                <div className="fs-session-card-name">
                  {isCurrent && <span className="fs-session-card-dot" />}
                  {describeDevice(session)}
                </div>

                <div className="fs-session-card-sub">
                  {maskedIp}
                  {country !== "Unknown" ? ` · ${country}` : ""}
                </div>

                <div className="fs-session-card-pills">
                  {isCurrent && (
                    <span className="fs-session-pill success">Current Session</span>
                  )}
                  {session?.auth_method && (
                    <span className="fs-session-pill accent">{session.auth_method}</span>
                  )}
                  {session?.expires_at && (
                    <span className={`fs-session-pill${expiringSoon ? " warning" : ""}`}>
                      Exp: {formatRelative(session.expires_at) === "Unknown"
                        ? formatAbsoluteDate(session.expires_at)
                        : formatAbsoluteDate(session.expires_at)}
                    </span>
                  )}
                </div>

                <div className="fs-session-card-meta">
                  Signed in {formatAbsoluteDate(signedInAt)}
                  {usedSignedInFallback && (
                    <span
                      style={{ marginLeft: 5, cursor: "help" }}
                      title="Exact sign-in timestamp unavailable. Showing first seen timestamp."
                      aria-label="signed-in-fallback-info"
                    >
                      (first seen)
                    </span>
                  )}
                  {" · "}Last active {formatRelative(session?.last_activity_at)}
                </div>
              </div>

              {!isCurrent && onRevoke && (
                <div className="fs-session-card-actions">
                  <button
                    type="button"
                    className="fs-session-revoke-btn"
                    onClick={() => onRevoke(session.id)}
                  >
                    Revoke
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="fs-drawer-footer">
        <div style={{ flex: 1, fontSize: 11, color: "var(--text-tertiary)" }}>{totalSessions} session(s)</div>
        <button className="fs-btn fs-btn-secondary" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </Drawer>
  );
}
```

- [ ] **Step 2: Run existing tests**

```bash
npm test -- --run src/admin/__tests__/ViewSessionsDrawer.test.jsx
```

Expected: existing test still PASSES (Current Session badge, fallback aria-label, Unknown country, sort order all preserved).

---

## Task 5: Wire `onRevoke` in SettingsPage

**Files:**
- Modify: `src/admin/pages/SettingsPage.jsx`

- [ ] **Step 1: Import `deleteAdminSession`**

Find the import line:
```js
import { upsertProfile, getSecurityPolicy, setSecurityPolicy, listAdminSessions } from "@/shared/api";
```

Replace with:
```js
import { upsertProfile, getSecurityPolicy, setSecurityPolicy, listAdminSessions, deleteAdminSession } from "@/shared/api";
```

- [ ] **Step 2: Add `handleRevokeSession` handler**

Find the `const [viewSessionsOpen, setViewSessionsOpen] = useState(false);` line. Add the handler directly below the `loadSessions` function (around line 128):

```js
async function handleRevokeSession(id) {
  await deleteAdminSession(id);
  const rows = await listAdminSessions();
  setAdminSessions(rows);
}
```

- [ ] **Step 3: Pass `onRevoke` to the drawer**

Find:
```jsx
<ViewSessionsDrawer
```

Add `onRevoke={handleRevokeSession}` to the props:
```jsx
<ViewSessionsDrawer
  open={viewSessionsOpen}
  onClose={() => setViewSessionsOpen(false)}
  sessions={adminSessions}
  loading={false}
  currentDeviceId={currentDeviceId}
  onRevoke={handleRevokeSession}
/>
```

(If `currentDeviceId` is not yet passed, check for the `getAdminDeviceId()` call in SettingsPage and pass its value.)

- [ ] **Step 4: Run full test suite**

```bash
npm test -- --run
```

Expected: all existing tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/drawers/ViewSessionsDrawer.jsx \
        src/styles/drawers.css \
        src/admin/pages/SettingsPage.jsx \
        src/admin/__tests__/ViewSessionsDrawer.test.jsx
git commit -m "feat(sessions): premium identity card layout + revoke button"
```

---

## Self-Review

**Spec coverage:**
- ✅ Identity card layout (B): device icon, pill badges, sub line
- ✅ Left accent bar (C): green for current, default for others via CSS `border-left`
- ✅ Hover revoke button: `.fs-session-card-actions` opacity transition
- ✅ Revoke API: `deleteAdminSession` + DELETE RLS policy
- ✅ Refresh after revoke: `handleRevokeSession` re-fetches sessions
- ✅ Existing test preserved: `Current Session` badge, `signed-in-fallback-info` aria-label, country Unknown, sort order

**Placeholder scan:** None found.

**Type consistency:** `deleteAdminSession(id)` called with `session.id` (UUID string) throughout. `onRevoke` prop signature matches handler.
