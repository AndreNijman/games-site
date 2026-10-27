import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "cloudflare:workers": fileURLToPath(new URL("./tests/unit/cloudflare-workers.js", import.meta.url)) } },
});
