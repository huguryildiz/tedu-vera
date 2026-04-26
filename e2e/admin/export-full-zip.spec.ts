/**
 * P2-3 — Backup create → list → download → JSON shape → delete.
 *
 * API-level test: skips the `logExportInitiated` Edge Function audit write
 * (avoids 5xx blocker risk) and exercises the Storage + RPC layer directly.
 * Uses the same signInWithPassword + makeUserClient pattern as settings-save.spec.ts
 * so the `_assert_org_admin` check inside each RPC runs against a real auth token.
 *
 * JSON shape verified:
 *   { periods, projects, jurors, scores, audit_logs }
 */

import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { E2E_PERIODS_ORG_ID } from "../fixtures/seed-ids";

const EMAIL = process.env.E2E_ADMIN_EMAIL || "demo-admin@vera-eval.app";
const PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";

const supabaseUrl =
  process.env.E2E_SUPABASE_URL ||
  process.env.VITE_DEMO_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";

const anonKey =
  process.env.VITE_DEMO_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

async function signInWithPassword(email: string, password: string): Promise<string> {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`signIn(${email}) failed ${res.status}: ${await res.text()}`);
  const body = await res.json();
  if (!body.access_token) throw new Error(`No access_token for ${email}`);
  return body.access_token as string;
}

function makeUserClient(accessToken: string) {
  return createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Minimal payload matching fullExport shape for JSON shape verification.
const SEED_PAYLOAD = {
  periods: [{ id: "p2-3-test", name: "P2-3 Test Period", season: "Spring" }],
  projects: [],
  jurors: [],
  scores: [],
  audit_logs: [],
};

test.describe("backup: create → list → download → shape → delete", () => {
  test.describe.configure({ mode: "serial" });

  type UserClient = ReturnType<typeof makeUserClient>;
  let userClient: UserClient;
  let backupId: string | null = null;
  let storagePath: string | null = null;

  test.beforeAll(async () => {
    const accessToken = await signInWithPassword(EMAIL, PASSWORD);
    userClient = makeUserClient(accessToken);

    // Upload a minimal JSON blob to the backups bucket.
    // Path format matches createBackup: `{orgId}/{uuid}.json`
    const uuid = randomUUID();
    storagePath = `${E2E_PERIODS_ORG_ID}/${uuid}.json`;
    const jsonBytes = Buffer.from(JSON.stringify(SEED_PAYLOAD), "utf-8");

    const { error: uploadError } = await userClient.storage
      .from("backups")
      .upload(storagePath, jsonBytes, { contentType: "application/json", upsert: false });
    if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

    // Register the backup row via RPC.
    const { data: id, error: rpcError } = await userClient.rpc("rpc_backup_register", {
      p_organization_id: E2E_PERIODS_ORG_ID,
      p_storage_path: storagePath,
      p_size_bytes: jsonBytes.length,
      p_format: "json",
      p_row_counts: { periods: 1, projects: 0, jurors: 0, scores: 0, audit_logs: 0 },
      p_period_ids: [],
      p_origin: "manual",
    });
    if (rpcError) throw new Error(`rpc_backup_register failed: ${rpcError.message}`);
    backupId = id as string;
  });

  test.afterAll(async () => {
    // backupId is set to null by the delete test on success; skip if already cleaned.
    if (!backupId) return;
    await userClient.rpc("rpc_backup_delete", { p_backup_id: backupId }).catch(() => {});
    if (storagePath) {
      await userClient.storage.from("backups").remove([storagePath]).catch(() => {});
    }
  });

  test("rpc_backup_list returns the created backup with correct metadata", async () => {
    const { data, error } = await userClient.rpc("rpc_backup_list", {
      p_organization_id: E2E_PERIODS_ORG_ID,
    });
    expect(error).toBeNull();
    const rows = data as Array<{
      id: string;
      format: string;
      origin: string;
      storage_path: string;
    }>;
    const found = rows.find((b) => b.id === backupId);
    expect(found, "created backup must appear in list").toBeDefined();
    expect(found!.format).toBe("json");
    expect(found!.origin).toBe("manual");
    expect(found!.storage_path).toBe(storagePath);
  });

  test("signed URL resolves to JSON with correct top-level shape", async () => {
    const { data: signedData, error: signedError } = await userClient.storage
      .from("backups")
      .createSignedUrl(storagePath!, 60);
    expect(signedError).toBeNull();
    expect(signedData?.signedUrl).toBeTruthy();

    const res = await fetch(signedData!.signedUrl);
    expect(res.ok).toBe(true);

    const json = await res.json() as Record<string, unknown>;
    // Verify the five required top-level keys from fullExport's return shape.
    expect(json).toHaveProperty("periods");
    expect(json).toHaveProperty("projects");
    expect(json).toHaveProperty("jurors");
    expect(json).toHaveProperty("scores");
    expect(json).toHaveProperty("audit_logs");
    expect(Array.isArray(json.periods)).toBe(true);
    expect(Array.isArray(json.projects)).toBe(true);
    expect(Array.isArray(json.jurors)).toBe(true);
    expect(Array.isArray(json.scores)).toBe(true);
    expect(Array.isArray(json.audit_logs)).toBe(true);
  });

  test("rpc_backup_delete removes the backup row from the list", async () => {
    const capturedId = backupId!;

    const { data: deleteData, error: deleteError } = await userClient.rpc("rpc_backup_delete", {
      p_backup_id: capturedId,
    });
    expect(deleteError).toBeNull();

    // The RPC returns the storage path for the Storage remove step.
    const path = Array.isArray(deleteData)
      ? (deleteData[0] as { storage_path?: string })?.storage_path
      : (deleteData as { storage_path?: string } | null)?.storage_path;
    if (path) {
      await userClient.storage.from("backups").remove([path]).catch(() => {});
    }

    // Mark as cleaned so afterAll does not attempt a second delete.
    backupId = null;

    const { data: listAfter } = await userClient.rpc("rpc_backup_list", {
      p_organization_id: E2E_PERIODS_ORG_ID,
    });
    const stillThere = (listAfter as Array<{ id: string }> || []).find(
      (b) => b.id === capturedId,
    );
    expect(stillThere).toBeUndefined();
  });
});
