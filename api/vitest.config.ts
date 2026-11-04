import { defineConfig } from "vitest/config";

export default defineConfig({
  // API tests share one PostgreSQL database, so files run one after another.
  test: { environment: "node", include: ["api/test/**/*.test.ts"], fileParallelism: false },
});
