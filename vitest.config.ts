import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests only — e2e/*.spec.ts belongs to Playwright.
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", "e2e/**", ".next/**"],
  },
});
