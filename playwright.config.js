// @ts-check
const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "e2e",
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3456",
    headless: true,
  },
  webServer: {
    command: "npx --yes serve -l 3456",
    url: "http://127.0.0.1:3456",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
