import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { auth } from "@/lib/auth";
import { db } from "@/db";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/examPermissions", () => ({
  assertTeacherTeaches: vi.fn(),
}));

vi.mock("@/lib/encryption", () => ({
  decryptData: vi.fn((val: string) => val),
}));

vi.mock("@/db", () => {
  const mockInsert = vi.fn(() => ({
    values: vi.fn().mockResolvedValue([{ id: "mock-audit-id" }]),
  }));
  return {
    db: {
      query: {
        exams: {
          findFirst: vi.fn(),
        },
        markEntries: {
          findMany: vi.fn(),
        },
        students: {
          findMany: vi.fn(),
        },
        subjects: {
          findMany: vi.fn(),
        },
      },
      insert: mockInsert,
    },
  };
});

describe("Sprint S12.1 Layer 3: Staff Exam Results API Tenant Guard (SEC-API-003)", () => {
  const schoolAId = "a1111111-1111-4111-8111-111111111111";
  const schoolBId = "b1111111-1111-4111-8111-111111111111";
  const examAId = "aaaaaaa1-1111-4aaa-8aaa-111111111111";
  const examBId = "bbbbbbb1-1111-4bbb-8bbb-111111111111";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("3.1: Unauthenticated request returns HTTP 401 Unauthorized", async () => {
    vi.mocked(auth).mockResolvedValue(null as any);

    const req = new Request("http://localhost:3000/api/staff/exam-results/exam-123");
    const res = await GET(req, { params: { examId: "exam-123" } });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("3.2: Unauthorized role (e.g. STUDENT) returns HTTP 403 Forbidden", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "student-1",
        role: "STUDENT",
        schoolId: schoolAId,
      },
    } as any);

    const req = new Request("http://localhost:3000/api/staff/exam-results/exam-123");
    const res = await GET(req, { params: { examId: "exam-123" } });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Forbidden");
  });

  it("3.3: Authenticated non-SUPER_ADMIN with missing schoolId is denied (HTTP 403)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "teacher-no-school",
        role: "TEACHER",
        schoolId: null, // missing tenant context
      },
    } as any);

    const req = new Request(`http://localhost:3000/api/staff/exam-results/${examAId}`);
    const res = await GET(req, { params: { examId: examAId } });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden: tenant school scope required for staff examination access");
  });

  it("3.4: Cross-tenant access: School A admin cannot access School B exam (HTTP 404 zero disclosure)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "admin-a",
        role: "SCHOOL_ADMIN",
        schoolId: schoolAId,
        email: "admin.a@isolation.internal",
      },
    } as any);

    // Scoped lookup for exam under School A returns undefined
    vi.mocked(db.query.exams.findFirst).mockResolvedValue(undefined as any);

    const req = new Request(`http://localhost:3000/api/staff/exam-results/${examBId}`);
    const res = await GET(req, { params: { examId: examBId } });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Exam not found");
  });

  it("3.5: Same-tenant access: School A admin accesses School A exam results (HTTP 200)", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "admin-a",
        role: "SCHOOL_ADMIN",
        schoolId: schoolAId,
        email: "admin.a@isolation.internal",
      },
    } as any);

    vi.mocked(db.query.exams.findFirst).mockResolvedValue({
      id: examAId,
      name: "Midterm Exam",
      schoolId: schoolAId,
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-10"),
      isLocked: false,
    } as any);

    vi.mocked(db.query.markEntries.findMany).mockResolvedValue([
      {
        id: "mark-1",
        examId: examAId,
        schoolId: schoolAId,
        studentId: "student-1",
        subjectId: "subject-1",
        marksObtained: 85,
        maxMarks: 100,
        isAbsent: false,
        isMedicalExempt: false,
      },
    ] as any);

    vi.mocked(db.query.students.findMany).mockResolvedValue([
      {
        id: "student-1",
        schoolId: schoolAId,
        admissionNumber: "ADM-101",
        firstNameEncrypted: "John",
        lastNameEncrypted: "Doe",
      },
    ] as any);

    vi.mocked(db.query.subjects.findMany).mockResolvedValue([
      {
        id: "subject-1",
        schoolId: schoolAId,
        name: "Mathematics",
      },
    ] as any);

    const req = new Request(`http://localhost:3000/api/staff/exam-results/${examAId}`);
    const res = await GET(req, { params: { examId: examAId } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.exam.id).toBe(examAId);
    expect(body.count).toBe(1);
    expect(body.results[0].studentName).toBe("John Doe");
    expect(body.results[0].subjectName).toBe("Mathematics");
  });

  it("3.6: SUPER_ADMIN can query across schools via explicit administrative path", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: "super-admin-root",
        role: "SUPER_ADMIN",
        schoolId: null,
        email: "superadmin@schoolmitra.internal",
      },
    } as any);

    vi.mocked(db.query.exams.findFirst).mockResolvedValue({
      id: examBId,
      name: "Term 1 School B Exam",
      schoolId: schoolBId,
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-10"),
      isLocked: false,
    } as any);

    vi.mocked(db.query.markEntries.findMany).mockResolvedValue([]);
    vi.mocked(db.query.students.findMany).mockResolvedValue([]);
    vi.mocked(db.query.subjects.findMany).mockResolvedValue([]);

    const req = new Request(`http://localhost:3000/api/staff/exam-results/${examBId}`);
    const res = await GET(req, { params: { examId: examBId } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.exam.id).toBe(examBId);
  });
});
