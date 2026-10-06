import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@/db/schema", replacement: path.resolve(__dirname, "../database/src/schema/index.ts") },
      { find: "@/db", replacement: path.resolve(__dirname, "../database/src/index.ts") },
      { find: /^@\/db\/(.*)$/, replacement: path.resolve(__dirname, "../database/src/$1") },
      { find: /^@\/lib\/(.*)$/, replacement: path.resolve(__dirname, "../backend/src/lib/$1") },
      { find: /^@\/server\/(.*)$/, replacement: path.resolve(__dirname, "../backend/src/server/$1") },
      { find: /^@\/workers\/(.*)$/, replacement: path.resolve(__dirname, "../backend/src/workers/$1") },
      { find: "@schoolmitra/database", replacement: path.resolve(__dirname, "../database/src/index.ts") },
      { find: "@schoolmitra/backend", replacement: path.resolve(__dirname, "../backend/src/server/root.ts") },
      { find: /^@\/(.*)$/, replacement: path.resolve(__dirname, "./src/$1") },
    ],
  },
  test: {
    environment: "node",
    globals: true,
    exclude: ["**/node_modules/**", "**/e2e/**", "**/dist/**"],
  },
});
