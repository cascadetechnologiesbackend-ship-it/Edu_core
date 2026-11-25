import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next-auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// Mock tenant contexts to provide controlled tx clients
const mockTx = {
  select: vi.fn(),
};

vi.mock("../tenant", () => ({
  withTenant: vi.fn(async (_schoolId, cb) => cb(mockTx)),
  withAuthContext: vi.fn(async (cb) => cb(mockTx)),
  withPlatformContext: vi.fn(async (cb) => cb(mockTx)),
}));

import { auth } from "@/lib/auth";
import { getCachedSession, requireAuth } from "../serverAuth";

describe("Super Admin Session Validation & Revocation (EDU-P2-002)", () => {
  const validAdminId = "a1111111-1111-4111-8111-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates active SUPER_ADMIN user with valid platform role", async () => {
    (auth as any).mockResolvedValue({
      user: {
        id: validAdminId,
        role: "SUPER_ADMIN",
        email: "superadmin@schoolmitra.com",
      },
    });

    mockTx.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ isActive: true }]),
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "role-1" }]),
          }),
        }),
      }),
    }));

    const session = await getCachedSession();
    expect(session).not.toBeNull();
    expect(session?.user?.role).toBe("SUPER_ADMIN");
  });

  it("fails closed when SUPER_ADMIN account is deactivated (isActive = false)", async () => {
    (auth as any).mockResolvedValue({
      user: {
        id: validAdminId,
        role: "SUPER_ADMIN",
        email: "deactivated@schoolmitra.com",
      },
    });

    mockTx.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ isActive: false }]),
        }),
      }),
    }));

    const session = await getCachedSession();
    // Must return null, invalidating the session immediately
    expect(session).toBeNull();
  });

  it("fails closed when SUPER_ADMIN role has been revoked in database", async () => {
    (auth as any).mockResolvedValue({
      user: {
        id: validAdminId,
        role: "SUPER_ADMIN",
        email: "revoked@schoolmitra.com",
      },
    });

    mockTx.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ isActive: true }]),
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No matching role
          }),
        }),
      }),
    }));

    const session = await getCachedSession();
    // Must return null because role was revoked
    expect(session).toBeNull();
  });

  it("fails closed when database connection or query throws", async () => {
    (auth as any).mockResolvedValue({
      user: {
        id: validAdminId,
        role: "SUPER_ADMIN",
        email: "err@schoolmitra.com",
      },
    });

    mockTx.select.mockImplementation(() => {
      throw new Error("DB Connection Pool Timeout");
    });

    const session = await getCachedSession();
    expect(session).toBeNull();
  });

  it("requireAuth throws UNAUTHORIZED when session validation returns null", async () => {
    (auth as any).mockResolvedValue({
      user: {
        id: validAdminId,
        role: "SUPER_ADMIN",
        email: "deactivated@schoolmitra.com",
      },
    });

    // Account is deactivated in DB
    mockTx.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ isActive: false }]),
        }),
      }),
    }));

    await expect(requireAuth(["SUPER_ADMIN"])).rejects.toThrow("UNAUTHORIZED");
  });
});
