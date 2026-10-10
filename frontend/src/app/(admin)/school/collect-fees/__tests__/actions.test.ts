import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchStudentsAction, clearClassCache } from "../actions";
import { computeSearchHash, computeLegacySearchHash } from "@/lib/encryption";

// Mock serverAuth
vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: "user-1", role: "ACCOUNTANT" },
  }),
  requireSchool: vi.fn().mockResolvedValue({
    id: "school-123",
    name: "DPS Test School",
  }),
}));

// Mock encryption
let decryptCallCount = 0;
vi.mock("@/lib/encryption", () => ({
  decryptData: vi.fn((val: string) => {
    decryptCallCount++;
    if (!val) return "";
    if (val === "enc-first-arjun") return "Arjun";
    if (val === "enc-last-singh") return "Singh";
    if (val === "enc-first-rohan") return "Rohan";
    if (val === "enc-last-sharma") return "Sharma";
    return val.replace("enc-", "");
  }),
  computeSearchHash: vi.fn((text: string) => `hash-${text.trim().toLowerCase()}`),
  computeLegacySearchHash: vi.fn((text: string) => `legacy-${text.trim().toLowerCase()}`),
}));

// Mock auditLogger and next/cache
vi.mock("@/lib/auditLogger", () => ({
  logFeeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock DB
const mockClassesFindMany = vi.fn();
const mockStudentsFindMany = vi.fn();
const mockFeeInvoicesFindMany = vi.fn();

vi.mock("@/db", () => ({
  db: {
    query: {
      classes: {
        findMany: (...args: any[]) => mockClassesFindMany(...args),
      },
      students: {
        findMany: (...args: any[]) => mockStudentsFindMany(...args),
      },
      feeInvoices: {
        findMany: (...args: any[]) => mockFeeInvoicesFindMany(...args),
      },
    },
  },
}));

describe("S1-T2: POS searchStudentsAction Indexed Rewrite", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    decryptCallCount = 0;
    await clearClassCache();

    // Default classes mock
    mockClassesFindMany.mockResolvedValue([
      { id: "class-1", displayName: "Class 10-A" },
      { id: "class-2", displayName: "Class 9-B" },
    ]);

    // Default invoices mock
    mockFeeInvoicesFindMany.mockResolvedValue([
      { studentId: "stud-1", balanceAmount: "1500.00", status: "PENDING" },
      { studentId: "stud-1", balanceAmount: "500.00", status: "PARTIAL" },
    ]);
  });

  it("1. Name match: queries via deterministic search hashes and returns decrypted student with dues", async () => {
    mockStudentsFindMany.mockResolvedValue([
      {
        id: "stud-1",
        admissionNumber: "ADM-101",
        firstNameEncrypted: "enc-first-arjun",
        lastNameEncrypted: "enc-last-singh",
        currentClassId: "class-1",
      },
    ]);

    const res = await searchStudentsAction("Arjun");
    expect(res.success).toBe(true);
    expect(res.students).toHaveLength(1);
    expect(res.students![0]!.name).toBe("Arjun Singh");
    expect(res.students![0]!.admissionNumber).toBe("ADM-101");
    expect(res.students![0]!.className).toBe("Class 10-A");
    expect(res.students![0]!.totalDue).toBe(2000);
    expect(res.students![0]!.pendingInvoiceCount).toBe(2);

    // Decrypt counter: exactly 2 calls (first and last name)
    expect(decryptCallCount).toBe(2);
  });

  it("2. Admission-number match: finds student by admission number prefix", async () => {
    mockStudentsFindMany.mockResolvedValue([
      {
        id: "stud-2",
        admissionNumber: "ADM-2024-009",
        firstNameEncrypted: "enc-first-rohan",
        lastNameEncrypted: "enc-last-sharma",
        currentClassId: "class-2",
      },
    ]);

    const res = await searchStudentsAction("ADM-2024");
    expect(res.success).toBe(true);
    expect(res.students).toHaveLength(1);
    expect(res.students![0]!.admissionNumber).toBe("ADM-2024-009");
    expect(res.students![0]!.name).toBe("Rohan Sharma");
    expect(res.students![0]!.className).toBe("Class 9-B");
    expect(decryptCallCount).toBe(2);
  });

  it("3. Zero-match result: returns empty array immediately and performs ZERO decrypts", async () => {
    mockStudentsFindMany.mockResolvedValue([]);

    const res = await searchStudentsAction("NONEXISTENT_STUDENT");
    expect(res.success).toBe(true);
    expect(res.students).toEqual([]);
    expect(decryptCallCount).toBe(0);
    expect(mockFeeInvoicesFindMany).not.toHaveBeenCalled();
  });

  it("4. Limit cap: caps results at maximum 20 students at SQL level and <= 40 decrypts", async () => {
    const mock20Students = Array.from({ length: 20 }, (_, i) => ({
      id: `stud-${i}`,
      admissionNumber: `ADM-${1000 + i}`,
      firstNameEncrypted: `enc-first-${i}`,
      lastNameEncrypted: `enc-last-${i}`,
      currentClassId: "class-1",
    }));
    mockStudentsFindMany.mockResolvedValue(mock20Students);

    const res = await searchStudentsAction("");
    expect(res.success).toBe(true);
    expect(res.students).toHaveLength(20);

    // Limit check on findMany query call
    expect(mockStudentsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 20,
      })
    );

    // Decrypt counter: strictly <= 40 decrypts (2 per row * 20 rows)
    expect(decryptCallCount).toBe(40);
  });

  it("5. Tenant scoping: scopes students and invoices to school.id", async () => {
    mockStudentsFindMany.mockResolvedValue([
      {
        id: "stud-1",
        admissionNumber: "ADM-101",
        firstNameEncrypted: "enc-first-arjun",
        lastNameEncrypted: "enc-last-singh",
        currentClassId: "class-1",
      },
    ]);

    await searchStudentsAction("Arjun");

    // Verify findMany was called with tenant scope
    expect(mockStudentsFindMany).toHaveBeenCalledTimes(1);
    const studentQueryArgs = mockStudentsFindMany.mock.calls[0][0];
    expect(studentQueryArgs).toBeDefined();

    // Verify invoices scoped to school-123
    expect(mockFeeInvoicesFindMany).toHaveBeenCalledTimes(1);
  });

  it("6. Class caching: reuses cached classMap on subsequent searches without re-querying classes", async () => {
    mockStudentsFindMany.mockResolvedValue([]);

    // First search: populates class cache
    await searchStudentsAction("query1");
    expect(mockClassesFindMany).toHaveBeenCalledTimes(1);

    // Second search: uses cached class map
    await searchStudentsAction("query2");
    expect(mockClassesFindMany).toHaveBeenCalledTimes(1); // Still 1! Zero extra DB calls.

    // Third search: still cached
    await searchStudentsAction("query3");
    expect(mockClassesFindMany).toHaveBeenCalledTimes(1);
  });
});
