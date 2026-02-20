import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/__tests__/**/*.test.ts",
      "channels/*/__tests__/**/*.test.ts",
    ],
    globals: false,
    testTimeout: 10_000,
  },
});
