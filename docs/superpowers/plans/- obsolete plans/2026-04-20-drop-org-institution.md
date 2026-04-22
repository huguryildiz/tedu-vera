# Drop `organizations.institution` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse VERA's two-column tenant identity (`organizations.institution` + `organizations.name`) into a single required `name` field, removing `institution` from the schema, RPCs, seed, admin UI, auth flow, and every read-only consumer.

**Architecture:** Snapshot-style migration (edit `002`, `006`, `009` in place + one-shot DDL on prod). Registration keeps its existing single `orgName` input. Admin org list collapses "Organization | Program" into one "Organization" column. Seed gets rewritten with full compound names (option B from the design doc).

**Tech Stack:** Supabase (Postgres + Auth), Vite + React 18, React Router v6, lucide-react, Vitest, Playwright.

**Spec reference:** [docs/superpowers/specs/2026-04-20-drop-org-institution-design.md](../specs/2026-04-20-drop-org-institution-design.md)

**Important rules from CLAUDE.md:**

- Edit migrations in place (snapshot approach); do NOT create a new `010_*.sql` file for this.
- Apply DB changes to **both** `vera-prod` and `vera-demo` in the same step via Supabase MCP.
- Do not run `000_dev_teardown` on prod.
- `sql/seeds/demo_seed.sql` is never pushed to any DB — user applies it manually.

---

## File Structure

**Modified files (grouped by task):**

### DB (Task 1)

- `sql/migrations/002_tables.sql` — drop `institution` column; strip institution from `handle_auth_user_confirmation` trigger.
- `sql/migrations/006_rpcs_admin.sql` — remove `p_institution`/`p_department` from `rpc_admin_create_org_and_membership`; drop `institution` from `rpc_admin_list_organizations`, `rpc_landing_stats`, `rpc_public_search_organizations`.
- `sql/migrations/009_audit.sql` — drop `institution` branch from `rpc_admin_update_organization`.
- `sql/README.md` — update organizations column list.

### Seed (Task 2)

- `scripts/generate_demo_seed.js` — rename `orgs[]` entries (drop `institution`, rewrite `name`); drop `institution` from INSERT.

### Live DB rollout (Task 3)

- (Supabase MCP; no file) — apply to demo (teardown + re-apply + seed) and prod (one-shot `ALTER TABLE ... DROP COLUMN`, plus updated RPC re-apply).

### API layer (Task 4)

- `src/shared/api/admin/organizations.js` — stop reading/writing `institution`; remove `university`/`department` compound logic from `createOrganization`/`updateOrganization`.
- `src/shared/api/admin/auth.js` — drop `institution` from all `organizations` selects.
- `src/shared/api/juryApi.js` — drop `institution` from the nested `organizations(...)` select at line 218.

### Auth flow (Task 5)

- `src/auth/AuthProvider.jsx` — remove `institution` from membership mapping; drop `institution`/`department` params from `completeProfile` RPC call.
- `src/auth/screens/RegisterScreen.jsx` — drop `institution`/`department` from the submit payload; replace `GroupedCombobox` with a plain combobox (or drop grouping by passing a single group).
- `src/auth/screens/CompleteProfileScreen.jsx` — same cleanup on payload.

### Admin org management (Task 6)

- `src/admin/hooks/useManageOrganizations.js` — strip `university`/`department`/`institution` from `EMPTY_CREATE_FORM`, `EMPTY_EDIT_FORM`, `EMPTY_CREATE_ERRORS`; drop `splitInstitution`; rewrite `openEdit`/`openCreate`/`handleCreateOrg`/`handleSaveEditOrganization`; simplify `filteredOrgs` search.
- `src/admin/drawers/CreateOrganizationDrawer.jsx` — remove the `university` + `department` two-column block; strip from `EMPTY`, `handleSave`, validation.
- `src/admin/pages/OrganizationsPage.jsx` — collapse "Organization | Program" table columns into one "Organization" column; delete `splitInstitution` helper (line 118); rewrite `getOrgInitials(org.institution)` → `getOrgInitials(org.name)`; same for `getOrgHue`; remove `institution` sort branch; update edit/view drawers (single "Name" field).
- `src/admin/settings/ManageOrganizationsPanel.jsx` — align with updated hook shape.
- `src/admin/__tests__/ManageOrganizationsPanel.test.jsx` — update fixture shapes.

### Read-only display consumers (Task 7)

- Any file that renders `org.institution` as UI text or uses it for avatar/identity. Sweep via grep and update each to fall back to `org.name` or drop the reference entirely. Known candidates: `SettingsPage.jsx`, `AdminSidebar.jsx`, `EntryControlPage.jsx`, `RankingsPage.jsx`, `PeriodsPage.jsx`, `ProjectsPage.jsx`, `AnalyticsPage.jsx`, `HeatmapPage.jsx`, `CriteriaPage.jsx`, `ReviewsPage.jsx`, `JurorsPage.jsx`, `OutcomesPage.jsx`, `EditProfileDrawer.jsx`, `TenantSwitcher.jsx`, `TenantSearchDropdown.jsx`, `PendingReviewScreen.jsx`, `InviteAcceptScreen.jsx`, `ForgotPasswordScreen.jsx`, `PinResultModal.jsx`, `EntryTokenModal.jsx`, `SendReportModal.jsx`, `IdentityStep.jsx`, `JurorBadge.jsx`.
- `src/shared/api/admin/notifications.js` — evaluate whether `department` param means `organization.department` (drop) or some unrelated field (keep).

### Landing + exports (Task 8)

