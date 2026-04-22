# Org Admin Ownership Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note:** VERA project policy forbids git worktrees (per `CLAUDE.md`). Work directly on `main`.

**Goal:** Introduce an owner role in each VERA organization so the person who sets it up controls who else joins, with an escape hatch to delegate invite rights and a safe ownership transfer flow.

**Architecture:** Add `memberships.is_owner boolean` + partial unique index (one owner per org). Use `organizations.settings.admins_can_invite` JSONB key as delegation toggle. Two new SQL helpers (`_assert_tenant_owner`, `_assert_can_invite`) gate three new RPCs (transfer, remove, set-setting) plus updates to list-members, cancel-invite, and the `invite-org-admin` edge function. Frontend gains Owner pill, toggle, kebab actions, and inline confirm panels in `AdminTeamCard`.

**Tech Stack:** PostgreSQL (Supabase), Deno (edge functions), React 18 + Vite, React Router v6, Lucide icons, Vitest.

**Spec:** `docs/superpowers/specs/2026-04-22-org-admin-ownership-model-design.md`

---

## File Structure

**Created:**
- none

**Modified:**
- `sql/migrations/002_tables.sql` — add `is_owner` column + partial unique index + idempotent backfill
- `sql/migrations/006_rpcs_admin.sql` — add 2 helpers + 3 new RPCs + update `rpc_org_admin_list_members`
- `sql/migrations/007_identity.sql` — update `rpc_org_admin_cancel_invite` caller check
- `sql/README.md` — update to reflect ownership column + new RPCs
- `supabase/functions/invite-org-admin/index.ts` — switch caller gate to `_assert_can_invite`
- `src/shared/api/admin/organizations.js` — add `transferOwnership`, `removeOrgAdmin`, `setAdminsCanInvite`
- `src/shared/api/admin/index.js` — re-export new helpers
- `src/shared/api/index.js` — public surface re-exports
- `src/admin/hooks/useAdminTeam.js` — map `is_owner`/`is_you`, expose `admins_can_invite`, expose `canInvite`, add `transferOwnership`/`removeMember`/`setAdminsCanInvite` actions
- `src/admin/components/AdminTeamCard.jsx` — Owner pill, toggle, updated kebab, invite-gated UI, inline confirm panels
- `src/admin/components/AdminTeamCard.css` — Owner pill, toggle row, inline confirm styles

**New tests:**
- `src/admin/__tests__/useAdminTeam.test.js` — mapping + canInvite derivation
- `src/admin/__tests__/AdminTeamCard.test.jsx` — pill rendering, kebab visibility matrix

---

## Migration policy reminder

Per `CLAUDE.md`:
1. Edit existing migration modules (no new patch files).
2. After every migration change, update `sql/README.md` in the same step.
3. Apply to **both** `vera-prod` and `vera-demo` in the same step via Supabase MCP.
4. Edge function deploy: both projects in the same step.
5. Backfill must be idempotent.

---

## Task 1: Add `is_owner` column and partial unique index

**Files:**
- Modify: `sql/migrations/002_tables.sql` (memberships block around lines 62-83)

- [ ] **Step 1: Add column + index + backfill to the memberships block**

Locate the memberships table definition (around line 62) and the index block that follows (lines 75-83). After the `idx_memberships_grace_ends_at` index, append:

```sql
-- is_owner: the person who set up the org is its owner. At most one owner per org.
-- New memberships default to false; the first active org_admin per org is backfilled below.
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS memberships_one_owner_per_org
  ON memberships(organization_id) WHERE is_owner = true;

-- Backfill: earliest active org_admin per org becomes owner.
-- Idempotent: only updates rows whose target is currently is_owner = false.
UPDATE memberships m
SET is_owner = true
FROM (
  SELECT DISTINCT ON (organization_id) id
  FROM memberships
  WHERE status = 'active'
    AND role = 'org_admin'
    AND organization_id IS NOT NULL
  ORDER BY organization_id, created_at ASC
) earliest
WHERE m.id = earliest.id
  AND m.is_owner = false;
```

Note: `ADD COLUMN IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS` make this safe to re-apply.

- [ ] **Step 2: Apply to vera-prod via Supabase MCP**

```
mcp__claude_ai_Supabase__apply_migration
  project_id: <vera-prod project ref>
  name: memberships_is_owner
  query: <the three statements above>
```

- [ ] **Step 3: Apply to vera-demo via Supabase MCP**

Same statements, different project.

- [ ] **Step 4: Verify backfill on both projects**

```
mcp__claude_ai_Supabase__execute_sql
  query: |
    SELECT organization_id, COUNT(*) FILTER (WHERE is_owner) AS owners,
           COUNT(*) FILTER (WHERE status='active' AND role='org_admin') AS admins
    FROM memberships
    WHERE organization_id IS NOT NULL
    GROUP BY organization_id
    HAVING COUNT(*) FILTER (WHERE is_owner) = 0
       AND COUNT(*) FILTER (WHERE status='active' AND role='org_admin') > 0;
```

Expected: 0 rows (every org with at least one active admin has exactly one owner).

- [ ] **Step 5: Commit**

```bash
git add sql/migrations/002_tables.sql
git commit -m "feat(db): add memberships.is_owner + partial unique index + backfill"
```

---

## Task 2: Add `_assert_tenant_owner` helper

**Files:**
- Modify: `sql/migrations/006_rpcs_admin.sql` (insert immediately after `_assert_org_admin`, around line 275)

- [ ] **Step 1: Append helper after `_assert_org_admin`**

Insert after the `GRANT EXECUTE ON FUNCTION _assert_org_admin(UUID)` line:

```sql
-- =============================================================================
-- _assert_tenant_owner
-- =============================================================================
-- Raises 'unauthorized' if caller is not the owner of p_org_id.
-- Super-admins bypass.

CREATE OR REPLACE FUNCTION public._assert_tenant_owner(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid() AND role = 'super_admin'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND status = 'active'
      AND is_owner = true
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public._assert_tenant_owner(UUID) TO authenticated;
```

- [ ] **Step 2: Apply to vera-prod + vera-demo via MCP**

Use `mcp__claude_ai_Supabase__apply_migration` with the `CREATE OR REPLACE FUNCTION` + `GRANT` statements on both projects.

- [ ] **Step 3: Smoke-test on demo**

