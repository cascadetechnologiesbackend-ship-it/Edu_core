export function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build") {
      throw new Error(
        "FATAL: AUTH_SECRET (or NEXTAUTH_SECRET) is required for refresh token signing in production. Refusing to run with insecure fallback.",
      );
    }
    return new TextEncoder().encode(
      "schoolmitra-erp-auth-secret-fallback-key-min-64-characters-long-key!!",
    );
  }
  return new TextEncoder().encode(secret);
}
