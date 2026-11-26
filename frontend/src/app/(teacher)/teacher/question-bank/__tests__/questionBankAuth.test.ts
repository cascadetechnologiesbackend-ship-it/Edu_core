import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  questionBank,
  classSubjects,
  classes,
  subjects,
  syllabusChapters,
  questionPaperBlueprints,
  questionPapers,
  questionPaperItems,
  auditLogs,
} from "@/db/schema";

const {
  activeSessionRef,
  activeTenantRef,
  teacherAllocationsRef,
  mockStore,
  insertedRecords,
  updatedRecords,
  mockResolveTeacherScope,
  mockTx,
} = vi.hoisted(() => {
  const activeSessionRef = {
    current: null as {
      userId: string;
      role: string;
      schoolId: string | null;
      email: string;
    } | null,
  };

  const activeTenantRef = {
    current: null as string | null,
  };

  const teacherAllocationsRef = {
    current: [] as Array<{
      sectionId: string;
      classSubjectId: string;
      subjectId: string;
    }>,
  };

  const insertedRecords: Array<{ table: unknown; values: any }> = [];
  const updatedRecords: Array<{ table: unknown; values: any }> = [];

  const mockStore = {
    classSubjects: [
      {
        id: "cs-A1",
        schoolId: "school-A",
        classId: "class-A1",
        subjectId: "sub-A1",
      },
      {
        id: "cs-A2",
        schoolId: "school-A",
        classId: "class-A2",
        subjectId: "sub-A2",
      },
      {
        id: "cs-B1",
        schoolId: "school-B",
        classId: "class-B1",
        subjectId: "sub-B1",
      },
    ],
    questionBank: [
      {
        id: "q-A1-own-draft",
        schoolId: "school-A",
        classId: "class-A1",
        subjectId: "sub-A1",
        createdById: "teacher-A1",
        reviewStatus: "DRAFT",
        questionText: "Own draft question",
      },
      {
        id: "q-A1-other-draft",
        schoolId: "school-A",
        classId: "class-A1",
        subjectId: "sub-A1",
        createdById: "teacher-A2",
        reviewStatus: "DRAFT",
        questionText: "Other teacher draft question",
      },
      {
        id: "q-A1-other-approved",
        schoolId: "school-A",
        classId: "class-A1",
        subjectId: "sub-A1",
        createdById: "teacher-A2",
        reviewStatus: "APPROVED",
        questionText: "Other teacher approved question",
      },
      {
        id: "q-A2-unassigned",
        schoolId: "school-A",
        classId: "class-A2",
        subjectId: "sub-A2",
        createdById: "teacher-A2",
        reviewStatus: "APPROVED",
        questionText: "Unassigned class/subject question",
      },
      {
        id: "q-B1-other-school",
        schoolId: "school-B",
        classId: "class-B1",
        subjectId: "sub-B1",
        createdById: "teacher-B1",
        reviewStatus: "DRAFT",
        questionText: "School B question",
      },
    ],
    blueprints: [
      {
        id: "bp-A1",
        schoolId: "school-A",
        classId: "class-A1",
        subjectId: "sub-A1",
        name: "Term 1 Blueprint",
        totalMarks: 20,
      },
    ],
    papers: [
      {
        id: "paper-A1",
        schoolId: "school-A",
        classId: "class-A1",
        subjectId: "sub-A1",
        status: "DRAFT",
      },
      {
        id: "paper-A2",
        schoolId: "school-A",
        classId: "class-A2",
        subjectId: "sub-A2",
        status: "DRAFT",
      },
      {
        id: "paper-B1",
        schoolId: "school-B",
        classId: "class-B1",
        subjectId: "sub-B1",
        status: "DRAFT",
      },
    ],
  };

  // Allows tests to specify which single record id is being looked up by `where`
  const lookupHintRef = {
    questionId: null as string | null,
    paperId: null as string | null,
    blueprintId: null as string | null,
  };

  const makeSelectChain = () => {
    let targetTable: unknown = null;
    const chain: any = {
      from: vi.fn((table: unknown) => {
        targetTable = table;
        return chain;
      }),
      innerJoin: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => {
        return Promise.resolve(resolveRows(targetTable, true));
      }),
      then: (resolve: any) =>
        Promise.resolve(resolveRows(targetTable, false)).then(resolve),
    };
    return chain;
  };

  function resolveRows(table: unknown, isSingleLookup: boolean): any[] {
    const tenantId = activeTenantRef.current;

    if (table === classSubjects) {
      const assignedIds = new Set(
        teacherAllocationsRef.current.map((a) => a.classSubjectId),
      );
      return mockStore.classSubjects.filter(
        (cs) => cs.schoolId === tenantId && assignedIds.has(cs.id),
      );
    }

    if (table === questionBank) {
      const schoolRows = mockStore.questionBank.filter(
        (q) => q.schoolId === tenantId,
      );
      if (isSingleLookup && lookupHintRef.questionId) {
        return schoolRows.filter((q) => q.id === lookupHintRef.questionId);
      }
      return schoolRows;
    }

    if (table === questionPaperBlueprints) {
      const schoolRows = mockStore.blueprints.filter(
        (b) => b.schoolId === tenantId,
      );
      if (isSingleLookup && lookupHintRef.blueprintId) {
        return schoolRows.filter((b) => b.id === lookupHintRef.blueprintId);
      }
      return schoolRows;
    }

    if (table === questionPapers) {
      const schoolRows = mockStore.papers.filter(
        (p) => p.schoolId === tenantId,
      );
      if (isSingleLookup && lookupHintRef.paperId) {
        return schoolRows.filter((p) => p.id === lookupHintRef.paperId);
      }
      return schoolRows;
    }

    if (table === classes) {
      return [
        { id: "class-A1", name: "Class 8" },
        { id: "class-A2", name: "Class 9" },
      ].filter(() => tenantId === "school-A");
    }

    if (table === subjects) {
      return [
        { id: "sub-A1", name: "Mathematics" },
        { id: "sub-A2", name: "Science" },
      ].filter(() => tenantId === "school-A");
    }

    if (table === syllabusChapters) {
      return [
        { id: "chap-A1", title: "Chapter 1" },
      ].filter(() => tenantId === "school-A");
    }

    return [];
  }

  const mockResolveTeacherScope = vi.fn(async (userId: string, opts: any) => ({
    teacherUserId: userId,
    schoolId: opts?.schoolId ?? activeSessionRef.current?.schoolId ?? "school-A",
    academicYearId: "ay-1",
    classTeacherSections: [],
    teachingSections: teacherAllocationsRef.current,
    scheduledPeriods: [],
    allSectionIds: teacherAllocationsRef.current.map((a) => a.sectionId),
  }));

  const mockTx = {
    select: vi.fn(() => makeSelectChain()),
    insert: vi.fn((table: unknown) => {
      const chain: any = {
        values: vi.fn((vals: any) => {
          insertedRecords.push({ table, values: vals });
          return chain;
        }),
        returning: vi.fn(() =>
          Promise.resolve([{ id: `created-${insertedRecords.length}` }]),
        ),
        then: (resolve: any) => Promise.resolve([]).then(resolve),
      };
      return chain;
    }),
    update: vi.fn((table: unknown) => {
      const chain: any = {
        set: vi.fn((vals: any) => {
          updatedRecords.push({ table, values: vals });
          return chain;
        }),
        where: vi.fn(() => Promise.resolve([])),
      };
      return chain;
    }),
  };

  return {
    activeSessionRef,
    activeTenantRef,
    teacherAllocationsRef,
    mockStore,
    insertedRecords,
    updatedRecords,
    mockResolveTeacherScope,
    mockTx,
    lookupHintRef,
  };
});

