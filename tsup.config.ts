import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    target: "node20",
    clean: true,
    sourcemap: false,
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    target: "node20",
    banner: { js: "#!/usr/bin/env node" },
    external: ["playwright", "@resvg/resvg-js"],
  },
]);
