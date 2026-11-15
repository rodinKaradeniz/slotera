import { defineConfig, devices } from "@playwright/test";

// Servers/database are owned by scripts/browser-check; never attach to a developer's app.
if (process.env.SLOTERA_BROWSER_TEST !== "1") throw new Error("Use ./scripts/browser-check from the repository root.");
export default defineConfig({
  testDir: "./e2e", fullyParallel: false, workers: 1, retries: 0,
  forbidOnly: !!process.env.CI, timeout: 45_000, globalTimeout: 600_000,
  reporter: [["./e2e/safe-reporter.ts"]], outputDir: "test-results",
  use: {baseURL: "http://localhost:3345", trace: "off", screenshot: "off", video: "off", serviceWorkers: "block"},
  projects: [
    {name: "desktop", use: {...devices["Desktop Chrome"]}},
    {name: "mobile", use: {...devices["Pixel 7"], defaultBrowserType: "chromium"}},
  ],
});
