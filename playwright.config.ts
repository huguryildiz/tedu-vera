import { defineConfig } from "@playwright/test";
import { config } from "dotenv";
config({ path: ".env.local" }); // load local E2E secrets (gitignored)

export default defineConfig({
  testDir: "./e2e",
  outputDir: "test-results/playwright-artifacts",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ["list"],
    ["html", { outputFolder: "test-results/playwright-report", open: "never" }],
    ["json", { outputFile: "test-results/playwright-results.json" }],
  ],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