- `src/landing/LandingPage.jsx` — drop any institution-specific rendering from the landing page (`rpc_landing_stats` no longer returns `institutions`).
- `src/admin/analytics/analyticsExport.js`, `src/admin/hooks/useCriteriaExport.js`, `src/admin/hooks/useOutcomesExport.js`, `src/admin/hooks/useGridExport.js`, `src/admin/utils/downloadTable.js`, `src/admin/components/ExportPanel.jsx`, `src/admin/utils/csvParser.js` — drop `institution` from export schema / CSV header / fixture rows.

### Tests + catalog (Task 9)

- `src/jury/__tests__/IdentityStep.test.jsx` — update fixture.
- `src/admin/__tests__/ManageOrganizationsPanel.test.jsx` — update fixture (covered in Task 6 but re-verify).
- `src/test/qa-catalog.json` — drop any QA entry whose copy references institution (sweep).

### Final verification (Task 10)

- `npm run build`, `npm test -- --run`, `npm run check:no-native-select`, `npm run check:no-nested-panels`.
- Manual smoke test: dev server, register, OrganizationsPage, demo admin, jury flow.

---

## Task 1: Migration files — drop `institution` from schema & RPCs

**Files:**

- Modify: `sql/migrations/002_tables.sql`
- Modify: `sql/migrations/006_rpcs_admin.sql`
- Modify: `sql/migrations/009_audit.sql`
- Modify: `sql/README.md`

- [ ] **Step 1: Edit `sql/migrations/002_tables.sql` — drop column from `CREATE TABLE organizations`**

Line 13 currently reads:

```sql
  institution        TEXT,
```

Delete that line entirely. The `CREATE TABLE organizations (...)` statement must no longer declare `institution`.

- [ ] **Step 2: Edit `sql/migrations/002_tables.sql` — strip institution from `handle_auth_user_confirmation` trigger**

The trigger at lines ~597-725 references `v_institution`. Remove:

- Line 614: `v_institution TEXT;` declaration.
- Line 636: `v_institution := COALESCE(trim(v_metadata->>'institution'), '');`
- Line 660-661 INSERT: change the column list to `INSERT INTO organizations(code, name, status) VALUES (v_code, v_org_name, 'active')` (drop `institution` from both the column list and the VALUES tuple).

Do not touch any other trigger logic (audit write, membership insert, `v_org_name`, `v_join_id` handling).

- [ ] **Step 3: Edit `sql/migrations/006_rpcs_admin.sql` — `rpc_admin_list_organizations` JSON shape**

Line 521 currently:

```sql
        'institution',        o.institution,
```

Delete that line from the `jsonb_build_object(...)` argument list. Leave the comma structure on the surrounding lines intact (the line above already ends with a comma; nothing else needs to change).

- [ ] **Step 4: Edit `sql/migrations/006_rpcs_admin.sql` — `rpc_admin_create_org_and_membership` signature**

Lines 554-612 define the function. Rewrite the signature to:

```sql
CREATE OR REPLACE FUNCTION public.rpc_admin_create_org_and_membership(
  p_name        TEXT,
  p_org_name    TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_org_id  UUID;
  v_code    TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'not_authenticated')::JSON;
  END IF;

  IF p_org_name IS NULL OR trim(p_org_name) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error_code', 'org_name_required')::JSON;
  END IF;

  v_code := upper(regexp_replace(left(p_org_name, 4), '[^A-Z0-9]', '', 'g'))
            || upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  INSERT INTO public.profiles(id) VALUES (v_user_id) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.organizations(code, name, status)
  VALUES (v_code, trim(p_org_name), 'active')
  RETURNING id INTO v_org_id;

  INSERT INTO public.memberships (user_id, organization_id, role, status)
  VALUES (v_user_id, v_org_id, 'org_admin', 'active');

  UPDATE public.profiles SET display_name = trim(p_name) WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'org_id', v_org_id, 'org_code', v_code)::JSON;
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('ok', false, 'error_code', 'org_name_taken')::JSON;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_create_org_and_membership(TEXT, TEXT) TO authenticated;
```

Also delete the old `GRANT EXECUTE ON FUNCTION ... (TEXT, TEXT, TEXT, TEXT)` line (612) — the new GRANT above replaces it with the correct 2-arg signature. The live DB rollout (Task 3) drops the stale 4-arg overload explicitly.

- [ ] **Step 5: Edit `sql/migrations/006_rpcs_admin.sql` — `rpc_landing_stats`**

Line 1489 currently:

```sql
    'institutions',  (SELECT json_agg(DISTINCT institution ORDER BY institution)
                       FROM organizations
                       WHERE status = 'active')
```

Delete the entire `'institutions', ...` key from the `json_build_object(...)` output — landing no longer advertises an institution count. Fix the trailing comma on the line above (`'projects'` ...) so the `json_build_object` call remains syntactically valid.

- [ ] **Step 6: Edit `sql/migrations/006_rpcs_admin.sql` — `rpc_public_search_organizations`**

Lines 2332-2366 currently select `o.institution` and filter by it. Rewrite the inner SELECT and WHERE so `institution` is gone:

```sql
  SELECT COALESCE(json_agg(row_to_json(r)), '[]'::JSON)
  INTO v_results
  FROM (
    SELECT
      o.id,
      o.name,
      (SELECT count(*) FROM memberships m
       WHERE m.organization_id = o.id AND m.status = 'active') AS member_count
    FROM organizations o
    WHERE o.status = 'active'
      AND LOWER(o.name) LIKE '%' || LOWER(trim(p_query)) || '%'
    ORDER BY o.name
    LIMIT 20
  ) r;
```

Note the search predicate now does a substring match on `name` (was prefix on name OR substring on institution). A substring match on `name` is strictly more permissive and matches what users now type into the single compound name (e.g. searching "TED" finds "TED University — Electrical-Electronics Engineering").

- [ ] **Step 7: Edit `sql/migrations/009_audit.sql` — `rpc_admin_update_organization`**

