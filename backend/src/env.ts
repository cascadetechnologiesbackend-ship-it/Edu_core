import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  IMPERSONATION_SECRET: z.string().min(32, "IMPERSONATION_SECRET must be at least 32 characters").optional(),
  ENCRYPTION_KEY: z
    .string()
    .length(64, "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"),
  // Optional in dev/test, but required in production
  S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
});

function validateEnv() {
  const isProd = process.env.NODE_ENV === "production";

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missingOrInvalid = result.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`,
    );

    if (isProd) {
      console.error("FATAL: Environment validation failed in production:");
      missingOrInvalid.forEach((msg) => console.error(`  - ${msg}`));
      process.exit(1);
    } else {
      console.warn("⚠️ Warning: Development environment variable issues:");
      missingOrInvalid.forEach((msg) => console.warn(`  - ${msg}`));
    }
  }

  if (isProd) {
    const missingProdStorage: string[] = [];
    if (!process.env.S3_BUCKET && !process.env.S3_BUCKET_DOCUMENTS) {
      missingProdStorage.push("S3_BUCKET (or S3_BUCKET_DOCUMENTS)");
    }
    if (!process.env.AWS_ACCESS_KEY_ID && !process.env.S3_ACCESS_KEY_ID) {
      missingProdStorage.push("AWS_ACCESS_KEY_ID (or S3_ACCESS_KEY_ID)");
    }
    if (!process.env.AWS_SECRET_ACCESS_KEY && !process.env.S3_SECRET_ACCESS_KEY) {
      missingProdStorage.push("AWS_SECRET_ACCESS_KEY (or S3_SECRET_ACCESS_KEY)");
    }

    if (missingProdStorage.length > 0) {
      console.error(
        "FATAL: Missing production storage environment variables:\n" +
          missingProdStorage.map((s) => `  - ${s}`).join("\n"),
      );
      process.exit(1);
    }
  }

  return process.env;
}

export const env = validateEnv();
