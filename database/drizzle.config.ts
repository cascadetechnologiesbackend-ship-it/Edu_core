import { defineConfig } from "drizzle-kit";
import { getMigrationDatabaseUrl, loadLocalEnvFiles } from "./src/neonEnv";

loadLocalEnvFiles();

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  driver: "pg",
  dbCredentials: {
    connectionString: getMigrationDatabaseUrl(),
  },
  verbose: true,
  strict: true,
});
