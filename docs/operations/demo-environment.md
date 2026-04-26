# Demo Environment

The demo environment is the public face of VERA — what prospective tenants
see when they click "Try the demo" on the landing page. This document
covers what the demo contains, how it gets there, and how to update it.

For *recovery* when the demo breaks, see
[runbooks/demo-seed-broken.md](runbooks/demo-seed-broken.md).

---

## What the demo is

| Component | Detail |
| --- | --- |
| Frontend | The same Vercel deployment that serves prod, accessed via the `/demo/*` path subtree. Pathname-based routing ([decisions/0001](../decisions/0001-pathname-based-routing.md)) selects the demo Supabase project automatically. |
| Backend | The `vera-demo` Supabase project — separate database, separate auth, separate Edge Function deployments. |
| Data | A deterministic seed produced by [`scripts/generate_demo_seed.js`](../../scripts/generate_demo_seed.js) and applied manually to `vera-demo` via the SQL editor. |
| Auto-login | `/demo` route auto-signs-in using `VITE_DEMO_ADMIN_EMAIL` / `VITE_DEMO_ADMIN_PASSWORD`, then redirects to `/demo/admin`. |
| Entry token | A pre-minted token for `/demo/eval` lives in `VITE_DEMO_ENTRY_TOKEN` so anyone clicking "Try as juror" lands on the jury flow instantly. |

The demo is intentionally low-stakes. No real tenant data lives there;
the project owner can rebuild it from scratch in 5-10 minutes.

---

## What's in the seed

The seed renders a believable cross-section of VERA usage. As of the
current generator:

- **6 organizations:**
  - TED University — Electrical-Electronics Engineering (Turkish, MÜDEK)
  - Carnegie Mellon University — Computer Science (English, ABET)
  - TEKNOFEST (multi-day national competition)
  - TÜBİTAK 2204-A (high-school research competition)
  - IEEE APS — AP-S Student Design Contest (international)
  - AAS CanSat Competition (multi-day, recovery tracking variant)
- **~68 jurors** distributed across the orgs, with realistic affiliations
  and IP / user-agent diversity in the audit log.
- **~174 projects** spread over multiple periods (current + 3 historical
  archive cohorts: prev / older / oldest).
- **Premium scoring data** — designed score archetypes (`star`, `solid`,
  `wellrounded`, `highvar`, `tech_strong_comm_weak`, `borderline`,
  `partial`, etc.) so the rankings page tells a compelling story.
- **90 days of audit-log activity** with deterministic IPs, user agents,
  correlation IDs, and signed hash chain.
- **Identity fixtures:**
  - `demo-admin@vera-eval.app` — super-admin (no password — log in via
    auto-login env vars).
  - `tenant-admin@vera-eval.app` — tenant-admin for E2E scenarios
    (password from seed + env).
  - One tenant-admin owner per org with `is_owner = true`.

The full inventory lives in `sql/seeds/demo_seed.sql` (≈13,665 lines —
generated, not hand-edited).

---

## Determinism

The generator uses a fixed seed (`_seed = 0.20260402`) so re-running it
produces the same UUIDs, names, scores, and timestamps. Consequences:

- Re-applying the seed to a clean demo project yields identical IDs.
  Any external system that links to `vera-demo` UUIDs (E2E test fixtures,
  documentation screenshots) keeps working.
- Period dates are anchored to `TODAY` at generation time — Spring/Fall
  semester labels and current-period start/end dates shift to keep the
  demo "evergreen". Historical periods stay fixed in the past.
- Hash chain is computed deterministically; the daily integrity validator
  on demo passes after a fresh apply.

If you need new randomness (different score distribution, different
affiliations), change the seed value — but understand it cascades into
every downstream UUID, breaking any external link to old IDs.

---

## How to update the demo

### Updating data shapes (most common case)

When the schema gains a column or a new entity, the generator usually
needs an update.

1. Edit [`scripts/generate_demo_seed.js`](../../scripts/generate_demo_seed.js).
   The script is monolithic; navigate by section comments.
2. Regenerate the seed file:

   ```bash
   node scripts/generate_demo_seed.js
   ```

   Output: `sql/seeds/demo_seed.sql` updated. Inspect the diff —
   especially around the section you edited.
3. Apply the new seed to **`vera-demo` only** (never prod):
   - Open the Supabase SQL editor for `vera-demo`.
   - Paste the contents of `sql/seeds/demo_seed.sql`.
   - Run. The seed begins with `TRUNCATE TABLE ...` so the existing data
     is replaced.
