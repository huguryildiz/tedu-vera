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
  outputDir: "test-results/playwright-artifacts",
  timeout: 30_000,
  workers: process.env.CI ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
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
  webServer: {
    // Port 5174 keeps the E2E server isolated from the dev server (5173),
    // so reuseExistingServer never accidentally picks up a dev server that
    // was started with .env.local (prod Supabase) instead of .env.e2e.local.
    // --force re-optimizes Vite deps to avoid 504 "Outdated Optimize Dep" on fresh starts.
    command: "npm run dev -- --port 5174 --force",
    env: webServerEnv,
    url: process.env.E2E_BASE_URL || "http://localhost:5174",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
