/**
 * Browser tests (Playwright). Run with `npm run e2e`, which builds the frontend first.
 *
 * Starts its own API (with a fresh, temporary SQLite database and the sample
 * data) and frontend on ports 8000 and 3000. If something is already running on
 * those ports, it stops instead of reusing it, so it never touches your data.
 * Needs the backend's Python packages; set PYTHON if `python` isn't the right one.
 */
import os from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Set once in the main process; test workers inherit it, so everyone agrees on the path.
process.env.BAD_E2E_DB ??= path.join(os.tmpdir(), `bad-e2e-${Date.now()}.db`);

const APP_URL = "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // Tests share one database (scores, edits, accounts), so run them one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: APP_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: `${process.env.PYTHON ?? "python"} -m uvicorn backend.main:app --host 127.0.0.1 --port 8000`,
      cwd: "..",
      // 127.0.0.1, not localhost: localhost can resolve to IPv6, where uvicorn isn't listening.
      url: "http://127.0.0.1:8000/health",
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        DATABASE_URL: `sqlite:///${process.env.BAD_E2E_DB}`,
        SECRET_KEY: "browser-tests-only-not-a-real-secret-key",
        SEED_SAMPLE_DATA: "true",
        ALLOW_REGISTRATION: "true",
        CORS_ORIGINS: APP_URL,
      },
    },
    {
      command: "npx next start -p 3000",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
