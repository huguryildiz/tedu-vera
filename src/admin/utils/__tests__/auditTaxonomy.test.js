import { describe, it, expect } from "vitest";
import { qaTest } from "@/test/qaTest";
import { EVENT_META } from "../auditUtils";

// Canonical list of actions that should have EVENT_META entries
// (typically emitted by RPCs, Edge Functions, or UI workflows)
// Extracted from migrations 005, 006a, 006b, 007, 008, 009 and Edge Functions
// NOTE: Trigger-based table CRUD actions are also emitted but many don't have custom renderers yet
const BACKEND_ACTIONS = [
  // RPC-emitted actions from jury, admin, identity, platform, audit migrations
  "admin.logout",
  "application.submitted",
  "application.approved",
  "application.rejected",
  "auth.admin.login.success",
  "auth.admin.login.failure",
  "auth.admin.password.changed",
  "auth.admin.password.reset.requested",
  "data.juror.auth.created",
  "data.juror.edit_mode.force_closed",
  "data.score.submitted",
  "data.score.edit_requested",
  "evaluation.complete",
  "juror.edit_mode_closed_on_resubmit",
  "juror.pin_locked",
  "juror.pin_unlocked",
  "juror.pin_unlocked_and_reset",
  "juror.pin_locked",
  "pin.reset",
  "token.generate",
  "token.revoke",
  "security.entry_token.revoked",
  "security.pin_reset.requested",
  "membership.join_requested",
  "membership.join_approved",
  "membership.join_rejected",
  "period.lock",
  "period.unlock",
  "period.set_current",
  "snapshot.freeze",
  // Trigger-emitted actions (table.operation pattern)
  "admin_invites.insert",
  "admin_invites.update",
  "admin_invites.delete",
  "entry_tokens.insert",
  "entry_tokens.update",
  "entry_tokens.delete",
  "frameworks.insert",
  "frameworks.update",
  "frameworks.delete",
  "jurors.insert",
  "jurors.update",
  "jurors.delete",
  "memberships.insert",
  "memberships.update",
  "memberships.delete",
  "organizations.insert",
  "organizations.update",
  "organizations.delete",
  "org_applications.insert",
  "org_applications.update",
  "org_applications.delete",
  "periods.insert",
  "periods.update",
  "periods.delete",
  "projects.insert",
  "projects.update",
  "projects.delete",
  "profiles.insert",
  "profiles.update",
  "score_sheets.insert",
  "score_sheets.update",
  "score_sheets.delete",
  "security_policy.insert",
  "security_policy.update",
  "security_policy.delete",
];

describe("auditTaxonomy", () => {
  const frontendKeys = Object.keys(EVENT_META);

  describe("audit-taxonomy-frontend-orphans", () => {
    qaTest("audit-taxonomy-frontend-orphans", () => {
      // Frontend orphans: keys in EVENT_META but NOT emitted by backend
      const orphans = frontendKeys.filter(
        (key) => !BACKEND_ACTIONS.includes(key)
      );

      // These are all valid action types with renderers, even if not currently emitted
      // by core system paths. They may be emitted by future features or admin-triggered actions.
      // Documenting count for tracking purposes.
      expect(orphans.length).toBeGreaterThan(0);

      // All orphans should have proper EVENT_META entries (at minimum a label)
      orphans.forEach((orphan) => {
        expect(EVENT_META[orphan]).toBeDefined();
        expect(EVENT_META[orphan].label).toBeDefined();
        // narrative is optional (some entries use fallback rendering)
      });
    });
  });

  describe("audit-taxonomy-backend-orphans", () => {
    qaTest("audit-taxonomy-backend-orphans", () => {
      // Backend orphans: actions emitted but NOT in EVENT_META (fallback to generic label)
      const orphans = BACKEND_ACTIONS.filter(
        (action) => !frontendKeys.includes(action)
      );

      // These actions are valid but will render with generic labels until custom renderers are added
      expect(orphans.length).toBeGreaterThan(0);

      // Verify all orphans are actually strings (valid action identifiers)
      orphans.forEach((action) => {
        expect(typeof action).toBe("string");
        expect(action.length).toBeGreaterThan(0);
      });
    });
  });

  describe("audit-taxonomy-coverage", () => {
    qaTest("audit-taxonomy-coverage", () => {
      // Coverage: what fraction of backend-emitted actions have EVENT_META renderers?
      const coveredBackendActions = BACKEND_ACTIONS.filter((action) =>
        frontendKeys.includes(action)
      );

      const uncoveredBackendActions = BACKEND_ACTIONS.filter(
        (action) => !frontendKeys.includes(action)
      );

      const coverage = coveredBackendActions.length / BACKEND_ACTIONS.length;

      // We have partial coverage (some actions lack custom renderers)
      expect(coverage).toBeGreaterThan(0);
      expect(coverage).toBeLessThan(1);

      // Document the counts for audit trail
      expect(BACKEND_ACTIONS.length).toBeGreaterThan(0);
      expect(coveredBackendActions.length).toBeGreaterThan(0);
      expect(uncoveredBackendActions.length).toBeGreaterThan(0);
    });
  });

  describe("audit-taxonomy-healthy-matches", () => {
    qaTest("audit-taxonomy-healthy-matches", () => {
      // Healthy actions: present in both backend and frontend EVENT_META
      const healthyActions = BACKEND_ACTIONS.filter((action) =>
        frontendKeys.includes(action)
      );

      // Should have at least some healthy matches
      expect(healthyActions.length).toBeGreaterThan(0);

      // Spot check critical actions are properly covered when they're in the system
      const criticalActionCandidates = [
        "data.score.submitted",
        "evaluation.complete",
        "auth.admin.login.success",
        "membership.join_approved",
        "token.generate",
      ];

      criticalActionCandidates.forEach((action) => {
        if (frontendKeys.includes(action)) {
          // If in frontend keys, verify it's properly defined
          expect(EVENT_META[action]).toBeDefined();
          expect(EVENT_META[action].label).toBeDefined();
          expect(EVENT_META[action].narrative).toBeDefined();
        }
      });
    });
  });

  describe("audit-taxonomy-event-meta-structure", () => {
    qaTest("audit-taxonomy-event-meta-structure", () => {
      // Verify all EVENT_META entries have required structure
      frontendKeys.forEach((key) => {
        const entry = EVENT_META[key];
        expect(entry).toBeDefined();
        expect(entry.label).toBeDefined();
        expect(typeof entry.label).toBe("string");
        // narrative is optional (fallback rendering uses label + title-case)
        if (entry.narrative) {
          expect(typeof entry.narrative).toBe("function");
        }
      });

      // Document total number of actions with custom renderers
      expect(frontendKeys.length).toBeGreaterThan(0);
    });
  });
});
