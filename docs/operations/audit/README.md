# Audit Documentation

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

**Total Audited Operations: 48/48 (100%)**

- **27 explicit actions:** User-initiated and RPC-emitted semantic events
  - 3 juror-initiated (evaluation submit, PIN lockout, edit mode close)
  - 5 admin-initiated juror actions (PIN unlock/reset, edit mode grant)
  - 6 period/framework management (criteria save, period lock/unlock, outcomes)
  - 2 token management (generate, revoke)
  - 2 snapshot & login (freeze, admin login)
  - 6 data exports (scores, rankings, heatmap, analytics, audit, backup)
  - 1 application rejection
  - 1 organization lifecycle state change
  - 1 active period assignment
  - 1 admin record update

- **7 trigger-based CRUD tables:** Automatic logging on INSERT/UPDATE/DELETE
  - organizations, periods, projects, jurors, score_sheets, memberships, entry_tokens

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
