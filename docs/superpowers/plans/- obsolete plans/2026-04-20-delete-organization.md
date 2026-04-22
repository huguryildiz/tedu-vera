# Delete Organization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a super-admin-only "Delete Organization" kebab action that hard-deletes an org and all cascaded data, guarded by a type-to-confirm modal.

**Architecture:** DB RPC handles audit snapshot + DELETE in one transaction; JS API wrapper calls the RPC; OrganizationsPage adds 4 state variables, a handler, a new kebab item, and a confirmation Modal — all following existing toggle-modal patterns.

**Tech Stack:** Supabase (PostgreSQL RPC, SECURITY DEFINER), React + useState/useCallback, lucide-react (Trash2 already imported), existing Modal + FbAlert + AsyncButtonContent UI components.

---

## File Map

| File | Change |
|---|---|
| `sql/migrations/006_rpcs_admin.sql` | Add `rpc_admin_delete_organization` RPC |
| `src/shared/api/admin/organizations.js` | Add `deleteOrganization` export |
| `src/shared/api/admin/index.js` | Re-export `deleteOrganization` |
| `src/shared/api/index.js` | Re-export `deleteOrganization` in public surface |
| `src/admin/pages/OrganizationsPage.jsx` | State + handler + kebab item + Modal |

---

## Task 1: DB RPC — `rpc_admin_delete_organization`

**Files:**
- Modify: `sql/migrations/006_rpcs_admin.sql` (append at end of file)

**Context:** `_assert_super_admin()` already exists in `003_helpers_and_triggers.sql` — raises `EXCEPTION 'unauthorized'` for non-super-admins. `audit_logs` columns are: `organization_id UUID`, `user_id UUID`, `action TEXT`, `resource_type TEXT`, `resource_id UUID`, `details JSONB`. All child tables (periods, projects, jurors, scores, etc.) have `ON DELETE CASCADE` FK to `organizations.id`.

- [ ] **Step 1: Write the failing test**

Create `src/admin/__tests__/deleteOrganization.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { qaTest } from "../../test/qaTest";

vi.mock("../../shared/lib/supabaseClient", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from "../../shared/lib/supabaseClient";
import { deleteOrganization } from "../../shared/api/admin/organizations";

describe("deleteOrganization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("throws when organizationId is missing", async () => {
    await expect(deleteOrganization(undefined)).rejects.toThrow(
      "deleteOrganization: organizationId required"
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("calls rpc_admin_delete_organization with correct param", async () => {
    supabase.rpc.mockResolvedValue({ error: null });
    await deleteOrganization("org-uuid-123");
    expect(supabase.rpc).toHaveBeenCalledWith(
      "rpc_admin_delete_organization",
      { p_org_id: "org-uuid-123" }
    );
  });

  it("throws when rpc returns an error", async () => {
    const err = new Error("unauthorized");
    supabase.rpc.mockResolvedValue({ error: err });
    await expect(deleteOrganization("org-uuid-123")).rejects.toThrow("unauthorized");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --run src/admin/__tests__/deleteOrganization.test.js
```

Expected: FAIL — `deleteOrganization` is not exported yet.

- [ ] **Step 3: Add RPC to migration file**

Append to `sql/migrations/006_rpcs_admin.sql` (at the very end, after the last `GRANT` statement):

```sql
-- =============================================================================
-- rpc_admin_delete_organization
-- Hard-deletes an organization + all CASCADE children after writing audit log.
-- Caller must be a super-admin (_assert_super_admin raises on failure).
-- =============================================================================

CREATE OR REPLACE FUNCTION rpc_admin_delete_organization(
  p_org_id UUID
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM _assert_super_admin();

  -- Capture org snapshot for audit before deletion
  INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, details)
  SELECT p_org_id, auth.uid(), 'delete_organization', 'organization', p_org_id,
         row_to_json(o)::jsonb
  FROM organizations o WHERE o.id = p_org_id;

  DELETE FROM organizations WHERE id = p_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_admin_delete_organization(UUID) TO authenticated;
```

- [ ] **Step 4: Apply migration to vera-prod via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with the SQL above on the vera-prod project.

- [ ] **Step 5: Apply same migration to vera-demo via Supabase MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with the same SQL on the vera-demo project.

---

## Task 2: API Layer — `deleteOrganization` function + re-exports

**Files:**
- Modify: `src/shared/api/admin/organizations.js`
- Modify: `src/shared/api/admin/index.js`
- Modify: `src/shared/api/index.js`

- [ ] **Step 1: Add the API function**

