import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Logic-only tests (helpers, mappers, routing rules) in Node; the browser covers the UI.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
