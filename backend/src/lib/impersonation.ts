import crypto from "crypto";

export interface ImpersonationPayload {
  superAdminId: string;
  superAdminEmail: string;
  schoolId: string;
  schoolName: string;
  role: "SCHOOL_ADMIN";
  exp: number; // Unix timestamp (ms)
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is required to sign impersonation tokens in production.");
  }
  return secret || "local-schoolmitra-impersonation-signing-secret-key-32b";
}

/**
 * Signs an impersonation payload with HMAC-SHA256 to ensure authenticity.
 */
export function signImpersonationToken(
  payload: Omit<ImpersonationPayload, "exp">,
  ttlMinutes = 60,
): string {
  const fullPayload: ImpersonationPayload = {
    ...payload,
    exp: Date.now() + ttlMinutes * 60 * 1000,
  };

  const payloadStr = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const hmac = crypto
    .createHmac("sha256", getSecret())
    .update(payloadStr)
    .digest("base64url");

  return `${payloadStr}.${hmac}`;
}

/**
 * Cryptographically verifies an impersonation token.
 * Returns the payload if valid and not expired, null otherwise.
 */
export function verifyImpersonationToken(token?: string | null): ImpersonationPayload | null {
  if (!token) return null;

  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payloadStr, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", getSecret())
      .update(payloadStr!)
      .digest("base64url");

    // Timing-safe comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature!);
    const expBuf = Buffer.from(expectedSignature);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload: ImpersonationPayload = JSON.parse(
      Buffer.from(payloadStr!, "base64url").toString("utf8"),
    );

    // Expiration check
    if (Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}
