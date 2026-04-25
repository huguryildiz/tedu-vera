import { test, expect } from "@playwright/test";
import { adminClient } from "../helpers/supabaseAdmin";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";
import {
  setupScoringFixture,
  teardownScoringFixture,
  type ScoringFixture,
} from "../helpers/scoringFixture";

/**
 * B1 — Juror batch import E2E spec
 *
 * Verifies that jurors can be batch-imported via the admin API and
 * correctly persisted with the proper organization_id.
 *
 * Flow:
 * 1. Create a test period using the scoring fixture
 * 2. Insert 3 jurors via adminClient (service-role API)
 * 3. Query the DB to verify the 3 jurors exist with correct org_id
 * 4. Clean up the inserted jurors
 */

test.describe("juror batch import", () => {
  test.describe.configure({ mode: "serial" });

  let fixture: ScoringFixture | null = null;

  test.beforeAll(async () => {
    // Set up a period to work with
    fixture = await setupScoringFixture({ namePrefix: "B1 Batch Import" });
  });

  test.afterAll(async () => {
    if (fixture) {
      await teardownScoringFixture(fixture);
    }
  });

  test("insert 3 jurors via API → jurors table populated with correct org_id", async () => {
    if (!fixture) throw new Error("Fixture not set up");

    const orgId = E2E_PERIODS_ORG_ID;
    const suffix = Date.now().toString(36);

    // Create 3 test jurors
    const jurorRows = [
      { organization_id: orgId, juror_name: `B1 Batch Juror 1 ${suffix}`, affiliation: "B1 Test Org" },
      { organization_id: orgId, juror_name: `B1 Batch Juror 2 ${suffix}`, affiliation: "B1 Test Org" },
      { organization_id: orgId, juror_name: `B1 Batch Juror 3 ${suffix}`, affiliation: "B1 Test Org" },
    ];

    // Insert the batch
    const { data: insertedJurors, error: insertErr } = await adminClient
      .from("jurors")
      .insert(jurorRows)
      .select("id, juror_name, affiliation, organization_id");

    expect(insertErr, `Insert error: ${insertErr?.message}`).toBeNull();
    expect(insertedJurors).toHaveLength(3);

    // Verify each juror has correct org_id
    insertedJurors?.forEach((juror, idx) => {
      expect(juror.organization_id).toBe(orgId);
      expect(juror.juror_name).toContain(`B1 Batch Juror ${idx + 1}`);
      expect(juror.affiliation).toBe("B1 Test Org");
    });

    // Query the jurors table to ensure they persisted
    const { data: queriedJurors, error: queryErr } = await adminClient
      .from("jurors")
      .select("id, juror_name, organization_id")
      .eq("organization_id", orgId)
      .in(
        "juror_name",
        jurorRows.map((r) => r.juror_name)
      );

    expect(queryErr).toBeNull();
    expect(queriedJurors).toHaveLength(3);

    // Verify organization_id is correct on all rows
    queriedJurors?.forEach((juror) => {
      expect(juror.organization_id).toBe(orgId);
    });

    // Cleanup: delete the inserted jurors
    const jurorIds = insertedJurors?.map((j) => j.id) ?? [];
    if (jurorIds.length > 0) {
      const { error: deleteErr } = await adminClient
        .from("jurors")
        .delete()
        .in("id", jurorIds);
      expect(deleteErr).toBeNull();
    }

    // Verify deletion
    const { data: afterDelete } = await adminClient
      .from("jurors")
      .select("id")
      .in("juror_name", jurorRows.map((r) => r.juror_name));

    expect(afterDelete).toHaveLength(0);
  });
});
