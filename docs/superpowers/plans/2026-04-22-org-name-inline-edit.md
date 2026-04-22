# Org Name Inline Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let org admins edit their organization's display name inline from the Settings page, while keeping code and status Super Admin–only.

**Architecture:** Single-file UI change in `SettingsPage.jsx`. Local state drives the edit/view toggle. On save, calls the existing `updateOrganization` API (which hits `rpc_admin_update_organization` — already org-admin accessible), then calls `refreshMemberships()` to sync the auth context so `activeOrganization.name` updates everywhere.

**Tech Stack:** React (useState, useRef), lucide-react icons, existing `updateOrganization` API, `refreshMemberships` from `useAuth()`

---

### Task 1: Update imports and add state

**Files:**
- Modify: `src/admin/pages/SettingsPage.jsx:20,25,88-96,111`

- [ ] **Step 1: Add `updateOrganization` to the existing `@/shared/api` import line (line 20)**

Change:
```js
import { upsertProfile, getSecurityPolicy, setSecurityPolicy, getPinPolicy, setPinPolicy, listAdminSessions, deleteAdminSession } from "@/shared/api";
```
To:
```js
import { upsertProfile, getSecurityPolicy, setSecurityPolicy, getPinPolicy, setPinPolicy, listAdminSessions, deleteAdminSession, updateOrganization } from "@/shared/api";
```

- [ ] **Step 2: Add `Pencil`, `Check`, `X` to the lucide import (line 25)**

Change:
```js
import { Icon, Lock } from "lucide-react";
```
To:
```js
import { Icon, Lock, Pencil, Check, X } from "lucide-react";
```

- [ ] **Step 3: Add `FbAlert` import after line 25**

```js
import FbAlert from "@/shared/ui/FbAlert";
```

- [ ] **Step 4: Destructure `refreshMemberships` from `useAuth()` (already destructured block around line 88–96)**

Find the destructuring block that contains `activeOrganization` and add `refreshMemberships`:
```js
refreshMemberships,
```

- [ ] **Step 5: Add 4 state variables after the existing `useState` declarations (around line 125)**

```js
const [editingOrgName, setEditingOrgName] = useState(false);
const [orgNameDraft, setOrgNameDraft] = useState("");
const [orgNameError, setOrgNameError] = useState(null);
const [orgNameSaving, setOrgNameSaving] = useState(false);
```

- [ ] **Step 6: Add the save handler function (after the state declarations, before the JSX return)**

```js
const handleOrgNameSave = useCallback(async () => {
  const trimmed = orgNameDraft.trim();
  if (!trimmed) return;
  if (trimmed === (activeOrganization?.name || "")) {
    setEditingOrgName(false);
    return;
  }
  setOrgNameSaving(true);
  setOrgNameError(null);
  try {
    await updateOrganization({ organizationId: activeOrganization.id, name: trimmed });
    await refreshMemberships();
    setEditingOrgName(false);
  } catch (err) {
    setOrgNameError(err?.message || "Failed to update organization name.");
  } finally {
    setOrgNameSaving(false);
  }
}, [orgNameDraft, activeOrganization, refreshMemberships]);
```

---

### Task 2: Replace the Organization Access card render

**Files:**
- Modify: `src/admin/pages/SettingsPage.jsx:450-487`

- [ ] **Step 1: Replace the entire `{/* Organization Access — org admin only */}` block**

Find and replace this block (lines 450–487):
```jsx
{/* Organization Access — org admin only */}
{!isSuper && (
  <div className="card settings-role-card" style={{ padding: 14 }}>
    <div className="card-header" style={{ marginBottom: 8 }}>
      <div className="card-title">Organization Access</div>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        <span className="badge badge-neutral">Read Only</span>
        <span className="badge badge-neutral"><Lock size={10} strokeWidth={2.5} />Managed by Super Admin</span>
      </div>
    </div>
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", fontSize: 12 }}>
      {[
        { label: "Organization", value: activeOrganization?.name || "—" },
        { label: "Short label", value: <span className="mono">{activeOrganization?.code || "—"}</span> },
        { label: "Membership status", value: <span className="badge badge-success"><Icon
          iconNode={[]}
          className="badge-ico"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></Icon>Active</span> },
      ].map(({ label, value }, i) => (
        <div
          key={label}
          style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", padding: "7px 10px", background: i % 2 === 0 ? "var(--surface-1)" : undefined, borderBottom: i < 2 ? "1px solid var(--border)" : undefined }}
        >
          <div className="text-xs text-muted">{label}</div>
          <div style={{ fontWeight: label === "Organization" ? 600 : undefined }}>{value}</div>
        </div>
      ))}
    </div>
    <div className="text-xs text-muted" style={{ marginTop: 8 }}>
      Organization identity fields are locked. Name, code, ownership, and metadata can only be edited by Super Admin.
    </div>
  </div>
)}
```

