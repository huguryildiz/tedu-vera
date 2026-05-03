# Audit Log Improvement Roadmap

> _Last updated: 2026-04-28_

> [!NOTE]
> All five items below were addressed in the 2026-04-28 audit-hardening pass.
> See [audit-coverage.md](./audit-coverage.md) for the current state.

---

## 1. Selective JSONB Diffing — ✅ shipped

- **Helper:** `public._jsonb_diff(jsonb, jsonb)` returns `{before, after}` with
  only keys whose values actually changed. Stripped noisy keys: `updated_at`,
  `last_seen_at`, `last_activity_at`.
- **Used by:** `trigger_audit_log` for INSERT / UPDATE / DELETE on every
  tracked table except `score_sheets` (still NULL diff for volume reasons).
- **Bonus:** UPDATEs whose only changes are noisy keys produce no audit row at
  all — the trigger early-returns. This is what makes the new
  `juror_period_auth` trigger safe under jury-day heartbeat traffic.

## 2. Foreign Key & Deletion Hardening — ✅ shipped

- `audit_logs.user_id` now references `profiles(id) ON DELETE SET NULL`.
  Deleting an admin clears the FK pointer but the audit row survives. The
  `actor_name` snapshot keeps the historical record readable without the
  live profile. Unblocks GDPR right-to-be-forgotten and clean offboarding.

## 3. Proxy & IP Trust Integrity — ✅ shipped

- **SQL:** `_audit_extract_client_ip(xff, real_ip)` reads `app.audit_proxy_depth`
  GUC. When set to N, returns `xff[len - 1 - N]` so spoofed left-side hops are
  ignored. Used by both `_audit_write` and `trigger_audit_log`.
- **Edge Functions:** `extractClientIp` in `_shared/audit-log.ts` reads
  `AUDIT_TRUSTED_PROXY_DEPTH` env. Same right-to-left walk.
- **Default:** when neither is configured, behavior falls back to legacy
  XFF[0] for backwards compatibility. Production deployments should set
  both. Setup is documented in the Tamper Evidence section of audit-coverage.md.

## 4. External Root Anchoring — ✅ shipped

- `audit-anomaly-sweep` emits a `security.chain.root.signed` audit row each
  sweep when `AUDIT_ROOT_SIGNING_SECRET` is set. The signature is HMAC-SHA256
  over `id|chain_seq|row_hash|signed_at` of the latest chain row.
- The sink forwards this row externally just like any other audit event, so
  the off-site copy carries a signed snapshot of the chain tip. A DB
  administrator who tampers with the in-DB chain cannot also forge the
  off-site signed roots without the secret.
- **Operator action remaining:** set `AUDIT_ROOT_SIGNING_SECRET` (≥ 32 random
  bytes) on both projects' Edge Function envs. Until then the pass is a no-op
  with no false-positive alerts.

## 5. Reliable Sinking & Failure Recovery — ✅ shipped

- `audit_logs.synced_to_ext BOOLEAN NOT NULL DEFAULT false` +
  `synced_to_ext_at TIMESTAMPTZ` columns track delivery state.
- The `audit-log-sink` Edge Function flips `synced_to_ext = true` after a
  successful POST.
- The `audit-anomaly-sweep` cron has a drain pass that re-POSTs up to 500
  unsynced rows older than 5 minutes per run. No silent drops. New rows that
  fail the immediate Database Webhook delivery are caught at the next sweep.
- A partial index `idx_audit_logs_unsynced ON (created_at) WHERE synced_to_ext = false`
  keeps the drain query cheap.

---

## What's next (post-roadmap follow-ups)

- Retrofit audit-aware assertions into the 45 `audit-emitting` RPC contract
  tests that currently don't reference `audit_logs`. Tracked by the
  `npm run check:audit-rpc-tests` ratchet sentinel — the BLIND_BASELINE
  number lowers each time a test is upgraded.
- Add a CLI signature-verification helper that pulls a signed-root row + the
  signing secret and recomputes the HMAC offline. Out of scope for the
  hardening pass but a natural compliance-tooling extension.
- Wire `rpc_admin_log_migration` into the `apply_migration` MCP automation
  (or the deploy-script wrapper) so the trail is automatic, not voluntary.
