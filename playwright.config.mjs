import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
const systemChromium =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  use: {
    headless: true,
    launchOptions: {
      executablePath: systemChromium,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "phone",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: [
    {
      command: "npm run preview --workspace @onebite/pos",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
    },
    {
      command: "npm run preview --workspace @onebite/admin",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: true,
    },
  ],
});