Lines 1198-1201 currently:

```sql
      institution   = CASE
                        WHEN p_updates ? 'institution' THEN p_updates->>'institution'
                        ELSE institution
                      END,
```

Delete those four lines. The `UPDATE organizations SET` statement must no longer mention `institution`. Leave `name`, `code`, `contact_email`, `status` branches unchanged.

- [ ] **Step 8: Edit `sql/README.md` — reflect new organizations column set**

Grep for any org column list in `sql/README.md` and ensure `institution` is no longer listed under the `organizations` table. If there is no column list, leave the file alone (nothing to desync). Commit only what is truly out of date.

- [ ] **Step 9: Verify migrations parse with psql dry check**

Run:

```bash
grep -n "institution" sql/migrations/*.sql
```

Expected output: **only** references inside `archive/` or comments that describe past behavior. No live `institution` token in any of `001..009*.sql`.

- [ ] **Step 10: Commit**

```bash
git add sql/migrations/002_tables.sql sql/migrations/006_rpcs_admin.sql sql/migrations/009_audit.sql sql/README.md
git commit -m "db: drop organizations.institution column and related RPC params

- 002: remove institution from CREATE TABLE + auth-confirm trigger
- 006: drop from list/landing/public-search RPCs; simplify
  rpc_admin_create_org_and_membership to (p_name, p_org_name)
- 009: drop institution branch from rpc_admin_update_organization
- README: sync column list

Snapshot-style edit; live DB rollout handled separately.
"
```

---

## Task 2: Demo seed — rewrite org names, drop institution

**Files:**

- Modify: `scripts/generate_demo_seed.js:197-235`

- [ ] **Step 1: Rewrite the `orgs` array**

Replace lines 197-204 exactly with:

```js
const orgs = [
  { p: 1, name: 'TED University — Electrical-Electronics Engineering', code: 'TEDU-EE', type: 'academic', evalDays: 1, lang: 'tr', descLang: 'en', commentLang: 'en' },
  { p: 2, name: 'Carnegie Mellon University — Computer Science', code: 'CMU-CS', type: 'academic', evalDays: 1, lang: 'en', descLang: 'en' },
  { p: 3, name: 'TEKNOFEST', code: 'TEKNOFEST', type: 'competition', evalDays: 3, lang: 'tr', descLang: 'tr' },
  { p: 4, name: 'TÜBİTAK 2204-A', code: 'TUBITAK-2204A', type: 'competition', evalDays: 2, lang: 'tr', descLang: 'tr' },
  { p: 5, name: 'IEEE APS — AP-S Student Design Contest', code: 'IEEE-APSSDC', type: 'competition', evalDays: 2, lang: 'en', descLang: 'en' },
  { p: 6, name: 'AAS CanSat Competition', code: 'CANSAT', type: 'competition', evalDays: 3, lang: 'en', descLang: 'en' },
];
```

Notice the trailing comma on the last row and the removal of the `institution` key from every entry.

- [ ] **Step 2: Rewrite the INSERT template (line 235)**

Replace:

```js
out.push(`INSERT INTO organizations (id, institution, name, code, status, settings, contact_email, setup_completed_at, updated_at) VALUES ('${o.id}', '${escapeSql(o.institution)}', '${escapeSql(o.name)}', '${o.code}', 'active', '${settings}', '${contactEmail}', ${ts}, ${ts}) ON CONFLICT DO NOTHING;`);
```

with:

```js
out.push(`INSERT INTO organizations (id, name, code, status, settings, contact_email, setup_completed_at, updated_at) VALUES ('${o.id}', '${escapeSql(o.name)}', '${o.code}', 'active', '${settings}', '${contactEmail}', ${ts}, ${ts}) ON CONFLICT DO NOTHING;`);
```

- [ ] **Step 3: Sweep the file for other `institution` or `.institution` references**

Run:

```bash
grep -n "institution" scripts/generate_demo_seed.js
```

Expected: zero hits. If any remain (e.g. audit JSON details strings), inspect and remove. Details JSON strings that already use `o.name` (e.g. line 2344) are fine as-is.

- [ ] **Step 4: Regenerate `sql/seeds/demo_seed.sql`**

Run:

```bash
node scripts/generate_demo_seed.js
```

This writes to `sql/seeds/demo_seed.sql`. Verify the script exits 0.

- [ ] **Step 5: Verify generated SQL is institution-free**

Run:

```bash
grep -c "institution" sql/seeds/demo_seed.sql
```

Expected: `0`.

- [ ] **Step 6: Spot-check one INSERT**

Run:

```bash
grep "CanSat" sql/seeds/demo_seed.sql | head -1
```

Expected: a line that starts `INSERT INTO organizations (id, name, code, ...) VALUES ('...', 'AAS CanSat Competition', 'CANSAT', ...)`.

- [ ] **Step 7: Commit**

```bash
git add scripts/generate_demo_seed.js sql/seeds/demo_seed.sql
git commit -m "seed: collapse org identity into single name, drop institution

Each demo org now has a single compound name (option B from design):
TEDU EE, CMU CS, TEKNOFEST, TÜBİTAK 2204-A, IEEE APS-SDC, AAS CanSat.
INSERT template drops the institution column.
"
```

---

## Task 3: Live DB rollout (Supabase MCP)

**Files:** none (Supabase MCP operations only)

**Do not commit any SQL for this task.** The one-shot DDL is a rollout step; the source-of-truth migration lives in Task 1.

- [ ] **Step 1: Demo DB — re-apply migrations from zero**

Using Supabase MCP for project `vera-demo`:

1. `mcp__claude_ai_Supabase__apply_migration` with name `dev_teardown` and content copied from `sql/migrations/000_dev_teardown.sql`.
2. Apply `001_extensions.sql` through `009_audit.sql` in order, each via `apply_migration`.
3. Apply `sql/seeds/demo_seed.sql` via `execute_sql` (or however the user usually loads it).

