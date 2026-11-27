import crypto from "crypto";

function getDemoSigningSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "default-schoolmitra-auth-secret-key-32chars-min-len"
  );
}

export interface DemoLaunchPayload {
  userId: string;
  schoolId: string;
  email: string;
  exp: number;
}

export function signDemoLaunchToken(
  userId: string,
  schoolId: string,
  email: string,
  ttlMs = 60_000,
): string {
  const payload: DemoLaunchPayload = {
    userId,
    schoolId,
    email: email.trim().toLowerCase(),
    exp: Date.now() + ttlMs,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", getDemoSigningSecret())
    .update(payloadB64)
    .digest("hex");
  return `${payloadB64}.${sig}`;
}

export function verifyDemoLaunchToken(token: string): DemoLaunchPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadB64, sigHex] = parts;
    if (!payloadB64 || !sigHex) return null;

    const expectedSig = crypto
      .createHmac("sha256", getDemoSigningSecret())
      .update(payloadB64)
      .digest("hex");

    const sigBuf = Buffer.from(sigHex, "hex");
    const expectedBuf = Buffer.from(expectedSig, "hex");
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as DemoLaunchPayload;

    if (!payload.userId || !payload.schoolId || !payload.email || !payload.exp) {
      return null;
    }
    if (Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
