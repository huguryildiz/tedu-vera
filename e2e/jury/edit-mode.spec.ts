import { test, expect } from "@playwright/test";
import {
  adminClient,
  resetJurorAuth,
  readJurorAuth,
  seedJurorSession,
  setJurorEditMode,
} from "../helpers/supabaseAdmin";
import { EVAL_PERIOD_ID, EVAL_JURORS } from "../fixtures/seed-ids";

// Dedicated juror for edit-mode tests — "E2E Eval Submit" is the most isolated
// one used by evaluate.spec; resetJurorAuth clears all its state in beforeEach
// so neither side interferes.
const EDIT_JUROR = EVAL_JURORS[2]; // E2E Eval Submit

/**
 * Why we write juror_period_auth columns directly (setJurorEditMode) instead
 * of calling rpc_juror_toggle_edit_mode:
 *   The admin RPC requires auth.uid() to match a tenant-admin membership.
 *   Playwright tests run via the service-role adminClient, which has no
 *   user context. We reproduce the exact post-toggle DB state
 *   (edit_enabled + edit_expires_at + final_submitted_at) so the downstream
 *   rpc_jury_upsert_score gate — which is the subject under test — behaves
 *   identically. See sql/migrations/006a_rpcs_admin.sql:141-145 for the
 *   columns the RPC mutates.
 */
test.describe("jury edit-mode after submit", () => {
  test.describe.configure({ mode: "serial" });

  let projectId = "";

  test.beforeAll(async () => {
    // Pick any project in EVAL_PERIOD_ID — rpc_jury_upsert_score needs a
    // valid (period_id, project_id) pair to create/update a score_sheet.
    const { data, error } = await adminClient
      .from("projects")
      .select("id")
      .eq("period_id", EVAL_PERIOD_ID)
      .limit(1)
      .single();
    if (error || !data?.id) {
      throw new Error(`Could not fetch project for EVAL_PERIOD_ID: ${error?.message}`);
    }
    projectId = data.id;
  });

  test.beforeEach(async () => {
    // F1: resetJurorAuth also clears session_token_hash + edit flags.
    await resetJurorAuth(EDIT_JUROR.id, EVAL_PERIOD_ID);
  });

  test("admin opens edit mode → juror can update submitted scores", async () => {
    // 1) Put the juror into the post-submit state an admin would see.
    const submittedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    const editExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // +1h
    await setJurorEditMode(EDIT_JUROR.id, EVAL_PERIOD_ID, {
      final_submitted_at: submittedAt,
      edit_enabled: true,
      edit_reason: "E5 edit-mode test — admin-enabled window",
      edit_expires_at: editExpiresAt,
    });

    // 2) Seed a live session so the RPC's session_token_hash check passes.
    const token = await seedJurorSession(EDIT_JUROR.id, EVAL_PERIOD_ID);

    // 3) Call the score upsert RPC — empty scores array is enough to exercise
    //    the edit-window gate; we only care that the RPC accepted the write.
    const { data, error } = await adminClient.rpc("rpc_jury_upsert_score", {
      p_period_id: EVAL_PERIOD_ID,
      p_project_id: projectId,
      p_juror_id: EDIT_JUROR.id,
      p_session_token: token,
      p_scores: [],
      p_comment: "E5 edit-mode allowed write",
    });
    expect(error, `RPC transport error: ${error?.message}`).toBeNull();
    expect(data?.ok, `RPC must return ok=true, got ${JSON.stringify(data)}`).toBe(true);
    expect(data?.score_sheet_id).toBeTruthy();

    // 4) DB confirmation — score_sheet row exists and carries our comment.
    const { data: sheet } = await adminClient
      .from("score_sheets")
      .select("id, comment, juror_id, project_id")
      .eq("id", data.score_sheet_id)
      .single();
    expect(sheet?.comment).toBe("E5 edit-mode allowed write");
    expect(sheet?.juror_id).toBe(EDIT_JUROR.id);
  });

  test("edit window expired → RPC returns edit_window_expired and resets edit_enabled", async () => {
    // Final submitted, edit supposedly enabled but expiration is in the past.
    const submittedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const editExpiresAt = new Date(Date.now() - 60 * 1000).toISOString(); // 1 min ago
    await setJurorEditMode(EDIT_JUROR.id, EVAL_PERIOD_ID, {
      final_submitted_at: submittedAt,
      edit_enabled: true,
      edit_reason: "E5 edit-mode test — expired window",
      edit_expires_at: editExpiresAt,
    });

    const token = await seedJurorSession(EDIT_JUROR.id, EVAL_PERIOD_ID);

    const { data, error } = await adminClient.rpc("rpc_jury_upsert_score", {
      p_period_id: EVAL_PERIOD_ID,
      p_project_id: projectId,
      p_juror_id: EDIT_JUROR.id,
      p_session_token: token,
      p_scores: [],
      p_comment: "E5 expired edit attempt",
    });
    expect(error, `RPC transport error: ${error?.message}`).toBeNull();
    expect(data?.ok).toBe(false);
    expect(data?.error_code).toBe("edit_window_expired");

    // The RPC self-cleans the stale edit flags on expiry (005_rpcs_jury.sql:522-532).
    const auth = await readJurorAuth(EDIT_JUROR.id, EVAL_PERIOD_ID);
    expect(auth.edit_enabled).toBe(false);
    expect(auth.edit_reason).toBeNull();
    expect(auth.edit_expires_at).toBeNull();
  });
});
