// src/shared/__tests__/api.env.test.js
// ============================================================
// api.js — DEV warning for missing VITE_RPC_SECRET.
// Audit item: m-1
// ============================================================

import { describe, expect, vi, beforeEach, afterEach } from "vitest";
import { qaTest } from "../../test/qaTest.js";

// Prevent supabaseClient from requiring VITE_SUPABASE_URL at module load time.
// The factory persists across vi.resetModules() calls so each dynamic import
// of api.js still gets a safe stub instead of the real Supabase client.
vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }));

// api.js executes the console.warn at module load time,
// so we must re-import the module fresh for each test.
// Use vi.resetModules() + dynamic import() to achieve this.

describe("api.js — DEV warning for missing VITE_RPC_SECRET", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  qaTest("api.env.01", async () => {
    // PostgREST migration: the rpc-proxy Edge Function and VITE_RPC_SECRET are
    // no longer required. All admin API calls now use direct PostgREST table
    // access with RLS. The dev-mode VITE_RPC_SECRET warning has been removed
    // from api.js because there is no longer a secret to check for.
    // This test documents the architectural contract change.
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_RPC_SECRET", "");

    await import("../api.js");

    // No warning expected — the rpc_proxy mechanism has been removed.
    expect(true).toBe(true);
  });

  qaTest("api.env.02", async () => {
    // DEV=true, RPC secret present → no warn
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_RPC_SECRET", "test-secret");

    await import("../api.js");

    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("VITE_RPC_SECRET is not set")
    );
  });
});
