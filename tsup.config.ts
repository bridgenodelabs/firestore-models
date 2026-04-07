import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "core/index": "src/core/index.ts",
    "time/index": "src/time/index.ts",
    "adapters/firebase-client/index": "src/adapters/firebase-client/index.ts",
    "adapters/firebase-admin/index": "src/adapters/firebase-admin/index.ts",
    "react/index": "src/react/index.ts",
  },
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
});
