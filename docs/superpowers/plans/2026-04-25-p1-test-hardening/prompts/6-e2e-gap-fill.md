# P1 Item 6 — E2E gap fill (6 new specs)

## Goal

Close the largest absolute coverage gap: critical admin + jury flows that have **zero E2E** today.

## The six flows

| # | Spec file | Flow | Acceptance |
|---|---|---|---|
| 1 | `e2e/admin/invite-accept.spec.ts` | Super-admin invites a tenant-admin → invite email link → accept page → password set → land on `/admin` for the new org | Token-bound invite consumed once, second click → already-accepted state |
| 2 | `e2e/auth/password-reset.spec.ts` | `/forgot-password` → enter email → reset link → `/reset-password?token=…` → submit new pw → can log in | Old pw rejected; reset token single-use |
| 3 | `e2e/admin/setup-wizard-submit.spec.ts` | Setup wizard happy path through all 5 steps → final submit → `setup_completed_at` set in DB → org appears as fully-configured | Existing setup-wizard.spec is just smoke; this is end-to-end |
| 4 | `e2e/admin/score-edit-request.spec.ts` | Juror requests score edit → admin sees pending request → approves → juror sees re-opened sheet | Reject path also covered |
| 5 | `e2e/admin/unlock-request.spec.ts` | Locked period → admin clicks "request unlock" → `period_unlock_requests` row inserted → super-admin approves → period.is_locked=false | Reject path also covered |
| 6 | `e2e/jury/final-submit-and-lock.spec.ts` | Juror completes all sheets → final submit → `juror_period_auth.final_submitted_at` set → re-entering shows "submitted" + edit-disabled state | Edit-grace window is separately tested in score-edit-request.spec |

## Patterns to reuse

- `setupScoringFixture` for any spec that needs a period+criteria+projects+juror
- `adminClient` from `e2e/helpers/supabaseAdmin.ts` for direct DB inserts/queries (faster than UI fixture creation)
- `LoginPom` from `e2e/poms/LoginPom.ts` for admin login
- `e2e/fixtures/seed-ids.ts` for shared UUIDs

## Demo-DB seed dependencies

If a spec needs new seed rows (e.g., a tenant with one open invite), add them in the `E2E TEST FIXTURES` block in `scripts/generate_demo_seed.js` and trigger `gh workflow run demo-db-reset.yml`.

## Out of scope

- Cross-tenant security probes for these flows (those live in `rbac-boundary.spec.ts`)
- Performance / concurrency (P1 item 11)

## Approach

These are 6 independent specs — dispatch each to a Sonnet subagent in parallel where the demo seed is already adequate, sequentially where new seed rows are needed.
