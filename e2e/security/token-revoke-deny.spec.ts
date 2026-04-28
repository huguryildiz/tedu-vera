/**
 * Token revoke → entry attempt rejected.
 *
 * Verifies that a revoked entry token cannot be used to start a jury session:
 * 1. Generate a fresh entry token via service-role.
 * 2. Mark it is_revoked = true in the DB.
 * 3. Navigate to /demo/eval?t=<token>.
 * 4. Assert the gate shows the "Token revoked" denial — revoked entry blocked.
 */

import { test, expect } from "@playwright/test";
import { randomBytes, createHash } from "node:crypto";
import { adminClient } from "../helpers/supabaseAdmin";
import { EVAL_PERIOD_ID } from "../fixtures/seed-ids";

test.describe("token revoke deny — revoked entry token rejected at eval gate", () => {
  test("revoked entry token: gate shows token_revoked denial", async ({ page }) => {
    // revoked entry: generate token, revoke via DB, try to enter → must be blocked
    const plainToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(plainToken).digest("hex");

    const { data: inserted, error: insertErr } = await adminClient
      .from("entry_tokens")
      .insert({
        period_id: EVAL_PERIOD_ID,
        token_hash: tokenHash,
        token_plain: plainToken,
        is_revoked: false,
        expires_at: null,
      })
      .select("id")
      .single();
    expect(insertErr, `token insert failed: ${insertErr?.message}`).toBeNull();

    // Revoke the token before it is used
    await adminClient
      .from("entry_tokens")
      .update({ is_revoked: true })
      .eq("id", inserted!.id);

    // Attempt to enter jury with the revoked token
    await page.goto(`/demo/eval?t=${plainToken}`);

    // revoke token reject: gate must surface a denial — not proceed to identity step
    await expect(
      page.getByText(/revoked|access denied|invalid/i),
      "revoked entry must show denial message",
    ).toBeVisible({ timeout: 15_000 });

    // Cleanup
    await adminClient.from("entry_tokens").delete().eq("id", inserted!.id);
  });
});