// Expose lookupHintRef via closure helper
let setLookupHint: (hint: {
  questionId?: string | null;
  paperId?: string | null;
  blueprintId?: string | null;
}) => void;

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    if (!activeSessionRef.current) {
      throw new Error("UNAUTHORIZED");
    }
    if (
      allowedRoles &&
      allowedRoles.length > 0 &&
      !allowedRoles.includes(activeSessionRef.current.role)
    ) {
      throw new Error("FORBIDDEN");
    }
    return activeSessionRef.current;
  }),
  requireSchool: vi.fn(async () => {
    if (!activeSessionRef.current?.schoolId) {
      throw new Error("NO_SCHOOL");
    }
    return { id: activeSessionRef.current.schoolId, name: "Test School" };
  }),
}));

vi.mock("@/db", () => ({
  withTenant: vi.fn(async (schoolId: string, cb: (tx: any) => Promise<any>) => {
    activeTenantRef.current = schoolId;
    return cb(mockTx);
  }),
}));

vi.mock("@/lib/teacherEventEngine/scopeResolver", () => {
  class TeacherScopeError extends Error {
    public readonly statusCode: number;
    constructor(message: string, statusCode = 403) {
      super(message);
      this.name = "TeacherScopeError";
      this.statusCode = statusCode;
    }
  }
  return {
    resolveTeacherScope: mockResolveTeacherScope,
    TeacherScopeError,
  };
});

