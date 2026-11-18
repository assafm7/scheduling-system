import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    // Deterministic dates: every test runs in UTC regardless of the machine's zone.
    env: { TZ: "UTC" },
    // antd under jsdom is slow, especially with coverage on and all files in parallel; give
    // interaction-heavy form tests headroom instead of letting them flake.
    testTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/test/**", "src/**/*.test.{ts,tsx}", "src/app/layout.tsx"],
      reporter: ["text", "text-summary", "html"],
    },
  },
});
