import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString:
      process.env["DATABASE_URL"] ??
      "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp",
  },
  verbose: true,
  strict: true,
});
