# Audit Documentation

> _Last updated: 2026-04-28_

This directory contains comprehensive documentation for VERA's audit logging system.

## Files

- **[audit-coverage.md](./audit-coverage.md)** — Authoritative reference for what's audited and how
  - Overview of the 3-layer audit system (DB triggers, RPC-emitted, frontend-instrumented)
  - Complete catalog of 24 explicit actions + 7 trigger-based CRUD tables
  - Actor classification logic (Admin, Juror, System)
  - UI chip mapping for resource types
  - Architecture details (schema, RPCs, query patterns)
  - Implementation references (migrations, API functions)
  - Usage examples and testing verification checklist

## Quick Navigation

### For Admins
- Want to understand what gets logged? Start with **Overview** (section 1)
- Looking for specific audit events? See **Explicit Actions** (section 2)
- Need to query audit logs? See **Usage Examples** (section 9)

### For Developers
- Implementing new audit logs? See **Implementation References** (section 8) and **RPC Functions** table
- Debugging trigger issues? Check **Trigger-Based CRUD** (section 3)
- Need to understand actor context? See **Actor Classification Logic** (section 4)

### For Compliance
- Full audit coverage checklist? See **Conscious Exclusions** (section 6)
- Data retention policies? See **Compliance & Retention** (section 11)
- Want to verify implementation? Use **Testing & Verification** (section 10)

## Coverage Summary

- **30+ explicit semantic actions:** User-initiated and RPC- or Edge-Function-emitted
  events (auth, access, evaluation flow, period/criteria/outcome management, exports,
  notifications, security anomalies). See [audit-coverage.md](./audit-coverage.md)
  for the full catalog.

- **15 trigger-based CRUD tables:** Automatic logging on INSERT/UPDATE/DELETE.
  Trigger-emitted rows carry `ip_address` and `user_agent` and use a selective
  diff (only changed keys, noisy timestamps stripped). UPDATEs whose only
  changes are noisy keys produce no audit row at all (heartbeat-traffic safe):
  - organizations, periods, projects, jurors, score_sheets (diff: NULL),
    memberships, entry_tokens, period_criteria, period_criterion_outcome_maps,
    framework_outcomes, frameworks, profiles, security_policy, unlock_requests,
    juror_period_auth (composite PK; resource_id = juror_id)

## Key Concepts

### Audit Log Anatomy
```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "user_id": "uuid or null",
  "action": "evaluation.complete",
  "resource_type": "juror_period_auth",
  "resource_id": "uuid",
  "details": { "actor_name": "John Doe", "period_id": "..." },
  "created_at": "2026-04-09T14:30:00Z"
}
```

### Actor Types
- **Admin** — Authenticated user; display name from profiles table
- **Juror** — Unauthenticated jury session; actor_name in details JSON
- **System** — Trigger-based CRUD; no authenticated user context

### RPC-Instrumented Events
Events emitted by stored procedures (migrations 008/009):
- Uses `INSERT INTO audit_logs` directly
- Captures org context from affected resource
- Enriched with actor names for juror-initiated events

### Frontend-Instrumented Events
Events emitted from UI code:
- Uses `rpc_admin_write_audit_log` generic RPC
- Captured via `writeAuditLog()` helper in `src/shared/api/admin/audit.js`
- Admin context automatically resolved from auth session

---
