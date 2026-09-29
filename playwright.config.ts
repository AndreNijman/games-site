import { defineConfig, devices } from "@playwright/test";
// Serves the built site (npm run build first) and runs the suites in all three
// engines. --ignore-lock keeps `astro preview` in the foreground: Astro 7
// backgrounds it and exits when it thinks an agent started it, which
// Playwright reads as the server dying.
const BASE = process.env.BASE_URL ?? "http://localhost:4321";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: BASE, contextOptions: { reducedMotion: "reduce" } },
  webServer: process.env.BASE_URL ? undefined : { command: "npx astro preview --port 4321 --ignore-lock", url: BASE, reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