```sql
-- Should raise 'unauthorized' when run as a non-owner admin
SELECT _assert_tenant_owner('<any org id>'::uuid);
```

- [ ] **Step 4: Commit**

```bash
git add sql/migrations/006_rpcs_admin.sql
git commit -m "feat(db): add _assert_tenant_owner helper"
```

---

## Task 3: Add `_assert_can_invite` helper

**Files:**
- Modify: `sql/migrations/006_rpcs_admin.sql` (insert after `_assert_tenant_owner`)

- [ ] **Step 1: Append helper**

```sql
-- =============================================================================
-- _assert_can_invite
-- =============================================================================
-- Raises 'unauthorized' unless caller is:
--   • the owner of p_org_id, OR
--   • an active org_admin of p_org_id AND organizations.settings.admins_can_invite = true, OR
--   • a super_admin.

CREATE OR REPLACE FUNCTION public._assert_can_invite(p_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner      boolean;
  v_is_admin      boolean;
  v_is_super      boolean;
  v_delegated     boolean;
BEGIN
  SELECT
    EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND role = 'super_admin'),
    EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND organization_id = p_org_id AND status = 'active' AND is_owner = true),
    EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND organization_id = p_org_id AND status = 'active' AND role = 'org_admin')
  INTO v_is_super, v_is_owner, v_is_admin;

  IF v_is_super OR v_is_owner THEN
    RETURN;
  END IF;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE((settings->>'admins_can_invite')::boolean, false)
  INTO v_delegated
  FROM organizations
  WHERE id = p_org_id;

  IF NOT COALESCE(v_delegated, false) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public._assert_can_invite(UUID) TO authenticated;
```

- [ ] **Step 2: Apply to vera-prod + vera-demo via MCP**

- [ ] **Step 3: Commit**

```bash
git add sql/migrations/006_rpcs_admin.sql
git commit -m "feat(db): add _assert_can_invite helper (owner or delegated admin)"
```

---

## Task 4: Update `rpc_org_admin_list_members` to include `is_owner`, `is_you`, and `admins_can_invite`

**Files:**
- Modify: `sql/migrations/006_rpcs_admin.sql` (around lines 2965-3003)

The existing function returns a JSON array of members. We extend it to:
- Add `is_owner` and `is_you` to each member object.
- Wrap the result in a top-level JSON object that also includes `admins_can_invite` (needed by the UI to decide whether non-owner admins see the Invite button).

- [ ] **Step 1: Replace the function body**

Replace the current `CREATE OR REPLACE FUNCTION public.rpc_org_admin_list_members()` block with:

```sql
CREATE OR REPLACE FUNCTION public.rpc_org_admin_list_members()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id  UUID;
  v_members JSONB;
  v_flag    boolean;
BEGIN
  SELECT organization_id INTO v_org_id
  FROM memberships
  WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  SELECT COALESCE((settings->>'admins_can_invite')::boolean, false)
  INTO v_flag
  FROM organizations
  WHERE id = v_org_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',           m.id,
      'user_id',      m.user_id,
      'status',       m.status,
      'created_at',   m.created_at,
      'display_name', p.display_name,
      'email',        u.email,
      'is_owner',     m.is_owner,
      'is_you',       (m.user_id = auth.uid())
    )
  ), '[]'::jsonb)
  INTO v_members
  FROM memberships m
  LEFT JOIN profiles p   ON p.id = m.user_id
  LEFT JOIN auth.users u ON u.id = m.user_id
  WHERE m.organization_id = v_org_id
    AND m.status IN ('active', 'invited');

  RETURN jsonb_build_object(
    'members', v_members,
    'admins_can_invite', COALESCE(v_flag, false)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_org_admin_list_members() TO authenticated;
```

**Breaking change:** return type changes from `JSON` array to `JSONB` object. The API layer and hook will be updated in Task 10 and 11 to match.

- [ ] **Step 2: Apply to vera-prod + vera-demo via MCP**

- [ ] **Step 3: Smoke test**

```sql
SELECT rpc_org_admin_list_members();
```
Expected output shape:
```json
{ "members": [ { "id": "...", "is_owner": true, "is_you": true, ... } ], "admins_can_invite": false }
```

- [ ] **Step 4: Commit**

```bash
git add sql/migrations/006_rpcs_admin.sql
git commit -m "feat(db): list-members returns {members, admins_can_invite}, per-row is_owner/is_you"
```

---

## Task 5: Update `rpc_org_admin_cancel_invite` to use `_assert_can_invite`

**Files:**
- Modify: `sql/migrations/007_identity.sql` (around line 89)

- [ ] **Step 1: Swap caller check**

In the existing function body, replace:

```sql
  PERFORM public._assert_org_admin(v_org_id);
```

with:

```sql
  PERFORM public._assert_can_invite(v_org_id);
```

No other change; the rest of the function body stays identical.

- [ ] **Step 2: Apply to vera-prod + vera-demo via MCP**

Re-run the full `CREATE OR REPLACE FUNCTION public.rpc_org_admin_cancel_invite(...)` body with the new assert.

- [ ] **Step 3: Commit**

```bash
git add sql/migrations/007_identity.sql
git commit -m "feat(db): rpc_org_admin_cancel_invite gated by _assert_can_invite"
```

---

## Task 6: Add `rpc_org_admin_transfer_ownership`

**Files:**
- Modify: `sql/migrations/006_rpcs_admin.sql` (append after `rpc_org_admin_list_members`)

- [ ] **Step 1: Append function**

