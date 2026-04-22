# Admin Team Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-width "Admin Team" card to the tenant-admin Settings page that lists active admins, lists pending invites, and lets the org admin send/resend/cancel invites.

**Architecture:** New SECURITY DEFINER RPC bypasses RLS so org admins can read co-members. A dedicated `useAdminTeam` hook owns all data fetching and action logic. `AdminTeamCard` is a pure display component driven entirely by hook props. SettingsPage composes them with a `!isSuper` guard.

**Tech Stack:** React 18, Vitest + @testing-library/react, Supabase (RPC + Edge Function), lucide-react, existing `useToast` + `FbAlert` patterns.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `sql/migrations/006_rpcs_admin.sql` | Modify — append | New `rpc_org_admin_list_members` SECURITY DEFINER RPC |
| `src/shared/api/admin/organizations.js` | Modify — append | `listOrgAdminMembers()` API wrapper |
| `src/shared/api/admin/index.js` | Modify | Re-export `listOrgAdminMembers` |
| `src/shared/api/index.js` | Modify | Re-export `listOrgAdminMembers` in flat export |
| `src/test/qa-catalog.json` | Modify | QA IDs for API + hook tests |
| `src/admin/__tests__/listOrgAdminMembers.test.js` | Create | API wrapper unit tests |
| `src/admin/hooks/useAdminTeam.js` | Create | Data fetching + action logic hook |
| `src/admin/__tests__/useAdminTeam.test.js` | Create | Hook unit tests |
| `src/admin/components/AdminTeamCard.css` | Create | Component styles |
| `src/admin/components/AdminTeamCard.jsx` | Create | Display component |
| `src/admin/pages/SettingsPage.jsx` | Modify | Import + render `<AdminTeamCard>` |

---

## Task 1: Add RPC to migration and deploy to both databases

**Files:**
- Modify: `sql/migrations/006_rpcs_admin.sql` (append at end of file)

- [ ] **Step 1: Append the RPC to `006_rpcs_admin.sql`**

Add the following block at the very end of `sql/migrations/006_rpcs_admin.sql`:

```sql
-- =============================================================================
-- rpc_org_admin_list_members — list active + invited members for caller's org
-- =============================================================================

CREATE OR REPLACE FUNCTION public.rpc_org_admin_list_members()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM memberships
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  RETURN (
    SELECT json_agg(
      jsonb_build_object(
        'id',           m.id,
        'user_id',      m.user_id,
        'status',       m.status,
        'created_at',   m.created_at,
        'display_name', p.display_name,
        'email',        u.email
      )
    )
    FROM memberships m
    LEFT JOIN profiles p   ON p.id = m.user_id
    LEFT JOIN auth.users u ON u.id = m.user_id
    WHERE m.organization_id = v_org_id
      AND m.status IN ('active', 'invited')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_org_admin_list_members() TO authenticated;
```

- [ ] **Step 2: Deploy to vera-prod via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` on vera-prod with the SQL from Step 1.
Expected: no error, function created.

- [ ] **Step 3: Deploy to vera-demo via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` on vera-demo with the same SQL.
Expected: no error, function created.

- [ ] **Step 4: Verify the RPC exists on vera-prod**

Run via `mcp__claude_ai_Supabase__execute_sql` on vera-prod:
```sql
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'rpc_org_admin_list_members';
```
Expected: one row returned.

---

## Task 2: API wrapper, export chain, QA catalog, and unit tests

**Files:**
- Modify: `src/shared/api/admin/organizations.js`
- Modify: `src/shared/api/admin/index.js`
- Modify: `src/shared/api/index.js`
- Modify: `src/test/qa-catalog.json`
- Create: `src/admin/__tests__/listOrgAdminMembers.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/admin/__tests__/listOrgAdminMembers.test.js`:

