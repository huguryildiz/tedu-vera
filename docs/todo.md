# TODO

## E2E Tests — Phase C Migration

E2E tests are failing because they still use the pre-Phase C login and jury flow.
CI e2e job is currently enabled (`if: true` in `.github/workflows/ci.yml`).

### What needs to happen

1. **Admin login flow**: E2E specs use the old `window.prompt` password entry.
   Update to use the Supabase Auth email/password login form (`LoginForm.jsx`).
   Affected: `admin-login.spec.ts`, `admin-export.spec.ts`, `admin-import.spec.ts`,
   `admin-results.spec.ts`.

2. **Jury entry flow**: Jury tests navigate directly to the identity step, but
   Phase C requires going through `jury_gate` (entry token verification) first.
   Affected: `jury-flow.spec.ts` — identity form tests and PIN flow tests.

3. **RPC rename**: DB function `rpc_get_active_semester` was renamed to
   `rpc_get_current_semester`. Either update the E2E Supabase instance with
   Phase C migrations, or add an alias function in SQL.
   Affected: `jury-flow.spec.ts` (PIN flow), `jury-lock.spec.ts`.

4. **CI Supabase instance**: Apply `sql/migrations/001-013` to the E2E Supabase
   project so tenant tables, v2 RPCs, and renamed functions exist.

5. **CI secrets**: Add `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` for Supabase
   Auth login (replaces the old single admin password).

6. **Tenant isolation E2E** (`tenant-isolation.spec.ts`): Most tests are
   currently skipped (need real Supabase Auth users). Wire up once admin login
   E2E is working.

### Quick fix (temporary)

Set `if: false` on the e2e job in `.github/workflows/ci.yml` to unblock CI
while these are addressed.

## Security Policy Drawer — Future Additions

Open ideas surfaced during the 2026-04-10 Security Policy simplification pass.
Not urgent; add when governance or operational needs demand it.

### 1. Tenant registration on/off (highest-value, lowest-effort)

Add an `allowTenantRegistration` flag to `security_policy.policy` so a super
admin can close new tenant applications without touching code.

- **Why:** VERA is moving beyond TEDU; there will be periods where we want to
  pause intake (freeze windows, onboarding capacity limits, etc).
- **Enforcement:**
  - New anon-callable RPC `rpc_public_registration_flag()` alongside
    [rpc_public_auth_flags()](sql/migrations/027_public_auth_flags_rpc.sql) —
    same pattern, same grant list.
  - `RegisterScreen.jsx` fetches on mount and shows an "applications are
    closed" state when off.
  - `submitApplication` in [auth.js](src/shared/api/admin/auth.js) re-checks
    server-side so a stale client cannot bypass the gate.
- **Drawer placement:** either under Authentication Methods, or a new "Access"
  section between Authentication and QR Access.

### 2. Admin idle timeout

Auto sign-out an admin after N minutes of inactivity (distinct from
remember-me, which governs long-lived session persistence).

- **Why:** Premium SaaS baseline (Linear, Notion). Mitigates unattended
  laptops without punishing long-lived sessions.
- **Values:** 15m / 30m / 1h / 4h / Never.
- **Enforcement:**
  - Client-side idle timer in `AuthProvider.jsx` — listens for
    mousemove/keydown/click, on timeout calls `supabase.auth.signOut()`.
  - Multi-tab coordination via `BroadcastChannel` or `localStorage` event.
  - Server-side backstop: `touchAdminSession` rejects stale sessions beyond
    the configured idle window.
- **Cost:** moderate — event plumbing, multi-tab edge cases, test coverage.

### 3. Session max lifetime

Hard ceiling on how long a single session can live even with Remember Me on.

- **Why:** Remember Me today = effectively unlimited for 30 days. A max
  lifetime ("force re-auth after N days") is a standard compliance control.
- **Enforcement:** check `session.issued_at + sessionMaxDays < now` in the
  session refresh path; if true, block refresh and force re-login.
- **Cost:** small, but marginal value drops if (2) ships first.

### Deliberately excluded

These were considered and rejected during the simplification:

- **MFA toggle** — meaningless without a Supabase MFA enrollment flow; would
  become a dead setting.
- **IP allowlist** — enterprise overkill; academic admins connect from many
  IPs.
- **Password complexity** — Supabase Auth already enforces the global 10-char
  minimum; we deliberately removed our duplicate policy.
- **Admin password lockout** — Supabase has its own brute-force protection.
- **Audit log retention** — premature until the table actually causes DB
  size pressure.

