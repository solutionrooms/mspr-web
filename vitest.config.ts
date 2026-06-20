import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The whole point of this project: bit-exact comparison. No retries, no
    // randomized order — determinism hygiene applies to the test runner too.
    sequence: { shuffle: false },
    watch: false,
  },
});
