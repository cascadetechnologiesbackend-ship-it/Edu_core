import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgresql://schoolmitra:schoolmitra_dev@localhost:5432/schoolmitra_erp",
  },
  verbose: true,
  strict: true,
});