## Schema & Naming

Items below that touch the DB should land in one consolidated migration,
not drip over several PRs.

### Consolidated DB migration

Single migration covering all renames and new columns, plus RPC and
field-mapping updates.

- Add `advisor` text nullable to `projects`.
- Add `description` text nullable to `projects`.
- Add `description`, `start_date`, `end_date` to `semesters` (→ `periods`).
- Add `email` text nullable to `jurors`.
- Rename `juror_inst` → `affiliation` in `jurors`.
- Add `coverage_override` (values: `indirect` | null) to `outcomes`.
- Rename `students` → `members` in `projects`.
- Rename `semesters` → `periods` (all FK updates).
- Rename `tenants` → `organizations`, `tenant_id` → `organization_id`.
- Update every RPC signature that references renamed columns/tables.
- Update [fieldMapping.js](src/shared/api/fieldMapping.js) for the new
  names.
- Update CLAUDE.md tables/columns sections.
- Defer the `entry_tokens` `token_hash` SHA-256 migration to a later batch
  — it is not on the critical path.

### Semester → Evaluation Period rename

UI and code follow the DB rename above. Long form is "Evaluation Period";
the compact form is "Period". Table label in DB changes to `periods`.

- Rename hooks: `useSemesters` → `usePeriods`, etc.
- Rename components/files referencing "semester".
- Update all UI labels, toast messages, button text.
- Update CLAUDE.md cross-references.

### Tenant → Organization rename

DB terminology for consistency with the user-facing UI (which already
says "Organization").

- Rename `tenants` table → `organizations`.
- Rename `tenant_id` foreign keys → `organization_id` everywhere.
- Rename RPCs (`rpc_admin_tenant_*` → `rpc_admin_org_*`).
- Update the JS API layer (`src/shared/api/admin/tenants.js` →
  `organizations.js` if not already done, imports, etc.).

### Generic naming in UI labels

Broader audience (hackathons, exhibitions) means academic-specific labels
must go.

- "Project Title" → "Title" (UI only, DB column stays).
- "Supervisor" → "Advisor" (DB column renamed via migration above).
- "Students" → "Team Members" (DB column renamed via migration above).
- Update all component labels, placeholders, toast text.
- Update CLAUDE.md.

### New optional fields on forms

