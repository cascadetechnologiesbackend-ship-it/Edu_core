import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCachedSession, requireAuth } from "../serverAuth";
import { auth } from "@/lib/auth";
import { db } from "@/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/db", () => {
  const mockSelect = vi.fn();
  const mockDb: any = {
    select: mockSelect,
    execute: vi.fn().mockResolvedValue({}),
    transaction: vi.fn(async (cb: (tx: any) => Promise<any>): Promise<any> => cb(mockDb)),
  };
  return {
    db: mockDb,
  };
});

describe("serverAuth Hardened Session & Fail-Closed Checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when auth() returns null or empty user", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);
    const session = await getCachedSession();
    expect(session).toBeNull();
  });

  it("fails closed (returns null) when DB throws an error during status check", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "user-test-1",
        role: "TEACHER",
        email: "teacher@school.edu",
      },
    } as any);

    // Mock db.select chain throwing database connection error
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error("PostgreSQL connection terminated unexpectedly");
    });

    const session = await getCachedSession();
    // Must fail closed, NOT return session
    expect(session).toBeNull();
  });

  it("returns null when user is marked inactive in database", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "user-test-inactive",
        role: "TEACHER",
        email: "teacher@school.edu",
      },
    } as any);

    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ isActive: false }]),
        }),
      }),
    } as any);

    const session = await getCachedSession();
    expect(session).toBeNull();
  });

  it("returns null when user has no matching role in database (stale/revoked session)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "user-test-role-mismatch",
        role: "ADMIN",
        email: "admin@school.edu",
      },
    } as any);

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Query 1: users.isActive -> active
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ isActive: true }]),
            }),
          }),
        } as any;
      } else {
        // Query 2: userRoles innerJoin roles -> empty (role revoked or mismatch)
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        } as any;
      }
    });

    const session = await getCachedSession();
    expect(session).toBeNull();
  });

  it("returns session when user is active and role matches", async () => {
    const validSession = {
      user: {
        id: "user-test-valid",
        role: "TEACHER",
        email: "teacher@school.edu",
      },
    };
    vi.mocked(auth).mockResolvedValue(validSession as any);

    let callCount = 0;
    vi.mocked(db.select).mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ isActive: true }]),
            }),
          }),
        } as any;
      } else {
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ id: "ur-123" }]),
              }),
            }),
          }),
        } as any;
      }
    });

    const session = await getCachedSession();
    expect(session).toEqual(validSession);
  });

  it("requireAuth throws UNAUTHORIZED when session is invalid", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    await expect(requireAuth()).rejects.toThrow("UNAUTHORIZED");
  });
});
