import { redis } from "./rateLimiter";

const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export async function recordFailedAttempt(email: string): Promise<number> {
  const key = `lockout:${email.toLowerCase()}`;
  const current = await redis.incr(key);
  
  if (current === 1) {
    // Set expiration on first failed attempt
    await redis.pexpire(key, LOCKOUT_DURATION_MS);
  }
  
  return current;
}

export async function isAccountLocked(email: string): Promise<boolean> {
  const key = `lockout:${email.toLowerCase()}`;
  const attempts = await redis.get(key);
  return attempts !== null && parseInt(attempts, 10) >= LOCKOUT_THRESHOLD;
}

export async function clearLockout(email: string): Promise<void> {
  const key = `lockout:${email.toLowerCase()}`;
  await redis.del(key);
}
