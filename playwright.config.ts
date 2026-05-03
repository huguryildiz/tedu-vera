import { defineConfig } from "@playwright/test";
import { config } from "dotenv";
// Prefer dedicated E2E env file to avoid mixing prod/demo credentials.
// Fallback to .env.local for backward compatibility.
config({ path: ".env.e2e.local", override: true });
config({ path: ".env.local", override: false });

const e2eWebEnv = {
  ...process.env,
  // Force Vite to run against E2E credentials, not default local/prod values.
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY,
  VITE_RPC_SECRET: process.env.VITE_RPC_SECRET,
};
const webServerEnv: Record<string, string> = Object.fromEntries(
  Object.entries(e2eWebEnv).filter((entry): entry is [string, string] => typeof entry[1] === "string")
);

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/legacy/**"],
  globalSetup: "./e2e/global.setup.ts",
  outputDir: "test-results/playwright-artifacts",
  // Remove platform suffix so darwin-generated snapshots work on linux CI.
  // {testFileDir} preserves the spec's subdirectory (e.g. "visual/") so
  // snapshots resolve next to the test file, not at the testDir root.
  snapshotPathTemplate: "{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}",
  timeout: 30_000,
  // E2E specs mutate shared local-Supabase fixture state. CI jobs are already
  // isolated by workflow job/shard, so keep each job single-worker to avoid
  // cross-spec races inside the same database.
  workers: process.env.CI ? 1 : undefined,
  // PR run'da retry kapalı (hızlı feedback); main push'ta retry açık (flaky koruması)
  retries: process.env.CI
    ? (process.env.GITHUB_EVENT_NAME === "pull_request" ? 0 : 1)
    : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/playwright-results.json" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5174",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      // Admin tests reuse a pre-authenticated session — skips the login form in every test.
      // maintenance-mode mutates a global platform setting (maintenance_mode singleton)
      // that blocks every non-super-admin page render — must run isolated.
      name: "admin",
      testMatch: /e2e\/admin\//,
      testIgnore: /e2e\/admin\/maintenance-mode\.spec\.ts/,
      use: { storageState: "e2e/.auth/admin.json" },
    },
    {
      // Auth/jury/demo tests intentionally start unauthenticated.
      name: "other",
      testIgnore: [
        /e2e\/admin\//,
        /e2e\/a11y\//,
        /e2e\/perf\//,
        /e2e\/visual\//,
        /e2e\/screenshots\//,
      ],
    },
    {
      // Global-state mutation specs — must run with no parallel workers because
      // they toggle platform-wide flags (maintenance_mode) that other tests read.
      name: "maintenance",
      testMatch: /e2e\/admin\/maintenance-mode\.spec\.ts/,
      use: { storageState: "e2e/.auth/admin.json" },
      fullyParallel: false,
    },
    {
      // Accessibility smoke — nightly only via the e2e.yml schedule cron.
      name: "a11y",
      testMatch: /e2e\/a11y\//,
      use: { storageState: "e2e/.auth/admin.json" },
    },
    {
      // Visual regression — nightly only via the e2e.yml schedule cron.
      name: "visual",
      testMatch: /e2e\/visual\//,
      use: { storageState: "e2e/.auth/admin.json" },
    },
    {
      // Performance — concurrent-jury load test, manual via perf.yml dispatch.
      name: "perf",
      testMatch: /e2e\/perf\//,
    },
    {
      // Product-tour screenshots — captured against /demo/* (DemoAdminLoader handles auth).
      // Run manually via `npm run screenshots`; CI drift check via screenshots.yml.
      // Not in the default PR matrix.
      name: "screenshots",
      testMatch: /e2e\/screenshots\/[^_].*\.spec\.(ts|js)$/,
    },
  ],
  webServer: {
    // Port 5174 keeps the E2E server isolated from the dev server (5173),
    // so reuseExistingServer never accidentally picks up a dev server that
    // was started with .env.local (prod Supabase) instead of .env.e2e.local.
    command: "npm run dev -- --port 5174 --mode e2e",
    env: webServerEnv,
    url: process.env.E2E_BASE_URL || "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