Append to `src/shared/api/admin/organizations.js` (after `deleteMemberHard`):

```js
export async function deleteOrganization(organizationId) {
  if (!organizationId) throw new Error("deleteOrganization: organizationId required");
  const { error } = await supabase.rpc("rpc_admin_delete_organization", {
    p_org_id: organizationId,
  });
  if (error) throw error;
}
```

- [ ] **Step 2: Run test to verify it passes**

```bash
npm test -- --run src/admin/__tests__/deleteOrganization.test.js
```

Expected: PASS (all 3 tests green).

- [ ] **Step 3: Add to admin barrel `src/shared/api/admin/index.js`**

In the organizations re-export block (lines 61–73), add `deleteOrganization`:

```js
export {
  listOrganizations,
  createOrganization,
  updateOrganization,
  updateMemberAdmin,
  deleteMemberHard,
  inviteOrgAdmin,
  cancelOrgAdminInvite,
  searchOrganizationsForJoin,
  requestToJoinOrg,
  approveJoinRequest,
  rejectJoinRequest,
  markSetupComplete,
  deleteOrganization,
} from "./organizations";
```

- [ ] **Step 4: Add to public surface `src/shared/api/index.js`**

In the admin re-export block, add `deleteOrganization` after `markSetupComplete`:

```js
  markSetupComplete,
  deleteOrganization,
```

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors; `deleteOrganization` is exported cleanly.

---

## Task 3: Frontend — OrganizationsPage state, handler, kebab item, and Modal

**Files:**
- Modify: `src/admin/pages/OrganizationsPage.jsx`

**Context:**
- `Trash2` is already imported (line 42). `AlertCircle` is already imported (line 29).
- `refreshMemberships` destructured from `useAuth()` at line 192.
- `loadOrgs` comes from `useManageOrganizations` at line 228.
- `setMessage` wraps `_toast.success` at line 194.
- Toggle state block is at lines 258–262; add delete state immediately after.
- Toggle handler `handleSaveToggleStatus` is at lines 595–615; add delete handler directly after.
- Kebab menu `FloatingMenu` children end at line 1576 (closing `</FloatingMenu>`); add new divider + button before the closing tag.
- Toggle Modal is at lines 1104–1172; add delete Modal immediately after.
- `updateOrganization` import at line 19; add `deleteOrganization` to same import.

- [ ] **Step 1: Add `deleteOrganization` to the import at the top of OrganizationsPage**

Current (line 19):
```js
import { updateOrganization, listUnlockRequests, resolveUnlockRequest } from "@/shared/api";
```

Replace with:
```js
import { updateOrganization, listUnlockRequests, resolveUnlockRequest, deleteOrganization } from "@/shared/api";
```

- [ ] **Step 2: Add 4 delete state variables after the toggle state block**

After line 262 (`const [toggleError, setToggleError] = useState("");`), add:

```js
  const [deleteOrg, setDeleteOrg] = useState(null);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
```

- [ ] **Step 3: Add `handleDeleteOrg` handler after `handleSaveToggleStatus`**

After line 615 (the closing of `handleSaveToggleStatus`), add:

```js
  const handleDeleteOrg = useCallback(async () => {
    if (!deleteOrg?.id) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await deleteOrganization(deleteOrg.id);
      setMessage(`"${deleteOrg.code}" organization deleted.`);
      setDeleteOrg(null);
      await loadOrgs();
      refreshMemberships().catch(() => {});
    } catch (e) {
      setDeleteError(e?.message || "Could not delete organization.");
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteOrg, loadOrgs, refreshMemberships, setMessage]);
```

- [ ] **Step 4: Add Delete kebab item + second divider inside FloatingMenu**

Current kebab ends at (around line 1575–1577):

```jsx
                              <button
                                className="floating-menu-item danger"
                                onMouseDown={(e) => runOrgMenuAction(e, () => { setToggleOrg(org); setToggleStatus(org.status || "active"); setToggleReason(""); setToggleError(""); })}
                              >
                                <Lock size={13} strokeWidth={2} />
                                Enable / Disable Organization
                              </button>
                            </FloatingMenu>
```

Replace with:

```jsx
                              <button
                                className="floating-menu-item danger"
                                onMouseDown={(e) => runOrgMenuAction(e, () => { setToggleOrg(org); setToggleStatus(org.status || "active"); setToggleReason(""); setToggleError(""); })}
                              >
                                <Lock size={13} strokeWidth={2} />
                                Enable / Disable Organization
                              </button>
                              <div className="floating-menu-divider" />
                              <button
                                className="floating-menu-item danger"
                                onMouseDown={(e) => runOrgMenuAction(e, () => {
                                  setDeleteOrg(org);
                                  setDeleteConfirmCode("");
                                  setDeleteError("");
                                })}
                              >
                                <Trash2 size={13} strokeWidth={2} />
                                Delete Organization
                              </button>
                            </FloatingMenu>
```

