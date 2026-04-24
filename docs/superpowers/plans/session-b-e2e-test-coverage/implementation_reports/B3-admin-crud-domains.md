# B3 — Admin CRUD domain rewrites (CLOSED)

**Sprint:** B3 (Session B)
**Date closed:** 2026-04-24
**Status:** Green — all exit criteria met

---

## Exit criteria

| # | Criterion | Result |
|---|---|---|
| 1 | Rewrite the five admin CRUD domains (Organizations, Jurors, Entry Tokens, Periods, Projects) as testid-only spec/POM pairs | ✅ |
| 2 | `npm run e2e` green | ✅ 20/20 passing, 1.1 min |
| 3 | `--repeat-each=3 --workers=1` flake check green | ✅ 60/60 passing, 3.3 min |
| 4 | Unit regression check | ⚠ 469/470 passing — 1 pre-existing test rot unrelated to B3 (see §Residual issues) |

Pass-rate delta from B2: 3/3 → 20/20 (+17 tests across 5 domains). No regression in B2's admin-login trio.

---

## Domains delivered

### 1. Organizations (super-admin flow)
- POM: [e2e/poms/OrgsPom.ts](e2e/poms/OrgsPom.ts) (scaffolded earlier in sprint)
- Spec: [e2e/admin/organizations-crud.spec.ts](e2e/admin/organizations-crud.spec.ts) — 4 tests: create / edit / delete (confirm-code) / create validation

### 2. Jurors
- POM: [e2e/poms/JurorsPom.ts](e2e/poms/JurorsPom.ts) — includes `jurorIdForRow(name)` helper that derives juror id from the row's kebab testid
- Spec: [e2e/admin/jurors-crud.spec.ts](e2e/admin/jurors-crud.spec.ts) — 4 tests: create / edit / delete / create validation
- E2E isolation: dedicated "E2E Jurors Org" (`a1b2c3d4-…-ef1234567889`) with one unlocked period

### 3. Entry Tokens
- POM: [e2e/poms/EntryTokensPom.ts](e2e/poms/EntryTokensPom.ts) — handles the LockWarnModal first-generate step via `Promise.race`
- Spec: [e2e/admin/entry-tokens.spec.ts](e2e/admin/entry-tokens.spec.ts) — 3 tests: generate / revoke / revoke-cancel
- E2E isolation: "E2E Tokens Org" (`a1b2c3d4-…-ef1234567890`) with a **pre-locked** period so generate goes straight to token creation without needing criteria/projects/outcomes
- **Blocker fixed:** `rpc_admin_revoke_entry_token` used `MIN(id)` on a UUID column — Postgres has no `min(uuid)` aggregate. See §Bugs surfaced.

### 4. Periods
- POM: [e2e/poms/PeriodsPom.ts](e2e/poms/PeriodsPom.ts)
- Spec: [e2e/admin/periods.spec.ts](e2e/admin/periods.spec.ts) — 3 tests: create draft / rename / delete (typed-confirm)
- E2E isolation: "E2E Periods Org" (`b2c3d4e5-…-f12345678901`)
- Scope: draft-period CRUD only. Publish/lifecycle (publish, revert, close, unlock) intentionally deferred — each requires criteria + projects + outcomes seeded first.

### 5. Projects
- POM: [e2e/poms/ProjectsPom.ts](e2e/poms/ProjectsPom.ts)
- Spec: [e2e/admin/projects.spec.ts](e2e/admin/projects.spec.ts) — 3 tests: create / rename / delete (typed-confirm)
- E2E isolation: "E2E Projects Org" (`c3d4e5f6-…-123456789012`) with one unlocked period "E2E Projects Period"
- Scope: manual-create CRUD only. CSV import intentionally deferred — adds file-upload + parse-preview complexity that belongs in a dedicated sprint.

---

## Testid additions

All forward-compatible (attribute-only edits, no markup restructure). Naming follows `{scope}-{component}-{element}` lowercase-hyphen convention:

| Domain | Testids added | Files touched |
|---|---|---|
| Periods | `periods-add-btn`, `period-drawer-{name,description,save,cancel}`, `period-row` (+ `data-period-id`, `data-period-name`), `period-row-kebab`, `period-menu-{edit,delete}`, `period-delete-{confirm-input,confirm,cancel}` | `PeriodsPage.jsx`, `AddEditPeriodDrawer.jsx`, `components/PeriodsTable.jsx`, `DeletePeriodModal.jsx` |
| Projects | `projects-add-btn`, `project-drawer-{title,member-<i>,save,cancel}`, `project-edit-drawer-{title,save,cancel}`, `project-row` (+ `data-project-id`, `data-project-title`), `project-row-kebab`, `project-menu-{edit,delete}`, `project-delete-{confirm-input,confirm,cancel}` | `ProjectsPage.jsx`, `AddProjectDrawer.jsx`, `EditProjectDrawer.jsx`, `components/ProjectsTable.jsx`, `DeleteProjectModal.jsx` |
| Entry Tokens | `entry-tokens-{generate,revoke,copy,download}-btn`, `lock-warn-modal-{confirm,cancel}`, `revoke-modal-{confirm,keep}` | `components/TokenGeneratorCard.jsx`, `components/LockWarnModal.jsx`, `JuryRevokeConfirmDialog.jsx` |

