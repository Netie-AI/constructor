// Playwright config for the Constructor skin (static site, chromium only).
// Port 8125 is ours; 8123 belongs to another lane's http-server.
const { defineConfig, devices } = require("@playwright/test");

const PORT = 8125;
const BASE_URL = "http://127.0.0.1:" + PORT;

module.exports = defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 10000 },
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    screenshot: "on",
    trace: "retain-on-failure",
    acceptDownloads: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: "npx http-server -p " + PORT + " -s -c-1 .",
    url: BASE_URL + "/index.html",
    reuseExistingServer: !!process.env.CI,
    timeout: 30000,
  },
});
