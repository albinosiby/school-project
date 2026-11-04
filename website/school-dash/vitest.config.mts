import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  resolve: { alias: [
    { find: /^@\/test\//, replacement: fileURLToPath(new URL("../shared/testing/", import.meta.url)) },
    { find: "@", replacement: fileURLToPath(new URL("./src/", import.meta.url)) },
  ] },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom", setupFiles: ["../shared/testing/setup.ts"], include: ["src/**/*.test.{ts,tsx}"],
    css: false, restoreMocks: true, pool: "threads", fileParallelism: false, testTimeout: 20000,
    poolOptions: { threads: { singleThread: true, maxThreads: 1, minThreads: 1 } },
  },
});
