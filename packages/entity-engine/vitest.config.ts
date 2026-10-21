import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "drizzle-orm": path.resolve(__dirname, "../../database/node_modules/drizzle-orm"),
    },
  },
  test: {
    globals: true,
  },
});
