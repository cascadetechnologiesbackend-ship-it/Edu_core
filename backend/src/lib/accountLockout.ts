import { redis } from "./rateLimiter";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const memoryLockoutMap = new Map<string, { count: number; expiresAt: number }>();

export async function recordFailedAttempt(email: string): Promise<number> {
  const key = `lockout:${email.toLowerCase()}`;
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.pexpire(key, LOCKOUT_DURATION_MS);
    }
    return current;
  } catch {
    const now = Date.now();
    const entry = memoryLockoutMap.get(key);
    if (!entry || entry.expiresAt < now) {
      memoryLockoutMap.set(key, { count: 1, expiresAt: now + LOCKOUT_DURATION_MS });
      return 1;
    }
    entry.count += 1;
    return entry.count;
  }
}

export async function isAccountLocked(email: string): Promise<boolean> {
  const key = `lockout:${email.toLowerCase()}`;
  try {
    const attempts = await redis.get(key);
    return attempts !== null && parseInt(attempts, 10) >= LOCKOUT_THRESHOLD;
  } catch {
    const entry = memoryLockoutMap.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      memoryLockoutMap.delete(key);
      return false;
    }
    return entry.count >= LOCKOUT_THRESHOLD;
  }
}

export async function clearLockout(email: string): Promise<void> {
  const key = `lockout:${email.toLowerCase()}`;
  try {
    await redis.del(key);
  } catch {
    memoryLockoutMap.delete(key);
  }
}