- Project form: `advisor` (placeholder: "e.g. Dr. Ali Yılmaz, Prof. Aylin
  Kaya"), `description`.
- Period form: `description`, `start_date`, `end_date`.
- Juror form: `email` (optional).
- Update CRUD RPCs to accept and return the new columns.

### Advisor multi-value convention

`advisor` stays TEXT. Multiple advisors are stored as a comma-separated
string; UI splits on display.

- Always split by comma and trim whitespace on read.
- Detect `1` vs `2+` to switch between "Advisor: ..." and
  "Advisors: ..." in labels.
- JSONB array migration is deferred — revisit only if the comma-string
  approach causes real pain.

## Analytics & Outcomes

### Framework per period

Accreditation framework (MÜDEK, ABET, EUR-ACE, custom) is chosen per
evaluation period, not globally. Analytics and outcome mappings derive
from the period's framework.

- Add `framework` field to period create/edit forms.
- Store `framework` on the `periods` row.
- Outcome mappings and Programme Outcome Analytics must read the period's
  framework.
- The Analytics header framework pill becomes read-only, reflecting the
  period setting.

### Indirect outcome mapping

Coverage level (Direct / Indirect / Not Mapped) is per-outcome, not
per-criterion-mapping.

- Outcomes that have at least one criterion mapped are always **Direct**
  (override ignored).
- Outcomes with no criteria can toggle between **Indirect** and **Not
  Mapped** via the `coverage_override` column.
- Make the coverage badge in the outcomes table clickable to cycle
  states.
- Update outcome analytics to respect the classification.

### Dynamic insight banners

Programme Outcome Analytics insight banners ("6 of 8 outcomes met") are
currently static in the prototype. The React implementation must compute
them live.

- Count met / borderline / not-met outcomes from real data.
- Detect regression warnings.
- Recompute whenever analytics data changes.
- Use the period's selected framework for outcome definitions.

### Chart redesign — theme integration

Analytics charts use hardcoded styles and old CSS. Redesign to match the
shadcn Nova/Blue preset while preserving criterion colors.

- Wrap chart components in shadcn `Card` instead of the old manage-card
  CSS.
- Update section headings to shadcn component style (drop the old
  bold/uppercase).
- Replace hardcoded colors with theme CSS variables, but keep the fixed
  criterion palette: Technical `#F59E0B`, Written `#22C55E`, Oral
  `#3B82F6`, Teamwork `#EF4444`.
- Update box plot, radar chart backgrounds/grids to use theme variables.
- Adjust spacing/padding to match preset rhythm.
- Evaluate migrating from custom SVG to a shadcn `chart.jsx` Recharts
  wrapper (preserve all data logic and types).

### Top Projects card with auto-highlight

Overview page needs a Top Projects card showing top 3-5 projects with an
auto-generated highlight phrase derived from rule-based criteria
performance.

- Add pure helper `getProjectHighlight()` to
  [scoreHelpers.js](src/admin/scoreHelpers.js).
- Implement rules: normalize criteria to percentages, detect consistency,
  single strong criterion, paired strong criteria, overall performance.
- Add a Top Projects card in
  [OverviewTab.jsx](src/admin/OverviewTab.jsx), between Criteria Progress
  and Juror Activity.
- No DB changes — uses existing score data.

## Admin UX

### Platform governance overhaul

Settings page is >2000 lines. Goal is to break it apart, drop dead
drawers, and move org management to its own page.

- Remove the Feature Flags drawer — there is no real flag system behind
  it.
- Create an `/admin/organizations` page with org management table +
  pending approvals.
- Simplify the Settings page to Profile + Security only (same sections
  for both roles).
- Wire the Global Settings drawer to a `platform_settings` DB table
  (single-row JSONB).
- Wire the Maintenance drawer to app-wide enforcement — check in
  `RootLayout` and show a maintenance screen except for super admins.
- Wire the Export & Backup drawer per-org (Scores CSV, Jurors/Projects
  JSON, Period config).
- Wire the System Health drawer to a single RPC covering DB ping, edge
  function status, storage usage, active sessions.
- Remove super-admin danger-zone actions (delete/reset demo).
- Remove org-admin danger-zone actions (Leave Org, Deactivate).

### Score-based field locking

Once scores exist for a period, structural fields must lock to protect
data integrity.

- Lock criteria weights and max scores.
- Lock rubric band add / remove / reorder.
- Lock outcome mapping changes.
- **Keep** labels and descriptions editable.
- Add "Locked — scores exist" visual hints and a banner on the Criteria
  page.
- Gate fields via the `eval_locked` flag or a scores-exist check.

### Admin Impact page data validation

Admin Impact step works technically but the numbers have not been
eyeballed against expected values yet.

- Verify Live Rankings sort order and scores.
- Validate Before/After toggle impact.
- Check rank-change, completion %, and mean-score tag calculations.
- Confirm Live Activity juror names and timestamps.
- Verify KPI strip counts (Project Groups, Completion, Mean Score,
  Active Jurors).

### Password strength indicator

Reusable component for all password fields.

- Create `PasswordStrengthInput` component.
- Strength bar: Weak → Fair → Good → Strong.
- Checklist: min 8 chars, lowercase, uppercase, number, special char.
- Match check for confirm field.
- Show/hide eye toggle.
- Integrate into `ResetPasswordCreateForm`, `RegisterForm`, and the
  Change Password drawer.
- Keep the requirements aligned with Supabase Auth's global minimum.

## Notifications

### Email notification system — live verification

`notify-application` is deployed and wired for all three events
(submitted / approved / rejected) on both prod and demo, but live email
delivery has not been verified end-to-end.

- Set Supabase Edge Function env vars on both projects: `RESEND_API_KEY`,
  `NOTIFICATION_FROM`, `NOTIFICATION_APP_URL`, `NOTIFICATION_REVIEW_URL`,
  `NOTIFICATION_LOGO_URL`.
- Configure the Resend domain (inbound, reply-to).
- Live-test delivery for submitted, approved, and rejected events.
- Verify the `org_admin` role name matches the DB schema after the
  tenant → organization rename.
- Realign [notify-application](supabase/functions/notify-application/index.ts)
  between prod and demo — the demo project is still running an older
  handler with a different payload shape.

### v2.0 — Send PIN via email

Near-term v2.0 feature. When an admin sets a juror email, surface "Send
PIN via Email" after PIN creation or reset.

- Reuse the `notify-application` pattern (or a new dedicated Edge
  Function).
- Add the button in juror PIN management, visible only when `email` is
  set.
- Ship single-juror first; bulk "Send PINs to All" comes later.
- Design a reusable "Compose & Send" modal pattern for admin email
  flows.