```js
import { describe, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../test/qaTest.js";

vi.mock("../../shared/lib/supabaseClient", () => ({ supabase: {} }));

import { supabase } from "../../shared/lib/supabaseClient";
import { listOrgAdminMembers } from "../../shared/api/admin/organizations.js";

describe("listOrgAdminMembers", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  qaTest("settings.team.api.01", async () => {
    supabase.rpc = vi.fn().mockResolvedValue({ data: [{ id: "m1" }], error: null });
    const result = await listOrgAdminMembers();
    expect(supabase.rpc).toHaveBeenCalledWith("rpc_org_admin_list_members");
    expect(result).toEqual([{ id: "m1" }]);
  });

  qaTest("settings.team.api.02", async () => {
    supabase.rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "unauthorized" } });
    await expect(listOrgAdminMembers()).rejects.toMatchObject({ message: "unauthorized" });
  });

  qaTest("settings.team.api.03", async () => {
    supabase.rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const result = await listOrgAdminMembers();
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Add QA catalog entries**

Add these 3 objects to the array in `src/test/qa-catalog.json` (before the closing `]`):

```json
{
  "id": "settings.team.api.01",
  "module": "Settings / Admin Team",
  "area": "API — listOrgAdminMembers",
  "story": "List org admin members",
  "scenario": "calls rpc_org_admin_list_members and returns data array",
  "whyItMatters": "The API wrapper must hit the correct RPC so org admins can see their team.",
  "risk": "Wrong RPC name silently returns nothing.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "settings.team.api.02",
  "module": "Settings / Admin Team",
  "area": "API — listOrgAdminMembers",
  "story": "List org admin members",
  "scenario": "propagates supabase error as thrown exception",
  "whyItMatters": "Hook error state depends on the wrapper throwing on RPC failure.",
  "risk": "Silent failures would leave the UI stuck in loading.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "settings.team.api.03",
  "module": "Settings / Admin Team",
  "area": "API — listOrgAdminMembers",
  "story": "List org admin members",
  "scenario": "returns empty array when RPC data is null",
  "whyItMatters": "Org with no admins yet must not crash the hook's array mapping.",
  "risk": "Null data would cause .map() TypeError in hook.",
  "coverageStrength": "Medium",
  "severity": "normal"
}
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npm test -- --run src/admin/__tests__/listOrgAdminMembers.test.js
```

Expected: 3 failures — `listOrgAdminMembers is not a function` (function not yet exported).

- [ ] **Step 4: Add `listOrgAdminMembers` to `organizations.js`**

Append to the end of `src/shared/api/admin/organizations.js` (after `cancelOrgAdminInvite`, before the Join Request API section comment):

```js
export async function listOrgAdminMembers() {
  const { data, error } = await supabase.rpc("rpc_org_admin_list_members");
  if (error) throw error;
  return data || [];
}
```

- [ ] **Step 5: Export from `src/shared/api/admin/index.js`**

In the organizations export block, add `listOrgAdminMembers`:

```js
export {
  listOrganizations,
  createOrganization,
  updateOrganization,
  updateMemberAdmin,
  deleteMemberHard,
  inviteOrgAdmin,
  cancelOrgAdminInvite,
  listOrgAdminMembers,
  searchOrganizationsForJoin,
  requestToJoinOrg,
  approveJoinRequest,
  rejectJoinRequest,
  markSetupComplete,
  deleteOrganization,
} from "./organizations";
```

- [ ] **Step 6: Export from `src/shared/api/index.js`**

In the flat export list (around line 79–85, after `cancelOrgAdminInvite`), add `listOrgAdminMembers`:

```js
  cancelOrgAdminInvite,
  listOrgAdminMembers,
  searchOrganizationsForJoin,
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
npm test -- --run src/admin/__tests__/listOrgAdminMembers.test.js
```

Expected: 3 tests pass, 0 failures.

---

## Task 3: `useAdminTeam` hook with unit tests

**Files:**
- Modify: `src/test/qa-catalog.json`
- Create: `src/admin/hooks/useAdminTeam.js`
- Create: `src/admin/__tests__/useAdminTeam.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/admin/__tests__/useAdminTeam.test.js`:

```js
import { describe, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { qaTest } from "../../test/qaTest.js";

const mockListMembers = vi.fn();
const mockInviteOrgAdmin = vi.fn();
const mockCancelOrgAdminInvite = vi.fn();
const mockShowToast = vi.fn();

vi.mock("../../shared/lib/supabaseClient", () => ({ supabase: {} }));
vi.mock("../../shared/api", () => ({
  listOrgAdminMembers: (...a) => mockListMembers(...a),
  inviteOrgAdmin: (...a) => mockInviteOrgAdmin(...a),
  cancelOrgAdminInvite: (...a) => mockCancelOrgAdminInvite(...a),
}));
vi.mock("../../shared/hooks/useToast", () => ({
  useToast: () => ({ showToast: mockShowToast }),
}));

import { useAdminTeam } from "../hooks/useAdminTeam.js";

const SAMPLE_RAW = [
  { id: "m1", user_id: "u1", status: "active",  created_at: "2026-01-01T00:00:00Z", display_name: "Alice", email: "alice@uni.edu" },
  { id: "m2", user_id: null, status: "invited", created_at: "2026-04-18T00:00:00Z", display_name: null,    email: "bob@uni.edu" },
];

describe("useAdminTeam", () => {
  beforeEach(() => {
    mockListMembers.mockReset();
    mockInviteOrgAdmin.mockReset();
    mockCancelOrgAdminInvite.mockReset();
    mockShowToast.mockReset();
  });

  qaTest("settings.team.hook.01", async () => {
    // orgId = null → no fetch, loading stays false, members = []
    const { result } = renderHook(() => useAdminTeam(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.members).toEqual([]);
    expect(mockListMembers).not.toHaveBeenCalled();
  });

  qaTest("settings.team.hook.02", async () => {
    // fetches on mount and maps RPC shape to member shape
    mockListMembers.mockResolvedValueOnce(SAMPLE_RAW);
    const { result } = renderHook(() => useAdminTeam("org-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.members).toEqual([
      { id: "m1", userId: "u1",  email: "alice@uni.edu", displayName: "Alice", status: "active",  joinedAt: "2026-01-01T00:00:00Z", invitedAt: null },
      { id: "m2", userId: null,  email: "bob@uni.edu",  displayName: null,    status: "invited", joinedAt: null,                   invitedAt: "2026-04-18T00:00:00Z" },
    ]);
  });

  qaTest("settings.team.hook.03", async () => {
    // sendInvite: calls inviteOrgAdmin, closes form, refetches
    mockListMembers.mockResolvedValue([]);
    mockInviteOrgAdmin.mockResolvedValueOnce({ status: "invited" });

    const { result } = renderHook(() => useAdminTeam("org-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.openInviteForm(); });
    act(() => { result.current.setInviteEmail("carol@uni.edu"); });
    await act(async () => { await result.current.sendInvite(); });

    expect(mockInviteOrgAdmin).toHaveBeenCalledWith("org-1", "carol@uni.edu");
    expect(result.current.inviteForm.open).toBe(false);
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
    expect(mockListMembers).toHaveBeenCalledTimes(2); // initial + refetch
  });

  qaTest("settings.team.hook.04", async () => {
    // cancelInvite: calls cancelOrgAdminInvite and refetches
    mockListMembers.mockResolvedValue([]);
    mockCancelOrgAdminInvite.mockResolvedValueOnce(true);

    const { result } = renderHook(() => useAdminTeam("org-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.cancelInvite("m2"); });

    expect(mockCancelOrgAdminInvite).toHaveBeenCalledWith("m2");
    expect(mockShowToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
    expect(mockListMembers).toHaveBeenCalledTimes(2); // initial + refetch
  });
});
```

- [ ] **Step 2: Add QA catalog entries**

Add these 4 objects to `src/test/qa-catalog.json`:

```json
{
  "id": "settings.team.hook.01",
  "module": "Settings / Admin Team",
  "area": "Hook — useAdminTeam",
  "story": "Null org guard",
  "scenario": "returns empty state immediately when orgId is null, without fetching",
  "whyItMatters": "Super admin has no orgId — hook must not call the RPC or enter loading state.",
  "risk": "Without guard, hook would RPC-error and surface a red alert on super admin's Settings page.",
  "coverageStrength": "Strong",
  "severity": "critical"
},
{
  "id": "settings.team.hook.02",
  "module": "Settings / Admin Team",
  "area": "Hook — useAdminTeam",
  "story": "Data fetch and mapping",
  "scenario": "maps RPC snake_case response to camelCase member shape with correct joinedAt/invitedAt split",
  "whyItMatters": "Component reads camelCase props; mismatched shape means names and dates render blank.",
  "risk": "Shape mismatch silently renders empty cells.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "settings.team.hook.03",
  "module": "Settings / Admin Team",
  "area": "Hook — useAdminTeam",
  "story": "Send invite",
  "scenario": "sendInvite calls inviteOrgAdmin, closes the form, shows success toast, and refetches members",
  "whyItMatters": "Invite without refetch leaves stale list; closed form required to confirm action completed.",
  "risk": "Stale list hides newly invited member; open form suggests action did not complete.",
  "coverageStrength": "Strong",
  "severity": "normal"
},
{
  "id": "settings.team.hook.04",
  "module": "Settings / Admin Team",
  "area": "Hook — useAdminTeam",
  "story": "Cancel invite",
  "scenario": "cancelInvite calls cancelOrgAdminInvite, shows success toast, and refetches members",
  "whyItMatters": "Cancel without refetch leaves the cancelled invite visible in the pending list.",
  "risk": "Stale list confuses admin into thinking the cancel failed.",
  "coverageStrength": "Strong",
  "severity": "normal"
}
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
npm test -- --run src/admin/__tests__/useAdminTeam.test.js
```

Expected: 4 failures — module not found.

- [ ] **Step 4: Create `src/admin/hooks/useAdminTeam.js`**

```js
import { useState, useEffect, useCallback } from "react";
import { listOrgAdminMembers, inviteOrgAdmin, cancelOrgAdminInvite } from "@/shared/api";
import { useToast } from "@/shared/hooks/useToast";

function mapMembers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => ({
    id: m.id,
    userId: m.user_id || null,
    email: m.email || "",
    displayName: m.display_name || null,
    status: m.status === "active" ? "active" : "invited",
    joinedAt: m.status === "active" ? m.created_at || null : null,
    invitedAt: m.status === "invited" ? m.created_at || null : null,
  }));
}

const INITIAL_INVITE_FORM = { open: false, email: "", submitting: false, error: null };

export function useAdminTeam(orgId) {
  const { showToast } = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inviteForm, setInviteForm] = useState(INITIAL_INVITE_FORM);

  const refetch = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await listOrgAdminMembers();
      setMembers(mapMembers(raw));
    } catch (e) {
      setError(e.message || "Failed to load team");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { refetch(); }, [refetch]);

  const openInviteForm = useCallback(
    () => setInviteForm((f) => ({ ...f, open: true })),
    []
  );

  const closeInviteForm = useCallback(
    () => setInviteForm(INITIAL_INVITE_FORM),
    []
  );

  const setInviteEmail = useCallback(
    (email) => setInviteForm((f) => ({ ...f, email })),
    []
  );

  const sendInvite = useCallback(async () => {
    const email = inviteForm.email.trim();
    if (!email) {
      setInviteForm((f) => ({ ...f, error: "Email is required" }));
      return;
    }
    setInviteForm((f) => ({ ...f, submitting: true, error: null }));
    try {
      const result = await inviteOrgAdmin(orgId, email);
      const msg =
        result?.status === "reinvited" ? "Invite resent" :
        result?.status === "added"     ? "Admin added" :
        "Invite sent";
      showToast({ message: msg, variant: "success" });
      setInviteForm(INITIAL_INVITE_FORM);
      await refetch();
    } catch (e) {
      setInviteForm((f) => ({
        ...f,
        submitting: false,
        error: e.message || "Failed to send invite",
      }));
    }
  }, [orgId, inviteForm.email, showToast, refetch]);

  const resendInvite = useCallback(
    async (_membershipId, email) => {
      try {
        await inviteOrgAdmin(orgId, email);
        showToast({ message: "Invite resent", variant: "success" });
        await refetch();
      } catch (e) {
        showToast({ message: e.message || "Failed to resend", variant: "danger" });
      }
    },
    [orgId, showToast, refetch]
  );

  const cancelInvite = useCallback(
    async (membershipId) => {
      try {
        await cancelOrgAdminInvite(membershipId);
        showToast({ message: "Invite cancelled", variant: "success" });
        await refetch();
      } catch (e) {
        showToast({ message: e.message || "Failed to cancel", variant: "danger" });
      }
    },
    [showToast, refetch]
  );

  return {
    members,
    loading,
    error,
    inviteForm,
    openInviteForm,
    closeInviteForm,
    setInviteEmail,
    sendInvite,
    resendInvite,
    cancelInvite,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npm test -- --run src/admin/__tests__/useAdminTeam.test.js
```

Expected: 4 tests pass, 0 failures.

---

## Task 4: `AdminTeamCard` component and CSS

**Files:**
- Create: `src/admin/components/AdminTeamCard.css`
- Create: `src/admin/components/AdminTeamCard.jsx`

- [ ] **Step 1: Create `src/admin/components/AdminTeamCard.css`**

```css
/* AdminTeamCard — full-width team management card for Settings page */

.admin-team-card {
  background: var(--surface-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 16px;
}

.admin-team-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}

.admin-team-title {
  font-weight: 700;
  font-size: 13px;
  color: var(--text-primary);
}

.admin-team-meta {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-left: 6px;
  font-weight: 400;
}

/* ── Invite form ──────────────────────────────── */

.admin-team-invite-form {
  background: rgba(99, 102, 241, 0.06);
  border: 1px dashed rgba(99, 102, 241, 0.3);
  border-radius: var(--radius-sm);
  padding: 12px;
  margin-bottom: 14px;
}

.admin-team-invite-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.7px;
  margin-bottom: 8px;
}

.admin-team-invite-row {
  display: flex;
  gap: 7px;
  align-items: flex-start;
}

.admin-team-invite-row input {
  flex: 1;
  font-size: 12px;
}

/* ── Section label ────────────────────────────── */

.admin-team-section-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-quaternary, var(--text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 8px 8px 4px;
}

.admin-team-section-label.pending {
  color: rgba(245, 158, 11, 0.6);
}

/* ── Members table ────────────────────────────── */

.admin-team-table {
  width: 100%;
  border-collapse: collapse;
}

.admin-team-table thead th {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-quaternary, var(--text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 8px 6px;
  text-align: left;
  border-bottom: 1px solid var(--border-subtle, var(--border));
}

.admin-team-table tbody tr {
  border-bottom: 1px solid var(--border-subtle, var(--border));
}

.admin-team-table tbody tr:last-child {
  border-bottom: none;
}

.admin-team-table td {
  padding: 9px 8px;
  vertical-align: middle;
}

/* ── Member avatar ────────────────────────────── */

.admin-team-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.admin-team-member-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.admin-team-member-name {
  font-weight: 600;
  font-size: 12px;
  line-height: 1.2;
  color: var(--text-primary);
}

.admin-team-member-name.pending {
  color: var(--text-secondary);
  font-weight: 400;
}

.admin-team-member-sub {
  font-size: 10.5px;
  color: var(--text-tertiary);
  font-family: var(--mono);
  margin-top: 1px;
}

/* ── Status badges ────────────────────────────── */

.admin-team-badge-active {
  background: var(--success-soft);
  color: var(--success);
  border: 1px solid rgba(22, 163, 74, 0.2);
  border-radius: 5px;
  padding: 2px 7px;
  font-size: 9.5px;
  font-weight: 600;
  white-space: nowrap;
}

.admin-team-badge-pending {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: 5px;
  padding: 2px 7px;
  font-size: 9.5px;
  font-weight: 600;
  white-space: nowrap;
}

/* ── Action cell ──────────────────────────────── */

.admin-team-actions {
  display: flex;
  gap: 5px;
  justify-content: flex-end;
  align-items: center;
}

/* ── Skeleton ─────────────────────────────────── */

.admin-team-skeleton-row td {
  padding: 10px 8px;
}

.admin-team-skeleton-cell {
  height: 16px;
  border-radius: 4px;
  background: var(--surface-1);
  border: 1px solid var(--border);
  animation: admin-team-pulse 1.4s ease-in-out infinite;
}

@keyframes admin-team-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.45; }
}
```

- [ ] **Step 2: Create `src/admin/components/AdminTeamCard.jsx`**

```jsx
import { useRef } from "react";
import { UserPlus, MoreVertical, MailOpen, X, AlertCircle } from "lucide-react";
import FbAlert from "@/shared/ui/FbAlert";
import "./AdminTeamCard.css";

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b",
  "#10b981", "#3b82f6", "#ef4444", "#14b8a6",
];

function avatarColor(seed) {
  return AVATAR_COLORS[(seed || "?").charCodeAt(0) % AVATAR_COLORS.length];
}

function initials(name, email) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email[0].toUpperCase();
  return "?";
}

function SkeletonRows() {
  return [0, 1, 2].map((i) => (
    <tr key={i} className="admin-team-skeleton-row">
      <td><div className="admin-team-skeleton-cell" style={{ width: "60%" }} /></td>
      <td><div className="admin-team-skeleton-cell" style={{ width: 60 }} /></td>
      <td><div className="admin-team-skeleton-cell" style={{ width: 55 }} /></td>
      <td><div className="admin-team-skeleton-cell" style={{ width: 50, marginLeft: "auto" }} /></td>
    </tr>
  ));
}

export default function AdminTeamCard({
  members,
  loading,
  error,
  inviteForm,
  openInviteForm,
  closeInviteForm,
  setInviteEmail,
  sendInvite,
  resendInvite,
  cancelInvite,
  currentUserId,
}) {
  const emailRef = useRef(null);

  const active  = members.filter((m) => m.status === "active");
  const pending = members.filter((m) => m.status === "invited");

  function handleOpenInvite() {
    openInviteForm();
    setTimeout(() => emailRef.current?.focus(), 50);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") sendInvite();
    if (e.key === "Escape") closeInviteForm();
  }

  return (
    <div className="admin-team-card">
      {/* ── Header ── */}
      <div className="admin-team-header">
        <div>
          <span className="admin-team-title">Admin Team</span>
          {!loading && (
            <span className="admin-team-meta">
              · {active.length} active · {pending.length} pending
            </span>
          )}
        </div>
        {!inviteForm.open && (
          <button className="btn btn-outline btn-sm" onClick={handleOpenInvite}>
            <UserPlus size={13} strokeWidth={2} />
            Invite Admin
          </button>
        )}
      </div>

      {/* ── Invite form ── */}
      {inviteForm.open && (
        <div className="admin-team-invite-form">
          <div className="admin-team-invite-label">Invite New Admin</div>
          <div className="admin-team-invite-row">
            <input
              ref={emailRef}
              type="email"
              className={inviteForm.error ? "error" : undefined}
              placeholder="admin@university.edu"
              value={inviteForm.email}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={inviteForm.submitting}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={sendInvite}
              disabled={inviteForm.submitting}
            >
              {inviteForm.submitting ? "Sending…" : "Send"}
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={closeInviteForm}
              disabled={inviteForm.submitting}
              title="Cancel"
            >
              <X size={13} strokeWidth={2} />
            </button>
          </div>
          {inviteForm.error && (
            <p className="crt-field-error" style={{ marginTop: 6 }}>
              <AlertCircle size={12} strokeWidth={2} />
              {inviteForm.error}
            </p>
          )}
        </div>
      )}

      {/* ── Error state ── */}
      {error && (
        <FbAlert variant="danger" style={{ marginBottom: 12 }}>{error}</FbAlert>
      )}

      {/* ── Members table ── */}
      <table className="admin-team-table">
        <thead>
          <tr>
            <th>Member</th>
            <th>Status</th>
            <th>Date</th>
            <th style={{ textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows />
          ) : (
            <>
              {/* Active section */}
              {active.length > 0 && (
                <>
                  <tr>
                    <td colSpan={4} style={{ padding: 0 }}>
                      <div className="admin-team-section-label">Active ({active.length})</div>
                    </td>
                  </tr>
                  {active.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="admin-team-member-info">
                          <div
                            className="admin-team-avatar"
                            style={{ background: avatarColor(m.displayName || m.email) }}
                          >
                            {initials(m.displayName, m.email)}
                          </div>
                          <div>
                            <div className="admin-team-member-name">
                              {m.displayName || m.email}
                            </div>
                            {m.displayName && (
                              <div className="admin-team-member-sub">{m.email}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="admin-team-badge-active">● Active</span>
                      </td>
                      <td style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "var(--mono)" }}>
                        {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td>
                        <div className="admin-team-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={m.userId === currentUserId}
                            title="More actions"
                            style={{ width: 26, height: 26, padding: 0 }}
                          >
                            <MoreVertical size={13} strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* Pending section */}
              {pending.length > 0 && (
                <>
                  <tr>
                    <td colSpan={4} style={{ padding: 0 }}>
                      <div className="admin-team-section-label pending">
                        Pending ({pending.length})
                      </div>
                    </td>
                  </tr>
                  {pending.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="admin-team-member-info">
                          <div
                            className="admin-team-avatar"
                            style={{ background: "var(--surface-2, #374151)" }}
                          >
                            ?
                          </div>
                          <div>
                            <div className="admin-team-member-name pending">{m.email}</div>
                            {m.invitedAt && (
                              <div className="admin-team-member-sub">
                                Invite sent{" "}
                                {new Date(m.invitedAt).toLocaleDateString("en-US", {
                                  month: "short", day: "numeric", year: "numeric",
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="admin-team-badge-pending">⏳ Pending</span>
                      </td>
                      <td style={{ fontSize: 10.5, color: "var(--text-tertiary)", fontFamily: "var(--mono)" }}>
                        —
                      </td>
                      <td>
                        <div className="admin-team-actions">
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => resendInvite(m.id, m.email)}
                            title="Resend invite"
                            style={{ fontSize: 10, padding: "3px 8px" }}
                          >
                            <MailOpen size={11} strokeWidth={2} />
                            Resend
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => cancelInvite(m.id)}
                            title="Cancel invite"
                            style={{ fontSize: 10, padding: "3px 8px", color: "var(--danger)", borderColor: "rgba(225,29,72,0.25)" }}
                          >
                            <X size={11} strokeWidth={2} />
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* Empty state */}
              {active.length === 0 && pending.length === 0 && !loading && !error && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "20px 8px", color: "var(--text-tertiary)", fontSize: 12 }}>
                    No admins yet
                  </td>
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Run the full test suite to catch any regressions**

```bash
npm test -- --run
```

Expected: all existing tests pass (AdminTeamCard has no unit tests — it is a display component tested manually in Task 5).

---

## Task 5: SettingsPage integration and smoke test

**Files:**
- Modify: `src/admin/pages/SettingsPage.jsx`

- [ ] **Step 1: Add hook import and component import to `SettingsPage.jsx`**

Add to the import block (near top, after existing component imports):

```js
import { useAdminTeam } from "../hooks/useAdminTeam";
import AdminTeamCard from "../components/AdminTeamCard";
```

- [ ] **Step 2: Add the hook call inside `SettingsPage` component**

Add after the existing hook calls near the top of the `SettingsPage` function body (around line 110, after `useEffect` calls):

```js
const adminTeam = useAdminTeam(!isSuper ? activeOrganization?.id : null);
```

- [ ] **Step 3: Render `AdminTeamCard` after the grid**

At line 478 (between the closing `</div>` of the `grid-2` div and the closing `</div>` of the outer wrapper), add:

The relevant section in the current file (lines 476–479):
```jsx
          </div>   {/* right column */}
        </div>     {/* grid-2 */}
      </div>       {/* settings-page-content */}
    </>
```

Change to:
```jsx
          </div>   {/* right column */}
        </div>     {/* grid-2 */}

        {!isSuper && (
          <AdminTeamCard
            {...adminTeam}
            currentUserId={user?.id}
          />
        )}
      </div>       {/* settings-page-content */}
    </>
```

- [ ] **Step 4: Run build check**

```bash
npm run build
```

Expected: no TypeScript/JSX errors, build succeeds.

- [ ] **Step 5: Start dev server and smoke test**

```bash
npm run dev
```

Open the app in a browser as an org-admin user. Navigate to `/admin/settings`.

Verify:
- Admin Team card renders below the 2-column grid
- Active admins list with initials avatar, name, email, Active badge, kebab button
- Pending invites with email, invite date, Pending badge, Resend + Cancel buttons
- Click `+ Invite Admin` → inline dashed form appears
- Type an email → click Send → form closes, success toast, list refetches
- Click Resend on a pending row → success toast, list refetches
- Click Cancel on a pending row → row disappears, success toast
- Super admin at `/admin/settings` → Admin Team card is NOT rendered

- [ ] **Step 6: Run final test suite**

```bash
npm test -- --run
```

Expected: all tests pass.
