# Audit Taxonomy Orphan Scan Report

**Date:** 2026-04-25  
**Source Files:** `src/admin/utils/auditUtils.js` (EVENT_META), SQL migrations (005, 006a, 006b, 007, 008, 009), Edge Functions  
**Summary:** 101 frontend keys vs. 64 backend-emitted actions = 38 frontend-only orphans, 1 backend-only orphan, 63 healthy matches (98.4% coverage)

---

## Frontend-Only Orphans (38)

Dead code in EVENT_META with no backend emitter. These entries are safe to deprecate but currently kept for historical audit log rendering (legacy actions from older workflows).

1. `access.admin.session.revoked`
2. `admin.create`
3. `admin.login` (legacy; superseded by `auth.admin.login.success`)
4. `admin.updated`
5. `backup.created`
6. `backup.deleted`
7. `backup.downloaded`
8. `config.backup_schedule.updated`
9. `config.outcome.created`
10. `config.outcome.deleted`
11. `config.outcome.updated`
12. `config.platform_settings.updated`
13. `criteria.save`
14. `criteria.update`
15. `data.juror.pin.locked` (legacy alias for `juror.pin_locked`)
16. `data.juror.pin.reset` (legacy alias for `pin.reset`)
17. `data.juror.pin.unlocked` (legacy alias for `juror.pin_unlocked`)
18. `juror.blocked`
19. `juror.create`
20. `juror.edit_enabled` (legacy alias for `juror.edit_mode_enabled`)
21. `juror.edit_mode_enabled`
22. `juror.import`
23. `maintenance.cancelled`
24. `maintenance.set`
25. `organization.status_changed`
26. `outcome.create`
27. `outcome.created`
28. `outcome.delete`
29. `outcome.deleted`
30. `outcome.update`
31. `outcome.updated`
32. `project.create`
33. `project.delete`
34. `project.import`
35. `project.update`
36. `score.update`
37. `security.anomaly.detected`
38. `security.chain.broken`

---

## Backend-Only Orphans (1)

Emitted by backend but no EVENT_META renderer (fallback to generic label). This is not critical.

1. `organizations.delete` — trigger-based table CRUD action; uses generic label "organizations delete"

---

## Healthy Matches (63)

Actions properly defined in both EVENT_META and backend emitters — 98.4% coverage.

1. `admin.logout`
2. `admin_invites.delete`
3. `admin_invites.insert`
4. `admin_invites.update`
5. `application.approved`
6. `application.rejected`
7. `application.submitted`
8. `auth.admin.login.failure`
9. `auth.admin.login.success`
10. `auth.admin.password.changed`
11. `auth.admin.password.reset.requested`
12. `data.juror.auth.created`
13. `data.juror.edit_mode.force_closed`
14. `data.score.edit_requested`
15. `data.score.submitted`
16. `entry_tokens.delete`
17. `entry_tokens.insert`
18. `entry_tokens.update`
19. `evaluation.complete`
20. `frameworks.delete`
21. `frameworks.insert`
22. `frameworks.update`
23. `juror.edit_mode_closed_on_resubmit`
24. `juror.pin_locked`
25. `juror.pin_unlocked`
26. `juror.pin_unlocked_and_reset`
27. `jurors.delete`
28. `jurors.insert`
29. `jurors.update`
30. `membership.join_approved`
31. `membership.join_rejected`
32. `membership.join_requested`
33. `memberships.delete`
34. `memberships.insert`
35. `memberships.update`
36. `org_applications.delete`
37. `org_applications.insert`
38. `org_applications.update`
39. `organizations.insert`
40. `organizations.update`
41. `period.lock`
42. `period.set_current`
43. `period.unlock`
44. `periods.delete`
45. `periods.insert`
46. `periods.update`
47. `pin.reset`
48. `profiles.insert`
49. `profiles.update`
50. `projects.delete`
51. `projects.insert`
52. `projects.update`
53. `score_sheets.delete`
54. `score_sheets.insert`
55. `score_sheets.update`
56. `security.entry_token.revoked`
57. `security.pin_reset.requested`
58. `security_policy.delete`
59. `security_policy.insert`
60. `security_policy.update`
61. `snapshot.freeze`
62. `token.generate`
63. `token.revoke`

---

## Notes

- **Trigger-generated actions** (table.operation pattern): 15 tables connected to `trigger_audit_log()` generate CRUD actions automatically. Only `organizations.delete` lacks a custom renderer.
- **Legacy aliases:** The `data.juror.pin.*` actions are aliases kept for backward compatibility; modern code emits `juror.pin_*` instead.
- **Frontend orphans:** Mostly anticipatory features (backup/restore, config changes, criteria management, outcome management, project operations) that are not yet fully emitted by the backend RPC layer. Safe to keep as they improve audit log completeness if/when these features are implemented.
- **Orphan severity:** Frontend orphans are not critical (just dead code for future features or historical events). The single backend orphan (`organizations.delete`) simply uses a fallback generic label and does not impair functionality.
- **Next steps:** Consider reviewing frontend orphans periodically for removal if the anticipated features are never implemented. Backend orphan `organizations.delete` could be given a custom renderer if needed for UX polish.