(Jurors + Organizations testid inventories were completed earlier in the sprint; see git history.)

---

## Bugs surfaced and fixed

### `rpc_admin_revoke_entry_token` — `min(uuid)` failure

**Symptom:** Entry-tokens revoke E2E test failed with "Could not revoke token." banner on the page. Client showed error; API-service logs showed no 4xx.

**Diagnosis path (per [e2e-testing-primer.md](docs/architecture/e2e-testing-primer.md) §3 "What the logs show and how to read them"):**
1. `get_logs service=api` — no errors
2. `get_logs service=postgres` — found `ERROR: function min(uuid) does not exist`

**Root cause:** [009_audit.sql:1318](sql/migrations/009_audit.sql#L1318) used `SELECT COUNT(*), MIN(id) INTO v_revoked_count, v_first_revoked_id FROM revoked;` where `id` is a UUID. Postgres does not implement a `min(uuid)` aggregate.

**Fix:** Replaced `MIN(id)` with `(array_agg(id))[1]`. Applied to both vera-prod and vera-demo via `mcp__claude_ai_Supabase__execute_sql` in the same step (per CLAUDE.md rule). Migration file edited in place (no patch file).

**Primer update:** The diagnostic signal "client error banner + empty api logs → check postgres logs" was captured as a new memory entry (`feedback_check_postgres_logs_first.md`) for future sprints.

---

## Flake-check results

Final suite: 20 tests / 5 domains + admin-login
`--repeat-each=3 --workers=1` → 60/60 green (3.3 min total).

One initial flake was caught and fixed:

**Flake:** `periods-crud › delete` failed on repeat 1 — `expectRowGone` timed out at 5s because the periods list refresh is asynchronous after the RPC returns and the modal closes.

**Fix:** Bumped `expectRowGone` / `expectProjectGone` default timeout to 10s in both POMs. Zero flakes in subsequent `--repeat-each=3` run.

---

## E2E isolation strategy

B3 established the pattern of **one E2E org per domain**, keeping state isolated across specs:

| Domain | Org ID | Notes |
|---|---|---|
| Jurors | `a1b2c3d4-…-ef1234567889` | Unlocked period, jurors seeded |
| Entry Tokens | `a1b2c3d4-…-ef1234567890` | Pre-locked period (bypasses publish blockers) |
| Periods | `b2c3d4e5-…-f12345678901` | Clean slate — each test creates/deletes its own periods |
| Projects | `c3d4e5f6-…-123456789012` | One unlocked period "E2E Projects Period" seeded |

Every spec sets `admin.active_organization_id` via `page.addInitScript()` before login. Combined with `admin.remember_me=true` (B2 bug fix) this keeps the auth session + active-org selection stable across navigation.

---

## Residual issues

### Pre-existing unit test failure (NOT B3-caused)

`src/shared/api/__tests__/admin/organizations.test.js > createOrganization resolves with the DB-returned row` — mock set up for `supabase.from().insert().select().single()` but the impl was migrated to `supabase.rpc("rpc_admin_super_create_organization", …)`. Test is stale vs. implementation. 469/470 other unit tests pass.

This should be cleaned up in a small follow-up (update the mock to the RPC-based shape). Not scoped under B3 because the organizations API changes pre-date this sprint by several commits and the E2E organizations spec exercises the real path end-to-end.

### Scope deferrals

- Periods lifecycle (publish/revert/close/unlock flow)
- Projects CSV import
- Tenant-admin role coverage (B3 covers super-admin only)

These are tracked for a future B4 sprint.

---

## Primer updates needed?

Yes — one addition, already captured in user memory:

- New diagnostic rule: "When client shows generic error banner and api-service logs are clean, check postgres-service logs via MCP — SQL-level errors (e.g. `min(uuid) does not exist`) don't surface via the api log." Memory entry: `feedback_check_postgres_logs_first.md`. Should be folded into [e2e-testing-primer.md](docs/architecture/e2e-testing-primer.md) §3 in a docs PR.
