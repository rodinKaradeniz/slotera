import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Logic tests run in Node; a component or hook test opts into jsdom with a
// `// @vitest-environment jsdom` first line.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