```sql
-- =============================================================================
-- rpc_org_admin_transfer_ownership
-- =============================================================================
-- Owner-only. Transfers ownership to another active org_admin in the same org.
-- After transfer, caller remains on the team as a regular org_admin.

CREATE OR REPLACE FUNCTION public.rpc_org_admin_transfer_ownership(
  p_target_membership_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_org_id       UUID;
  v_target_user  UUID;
  v_target_status TEXT;
  v_target_role  TEXT;
  v_target_owner boolean;
  v_caller_membership UUID;
BEGIN
  -- Load target row and its org.
  SELECT organization_id, user_id, status, role, is_owner
    INTO v_org_id, v_target_user, v_target_status, v_target_role, v_target_owner
  FROM memberships
  WHERE id = p_target_membership_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  -- Caller must be owner of this org (or super-admin).
  PERFORM public._assert_tenant_owner(v_org_id);

  IF v_target_status <> 'active' OR v_target_role <> 'org_admin' OR v_target_owner THEN
    RAISE EXCEPTION 'invalid_target';
  END IF;

  IF v_target_user = auth.uid() THEN
    RAISE EXCEPTION 'cannot_transfer_to_self';
  END IF;

  -- Find caller's membership in this org.
  SELECT id INTO v_caller_membership
  FROM memberships
  WHERE organization_id = v_org_id
    AND user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;

  -- Two-step update in a single transaction. Unique index allows the
  -- intermediate state (zero owners) momentarily; constraint is enforced at
  -- statement boundary, not row boundary.
  UPDATE memberships SET is_owner = false WHERE id = v_caller_membership;
  UPDATE memberships SET is_owner = true  WHERE id = p_target_membership_id;

  -- Audit
  PERFORM public._audit_write(
    v_org_id,
    'org.ownership.transfer',
    'membership',
    p_target_membership_id,
    'security'::audit_category,
    'high'::audit_severity,
    jsonb_build_object(
      'from_user_id', auth.uid(),
      'to_user_id',   v_target_user
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'new_owner_user_id', v_target_user
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_org_admin_transfer_ownership(UUID) TO authenticated;
```

- [ ] **Step 2: Apply to vera-prod + vera-demo via MCP**

- [ ] **Step 3: Manual smoke test (demo)**

- Seed two active org_admins in one org.
- Call `rpc_org_admin_transfer_ownership(<other_membership_id>)` as the current owner.
- Verify ownership flipped and an audit row with `action='org.ownership.transfer'` exists.

- [ ] **Step 4: Commit**

```bash
git add sql/migrations/006_rpcs_admin.sql
git commit -m "feat(db): add rpc_org_admin_transfer_ownership"
```

---

## Task 7: Add `rpc_org_admin_remove_member`

**Files:**
- Modify: `sql/migrations/006_rpcs_admin.sql` (append after transfer_ownership)

- [ ] **Step 1: Append function**

```sql
-- =============================================================================
-- rpc_org_admin_remove_member
-- =============================================================================
-- Owner-only. Deletes a membership row (active or invited).
-- Cannot remove the owner's own row; ownership must be transferred first.

CREATE OR REPLACE FUNCTION public.rpc_org_admin_remove_member(
  p_membership_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id     UUID;
  v_target_user UUID;
  v_is_owner   boolean;
BEGIN
  SELECT organization_id, user_id, is_owner
    INTO v_org_id, v_target_user, v_is_owner
  FROM memberships
  WHERE id = p_membership_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'target_not_found';
  END IF;

  PERFORM public._assert_tenant_owner(v_org_id);

  IF v_is_owner THEN
    RAISE EXCEPTION 'cannot_remove_owner';
  END IF;

  DELETE FROM memberships WHERE id = p_membership_id;

  PERFORM public._audit_write(
    v_org_id,
    'org.admin.remove',
    'membership',
    p_membership_id,
    'security'::audit_category,
    'medium'::audit_severity,
    jsonb_build_object('removed_user_id', v_target_user)
  );

  RETURN jsonb_build_object('ok', true, 'membership_id', p_membership_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_org_admin_remove_member(UUID) TO authenticated;
```

- [ ] **Step 2: Apply to vera-prod + vera-demo via MCP**

- [ ] **Step 3: Commit**

```bash
git add sql/migrations/006_rpcs_admin.sql
git commit -m "feat(db): add rpc_org_admin_remove_member"
```

---

## Task 8: Add `rpc_org_admin_set_admins_can_invite`

**Files:**
- Modify: `sql/migrations/006_rpcs_admin.sql` (append after remove_member)

- [ ] **Step 1: Append function**

```sql
-- =============================================================================
-- rpc_org_admin_set_admins_can_invite
-- =============================================================================
-- Owner-only. Toggles organizations.settings.admins_can_invite for p_org_id.

CREATE OR REPLACE FUNCTION public.rpc_org_admin_set_admins_can_invite(
  p_org_id  UUID,
  p_enabled boolean
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._assert_tenant_owner(p_org_id);

  UPDATE organizations
  SET settings = jsonb_set(
        COALESCE(settings, '{}'::jsonb),
        '{admins_can_invite}',
        to_jsonb(p_enabled),
        true
      ),
      updated_at = now()
  WHERE id = p_org_id;

  PERFORM public._audit_write(
    p_org_id,
    'org.settings.admins_can_invite',
    'organization',
    p_org_id,
    'configuration'::audit_category,
    'medium'::audit_severity,
    jsonb_build_object('enabled', p_enabled)
  );

  RETURN jsonb_build_object('ok', true, 'enabled', p_enabled);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_org_admin_set_admins_can_invite(UUID, boolean) TO authenticated;
```

**Note:** If the codebase uses different audit category/severity ENUM labels, verify them before applying. The values `security`, `configuration`, `high`, `medium` must match `audit_category` / `audit_severity` enums in `002_tables.sql`. If not, replace with the actual enum labels.

- [ ] **Step 2: Apply to vera-prod + vera-demo via MCP**

- [ ] **Step 3: Commit**

```bash
git add sql/migrations/006_rpcs_admin.sql
git commit -m "feat(db): add rpc_org_admin_set_admins_can_invite"
```

---

## Task 9: Update `invite-org-admin` edge function caller check

**Files:**
- Modify: `supabase/functions/invite-org-admin/index.ts`

The edge function currently calls `_assert_org_admin` (directly or via a membership lookup). We change it to use `_assert_can_invite` so delegated admins can invite when the org setting is on.

- [ ] **Step 1: Read the current caller-authorization block**

```bash
grep -n "_assert_org_admin\|assertOrgAdmin\|membership_check\|rpc_org_admin" supabase/functions/invite-org-admin/index.ts
```

Locate the code that asserts the caller is an org admin — likely a call like:

```ts
const { error: assertErr } = await service.rpc('_assert_org_admin', { p_org_id: orgId });
```

- [ ] **Step 2: Replace with `_assert_can_invite`**