vi.mock("@/lib/requestContext", () => ({
  getClientRequestContext: vi.fn(() => ({
    ipAddress: "10.0.0.1",
    userAgent: "vitest-agent",
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  getQuestionBankData,
  saveQuestionBankItem,
} from "../actions";
import {
  saveBlueprint,
  saveQuestionPaper,
  submitQuestionPaperForModeration,
} from "../../question-papers/actions";

describe("Question Bank & Question Paper Authorization + Teacher Scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertedRecords.length = 0;
    updatedRecords.length = 0;
    activeTenantRef.current = null;
    activeSessionRef.current = {
      userId: "teacher-A1",
      role: "TEACHER",
      schoolId: "school-A",
      email: "teacher.a1@school-a.edu",
    };
    teacherAllocationsRef.current = [
      {
        sectionId: "sec-A1",
        classSubjectId: "cs-A1",
        subjectId: "sub-A1",
      },
    ];
  });

  it("blocks teacher from reading question bank when they have no assigned class-subject pairs", async () => {
    teacherAllocationsRef.current = [];

    const result = await getQuestionBankData();

    expect(mockResolveTeacherScope).toHaveBeenCalledWith("teacher-A1", {
      tx: mockTx,
      schoolId: "school-A",
    });
    expect(result).toEqual({
      questions: [],
      classes: [],
      subjects: [],
      chapters: [],
    });
    // Should not query questionBank at all when unassigned
    const qbSelects = mockTx.select.mock.results.filter((_, idx) => {
      const fromMock = mockTx.select.mock.results[idx]?.value?.from;
      return fromMock?.mock?.calls?.some((c: any[]) => c[0] === questionBank);
    });
    expect(qbSelects).toHaveLength(0);
  });

  it("blocks teacher from creating a question for an unassigned (classId, subjectId)", async () => {
    const res = await saveQuestionBankItem({
      classId: "class-A2",
      subjectId: "sub-A2",
      questionType: "MCQ",
      questionText: "Unauthorized class/subject question",
      maxMarks: 2,
      difficulty: "MEDIUM",
      cognitiveLevel: "APPLY",
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not assigned/i);
    expect(insertedRecords).toHaveLength(0);
  });

  it("allows teacher to create a question for an assigned (classId, subjectId) and writes an audit log", async () => {
    const res = await saveQuestionBankItem({
      classId: "class-A1",
      subjectId: "sub-A1",
      questionType: "MCQ",
      questionText: "Authorized math question",
      maxMarks: 2,
      difficulty: "EASY",
      cognitiveLevel: "REMEMBER",
    });

    expect(res.success).toBe(true);
    expect(insertedRecords.some((r) => r.table === questionBank)).toBe(true);
    const auditEntry = insertedRecords.find((r) => r.table === auditLogs);
    expect(auditEntry).toBeDefined();
    expect(auditEntry?.values).toMatchObject({
      userId: "teacher-A1",
      schoolId: "school-A",
      tableName: "question_bank",
      action: "WRITE",
    });
  });

  it("blocks teacher from editing another teacher's DRAFT question", async () => {
    // Mock single-row lookup for q-A1-other-draft
    mockTx.select.mockImplementationOnce(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        limit: vi.fn(() =>
          Promise.resolve([
            mockStore.questionBank.find((q) => q.id === "q-A1-other-draft"),
          ]),
        ),
      };
      return chain;
    });
    // First select in saveQuestionBankItem is classSubjects (for scope check),
    // second select is questionBank (for existing row check).
    mockTx.select.mockReset();
    let selectCount = 0;
    mockTx.select.mockImplementation(() => {
      selectCount++;
      const currentCall = selectCount;
      const chain: any = {
        from: vi.fn((table: unknown) => {
          (chain as any)._table = table;
          return chain;
        }),
        where: vi.fn(() => chain),
        limit: vi.fn(() => {
          if (currentCall === 2) {
            return Promise.resolve([
              mockStore.questionBank.find((q) => q.id === "q-A1-other-draft"),
            ]);
          }
          return Promise.resolve([]);
        }),
        then: (resolve: any) => {
          if ((chain as any)._table === classSubjects) {
            return Promise.resolve([mockStore.classSubjects[0]]).then(resolve);
          }
          return Promise.resolve([]).then(resolve);
        },
      };
      return chain;
    });

    const res = await saveQuestionBankItem({
      id: "q-A1-other-draft",
      classId: "class-A1",
      subjectId: "sub-A1",
      questionType: "MCQ",
      questionText: "Attempting to overwrite another teacher's draft",
      maxMarks: 1,
      difficulty: "MEDIUM",
      cognitiveLevel: "UNDERSTAND",
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/own questions/i);
    expect(updatedRecords).toHaveLength(0);
  });

  it("enforces cross-tenant isolation when school.id does not match the target question", async () => {
    // Teacher in school-A tries to edit q-B1-other-school (which belongs to school-B)
    mockTx.select.mockReset();
    mockTx.select.mockImplementation(() => {
      const chain: any = {
        from: vi.fn((table: unknown) => {
          (chain as any)._table = table;
          return chain;
        }),
        where: vi.fn(() => chain),
        limit: vi.fn(() => {
          // Tenant-scoped query returns nothing because schoolId !== school-A
          const row = mockStore.questionBank.find(
            (q) =>
              q.id === "q-B1-other-school" &&
              q.schoolId === activeTenantRef.current,
          );
          return Promise.resolve(row ? [row] : []);
        }),
        then: (resolve: any) => {
          if ((chain as any)._table === classSubjects) {
            return Promise.resolve([mockStore.classSubjects[0]]).then(resolve);
          }
          return Promise.resolve([]).then(resolve);
        },
      };
      return chain;
    });

    const res = await saveQuestionBankItem({
      id: "q-B1-other-school",
      classId: "class-A1",
      subjectId: "sub-A1",
      questionType: "SA",
      questionText: "Cross-tenant hijack attempt",
      maxMarks: 3,
      difficulty: "HARD",
      cognitiveLevel: "ANALYZE",
    });

    expect(activeTenantRef.current).toBe("school-A");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not found/i);
    expect(updatedRecords).toHaveLength(0);
  });

  it("enforces teacher scope on question papers and restricts APPROVED/LOCKED transitions to admins", async () => {
    // 1. Teacher cannot save blueprint for unassigned class/subject
    const bpRes = await saveBlueprint({
      name: "Unauthorized Blueprint",
      classId: "class-A2",
      subjectId: "sub-A2",
      totalMarks: 50,
      durationMinutes: 120,
      sections: [{ label: "Section A", questionCount: 5, marksPerQuestion: 10 }],
    });
    expect(bpRes.success).toBe(false);
    expect(bpRes.error).toMatch(/not assigned/i);

    // 2. Duplicate questions rejected in saveQuestionPaper
    const dupRes = await saveQuestionPaper({
      title: "Math Paper",
      classId: "class-A1",
      subjectId: "sub-A1",
      setCode: "A",
      totalMarks: 4,
      durationMinutes: 60,
      items: [
        { questionId: "q-1", sectionLabel: "A", orderIndex: 1, marks: 2 },
        { questionId: "q-1", sectionLabel: "A", orderIndex: 2, marks: 2 },
      ],
    });
    expect(dupRes.success).toBe(false);
    expect(dupRes.error).toMatch(/duplicate/i);

    // 3. Teacher cannot transition paper to APPROVED or LOCKED
    const approveAsTeacher = await submitQuestionPaperForModeration(
      "paper-A1",
      "APPROVED",
    );
    expect(approveAsTeacher.success).toBe(false);
    expect(approveAsTeacher.error).toMatch(/School Admin, Principal, or Super Admin/i);

    // 4. Principal CAN transition paper to APPROVED and writes auditLogs
    activeSessionRef.current = {
      userId: "principal-A1",
      role: "PRINCIPAL",
      schoolId: "school-A",
      email: "principal@school-a.edu",
    };

    mockTx.select.mockReset();
    mockTx.select.mockImplementation(() => {
      const chain: any = {
        from: vi.fn(() => chain),
        where: vi.fn(() => chain),
        limit: vi.fn(() =>
          Promise.resolve([
            mockStore.papers.find(
              (p) =>
                p.id === "paper-A1" && p.schoolId === activeTenantRef.current,
            ),
          ]),
        ),
      };
      return chain;
    });

    const approveAsPrincipal = await submitQuestionPaperForModeration(
      "paper-A1",
      "APPROVED",
    );
    expect(approveAsPrincipal.success).toBe(true);
    expect(updatedRecords.some((r) => r.table === questionPapers)).toBe(true);
    expect(insertedRecords.some((r) => r.table === auditLogs)).toBe(true);
  });
});
