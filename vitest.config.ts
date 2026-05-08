import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // server-only is a Next.js bundler marker; alias to empty in tests so
      // server-only modules can be imported by vitest in Node.
      "server-only": path.resolve(__dirname, "lib/test/server-only-shim.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/.next/**"],
  },
});