Verify with `list_tables({ schemas: ['public'] })` that `organizations` no longer has `institution`.

- [ ] **Step 2: Prod DB — one-shot DDL + updated RPCs**

Using Supabase MCP for project `vera-prod`:

1. `apply_migration` with name `drop_org_institution` and SQL:

```sql
-- Drop stale RPC signature first so GRANT on the new 2-arg one is clean.
DROP FUNCTION IF EXISTS public.rpc_admin_create_org_and_membership(TEXT, TEXT, TEXT, TEXT);

-- Drop the column (IF EXISTS makes it idempotent in case this migration is re-run).
ALTER TABLE organizations DROP COLUMN IF EXISTS institution;
```

2. Re-apply the updated `sql/migrations/006_rpcs_admin.sql` and `sql/migrations/009_audit.sql` via `apply_migration` (name them `rpcs_admin_refresh` and `audit_refresh`). These are `CREATE OR REPLACE FUNCTION` so they are safe to re-apply.

3. Verify:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'organizations'
ORDER BY ordinal_position;
```

Expected: `id, code, name, contact_email, status, settings, setup_completed_at, created_at, updated_at`. No `institution`.

- [ ] **Step 3: Smoke-test both envs**

For each env, run via MCP `execute_sql`:

```sql
SELECT COUNT(*) FROM organizations;
```

Demo: `6` (after seed). Prod: whatever the current tenant count is (likely 0 or a handful of internal test rows).

Then:

```sql
SELECT name, code FROM organizations ORDER BY name LIMIT 10;
```

Verify on demo that the new names appear: `AAS CanSat Competition`, `Carnegie Mellon University — Computer Science`, etc.

- [ ] **Step 4: No commit**

This task is DB rollout only. No git changes from this task.

---

## Task 4: API wrappers — stop reading/writing `institution`

**Files:**

- Modify: `src/shared/api/admin/organizations.js`
- Modify: `src/shared/api/admin/auth.js`
- Modify: `src/shared/api/juryApi.js`

- [ ] **Step 1: Update `src/shared/api/admin/organizations.js` — `createOrganization`**

Replace the entire `createOrganization` function (lines 51-70) with:

```js
export async function createOrganization(payload) {
  const { data, error } = await supabase
    .from("organizations")
    .insert({
      name: payload.name,
      code: payload.code || payload.shortLabel || null,
      contact_email: payload.contact_email || null,
      status: payload.status || "active",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Update `src/shared/api/admin/organizations.js` — `updateOrganization`**

Replace lines 72-99 with:

```js
export async function updateOrganization(payload) {
  const id = payload.organizationId || payload.id;
  if (!id) throw new Error("updateOrganization: organizationId required");

  const updates = {};
  if (payload.name !== undefined) updates.name = payload.name;
  const resolvedCode = payload.code !== undefined ? payload.code : payload.shortLabel;
  if (resolvedCode !== undefined) updates.code = resolvedCode;
  if (payload.contact_email !== undefined) updates.contact_email = payload.contact_email;
  if (payload.status !== undefined) updates.status = payload.status;
  if (payload.reason !== undefined) updates.reason = payload.reason;

  const { data, error } = await supabase.rpc("rpc_admin_update_organization", {
    p_org_id: id,
    p_updates: updates,
  });
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: Update `src/shared/api/admin/auth.js`**

Three selects reference `institution` (lines ~16, 32, 56). Update each to drop the column:

- Line 16: `.select("*, organization:organizations(id, name, code, status, setup_completed_at)")`
- Line 32: `.select("id, status, created_at, organization:organizations(id, name)")`
- Line 56: `.select("id, name, code, setup_completed_at")`

Verify the mapping code below each select doesn't destructure `institution` from the result; if it does, drop that field from the mapping.

- [ ] **Step 4: Update `src/shared/api/juryApi.js:218`**

The nested `organizations(...)` select currently reads `organizations(code, name, institution, contact_email)`. Change to `organizations(code, name, contact_email)`. Verify no downstream code reads `period.organizations.institution`.

- [ ] **Step 5: Run unit tests**

```bash
npm test -- --run
```

Tests that exercise `createOrganization` or `updateOrganization` mocks may still pass payloads with `university`/`department` — that's fine, our simplified implementation ignores them. If a test explicitly asserts that `institution` reaches the insert, fix it in Task 6/9.

- [ ] **Step 6: Commit**

```bash
git add src/shared/api/
git commit -m "api: drop institution from org wrappers + selects

- createOrganization/updateOrganization no longer build a
  compound institution from university+department.
- Auth-related selects and the jury period RPC stop
  requesting the column.
"
```

---

## Task 5: Auth flow — strip `institution`/`department` from signup path

**Files:**

- Modify: `src/auth/AuthProvider.jsx`
- Modify: `src/auth/screens/RegisterScreen.jsx`
- Modify: `src/auth/screens/CompleteProfileScreen.jsx`

- [ ] **Step 1: `AuthProvider.jsx` — `completeProfile`**

Current (lines ~474-492):

```js
const completeProfile = useCallback(async ({ name, orgName, institution, department, joinOrgId }) => {
    ...
    const { data, error } = await supabase.rpc("rpc_admin_create_org_and_membership", {
      p_name: name,
      p_org_name: orgName,
      p_institution: institution || "",
      p_department: department || "",
    });
```

Change to:

```js
const completeProfile = useCallback(async ({ name, orgName, joinOrgId }) => {
    ...
    const { data, error } = await supabase.rpc("rpc_admin_create_org_and_membership", {
      p_name: name,
      p_org_name: orgName,
    });
```

Keep the rest of the function (including `joinOrgId` branch) unchanged.

- [ ] **Step 2: `AuthProvider.jsx` — membership mapping**

Lines 158, 205, 214, 505, 609, 615, 624, 637 reference `institution` in the returned membership shape. Each such reference (e.g. `institution: m.organization?.institution ?? null`) is **deleted** from the object literal. Do NOT replace with `null` or `name` — the field goes away entirely. Anywhere downstream that destructures `institution` from the membership must also drop it (will be caught by Task 7 sweep).

- [ ] **Step 3: `AuthProvider.jsx` — `signUp` metadata**

`signUp` at line 516 passes `metadata` into `supabase.auth.signUp`. If `metadata.institution` or `metadata.department` is set anywhere in callers, it gets forwarded to `raw_user_meta_data`. Since the trigger no longer reads those keys, callers should stop sending them. Update any default metadata object in this function to omit those keys.

- [ ] **Step 4: `src/auth/screens/RegisterScreen.jsx` — payload**

Lines 251 and 257-263 currently pass `institution: ""` / `department: ""`. Update:

- Line ~251 (Google profile-completion branch):

```js
await doCompleteProfile({ name: fullName.trim(), orgName: orgName.trim() });
```

- Lines ~257-263 (email/password register branch):

```js
const payload = {
  name: fullName.trim(),
  orgName: orgMode === "join" ? "" : orgName.trim(),
  joinOrgId: orgMode === "join" ? selectedOrgId : undefined,
};
await doRegister(email.trim(), password, payload);
```

- [ ] **Step 5: `RegisterScreen.jsx` — combobox grouping**

Since `listOrganizationsPublic` no longer returns `institution` (already dropped in Task 4 Step 3), the `group: o.institution || "Other"` line at ~166 produces `"Other"` for every entry. Replace `GroupedCombobox` with the plain `Combobox` component.

Find and replace lines 160-172 with:

```js
  useEffect(() => {
    let active = true;
    listOrganizationsPublic()
      .then((orgs) => {
        if (!active) return;
        setOrgOptions(
          orgs.map((o) => ({
            value: o.id,
            label: o.name,
          }))
        );
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
```

Change the import at line 12 from `GroupedCombobox` to `Combobox`:

```js
import Combobox from "@/shared/ui/Combobox";
```

Update the JSX at lines ~491-500 to use `<Combobox ...>` instead of `<GroupedCombobox ...>`; drop any `groups={...}` prop. Keep `value`, `onChange`, `options`, `placeholder`, `emptyMessage`, `disabled`, `ariaLabel`.

Verify `src/shared/ui/Combobox.jsx` exists and accepts the same props; if not, keep `GroupedCombobox` but pass all options under a single implicit group.

- [ ] **Step 6: `CompleteProfileScreen.jsx` — payload**

Grep for `institution` or `department` in the file. Any call to `completeProfile({...})` must drop those keys. Preserve `name`, `orgName`, and `joinOrgId`.

- [ ] **Step 7: Dev server smoke test**

Run:

```bash
npm run dev
```

Navigate to `http://localhost:5173/register`, fill in:

- Full Name: `Test Admin`
- Email: `test-$(date +%s)@example.com` (unique each run)
- Organization: `TED University — Electrical Engineering`
- Password: meet policy
- Confirm Password: same

Submit. Expected: success page appears; no console error referencing `p_institution`/`p_department`/`institution`.

Stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add src/auth/
git commit -m "auth: remove institution/department from signup and membership shapes

RegisterScreen + CompleteProfileScreen stop sending those
keys; AuthProvider.completeProfile passes only (name, orgName)
to the simplified RPC; membership objects no longer carry
an institution field. Listing combobox drops grouping.
"
```

---

## Task 6: Admin org management — one-column layout, single-name form

**Files:**

- Modify: `src/admin/hooks/useManageOrganizations.js`
- Modify: `src/admin/drawers/CreateOrganizationDrawer.jsx`
- Modify: `src/admin/pages/OrganizationsPage.jsx`
- Modify: `src/admin/settings/ManageOrganizationsPanel.jsx` (align with hook shape)
- Modify: `src/admin/__tests__/ManageOrganizationsPanel.test.jsx` (fixtures)

- [ ] **Step 1: `useManageOrganizations.js` — constants**

Rewrite `EMPTY_CREATE_FORM`, `EMPTY_EDIT_FORM`, `EMPTY_CREATE_ERRORS` to drop `university`/`department`/`institution`:

```js
const EMPTY_CREATE_FORM = {
  name: "",
  code: "",
  shortLabel: "",
  contact_email: "",
  status: "active",
};

const EMPTY_EDIT_FORM = {
  id: "",
  name: "",
  code: "",
  shortLabel: "",
  contact_email: "",
  status: "active",
  created_at: "",
  updated_at: "",
};

const EMPTY_CREATE_ERRORS = { name: "", shortLabel: "", contact_email: "" };
```

Keep any other keys that already exist (`code`, `shortLabel`, `contact_email`, `status`, etc.).

- [ ] **Step 2: `useManageOrganizations.js` — drop `splitInstitution`**

Delete lines 54-65 (the `splitInstitution` helper). It has no remaining callers after this task.

- [ ] **Step 3: `useManageOrganizations.js` — `openEdit`**

Replace the body that derives `university`/`department` from `institution` (lines ~246-255) with a simple shape:

```js
setEditForm({
  id: org.id,
  name: org.name || "",
  code: org.code || "",
  shortLabel: org.code || "",
  contact_email: org.contact_email || "",
  status: org.status || "active",
  created_at: org.created_at || "",
  updated_at: org.updated_at || "",
});
```

- [ ] **Step 4: `useManageOrganizations.js` — `handleCreateOrg`**

The current body at ~280-340 validates `university`/`department` and builds a compound `institution`. Replace with:

```js
const handleCreateOrg = useCallback(async () => {
  const name = String(createForm.name || "").trim();
  const shortLabel = String(createForm.shortLabel || "").trim().toUpperCase();

  const errors = {
    name: !name ? "Organization name is required." : "",
    shortLabel: !shortLabel ? "Short label is required." : "",
    contact_email: "",
  };
  setCreateFieldErrors(errors);
  if (errors.name || errors.shortLabel) return;

  setCreateSaving(true);
  setCreateError("");
  try {
    const created = await createOrganization({
      name,
      code: shortLabel.toLowerCase().replace(/\s+/g, "-"),
      shortLabel,
      contact_email: createForm.contact_email || null,
      status: createForm.status || "active",
    });
    // ... keep existing post-create refresh/toast/drawer-close logic ...
  } catch (err) {
    setCreateError(err?.message || "Could not create organization.");
  } finally {
    setCreateSaving(false);
  }
}, [createForm, ... /* keep existing deps minus any uni/dept */]);
```

Replace the post-create block (refresh, close, reset) with whatever the existing function did after a successful `createOrganization` — do not re-invent it; copy the existing code after the `createOrganization(...)` call and strip any references to `university`/`department`.

- [ ] **Step 5: `useManageOrganizations.js` — `handleSaveEditOrganization`**

Rewrite the payload builder (lines ~370-390) to drop the compound institution logic:

```js
const payload = {
  organizationId: editForm.id,
  name: String(editForm.name || "").trim(),
  code: String(editForm.code || editForm.shortLabel || "").trim(),
  shortLabel: String(editForm.shortLabel || "").trim(),
  contact_email: editForm.contact_email || null,
  status: editForm.status || "active",
};
```

Leave the `await updateOrganization(payload)` call and surrounding error/toast logic intact.

- [ ] **Step 6: `useManageOrganizations.js` — search filter**

Line 225 currently has `String(o.institution || "").toLowerCase().includes(q)`. Remove that condition from the `filteredOrgs` reducer; search against `name` and `code` only.

- [ ] **Step 7: `useManageOrganizations.js` — dirty-check branches**

Lines 182-196 compare `createForm.university !== orig.university || createForm.department !== orig.department ...`. Drop those lines from both the create-dirty and edit-dirty conditions; the comparison should only check `name`, `code`/`shortLabel`, `contact_email`, `status`.

- [ ] **Step 8: `CreateOrganizationDrawer.jsx` — remove university+department block**

Delete lines 32-36 and 43-52 (uni/dept in `EMPTY` and `onSave` payload). The resulting `EMPTY` is:

```js
const EMPTY = {
  name: "",
  shortLabel: "",
  contactEmail: "",
  initialAdminEmail: "",
  status: "active",
  notes: "",
};
```

`handleSave` body:

```js
await onSave?.({
  name: form.name.trim(),
  shortLabel: form.shortLabel.trim().toUpperCase(),
  contactEmail: form.contactEmail.trim() || null,
  initialAdminEmail: form.initialAdminEmail.trim() || null,
  status: form.status,
  notes: form.notes.trim() || null,
});
```

Delete the grid with the university/department inputs (lines 144-167 — the wrapping `<div style={{ display: "grid" ... }}>` and both `<div className="fs-field">` children).

- [ ] **Step 9: `OrganizationsPage.jsx` — delete `splitInstitution`**

Remove lines 118-129 (the local `splitInstitution` helper).

- [ ] **Step 10: `OrganizationsPage.jsx` — `getOrgInitials`/`getOrgHue` callers**

Lines 1608-1609 currently:

```js
const initials = getOrgInitials(org.institution);
const hue = getOrgHue(org.institution);
```

Change to:

```js
const initials = getOrgInitials(org.name);
const hue = getOrgHue(org.name);
```

The helpers themselves (lines 173-186) already handle any string input; no change needed to the helper bodies.

- [ ] **Step 11: `OrganizationsPage.jsx` — `getOrgMeta`**

Line 303 uses `splitInstitution` to derive `university`/`department`. Change the destructure to drop them:

```js
const status = org?.status || "active";
return { period, jurors, projects, status };
```

Remove `university` and `department` from the returned object entirely. Callers that used `meta.university` (view drawer) will be updated in Step 13.

- [ ] **Step 12: `OrganizationsPage.jsx` — sort key / `institution` branch**

Delete lines 391-392 (the `institution` branch in `sortedFilteredOrgs`). If any other code references `"institution"` as a sort key (e.g., a `SortIcon` or a `handleOrgSort` call), remove it too.

- [ ] **Step 13: `OrganizationsPage.jsx` — table header + row**

Line 1588-1589: collapse the two `<th>`s into one:

```jsx
<th className={`sortable${orgSortKey === "name" ? " sorted" : ""}`} onClick={() => handleOrgSort("name")}>Organization <SortIcon colKey="name" sortKey={orgSortKey} sortDir={orgSortDir} /></th>
```

Line 1617-1620: collapse the two `<td>`s into one:

```jsx
<td data-label="Organization" style={{ fontWeight: 600 }}>
  {org.name || "—"}
</td>
```

Update the `colSpan` on the empty-state row (line 1600): `colSpan={7}` → `colSpan={6}` (header had 7 columns, now 6).

- [ ] **Step 14: `OrganizationsPage.jsx` — view drawer**

Line 847-848 (view drawer title block):

```jsx
<div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{viewOrg?.name || "Organization Profile"}</div>
<div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{String(viewOrg?.code || "").toUpperCase() || "—"}</div>
```

Line 875-876 (view drawer detail list): remove the "Organization" row and the "Program" row; keep one "Name" row:

```jsx
<div style={{ display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid var(--border)" }}>
  <span className="text-sm text-muted">Name</span>
  <span style={{ fontSize: 12.5, fontWeight: 600 }}>{viewOrg?.name || "—"}</span>
</div>
```

- [ ] **Step 15: `OrganizationsPage.jsx` — edit drawer**

Lines 803-811 currently have "Organization" and "Program" fields bound to `editForm.university` and `editForm.name`. Replace with one "Name" field:

```jsx
<div className="fs-field">
  <label className="fs-field-label">Name</label>
  <input
    className="fs-input"
    type="text"
    value={editForm.name || ""}
    onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
    placeholder="e.g., TED University — Electrical-Electronics Engineering"
  />
</div>
```

Leave the Code, Status, Contact Email fields below unchanged.

- [ ] **Step 16: `OrganizationsPage.jsx` — allPending mapping**

Line 350-361: the `orgSubtitle: o.institution || ""` line should become `orgSubtitle: ""` or the key should be dropped. Grep within the file for consumers of `orgSubtitle`; if none, delete the key. If used (likely in a modal header), change to fall back to `o.code`:

```js
orgSubtitle: o.code || "",
```

- [ ] **Step 17: `ManageOrganizationsPanel.jsx` — align with hook shape**

Grep the file for `university`, `department`, `institution`, and rewire each reference to use `name` (or drop entirely). Do not introduce new fields. If the panel has an inline form mirroring the hook's `EMPTY_CREATE_FORM`, align the fields to match Step 1 exactly.

- [ ] **Step 18: `ManageOrganizationsPanel.test.jsx` — fixtures**

Current (lines ~17-23, 45, 52):

```js
{
  university: "TED University",
  department: "Electrical Engineering",
  ...
}
createForm: { code: "", shortLabel: "", university: "", department: "" },
editForm: { id: "", code: "", shortLabel: "", university: "", department: "", status: "active", created_at: "", updated_at: "" },
```

Rewrite fixtures to match the new shape:

```js
{
  name: "TED University — Electrical Engineering",
  ...
}
createForm: { name: "", code: "", shortLabel: "", contact_email: "", status: "active" },
editForm: { id: "", name: "", code: "", shortLabel: "", contact_email: "", status: "active", created_at: "", updated_at: "" },
```

Then update any test assertion that reads `university`/`department` from the DOM.

- [ ] **Step 19: Run tests for this area**

```bash
npm test -- --run src/admin/__tests__/ManageOrganizationsPanel.test.jsx
```

Expected: pass. Fix any residual failures in fixtures.

- [ ] **Step 20: Commit**

```bash
git add src/admin/
git commit -m "admin: collapse OrganizationsPage into single-name column

- Remove university/department/institution from
  useManageOrganizations form state, validation, search,
  dirty-check, and save payloads.
- CreateOrganizationDrawer loses the uni/dept grid.
- OrganizationsPage table shows a single 'Organization'
  column; edit/view drawers show a single 'Name' field.
  Avatar initials derive from name.
- Test fixtures aligned with the new shape.
"
```

---

## Task 7: Read-only display consumers

**Files:** any file under `src/` that still references `.institution`. Expect many small touches.

- [ ] **Step 1: Produce a list of remaining references**

```bash
grep -rn "\.institution" src/ | grep -v "\.test\." | grep -v "node_modules"
```

Save the output. Each line is a callsite that either:

- renders the field as display text → drop or substitute with `name`,
- destructures from a payload that no longer contains it → drop the key,
- uses it in an export/CSV header → drop the column.

- [ ] **Step 2: Fix each remaining reference**

Walk the list file by file. For each hit, apply the right fix:

- **Display text fallback** (e.g. `{org.institution || org.name}`) → replace with `{org.name}`.
- **Destructure** (e.g. `const { name, institution, code } = org;`) → remove `institution`.
- **Tooltip / subtitle** (e.g. `<div className="muted">{org.institution}</div>`) → delete the line.
- **Sidebar / sidebar switcher labels** (e.g. `TenantSwitcher`, `TenantSearchDropdown`) — show only `name`.

Do not add comments like `// removed institution` — just delete the code.

- [ ] **Step 3: `src/shared/api/admin/notifications.js` — evaluate `department` param**

Grep the file at line ~84 for `department`. Determine whether it refers to `organizations.department` (which never existed — the field is `institution`) or an unrelated parameter (e.g. a notification recipient department). If unrelated, leave it alone. If it is threaded through from the signup flow, drop it consistent with Task 5.

- [ ] **Step 4: `src/test/qa-catalog.json` — sweep**

```bash
grep -n "institution" src/test/qa-catalog.json
```

For each entry whose `description`, `title`, or `body` mentions institution-specific behavior (e.g., "shows institution header"), either update the text to mention `name` or delete the entry if the test covered behavior that no longer exists.

- [ ] **Step 5: Verify zero residual references in product code**

```bash
grep -rn "institution" src/ | grep -v "\.test\." | grep -v node_modules | grep -v qa-catalog.json
```

Expected: zero hits (or only references in strings like `"educational institution"` in marketing copy on `LandingPage.jsx`, which are fine — we only care about schema references).

- [ ] **Step 6: Run the full test suite**

```bash
npm test -- --run
```

Fix any failures by following the same rules above.

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "ui: scrub remaining institution references from consumers

Pages, drawers, modals, and exports that previously read
organization.institution now rely on organization.name. No
behavior change beyond removing the secondary display field.
"
```

---

## Task 8: Landing + exports

**Files:**

- Modify: `src/landing/LandingPage.jsx`
- Modify: `src/admin/analytics/analyticsExport.js`
- Modify: `src/admin/hooks/useCriteriaExport.js`
- Modify: `src/admin/hooks/useOutcomesExport.js`
- Modify: `src/admin/hooks/useGridExport.js`
- Modify: `src/admin/utils/downloadTable.js`
- Modify: `src/admin/components/ExportPanel.jsx`
- Modify: `src/admin/utils/csvParser.js`

- [ ] **Step 1: `LandingPage.jsx` — stats section**

`rpc_landing_stats` no longer returns `institutions`. Grep the file for `institutions` (landing stat key, distinct from "institution" substrings in prose). Delete any card/number that renders that value. If the landing stats grid had a hard-coded slot for it, rebalance the grid (e.g., 5 cards → 4 cards). Do NOT alter marketing prose like "universities, competitions, and institutions".

- [ ] **Step 2: Export column schemas**

For each export helper (analyticsExport, useCriteriaExport, useOutcomesExport, useGridExport, downloadTable, ExportPanel, csvParser):

Grep each file for `institution`. For each CSV/PDF column definition that emits institution, delete the column (both the header and the row getter). For any import path (csvParser) that expects an institution column, drop it from the expected shape.

- [ ] **Step 3: Verify builds and tests**

```bash
npm run build
npm test -- --run
```

Both must succeed. PDF export will render one fewer column; CSV exports one fewer column — acceptable.

- [ ] **Step 4: Commit**

```bash
git add src/landing/ src/admin/analytics/ src/admin/hooks/ src/admin/utils/ src/admin/components/ExportPanel.jsx
git commit -m "landing/export: drop institution column/card

Landing stats no longer include institutions; CSV/PDF exports
lose the institution column across analytics, criteria,
outcomes, grid, and download utilities.
"
```

---

## Task 9: Test sweep + QA catalog

**Files:**

- Modify: `src/jury/__tests__/IdentityStep.test.jsx`
- Modify: `src/test/qa-catalog.json` (already touched in Task 7, re-verify)
- Modify: any other `__tests__/*.{jsx,js,ts,tsx}` with institution fixtures

- [ ] **Step 1: Grep tests**

```bash
grep -rn "institution" src/ --include="*.test.*"
grep -rn "institution" src/test/
```

- [ ] **Step 2: Update each test fixture**

Fix fixtures to match the new organization shape. Do not introduce synthetic `institution` keys; the schema no longer has them.

- [ ] **Step 3: Run full test suite**

```bash
npm test -- --run
```

Expected: 100% pass.

- [ ] **Step 4: Run E2E smoke (if feasible)**

```bash
npm run e2e
```

If Playwright hits a "Register" test that asserts specific field layouts, update the spec to match the single-input version. If it fails for unrelated reasons (timeouts, flakiness), skip and note in the final verification.

- [ ] **Step 5: Commit**

```bash
git add src/
git commit -m "tests: drop institution from fixtures + qa-catalog

All unit-test fixtures now use the single-name organization
shape. Any qa-catalog entries that described institution-row
behavior are removed or rewritten.
"
```

---

## Task 10: Final verification + push

**Files:** none (verification only)

- [ ] **Step 1: Run build**

```bash
npm run build
```

Expected: success, no TS/ESM errors. If errors remain about `institution` or undefined properties, trace to the file and fix before proceeding.

- [ ] **Step 2: Run full test suite**

```bash
npm test -- --run
```

Expected: 100% pass.

- [ ] **Step 3: Run repo health checks**

```bash
npm run check:no-native-select
npm run check:no-nested-panels
```

Both must pass.

- [ ] **Step 4: Final grep for leftover `institution`**

```bash
grep -rn "institution" src/ sql/migrations/*.sql scripts/generate_demo_seed.js 2>/dev/null | grep -v archive/ | grep -v "\.test\."
```

Expected: zero business-relevant hits. Marketing copy in `LandingPage.jsx` may contain the word "institution" as a noun — that is fine.

- [ ] **Step 5: Dev server manual smoke**

```bash
npm run dev
```

Verify:

1. **Landing** — loads, stats grid renders without "institutions" card.
2. **Register** (`/register`) — form takes a single Organization Name, submits successfully, success state shown.
3. **Login** → `/admin/organizations` — table shows one "Organization" column; rows render the new compound names from the demo seed; sort works; avatar initials derived from `name`.
4. **Edit drawer** — "Name" field shown, save works.
5. **Create drawer** — no university/department inputs; save works.
6. **Jury flow** (`/eval`) — entry-token → identity → evaluate; no console errors about missing `institution`.
7. **Demo workspace** (`/demo`) — admin loads, jurors/projects/periods pages open without error.

If any smoke fails, fix + amend the relevant task's commit (or add a follow-up commit in the same branch).

Stop the dev server.

- [ ] **Step 6: Push to main**

The user has explicitly authorized commit+push for this end-of-task step. Run:

```bash
git push origin main
```

Confirm the push succeeded and paste the final `git log --oneline -15` in the completion report so the user can see every commit.

- [ ] **Step 7: Close the loop**

Report to the user:

- Commits pushed (count + short list).
- Supabase MCP rollout performed on both envs.
- Seed regenerated.
- Test & build status.
- Any smoke-test caveats.

---

## Self-Review Notes

- **Spec coverage:** All eight spec sections (schema, RPC, seed, API, frontend, error mapping, tests, docs) map to one or more tasks above. The live-DB rollout is Task 3; the snapshot edits are Tasks 1-2.
- **Placeholders:** None — every code snippet is concrete; every verification step has a command with expected output.
- **Type consistency:** `name` is the only identifier across tasks; `code`/`shortLabel` consistent; `institution`/`university`/`department` fully removed.
- **Risk note:** Task 7 (read-only consumers) relies on grep + manual per-file fix. If the list is longer than expected, split into sub-commits per area (auth screens, admin pages, switchers, modals) rather than one giant commit.
