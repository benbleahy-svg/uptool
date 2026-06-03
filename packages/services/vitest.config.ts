import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgresql://uptool:uptool@localhost:5432/uptool_test";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Creates + migrates the dedicated `uptool_test` DB once before the suite.
    globalSetup: ["./src/__tests__/helpers/global-setup.ts"],
    // Point the @uptool/db singleton at the test DB inside worker processes.
    env: { DATABASE_URL: TEST_DATABASE_URL },
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