Change the RPC name to `_assert_can_invite` (parameter name stays `p_org_id`). The call uses the caller's JWT (not service-role) so the assertion evaluates `auth.uid()` correctly — confirm the function uses an auth-scoped client (e.g., `authClient.rpc(...)`) rather than the service client for this assertion. If it currently uses service role for the assertion, switch to an auth-scoped client:

```ts
const authClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_ANON_KEY")!,
  { global: { headers: { Authorization: `Bearer ${token}` } } }
);

const { error: assertErr } = await authClient.rpc('_assert_can_invite', { p_org_id: orgId });
if (assertErr) return json(403, { error: 'forbidden' });
```

Rationale: the helper reads `auth.uid()` from the caller's JWT. Service-role calls would evaluate as super-admin and bypass the gate.

- [ ] **Step 3: Deploy to vera-prod AND vera-demo in the same step**

```
mcp__claude_ai_Supabase__deploy_edge_function
  project_id: <vera-prod ref>
  name: invite-org-admin
  files: [{ name: 'index.ts', content: <updated file> }]
```

Repeat for vera-demo.

- [ ] **Step 4: Manual verification on demo**

- As a non-owner admin with `admins_can_invite = false`: invite should 403.
- Toggle the setting on via SQL: `UPDATE organizations SET settings = jsonb_set(COALESCE(settings,'{}'::jsonb), '{admins_can_invite}', 'true'::jsonb) WHERE id = '<org>';`
- Retry invite as non-owner admin: should succeed.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/invite-org-admin/index.ts
git commit -m "feat(edge): invite-org-admin uses _assert_can_invite"
```

---

## Task 10: Update `sql/README.md`

**Files:**
- Modify: `sql/README.md`

- [ ] **Step 1: Reflect new column + helpers + RPCs**

Add or update entries under the appropriate sections to mention:
- `memberships.is_owner` column (002)
- `_assert_tenant_owner`, `_assert_can_invite` helpers (006)
- `rpc_org_admin_transfer_ownership`, `rpc_org_admin_remove_member`, `rpc_org_admin_set_admins_can_invite` (006)
- Updated signatures: `rpc_org_admin_list_members` now returns `{members, admins_can_invite}`
- `rpc_org_admin_cancel_invite` gated by `_assert_can_invite`

Use terse wording that matches the file's existing style.

- [ ] **Step 2: Commit**

```bash
git add sql/README.md
git commit -m "docs(sql): document ownership model + new RPCs"
```

---

## Task 11: Extend API layer — `listOrgAdminMembers` response shape

**Files:**
- Modify: `src/shared/api/admin/organizations.js` (lines 253-257)

- [ ] **Step 1: Update the wrapper to handle new shape**

Replace:

```js
export async function listOrgAdminMembers() {
  const { data, error } = await supabase.rpc("rpc_org_admin_list_members");
  if (error) throw error;
  return data || [];
}
```

with:

```js
/**
 * Returns { members: Array, adminsCanInvite: boolean }.
 * Members include per-row is_owner / is_you fields.
 */
export async function listOrgAdminMembers() {
  const { data, error } = await supabase.rpc("rpc_org_admin_list_members");
  if (error) throw error;
  return {
    members: Array.isArray(data?.members) ? data.members : [],
    adminsCanInvite: Boolean(data?.admins_can_invite),
  };
}
```

- [ ] **Step 2: Search for any other caller of `listOrgAdminMembers`**

```bash
grep -rn "listOrgAdminMembers" src/
```

Expected: only `src/admin/hooks/useAdminTeam.js` — update in Task 13.

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/admin/organizations.js
git commit -m "feat(api): listOrgAdminMembers returns {members, adminsCanInvite}"
```

---

## Task 12: Add `transferOwnership`, `removeOrgAdmin`, `setAdminsCanInvite` API helpers

**Files:**
- Modify: `src/shared/api/admin/organizations.js` (append near other invite helpers, around line 190)
- Modify: `src/shared/api/admin/index.js`
- Modify: `src/shared/api/index.js`

- [ ] **Step 1: Append to `organizations.js`**

```js
/**
 * Owner-only: transfer ownership to another active admin in the same org.
 */
export async function transferOwnership(targetMembershipId) {
  const { data, error } = await supabase.rpc("rpc_org_admin_transfer_ownership", {
    p_target_membership_id: targetMembershipId,
  });
  if (error) throw error;
  return data;
}

/**
 * Owner-only: remove another admin (active or invited).
 */
export async function removeOrgAdmin(membershipId) {
  const { data, error } = await supabase.rpc("rpc_org_admin_remove_member", {
    p_membership_id: membershipId,
  });
  if (error) throw error;
  return data;
}

/**
 * Owner-only: toggle the "admins can invite" delegation flag for an org.
 */
export async function setAdminsCanInvite(orgId, enabled) {
  const { data, error } = await supabase.rpc("rpc_org_admin_set_admins_can_invite", {
    p_org_id: orgId,
    p_enabled: Boolean(enabled),
  });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Re-export from `src/shared/api/admin/index.js`**

Open the file and find the block that re-exports from `./organizations`. Add the three new names to the existing export list (keep alphabetical/existing order):

```js
export {
  // ... existing exports
  listOrgAdminMembers,
  transferOwnership,
  removeOrgAdmin,
  setAdminsCanInvite,
} from "./organizations.js";
```

If the file re-exports via `export * from "./organizations.js"`, no change is needed — just verify.

- [ ] **Step 3: Re-export from `src/shared/api/index.js`**

Verify the public surface file already re-exports the admin barrel (it should). If it uses an explicit list, append the three new names. If it uses `export * from "./admin"`, no change is needed.

- [ ] **Step 4: Commit**

```bash
git add src/shared/api/admin/organizations.js src/shared/api/admin/index.js src/shared/api/index.js
git commit -m "feat(api): transferOwnership, removeOrgAdmin, setAdminsCanInvite"
```

---

## Task 13: Extend `useAdminTeam` hook

**Files:**
- Modify: `src/admin/hooks/useAdminTeam.js`

- [ ] **Step 1: Update `mapMembers` for new fields**

Replace the current `mapMembers` function with:

```js
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
    isOwner: Boolean(m.is_owner),
    isYou: Boolean(m.is_you),
  }));
}
```

- [ ] **Step 2: Update the hook to consume the new API shape and derive `canInvite`**

Replace the `refetch` function body with:

```js
const [adminsCanInvite, setAdminsCanInvite] = useState(false);

