# Audit Log Improvement Roadmap

Five improvements needed to bring VERA's audit logging to enterprise-grade
reliability. Each item is referenced from [known-limitations.md](../../known-limitations.md)
under "Audit and tamper evidence".

---

## 1. Selective JSONB Diffing (storage optimisation)

> [!WARNING]
> The current trigger writes a full JSON snapshot of both the old and new
> row on every UPDATE — even when only one column changes.

- **Problem:** a 100-column table emits 200 columns of JSON per update.
  Storage grows aggressively over long-lived tenants.
- **Solution:** add a `jsonb_diff` helper to `trigger_audit_log` so only the
  **delta** (changed fields) is stored.
- **Impact:** 80–95% storage reduction; diff chips in the Audit Log UI become
  genuinely readable.

## 2. Foreign Key & Deletion Hardening (operational flexibility)

> [!CAUTION]
> `audit_logs.user_id` has a hard FK to `profiles`. This blocks deletion of
> any admin who has audit rows (circular dependency with append-only logs).

- **Problem:** deleting an admin raises a FK violation. The log cannot be
  deleted (append-only) and neither can the user. The system deadlocks.
- **Solution:** change `user_id` to `ON DELETE SET NULL`, or snapshot admin
  metadata entirely and drop the FK dependency.
- **Impact:** clean user-management workflows and GDPR Right-to-be-Forgotten
  compliance.

## 3. Proxy & IP Trust Integrity (security hardening)

> [!IMPORTANT]
> The current `_audit_write` IP logic trusts the first value in
> `X-Forwarded-For` unconditionally.

- **Problem:** a malicious user can spoof the header and appear to originate
  from a different IP (e.g. localhost).
- **Solution:** validate the trusted-proxy list (Supabase Edge, Cloudflare,
  etc.) and resolve the header chain safely.
- **Impact:** audit records become non-repudiable for forensic purposes.

## 4. External Root Anchoring (tamper-evidence hardening)

- **Problem:** the hash chain lives entirely inside the database. A DB admin
  with write access could re-key the entire chain to produce a "Chain OK"
  result after tampering.
- **Solution:** periodically emit the chain's latest root hash to an external
  system (Axiom, AWS CloudWatch, or an external webhook), cryptographically
  signed.
- **Impact:** true immutable-ledger guarantee — even a compromised DB admin
  cannot alter logs without detection.

## 5. Reliable Sinking & Failure Recovery (system reliability)

- **Problem:** the `audit-log-sink` Edge Function is fire-and-forget. If the
  external sink (Axiom etc.) is unavailable, the log entry is silently lost
  and never retried.
- **Solution:** mark failed sink attempts with a flag (e.g.
  `synced_to_ext: false`) on the `audit_logs` row and drain them via a
  periodic job.
- **Impact:** "no silent drops" guarantee for both the DB copy and the offsite
  backup.
