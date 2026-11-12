import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const projectRoot = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: projectRoot },
      // Next.js resolves "server-only" internally and no npm package is installed,
      // so tests point it at the no-op build Next.js ships for server code.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(
          new URL("./node_modules/next/dist/compiled/server-only/empty.js", import.meta.url),
        ),
      },
    ],
  },
  test: {
    environment: "node",
  },
});