- [ ] **Step 5: Add the confirmation Modal after the toggle Modal**

After the closing `</Modal>` of the toggle modal (line 1172), add:

```jsx
      {/* Delete Organization confirmation modal */}
      <Modal open={!!deleteOrg} onClose={() => setDeleteOrg(null)} size="sm">
        <div className="fs-modal-header" style={{ textAlign: "center", borderBottom: "none", paddingBottom: 4, position: "relative" }}>
          <button className="fs-close" onClick={() => setDeleteOrg(null)} style={{ position: "absolute", top: 0, right: 0 }}>
            <X size={16} strokeWidth={2} />
          </button>
          <div className="eem-icon" style={{ margin: "0 auto 10px", display: "grid", placeItems: "center" }}>
            <Trash2 size={20} />
          </div>
          <div className="fs-title" style={{ letterSpacing: "-0.3px" }}>Delete Organization</div>
        </div>
        <div className="fs-modal-body" style={{ paddingTop: 8 }}>
          <FbAlert variant="danger">
            <p style={{ textAlign: "justify", textJustify: "inter-word" }}>
              This will permanently delete <strong>{deleteOrg?.name}</strong>{" "}
              (<code>{deleteOrg?.code}</code>) and <strong>all associated data</strong>:
              evaluation periods, projects, jurors, scores, and audit logs.
              This action cannot be undone.
            </p>
          </FbAlert>
          <label style={{ display: "block", marginTop: 16, fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
            Type <code>{deleteOrg?.code}</code> to confirm
          </label>
          <input
            className={`fs-input${deleteError ? " error" : ""}`}
            value={deleteConfirmCode}
            onChange={(e) => { setDeleteConfirmCode(e.target.value); setDeleteError(""); }}
            placeholder={deleteOrg?.code}
            autoFocus
            autoComplete="off"
            style={{ marginTop: 6 }}
          />
          {deleteError && (
            <p className="crt-field-error">
              <AlertCircle size={12} strokeWidth={2} />{deleteError}
            </p>
          )}
        </div>
        <div className="fs-modal-footer" style={{ justifyContent: "center", borderTop: "none", background: "transparent", paddingTop: 0, paddingBottom: 20, gap: 8 }}>
          <button className="fs-btn fs-btn-secondary" onClick={() => setDeleteOrg(null)} style={{ minWidth: 88 }}>
            Cancel
          </button>
          <button
            className="fs-btn fs-btn-danger"
            disabled={
              deleteLoading ||
              deleteConfirmCode.trim().toUpperCase() !== (deleteOrg?.code || "").toUpperCase()
            }
            onClick={handleDeleteOrg}
            style={{ minWidth: 150 }}
          >
            <AsyncButtonContent loading={deleteLoading} loadingText="Deleting…">
              Delete Organization
            </AsyncButtonContent>
          </button>
        </div>
      </Modal>
```

- [ ] **Step 6: Verify no TypeScript/lint errors and build passes**

```bash
npm run build 2>&1 | tail -20
```

Expected: clean build, no errors.

- [ ] **Step 7: Run full test suite**

```bash
npm test -- --run
```

Expected: all tests pass, including the new `deleteOrganization.test.js`.

---

## Task 4: Manual QA Checklist

After deploying the migration and implementing the UI, verify the following in the running app (`npm run dev`):

- [ ] Open OrganizationsPage as super admin. Kebab menu shows **Delete Organization** item (below a second divider, after Enable/Disable).
- [ ] Click Delete Organization. Modal opens with org name and code in the warning text.
- [ ] Delete button is disabled until you type the org code exactly (case-insensitive: `ieee-apssdc` matches `IEEE-APSSDC`).
- [ ] Type the org code → Delete button activates.
- [ ] Confirm deletion → modal closes, toast shows `"<code>" organization deleted.`, org disappears from the list.
- [ ] Non-super admin cannot reach OrganizationsPage (redirected to overview) — no code change needed, just verify existing guard still works.
- [ ] Attempt deletion with wrong code typed → button stays disabled; submitting is impossible.
- [ ] If RPC returns an error (e.g. mock by revoking grant), `deleteError` is shown inline in the modal, not as `window.alert`.
