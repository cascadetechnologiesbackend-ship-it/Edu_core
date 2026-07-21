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

  const session = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.sessionToken, tokenHash),
      gt(sessions.expiresAt, new Date()),
      isNull(sessions.revokedAt),
    ),
  });

  if (!session) return null;

  // Revoke old session (rotation)
  await db.update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, session.id));

  // Issue new session
  const newToken = await createRefreshSession(session.userId, ipAddress, userAgent);
  return { newToken, userId: session.userId };
}

export async function revokeAllUserSessions(userId: string) {
  await db.update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
