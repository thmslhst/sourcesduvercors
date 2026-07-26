import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config. The offline spec manages its own `next start` process (it has
 * to kill and restart the server to simulate airplane mode for both the
 * page and the service worker), so there is no `webServer` block. Run with
 * `npm run test:e2e` — it builds first with NEXT_PUBLIC_E2E=1.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 180_000,
  // One worker: the specs share a server port and the database.
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Pixel 7"], // mobile-first product, test it that way
    locale: "fr-FR",
  },
});