4. Verify on `/demo/admin`:
   - Auto-login should still work.
   - All 6 organizations should appear in the org switcher.
   - Recent audit-log activity should populate.
5. Commit `scripts/generate_demo_seed.js` + `sql/seeds/demo_seed.sql`
   together. Commits that change one without the other create drift.

### Updating period dates only

If the only thing that's gone stale is the current-period dates ("Fall
2024" needs to become "Spring 2026"), regenerate without code changes:

```bash
node scripts/generate_demo_seed.js
```

Because dates anchor to `TODAY`, the regenerated file shifts current-
period dates forward. Historical periods stay where they are.

Apply to demo, commit both files.

### Updating identity fixtures

If you need to add a new tenant-admin or change the demo super-admin's
display name:

1. Find the Identity section in `generate_demo_seed.js` (search for
   `demo-admin@vera-eval.app`).
2. Add or modify the seed entry. Hardcoded UUIDs are fine; the script
   uses fixed values for fixtures so E2E tests can reference them.
3. Update `.env.local` documentation with any new credentials.
4. Regenerate and apply.

### Adding a new organization

Add an entry in the orgs array (search `Organizations` in the
generator). Match the existing pattern — code, settings JSON, contact
email, `setup_completed_at`. The downstream cohorts (jurors, projects,
periods) will fill in based on `orgType` and overrides.

---

## Hard rules

These are operationally enforced. Violating any one is an incident.

1. **Never push `sql/seeds/demo_seed.sql` to vera-prod.** Documented in
   [CLAUDE.md migration policy](../../CLAUDE.md). The seed begins with
   `TRUNCATE TABLE` — applying to prod destroys real tenant data.
2. **Never run the seed automatically.** Not from CI, not from a deploy
   hook, not from a cron. The project owner applies it manually via the
   Supabase SQL editor.
3. **Never edit `sql/seeds/demo_seed.sql` by hand.** The file is
   generated. Manual edits get overwritten on the next regen and
   produce silent drift.
4. **Always commit the generator and the seed file together.** A change
   to one without the other means the next person's regen produces a
   different file than what's in git.
5. **Demo schema follows prod schema.** The seed must be valid against
   the current `sql/migrations/` snapshot. If a migration changes the
   schema, the seed and the generator may need updating in the same
   change set.

---

## Verification — confirming the demo is healthy

A quick sanity check after any seed apply:

```sql
-- Run via Supabase SQL editor on vera-demo
SELECT (SELECT COUNT(*) FROM organizations)        AS orgs,           -- expect 6
       (SELECT COUNT(*) FROM auth.users)           AS auth_users,     -- expect ≥10
       (SELECT COUNT(*) FROM memberships)          AS memberships,    -- expect ≥10
       (SELECT COUNT(*) FROM periods)              AS periods,        -- expect ≥20
       (SELECT COUNT(*) FROM projects)             AS projects,       -- expect ≥150
       (SELECT COUNT(*) FROM jurors)               AS jurors,         -- expect ≥60
       (SELECT COUNT(*) FROM score_sheets)         AS score_sheets,   -- non-zero
       (SELECT COUNT(*) FROM audit_logs)           AS audit_rows,     -- non-zero
       (SELECT COUNT(*) FROM entry_tokens
        WHERE expires_at > NOW())                  AS active_tokens;  -- expect ≥6
```

Then visit:

- `/demo/admin` — should auto-login within 3 seconds.
- `/demo/eval?t=<VITE_DEMO_ENTRY_TOKEN>` — should render the jury gate.
- `/demo/admin/audit-log` — should show ~90 days of activity.

If any of these fails, see [runbooks/demo-seed-broken.md](runbooks/demo-seed-broken.md).

---

## Related

- [decisions/0001-pathname-based-routing.md](../decisions/0001-pathname-based-routing.md)
  (why `/demo/*` selects the demo project)
- [decisions/0005-snapshot-migrations.md](../decisions/0005-snapshot-migrations.md)
  (why the demo seed sits outside the migration suite)
- [runbooks/demo-seed-broken.md](runbooks/demo-seed-broken.md) (recovery)
- [deployment/migrations.md](../deployment/migrations.md) (related rule
  set, also forbids automated seed apply)
- [walkthroughs/tenant-onboarding.md](../walkthroughs/tenant-onboarding.md)
  (the flow the demo simulates)
- `sql/README.md` — Seed Data section

---

> *Last updated: 2026-04-24*
