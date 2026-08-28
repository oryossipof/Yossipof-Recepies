import { defineConfig } from "vitest/config";
import path from "node:path";

// Kept apart from vite.config.ts on purpose: the app's build config carries the
// PWA plugin and its whole service-worker pipeline, none of which a unit test
// needs, and the deploy build has no reason to load a test runner.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    // sanitize-html and everything built on it run on DOMParser, so the tests
    // need a DOM rather than bare Node.
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
