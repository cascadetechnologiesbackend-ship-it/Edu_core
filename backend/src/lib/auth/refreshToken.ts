import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import crypto from "crypto";

const REFRESH_TOKEN_EXPIRY_DAYS = 7;

export function generateRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createRefreshSession(
  userId: string,
  ipAddress: string,
  userAgent: string,
): Promise<string> {
  const rawToken = generateRefreshToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({
    userId,
    sessionToken: tokenHash, // stored as hash
    ipAddress,
    userAgent,
    expiresAt,
  });

  return rawToken; // return raw token to set in HttpOnly cookie
}

export async function rotateRefreshSession(
  rawToken: string,
  ipAddress: string,
  userAgent: string,
): Promise<{ newToken: string; userId: string } | null> {
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  return await db.transaction(async (tx) => {
    // Atomically claim and revoke the existing refresh session once
    const [revoked] = await tx
      .update(sessions)
      .set({ revokedAt: now })
      .where(
        and(
          eq(sessions.sessionToken, tokenHash),
          gt(sessions.expiresAt, now),
          isNull(sessions.revokedAt),
        ),
      )
      .returning({ id: sessions.id, userId: sessions.userId });

    if (!revoked) return null;

    // Issue new session within the same transaction
    const newToken = generateRefreshToken();
    const newTokenHash = hashToken(newToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await tx.insert(sessions).values({
      userId: revoked.userId,
      sessionToken: newTokenHash,
      ipAddress,
      userAgent,
      expiresAt,
    });

    return { newToken, userId: revoked.userId };
  });
}

export async function revokeAllUserSessions(userId: string) {
  await db.update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