const refetch = useCallback(async () => {
  if (!orgId) return;
  setLoading(true);
  setError(null);
  try {
    const { members: raw, adminsCanInvite: flag } = await listOrgAdminMembers();
    setMembers(mapMembers(raw));
    setAdminsCanInvite(flag);
  } catch (e) {
    setError(e.message || "Failed to load team");
  } finally {
    setLoading(false);
  }
}, [orgId]);
```

Add the new `useState` declaration at the top of the hook alongside the existing ones.

- [ ] **Step 3: Derive `isOwnerViewer` and `canInvite`**

After the existing state declarations, compute:

```js
// Viewer-side derived state. Owner always can invite.
const isOwnerViewer = members.some((m) => m.isYou && m.isOwner);
const canInvite = isOwnerViewer || adminsCanInvite;
```

- [ ] **Step 4: Add new action wrappers**

Import the three new API functions at the top:

```js
import {
  listOrgAdminMembers,
  inviteOrgAdmin,
  cancelOrgAdminInvite,
  transferOwnership as apiTransferOwnership,
  removeOrgAdmin as apiRemoveOrgAdmin,
  setAdminsCanInvite as apiSetAdminsCanInvite,
} from "../../shared/api";
```

Add action callbacks before the `return`:

```js
const transferOwnership = useCallback(
  async (targetMembershipId) => {
    try {
      await apiTransferOwnership(targetMembershipId);
      toast.success("Ownership transferred");
      await refetch();
    } catch (e) {
      toast.error(e.message || "Failed to transfer ownership");
    }
  },
  [toast, refetch]
);

const removeMember = useCallback(
  async (membershipId) => {
    try {
      await apiRemoveOrgAdmin(membershipId);
      toast.success("Admin removed");
      await refetch();
    } catch (e) {
      toast.error(e.message || "Failed to remove admin");
    }
  },
  [toast, refetch]
);

const setAdminsCanInviteFlag = useCallback(
  async (enabled) => {
    if (!orgId) return;
    // Optimistic update for snappier toggle; revert on failure.
    const prev = adminsCanInvite;
    setAdminsCanInvite(enabled);
    try {
      await apiSetAdminsCanInvite(orgId, enabled);
      toast.success(enabled ? "Admins can now invite" : "Only owner can invite now");
    } catch (e) {
      setAdminsCanInvite(prev);
      toast.error(e.message || "Failed to update setting");
    }
  },
  [orgId, adminsCanInvite, toast]
);
```

- [ ] **Step 5: Expose them in the return value**

```js
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
  adminsCanInvite,
  canInvite,
  isOwnerViewer,
  transferOwnership,
  removeMember,
  setAdminsCanInvite: setAdminsCanInviteFlag,
};
```

- [ ] **Step 6: Commit**

```bash
git add src/admin/hooks/useAdminTeam.js
git commit -m "feat(admin): extend useAdminTeam with owner + delegation state"
```

---

## Task 14: Unit test for `useAdminTeam`

**Files:**
- Create: `src/admin/__tests__/useAdminTeam.test.js`

- [ ] **Step 1: Write tests**

```js
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { qaTest } from "../../test/qaTest";

vi.mock("../../shared/api", () => ({
  listOrgAdminMembers: vi.fn(),
  inviteOrgAdmin: vi.fn(),
  cancelOrgAdminInvite: vi.fn(),
  transferOwnership: vi.fn(),
  removeOrgAdmin: vi.fn(),
  setAdminsCanInvite: vi.fn(),
}));

