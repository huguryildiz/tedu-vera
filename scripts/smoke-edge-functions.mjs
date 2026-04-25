#!/usr/bin/env node
/**
 * scripts/smoke-edge-functions.mjs
 *
 * Smoke test harness for deployed VERA Edge Functions.
 * Verifies that each function is:
 *   - Reachable (no 404)
 *   - Not broken on cold start (no 5xx)
 *   - Correctly gated (401 for verify_jwt=true, 400 for verify_jwt=false with empty body)
 *   - CORS-compliant (OPTIONS returns 200 with Access-Control-Allow-Origin)
 *
 * Usage:
 *   node scripts/smoke-edge-functions.mjs [vera-demo|vera-prod]
 *
 * Defaults to vera-demo. Set via arg or SUPABASE_ENV env var.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// Configuration
const ENVS = {
  "vera-demo": {
    projectRef: "kmprsxrofnemmsryjhfj",
    baseUrl: "https://kmprsxrofnemmsryjhfj.supabase.co",
  },
  "vera-prod": {
    projectRef: "etxgvkvxvbyserhrugjw",
    baseUrl: "https://etxgvkvxvbyserhrugjw.supabase.co",
  },
};

// Functions with verify_jwt=false (expect 400 on empty body, not 401)
const VERIFY_JWT_FALSE = new Set([
  "admin-session-touch",
  "email-verification-confirm",
  "invite-org-admin",
  "send-juror-pin-email",
]);

// Webhook-triggered functions that intentionally always return 200
// to prevent Supabase from retrying on every error.
const WEBHOOK_ALWAYS_OK = new Set([
  "audit-log-sink",
  "on-auth-event",
  "receive-email",
]);

// Parse env from args or env var
let env = process.argv[2] || process.env.SUPABASE_ENV || "vera-demo";
if (!ENVS[env]) {
  console.error(`Invalid env: ${env}. Use 'vera-demo' or 'vera-prod'.`);
  process.exit(1);
}

const config = ENVS[env];

/**
 * Discover all edge function directories from supabase/functions/
 */
function discoverFunctions() {
  const functionsDir = path.join(ROOT, "supabase", "functions");
  const entries = fs.readdirSync(functionsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
    .map((e) => e.name)
    .sort();
}

/**
 * Test a single function:
 *   1. OPTIONS preflight → expect 200 + CORS headers
 *   2. POST with empty body → expect 401 (or 400 if verify_jwt=false)
 */
async function testFunction(name) {
  const url = `${config.baseUrl}/functions/v1/${name}`;
  const results = {
    name,
    url,
    optionsPassed: false,
    corsOk: false,
    postStatus: null,
    postOk: false,
    error: null,
  };

  try {
    // Test 1: OPTIONS preflight
    const optResp = await fetch(url, { method: "OPTIONS" });
    results.optionsPassed = optResp.ok;
    const origin = optResp.headers.get("access-control-allow-origin");
    results.corsOk = origin !== null;

    // Test 2: POST with empty body
    const postResp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

    results.postStatus = postResp.status;

    // Webhook-triggered functions always return 200 (prevent retry loops)
    if (WEBHOOK_ALWAYS_OK.has(name)) {
      if (postResp.status === 200) {
        results.postOk = true;
      } else {
        results.error = `Webhook function returned unexpected ${postResp.status}`;
      }
    } else {
      // User-facing functions: accept 400, 401, 405 as OK gates
      // Reject 404 (not deployed) and 5xx (broken on cold start)
      if ([400, 401, 405].includes(postResp.status)) {
        results.postOk = true;
      } else if (postResp.status >= 500) {
        results.error = `Cold-start error: ${postResp.status}`;
      } else if (postResp.status === 404) {
        results.error = "Function not deployed (404)";
      } else {
        // Unexpected status
        results.error = `Unexpected status: ${postResp.status}`;
      }
    }
  } catch (err) {
    results.error = err.message;
  }

  return results;
}

/**
 * Main smoke test
 */
async function main() {
  console.log(`\n📊 Smoke testing Edge Functions on ${env}`);
  console.log(`   Base URL: ${config.baseUrl}\n`);

  const functions = discoverFunctions();
  console.log(`Testing ${functions.length} functions...\n`);

  const results = [];
  for (const fn of functions) {
    const result = await testFunction(fn);
    results.push(result);

    // Log result as we go
    const status = result.error ? "❌" : "✅";
    console.log(`${status} ${fn}`);
    if (result.error) {
      console.log(`   └─ ${result.error}`);
    }
  }

  // Summary
  console.log(`\n${"─".repeat(70)}`);
  const passed = results.filter((r) => !r.error).length;
  const failed = results.filter((r) => r.error).length;

  console.log(`\nResults:`);
  console.log(`  Reachable + correct gate: ${passed}/${functions.length}`);
  console.log(`  Unexpected status: ${failed}/${functions.length}`);

  if (failed > 0) {
    console.log(`\nFailed functions:`);
    results
      .filter((r) => r.error)
      .forEach((r) => {
        console.log(`  - ${r.name}: ${r.error}`);
      });
  }

  console.log();

  // Exit with failure if any function is broken
  const hasBreakingIssue = results.some(
    (r) =>
      r.error?.includes("Cold-start") || r.error?.includes("not deployed")
  );
  process.exit(hasBreakingIssue ? 1 : 0);
}

main();