With:
```jsx
{/* Organization Access — org admin only */}
{!isSuper && (
  <div className="card settings-role-card" style={{ padding: 14 }}>
    <div className="card-header" style={{ marginBottom: 8 }}>
      <div className="card-title">Organization Access</div>
      <span className="badge badge-neutral"><Lock size={10} strokeWidth={2.5} />Code &amp; status managed by Super Admin</span>
    </div>
    <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", fontSize: 12 }}>

      {/* Organization name row — inline editable */}
      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", padding: "7px 10px", background: "var(--surface-1)", borderBottom: "1px solid var(--border)" }}>
        <div className="text-xs text-muted">Organization</div>
        {editingOrgName ? (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <input
              autoFocus
              value={orgNameDraft}
              onChange={(e) => setOrgNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleOrgNameSave(); }
                if (e.key === "Escape") { setEditingOrgName(false); setOrgNameError(null); }
              }}
              style={{ flex: 1, fontWeight: 600, fontSize: 12, padding: "2px 6px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-primary)", minWidth: 0 }}
              disabled={orgNameSaving}
            />
            <button
              onClick={handleOrgNameSave}
              disabled={orgNameSaving || !orgNameDraft.trim()}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "var(--radius-sm)", border: "none", background: "var(--success-soft)", color: "var(--success)", cursor: "pointer", flexShrink: 0 }}
              title="Save"
            >
              <Check size={12} strokeWidth={2.5} />
            </button>
            <button
              onClick={() => { setEditingOrgName(false); setOrgNameError(null); }}
              disabled={orgNameSaving}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "var(--radius-sm)", border: "none", background: "var(--surface-3)", color: "var(--text-muted)", cursor: "pointer", flexShrink: 0 }}
              title="Cancel"
            >
              <X size={12} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontWeight: 600, flex: 1 }}>{activeOrganization?.name || "—"}</span>
            <button
              onClick={() => { setOrgNameDraft(activeOrganization?.name || ""); setEditingOrgName(true); setOrgNameError(null); }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 20, height: 20, borderRadius: "var(--radius-sm)", border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", flexShrink: 0, transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
              title="Edit name"
            >
              <Pencil size={13} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>
      {orgNameError && (
        <div style={{ padding: "0 10px 8px" }}>
          <FbAlert variant="danger" style={{ marginTop: 6 }}>{orgNameError}</FbAlert>
        </div>
      )}

      {/* Short label row — read only */}
      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", padding: "7px 10px", borderBottom: "1px solid var(--border)" }}>
        <div className="text-xs text-muted">Short label</div>
        <span className="mono">{activeOrganization?.code || "—"}</span>
      </div>

      {/* Membership status row — read only */}
      <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", alignItems: "center", padding: "7px 10px", background: "var(--surface-1)" }}>
        <div className="text-xs text-muted">Membership status</div>
        <span className="badge badge-success" style={{ alignSelf: "center" }}>
          <Icon
            iconNode={[]}
            className="badge-ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          ><path d="M20 6 9 17l-5-5" /></Icon>Active
        </span>
      </div>
    </div>

    <div className="text-xs text-muted" style={{ marginTop: 8 }}>
      Organization name can be edited by org admins. Code, ownership, and status are managed by Super Admin.
    </div>
  </div>
)}
```

---

### Task 3: Verify in the browser

**Files:** None (browser-only verification)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Log in as an org admin (non-super-admin) and navigate to Settings**

- [ ] **Step 3: Verify view mode**
  - "Organization Access" card shows no "Read Only" badge
  - "Code & status managed by Super Admin" badge is present
  - Organization name row shows the name + pencil icon on the right
  - Clicking anywhere other than the pencil does nothing

- [ ] **Step 4: Verify edit mode**
  - Clicking the pencil opens an input pre-filled with the current name
  - Pressing Escape cancels and restores view mode
  - Clearing the input and clicking ✓ does nothing (button disabled)
  - Typing a new name and pressing Enter saves and updates the displayed name
  - Short label and Membership status rows are unchanged throughout

- [ ] **Step 5: Verify error state**
  - Temporarily break the save (e.g. log in as super-admin to confirm they also see the edit icon — they skip this card entirely via `!isSuper`)
  - Confirm `FbAlert` appears inline if the API throws