vi.mock("../../shared/hooks/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import { listOrgAdminMembers } from "../../shared/api";
import { useAdminTeam } from "../hooks/useAdminTeam";

describe("useAdminTeam", () => {
  beforeEach(() => vi.clearAllMocks());

  qaTest("AT-HOOK-01", "owner viewer has canInvite=true regardless of flag", async () => {
    listOrgAdminMembers.mockResolvedValueOnce({
      members: [
        { id: "m1", user_id: "u1", status: "active", is_owner: true, is_you: true, email: "a@b" },
        { id: "m2", user_id: "u2", status: "active", is_owner: false, is_you: false, email: "c@d" },
      ],
      adminsCanInvite: false,
    });
    const { result } = renderHook(() => useAdminTeam("org-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isOwnerViewer).toBe(true);
    expect(result.current.canInvite).toBe(true);
  });

  qaTest("AT-HOOK-02", "non-owner viewer canInvite follows delegation flag", async () => {
    listOrgAdminMembers.mockResolvedValueOnce({
      members: [
        { id: "m1", user_id: "u1", status: "active", is_owner: true, is_you: false, email: "a@b" },
        { id: "m2", user_id: "u2", status: "active", is_owner: false, is_you: true, email: "c@d" },
      ],
      adminsCanInvite: true,
    });
    const { result } = renderHook(() => useAdminTeam("org-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isOwnerViewer).toBe(false);
    expect(result.current.canInvite).toBe(true);
  });

  qaTest("AT-HOOK-03", "non-owner viewer canInvite=false when flag off", async () => {
    listOrgAdminMembers.mockResolvedValueOnce({
      members: [
        { id: "m1", user_id: "u1", status: "active", is_owner: true, is_you: false, email: "a@b" },
        { id: "m2", user_id: "u2", status: "active", is_owner: false, is_you: true, email: "c@d" },
      ],
      adminsCanInvite: false,
    });
    const { result } = renderHook(() => useAdminTeam("org-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.canInvite).toBe(false);
  });
});
```

- [ ] **Step 2: Add QA catalog entries**

Open `src/test/qa-catalog.json` and add:

```json
"AT-HOOK-01": "useAdminTeam: owner viewer always can invite",
"AT-HOOK-02": "useAdminTeam: non-owner canInvite follows delegation flag",
"AT-HOOK-03": "useAdminTeam: non-owner canInvite false when flag off"
```

Preserve existing JSON formatting and comma placement.

- [ ] **Step 3: Run the tests**

```bash
npm test -- --run src/admin/__tests__/useAdminTeam.test.js
```

Expected: 3 passing.

- [ ] **Step 4: Commit**

```bash
git add src/admin/__tests__/useAdminTeam.test.js src/test/qa-catalog.json
git commit -m "test(admin): cover useAdminTeam ownership + delegation derivation"
```

---

## Task 15: Update `AdminTeamCard` — Owner pill, kebab matrix, toggle, inline confirms

**Files:**
- Modify: `src/admin/components/AdminTeamCard.jsx`
- Modify: `src/admin/components/AdminTeamCard.css`

- [ ] **Step 1: Update imports**

Replace the top import line with:

```jsx
import { UserPlus, MoreVertical, MailOpen, X, AlertCircle, Crown, ArrowRightLeft, UserMinus, Info } from "lucide-react";
import { useState } from "react";
import FbAlert from "../../shared/ui/FbAlert.jsx";
import "./AdminTeamCard.css";
```

- [ ] **Step 2: Update the component props signature**

Replace the destructured props block in the function signature with:

```jsx
export default function AdminTeamCard({
  members = [],
  loading,
  error,
  inviteForm,
  openInviteForm,
  closeInviteForm,
  setInviteEmail,
  sendInvite,
  resendInvite,
  cancelInvite,
  transferOwnership,
  removeMember,
  setAdminsCanInvite,
  adminsCanInvite,
  canInvite,
  isOwnerViewer,
  currentUserId,
}) {
```

- [ ] **Step 3: Add row-level inline confirm state**

Immediately inside the function body, add:

```jsx
// inline confirm state per row: { id: string, kind: 'transfer'|'remove' } | null
const [rowConfirm, setRowConfirm] = useState(null);
```

- [ ] **Step 4: Rewrite the card header**

Replace the existing `<div className="admin-team-header"> ... </div>` block with:

```jsx
<div className="admin-team-header">
  <div>
    <span className="admin-team-title">Admin Team</span>
    {!loading && (
      <span className="admin-team-meta">
        {active.length > 0 && ` · ${active.length} active`}
        {pending.length > 0 && ` · ${pending.length} pending`}
      </span>
    )}
  </div>
  {!inviteForm?.open && canInvite && (
    <button type="button" className="btn-invite-admin" onClick={openInviteForm}>
      <UserPlus size={14} strokeWidth={2} />
      Invite Admin
    </button>
  )}
</div>

{!loading && !canInvite && !isOwnerViewer && (
  <p className="admin-team-info-note">
    <Info size={12} strokeWidth={2} />
    Only the owner can invite new admins.
  </p>
)}

{isOwnerViewer && (
  <label className="admin-team-toggle">
    <input
      type="checkbox"
      checked={!!adminsCanInvite}
      onChange={(e) => setAdminsCanInvite(e.target.checked)}
    />
    <span className="admin-team-toggle-body">
      <span className="admin-team-toggle-label">Allow admins to invite other admins</span>
      <span className="admin-team-toggle-helper">When on, other admins can invite new admins. You always can.</span>
    </span>
  </label>
)}
```

- [ ] **Step 5: Rewrite the active member row**

Replace the existing active member `<tr>` block (currently lines ~141-174) with:

```jsx
{active.map((m) => {
  const isSelf = m.userId === currentUserId;
  const showKebab = isOwnerViewer && !isSelf;
  const openConfirm = rowConfirm?.id === m.id ? rowConfirm.kind : null;

  return (
    <tr key={m.id}>
      <td>
        <div className="admin-team-member-cell">
          <div className="admin-team-avatar" style={{ background: avatarColor(m.email) }}>
            {initials(m)}
          </div>
          <div>
            <div className="admin-team-name">
              {m.displayName || m.email}
              {m.isOwner && (
                <span className="admin-team-owner-pill" title="Owner">
                  <Crown size={10} strokeWidth={2.2} /> Owner
                </span>
              )}
              {isSelf && <span className="admin-team-you-badge">You</span>}
            </div>
            {m.displayName && <div className="admin-team-email">{m.email}</div>}
          </div>
        </div>
      </td>
      <td>
        <span className="badge-active">● Active</span>
      </td>
      <td className="admin-team-actions">
        <div className="admin-team-actions-wrap">
          {openConfirm ? (
            <div className="fs-confirm-panel">
              <span className="fs-confirm-msg">
                {openConfirm === "transfer"
                  ? `Transfer ownership to ${m.displayName || m.email}? You'll become a regular admin.`
                  : `Remove ${m.displayName || m.email} from the admin team? They'll lose access immediately.`}
              </span>
              <span className="fs-confirm-btns">
                <button
                  type="button"
                  className="fs-confirm-cancel"
                  onClick={() => setRowConfirm(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="fs-confirm-action"
                  onClick={async () => {
                    if (openConfirm === "transfer") {
                      await transferOwnership(m.id);
                    } else {
                      await removeMember(m.id);
                    }
                    setRowConfirm(null);
                  }}
                >
                  {openConfirm === "transfer" ? "Transfer" : "Remove"}
                </button>
              </span>
            </div>
          ) : showKebab ? (
            <RowKebab
              onTransfer={() => setRowConfirm({ id: m.id, kind: "transfer" })}
              onRemove={() => setRowConfirm({ id: m.id, kind: "remove" })}
            />
          ) : null}
        </div>
      </td>
    </tr>
  );
})}
```

- [ ] **Step 6: Rewrite the pending member row**

Replace the existing pending `<tr>` block with:

```jsx
{pending.map((m) => {
  const showActions = canInvite;
  const openConfirm = rowConfirm?.id === m.id ? rowConfirm.kind : null;

  return (
    <tr key={m.id}>
      <td>
        <div className="admin-team-member-cell">
          <div className="admin-team-avatar admin-team-avatar-pending">?</div>
          <div>
            <div className="admin-team-name admin-team-name-pending">{m.email}</div>
          </div>
        </div>
      </td>
      <td>
        <span className="badge-pending">⏳ Pending</span>
      </td>
      <td className="admin-team-actions">
        <div className="admin-team-actions-wrap">
          {openConfirm === "cancel" ? (
            <div className="fs-confirm-panel">
              <span className="fs-confirm-msg">Cancel invite for {m.email}?</span>
              <span className="fs-confirm-btns">
                <button
                  type="button"
                  className="fs-confirm-cancel"
                  onClick={() => setRowConfirm(null)}
                >
                  Keep
                </button>
                <button
                  type="button"
                  className="fs-confirm-action"
                  onClick={async () => {
                    await cancelInvite(m.id);
                    setRowConfirm(null);
                  }}
                >
                  Cancel invite
                </button>
              </span>
            </div>
          ) : showActions ? (
            <>
              <button
                type="button"
                className="btn-resend"
                onClick={() => resendInvite(m.id, m.email)}
                title="Resend invite"
              >
                <MailOpen size={12} strokeWidth={2} />
                Resend
              </button>
              <button
                type="button"
                className="btn-cancel-invite"
                onClick={() => setRowConfirm({ id: m.id, kind: "cancel" })}
                title="Cancel invite"
              >
                <X size={12} strokeWidth={2} />
                Cancel
              </button>
            </>
          ) : null}
        </div>
      </td>
    </tr>
  );
})}
```

- [ ] **Step 7: Add the `RowKebab` helper component**

At the bottom of the file (below `AdminTeamCard`), add:

```jsx
function RowKebab({ onTransfer, onRemove }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="admin-team-kebab-wrap">
      <button
        type="button"
        className="btn-kebab"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
      >
        <MoreVertical size={14} strokeWidth={2} />
      </button>
      {open && (
        <div className="admin-team-kebab-menu" onMouseLeave={() => setOpen(false)}>
          <button
            type="button"
            className="admin-team-kebab-item"
            onClick={() => { setOpen(false); onTransfer(); }}
          >
            <ArrowRightLeft size={12} strokeWidth={2} />
            Transfer ownership
          </button>
          <button
            type="button"
            className="admin-team-kebab-item admin-team-kebab-item-danger"
            onClick={() => { setOpen(false); onRemove(); }}
          >
            <UserMinus size={12} strokeWidth={2} />
            Remove from team
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Append CSS**

Append to `src/admin/components/AdminTeamCard.css`:

```css
/* ── Owner pill ── */
.admin-team-owner-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 8px;
  padding: 2px 7px;
  border-radius: 99px;
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.18), rgba(234, 179, 8, 0.08));
  border: 1px solid rgba(234, 179, 8, 0.35);
  color: #b45309;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  vertical-align: middle;
}
.dark-mode .admin-team-owner-pill {
  background: rgba(234, 179, 8, 0.12);
  color: #fbbf24;
  border-color: rgba(234, 179, 8, 0.35);
}

/* ── Delegation toggle ── */
.admin-team-toggle {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-1);
  cursor: pointer;
  margin-bottom: 14px;
}
.admin-team-toggle input[type="checkbox"] {
  margin-top: 2px;
  cursor: pointer;
}
.admin-team-toggle-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.admin-team-toggle-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.admin-team-toggle-helper {
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: justify;
  text-justify: inter-word;
}

/* ── Info note ── */
.admin-team-info-note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-tertiary);
  margin: -6px 0 12px;
}

/* ── Kebab menu ── */
.admin-team-kebab-wrap {
  position: relative;
}
.admin-team-kebab-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  min-width: 180px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-popover, 0 8px 24px rgba(0, 0, 0, 0.12));
  padding: 4px;
  z-index: 20;
  display: flex;
  flex-direction: column;
}
.admin-team-kebab-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: transparent;
  border: none;
  border-radius: var(--radius-xs, 4px);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 500;
  text-align: left;
  cursor: pointer;
}
.admin-team-kebab-item:hover {
  background: var(--surface-1);
}
.admin-team-kebab-item-danger {
  color: var(--danger);
}
.admin-team-kebab-item-danger:hover {
  background: var(--danger-soft);
}
```

The `.fs-confirm-*` classes are project-global (defined in `src/styles/drawers.css` per CLAUDE.md). They should already style the inline confirm correctly without additional CSS.

- [ ] **Step 9: Commit**

```bash
git add src/admin/components/AdminTeamCard.jsx src/admin/components/AdminTeamCard.css
git commit -m "feat(admin): owner pill, kebab actions, delegation toggle, inline confirms"
```

---

## Task 16: Pipe new hook props into `AdminTeamCard` from `SettingsPage`

**Files:**
- Modify: `src/admin/pages/SettingsPage.jsx` (around lines 527-532)

The existing spread already passes everything the hook returns. Verify nothing special is needed — the spread `{...adminTeam}` now includes the new props (`canInvite`, `isOwnerViewer`, `adminsCanInvite`, `transferOwnership`, `removeMember`, `setAdminsCanInvite`). No diff required here unless the file explicitly cherry-picks fields.

- [ ] **Step 1: Inspect the current call site**

```bash
grep -n "AdminTeamCard" src/admin/pages/SettingsPage.jsx
```

Expected: passes `{...adminTeam}` plus `currentUserId`. No changes required.

- [ ] **Step 2: (If needed) Update the spread**

If the file does not use spread (i.e., explicitly destructures fields), enumerate the new ones alongside existing ones.

- [ ] **Step 3: Commit (if changed)**

```bash
git add src/admin/pages/SettingsPage.jsx
git commit -m "chore(admin): forward ownership props to AdminTeamCard"
```

---

## Task 17: Unit test for `AdminTeamCard` kebab visibility matrix

**Files:**
- Create: `src/admin/__tests__/AdminTeamCard.test.jsx`

- [ ] **Step 1: Write tests**

```jsx
import { describe, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { qaTest } from "../../test/qaTest";
import AdminTeamCard from "../components/AdminTeamCard";

vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }));

function baseProps(overrides = {}) {
  return {
    members: [],
    loading: false,
    error: null,
    inviteForm: { open: false, email: "", submitting: false, error: null },
    openInviteForm: vi.fn(),
    closeInviteForm: vi.fn(),
    setInviteEmail: vi.fn(),
    sendInvite: vi.fn(),
    resendInvite: vi.fn(),
    cancelInvite: vi.fn(),
    transferOwnership: vi.fn(),
    removeMember: vi.fn(),
    setAdminsCanInvite: vi.fn(),
    adminsCanInvite: false,
    canInvite: false,
    isOwnerViewer: false,
    currentUserId: "viewer-id",
    ...overrides,
  };
}

const owner = { id: "m-own", userId: "viewer-id", email: "o@x", status: "active", isOwner: true, isYou: true, displayName: "Owner User" };
const other = { id: "m-oth", userId: "u2", email: "a@x", status: "active", isOwner: false, isYou: false, displayName: "Other Admin" };

describe("AdminTeamCard ownership UI", () => {
  qaTest("AT-UI-01", "shows Owner pill on owner row", () => {
    render(<AdminTeamCard {...baseProps({ members: [owner, other], canInvite: true, isOwnerViewer: true })} />);
    const ownerRow = screen.getByText("Owner User").closest("tr");
    expect(ownerRow).toHaveTextContent(/Owner/i);
  });

  qaTest("AT-UI-02", "owner viewer sees Invite Admin button", () => {
    render(<AdminTeamCard {...baseProps({ members: [owner], canInvite: true, isOwnerViewer: true })} />);
    expect(screen.getByRole("button", { name: /Invite Admin/i })).toBeInTheDocument();
  });

  qaTest("AT-UI-03", "non-owner with flag off sees info note instead of button", () => {
    render(<AdminTeamCard {...baseProps({ members: [{ ...other, isYou: true }, { ...owner, isYou: false }], canInvite: false, isOwnerViewer: false })} />);
    expect(screen.queryByRole("button", { name: /Invite Admin/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Only the owner can invite/i)).toBeInTheDocument();
  });

  qaTest("AT-UI-04", "non-owner viewer sees no kebab on other active admins", () => {
    const members = [
      { ...owner, isYou: false },
      { ...other, isYou: true },
      { id: "m-third", userId: "u3", email: "b@x", status: "active", isOwner: false, isYou: false, displayName: "Third" },
    ];
    render(<AdminTeamCard {...baseProps({ members, canInvite: false, isOwnerViewer: false })} />);
    expect(screen.queryByRole("button", { name: /More actions/i })).not.toBeInTheDocument();
  });

  qaTest("AT-UI-05", "owner viewer sees delegation toggle", () => {
    render(<AdminTeamCard {...baseProps({ members: [owner], isOwnerViewer: true, canInvite: true })} />);
    expect(screen.getByText(/Allow admins to invite other admins/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add QA catalog entries**

Append to `src/test/qa-catalog.json`:

```json
"AT-UI-01": "AdminTeamCard: Owner pill rendered on owner row",
"AT-UI-02": "AdminTeamCard: owner sees Invite Admin button",
"AT-UI-03": "AdminTeamCard: non-owner with flag off sees info note, no button",
"AT-UI-04": "AdminTeamCard: non-owner sees no kebab on active admins",
"AT-UI-05": "AdminTeamCard: owner sees delegation toggle"
```

- [ ] **Step 3: Run**

```bash
npm test -- --run src/admin/__tests__/AdminTeamCard.test.jsx
```

Expected: 5 passing.

- [ ] **Step 4: Commit**

```bash
git add src/admin/__tests__/AdminTeamCard.test.jsx src/test/qa-catalog.json
git commit -m "test(admin): AdminTeamCard kebab + pill + toggle visibility"
```

---

## Task 18: End-to-end live verification

**Files:** none (manual browser testing per `feedback_verify_against_live`).

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Golden path — owner flow (against vera-demo)**

1. Log in as the demo admin (owner).
2. Go to `/demo/admin/settings`.
3. Confirm Admin Team card shows: `Owner` pill + `You` pill on own row, `Invite Admin` button, delegation toggle off.
4. Invite a second admin by email. Pending row appears.
5. Open an incognito window, accept invite via email link, complete signup. Row becomes active.
6. Back in owner session: on the new admin's row, open kebab → `Transfer ownership` → confirm. Expect toast `"Ownership transferred"`; pill moves to the other row.
7. Reverse: log in as the new owner, transfer back.

- [ ] **Step 3: Non-owner admin flow**

1. Log in as the non-owner admin (created above).
2. Confirm Admin Team card shows: no `Invite Admin` button, info note `"Only the owner can invite new admins."`, no kebab on any row, no toggle visible.

- [ ] **Step 4: Delegation flow**

1. Log back in as owner, toggle delegation on.
2. Non-owner admin (re-login or refresh): `Invite Admin` button now visible, info note gone.
3. Non-owner invites a third admin — expect success.
4. Non-owner tries to use kebab on an active admin — not visible (remove is still owner-only).

- [ ] **Step 5: Owner leave guard**

1. As owner, confirm that there is no "remove" / "leave" action on own row (only the `Owner`/`You` pills).
2. Attempt direct RPC call `rpc_org_admin_remove_member(<own_membership_id>)` via SQL — expect `cannot_remove_owner` error.

- [ ] **Step 6: Commit verification notes (optional)**

If you took screenshots or made notes, leave them locally. Do not commit screenshots.

---

## Task 19: Final regressions + cleanup

**Files:** none (project-level checks).

- [ ] **Step 1: Run full test suite**

```bash
npm test -- --run
```

All existing + new tests must pass.

- [ ] **Step 2: Run native-select check**

```bash
npm run check:no-native-select
```

- [ ] **Step 3: Run nested-panel check**

```bash
npm run check:no-nested-panels
```

- [ ] **Step 4: Build**

```bash
npm run build
```

Must succeed with no errors.

- [ ] **Step 5: Final commit (if any cleanup)**

```bash
git add -A
git commit -m "chore(admin): ownership model — regressions green"
```

---

## Self-Review (completed)

**Spec coverage:**
- §1 Data Model → Task 1 ✓
- §2 Permission Model → Tasks 2, 3 (helpers) + enforced in Tasks 5, 6, 7, 8, 9 ✓
- §3 RPC & Edge Function Changes → Tasks 2–9 ✓
- §4 API Layer → Tasks 11, 12 ✓
- §5 UI Changes → Tasks 13, 15, 16 ✓
- §6 Migration & Rollout → each DB task includes "apply to both projects"; edge deploy in Task 9 ✓
- §7 Testing → Tasks 14, 17, 18 ✓

**Placeholder scan:** no TBD/TODO. Each step includes exact code.

**Type consistency:** `listOrgAdminMembers` return type `{ members, adminsCanInvite }` is used identically in Tasks 11, 13, and tests in 14, 17. Hook property names (`canInvite`, `isOwnerViewer`, `adminsCanInvite`, `transferOwnership`, `removeMember`, `setAdminsCanInvite`) match across Tasks 13, 15, 16, 17.

**Scope check:** single subsystem (org admin ownership), one plan.

---

**Next:** Offer execution mode — subagent-driven or inline.
