import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    extensions: [".mjs", ".js", ".ts", ".jsx", ".tsx", ".json"],
    alias: [
      { find: /^next\/server$/, replacement: "next/server.js" },
      { find: /^@\/db\/schema$/, replacement: path.resolve(__dirname, "../database/src/schema/index.ts") },
      { find: /^@\/db\/schema\/(.*)$/, replacement: path.resolve(__dirname, "../database/src/schema/$1") },
      { find: /^@\/db$/, replacement: path.resolve(__dirname, "../database/src/index.ts") },
      { find: /^@\/db\/(.*)$/, replacement: path.resolve(__dirname, "../database/src/$1") },
      { find: /^@schoolmitra\/backend\/(.*)$/, replacement: path.resolve(__dirname, "../backend/src/$1") },
      { find: "@schoolmitra/backend", replacement: path.resolve(__dirname, "../backend/src/server/root.ts") },
      { find: /^@schoolmitra\/database\/(.*)$/, replacement: path.resolve(__dirname, "../database/src/$1") },
      { find: "@schoolmitra/database", replacement: path.resolve(__dirname, "../database/src/index.ts") },
      { find: /^@schoolmitra\/entity-engine\/(.*)$/, replacement: path.resolve(__dirname, "../packages/entity-engine/src/$1") },
      { find: "@schoolmitra/entity-engine", replacement: path.resolve(__dirname, "../packages/entity-engine/src/index.ts") },
      { find: /^@\/lib\/pii\/(.*)$/, replacement: path.resolve(__dirname, "./src/lib/pii/$1") },
      { find: /^@\/lib\/offline\/(.*)$/, replacement: path.resolve(__dirname, "./src/lib/offline/$1") },
      { find: /^@\/lib\/(timetableEngine|provisioningEngine|importExportEngine|canonicalBlueprints|requestContext|serverTiming)$/, replacement: path.resolve(__dirname, "./src/lib/$1.ts") },
      { find: /^@\/lib\/(.*)$/, replacement: path.resolve(__dirname, "../backend/src/lib/$1") },
      { find: /^@\/server\/(.*)$/, replacement: path.resolve(__dirname, "../backend/src/server/$1") },
      { find: /^@\/workers\/(.*)$/, replacement: path.resolve(__dirname, "../backend/src/workers/$1") },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "./src/$1") },
    ],
  },
  test: {
    environment: "node",
    globals: true,
    exclude: ["**/node_modules/**", "**/e2e/**", "**/dist/**"],
  },
});
