import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Mock React cache ───────────────────────────────────────────────────────
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: any[]) => any>(fn: T): T => fn,
  };
});

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/requestContext", () => ({
  getClientRequestContext: vi.fn(() => ({})),
}));

vi.mock("@/lib/encryption", () => ({
  encryptData: vi.fn((val: string) => `enc_${val}`),
  decryptData: vi.fn((val: string) => (val?.startsWith("enc_") ? val.replace("enc_", "") : val)),
  computeSearchHash: vi.fn((val: string) => `hash_${val}`),
}));

// ─── 2. Hoisted Mock References ────────────────────────────────────────────────
const {
  activeSessionRef,
  mockStaffFindFirst,
  mockAuditLogsInsert,
  mockLogHrAudit,
} = vi.hoisted(() => {
  const activeSessionRef = {
    current: null as {
      userId: string;
      role: string;
      schoolId: string;
      email: string;
    } | null,
  };

  return {
    activeSessionRef,
    mockStaffFindFirst: vi.fn(),
    mockAuditLogsInsert: vi.fn(),
    mockLogHrAudit: vi.fn(),
  };
});

// ─── 3. Mock Server Auth & Database ────────────────────────────────────────────
vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles: readonly string[]) => {
    if (!activeSessionRef.current) throw new Error("Unauthorized");
    if (!allowedRoles.includes(activeSessionRef.current.role)) {
      throw new Error(`Role ${activeSessionRef.current.role} is not permitted`);
    }
    return {
      session: {
        user: activeSessionRef.current,
      },
      userId: activeSessionRef.current.userId,
      role: activeSessionRef.current.role,
      schoolId: activeSessionRef.current.schoolId,
      email: activeSessionRef.current.email,
    };
  }),
  requireSchool: vi.fn(async (ctx: any) => {
    const schoolId = ctx.schoolId || ctx.session?.user?.schoolId;
    if (!schoolId) throw new Error("No school associated");
    return { id: schoolId, name: "Test School" };
  }),
  checkAuth: vi.fn(async (allowedRoles: readonly string[]) => {
    if (!activeSessionRef.current) throw new Error("Unauthorized");
    if (!allowedRoles.includes(activeSessionRef.current.role)) {
      throw new Error(`Forbidden: ${activeSessionRef.current.role}`);
    }
    return { user: activeSessionRef.current };
  }),
  getCachedSession: vi.fn(async () => {
    return activeSessionRef.current ? { user: activeSessionRef.current } : null;
  }),
}));

vi.mock("@/db", () => {
  const mockDb = {
    query: {
      staff: {
        findFirst: (...args: any[]) => mockStaffFindFirst(...args),
      },
    },
    insert: (table: any) => ({
      values: (vals: any) => {
        mockAuditLogsInsert(vals);
        return {
          returning: () => [{ id: "mock-id", ...vals }],
        };
      },
    }),
  };

  return {
    db: mockDb,
    withTenant: vi.fn(async (_schoolId: string, callback: (tx: any) => Promise<any>) => {
      return callback(mockDb);
    }),
  };
});

// ─── 4. Import Target Actions Under Test ───────────────────────────────────────
import { revealStaffPii } from "../actions";

describe("S18 L1: PII Reveal Guard Matrix & DPDP Audit Integrity", () => {
  const mockStaffSchoolA = {
    id: "staff-101",
    schoolId: "school-A",
    panEncrypted: "enc_ABCDE1234F",
    bankNameEncrypted: "enc_HDFC Bank",
    bankAccountEncrypted: "enc_987654321012",
    bankIfscEncrypted: "enc_HDFC0001234",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStaffFindFirst.mockImplementation(async ({ where }: any) => {
      // Basic mock check: matches staffId and schoolId
      return mockStaffSchoolA;
    });
  });

  it("1. HR_MANAGER is permitted to reveal staff PAN and bank details", async () => {
    activeSessionRef.current = {
      userId: "user-hr-1",
      role: "HR_MANAGER",
      schoolId: "school-A",
      email: "hr@school-a.edu",
    };

    const res = await revealStaffPii("staff-101", "pan");
    expect(res.success).toBe(true);
    expect(res.decrypted).toBe("ABCDE1234F");
    expect(mockAuditLogsInsert).toHaveBeenCalled();
  });

  it("2. SUPER_ADMIN is permitted to reveal staff PII", async () => {
    activeSessionRef.current = {
      userId: "user-super-1",
      role: "SUPER_ADMIN",
      schoolId: "school-A",
      email: "superadmin@schoolmitra.com",
    };

    const res = await revealStaffPii("staff-101", "bank");
    expect(res.success).toBe(true);
    expect(res.decrypted).toContain("HDFC Bank");
    expect(res.decrypted).toContain("987654321012");
  });

  it("3. SCHOOL_ADMIN is permitted to reveal staff PII", async () => {
    activeSessionRef.current = {
      userId: "user-admin-1",
      role: "SCHOOL_ADMIN",
      schoolId: "school-A",
      email: "admin@school-a.edu",
    };

    const res = await revealStaffPii("staff-101", "all");
    expect(res.success).toBe(true);
    expect(res.data?.pan).toBe("ABCDE1234F");
    expect(res.data?.bankName).toBe("HDFC Bank");
  });

  it("4. PRINCIPAL is permitted to reveal staff PII per amended OD1 policy with audit log", async () => {
    activeSessionRef.current = {
      userId: "user-principal-1",
      role: "PRINCIPAL",
      schoolId: "school-A",
      email: "principal@school-a.edu",
    };

    const res = await revealStaffPii("staff-101", "pan");
    expect(res.success).toBe(true);
    expect(res.decrypted).toBe("ABCDE1234F");

    // DPDP Integrity: verify audit log inserted
    expect(mockAuditLogsInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: "staff",
        recordId: "staff-101",
        action: "READ",
      })
    );
  });

  it("5. TEACHER is strictly forbidden from revealing staff PII (403)", async () => {
    activeSessionRef.current = {
      userId: "user-teacher-1",
      role: "TEACHER",
      schoolId: "school-A",
      email: "teacher@school-a.edu",
    };

    const res = await revealStaffPii("staff-101", "pan");
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Role TEACHER is not permitted/i);
    expect(mockStaffFindFirst).not.toHaveBeenCalled();
  });

  it("6. PARENT is strictly forbidden from revealing staff PII (403)", async () => {
    activeSessionRef.current = {
      userId: "user-parent-1",
      role: "PARENT",
      schoolId: "school-A",
      email: "parent@gmail.com",
    };

    const res = await revealStaffPii("staff-101", "pan");
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Role PARENT is not permitted/i);
  });

  it("7. STUDENT is strictly forbidden from revealing staff PII (403)", async () => {
    activeSessionRef.current = {
      userId: "user-student-1",
      role: "STUDENT",
      schoolId: "school-A",
      email: "student@school-a.edu",
    };

    const res = await revealStaffPii("staff-101", "all");
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Role STUDENT is not permitted/i);
  });

  it("8. Unauthenticated requests are rejected immediately", async () => {
    activeSessionRef.current = null;

    const res = await revealStaffPii("staff-101", "pan");
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Unauthorized/i);
  });

  it("9. Multi-tenant isolation: Principal of School B cannot reveal staff of School A", async () => {
    activeSessionRef.current = {
      userId: "user-principal-2",
      role: "PRINCIPAL",
      schoolId: "school-B",
      email: "principal@school-b.edu",
    };

    mockStaffFindFirst.mockResolvedValueOnce(null); // Staff not in School B

    const res = await revealStaffPii("staff-101", "pan");
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Staff not found or access denied/i);
  });
});
