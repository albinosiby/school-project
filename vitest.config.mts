import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit + component tests. Firebase, Next navigation and the Firestore store are replaced by in-memory fakes in
// src/test/setup.ts, so no test ever talks to a Firebase project or an emulator.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    restoreMocks: true,
    // one worker: the dev machine is small (8 GB) and the suite is fast enough serially
    pool: "threads",
    poolOptions: { threads: { singleThread: true, maxThreads: 1, minThreads: 1 } },
    fileParallelism: false,
    testTimeout: 20000,
  },
});
