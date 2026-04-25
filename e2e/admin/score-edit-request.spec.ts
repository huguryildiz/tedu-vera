import { test, expect } from "@playwright/test";
import {
  setupScoringFixture,
  teardownScoringFixture,
  writeScoresAsJuror,
  ScoringFixture,
} from "../helpers/scoringFixture";
import { adminClient } from "../helpers/supabaseAdmin";

/**
 * SKIPPED: rpc_jury_request_score_edit and the score edit request flow
 * (score_edit_requests table + RPC) have not yet been implemented in the
 * database schema or API layer.
 *
 * To re-enable this spec, implement:
 *   - score_edit_requests table in sql/migrations/002_tables.sql
 *   - rpc_jury_request_score_edit in sql/migrations/005_rpcs_jury.sql
 *   - rpc_admin_approve_score_edit_request in sql/migrations/006a_rpcs_admin.sql
 *   - rpc_admin_reject_score_edit_request in sql/migrations/006a_rpcs_admin.sql
 *   - Admin UI endpoints to view/approve/reject requests
 */

test.describe("score-edit-request flow (SKIPPED - RPC not yet implemented)", () => {
  test("placeholder: awaiting rpc_jury_request_score_edit implementation", async () => {
    // This test will be enabled once the edit request RPC is available
    expect(true).toBe(true);
  });
});
