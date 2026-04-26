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
  timeout: 30_000,
  workers: process.env.CI ? 2 : undefined,
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
      name: "admin",
      testMatch: /e2e\/admin\//,
      use: { storageState: "e2e/.auth/admin.json" },
    },
    {
      // Auth/jury/demo tests intentionally start unauthenticated.
      name: "other",
      testIgnore: /e2e\/admin\//,
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
