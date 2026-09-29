// games.andrenijman.com: the hub page, built with Astro the way andrenijman.com
// and rimeos.com are. The games-guard Worker in worker/ sits in front of it
// and of every game host; it is deployed separately (npm run deploy).
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://games.andrenijman.com",
  output: "static",
  build: { format: "file", inlineStylesheets: "never" },
  trailingSlash: "never",
  prefetch: false,
  devToolbar: { enabled: false },
  markdown: { syntaxHighlight: false },
  // No data: URIs: every asset is a file the Worker can cache on its own.
  vite: { build: { assetsInlineLimit: 0 } },
});
