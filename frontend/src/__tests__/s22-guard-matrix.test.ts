import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Mocks for React, Next, Auth & Server Utilities ────────────────────────
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: any[]) => any>(fn: T): T => fn,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/encryption", () => ({
  encryptData: vi.fn((val: string) => `enc_${val}`),
  decryptData: vi.fn((val: string) => (val?.startsWith("enc_") ? val.replace("enc_", "") : val)),
  computeSearchHash: vi.fn((val: string) => `hash_${val}`),
}));

// ─── 2. Multi-Tenant State & Active Session ──────────────────────────────────
function safeInspect(obj: any): string {
  try {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return;
        seen.add(value);
      }
      return value;
    });
  } catch {
    return "";
  }
}

const { activeSessionRef, mockTwoSchoolDb } = vi.hoisted(() => {
  const activeSessionRef = {
    current: {
      userId: "parent-A-1",
      role: "PARENT",
      schoolId: "school-A",
      email: "parent1@school-a.edu",
    } as any,
  };

  const mockTwoSchoolDb = {
    schools: [
      { id: "school-A", name: "Delhi Public School (School A)" },
      { id: "school-B", name: "St. Xavier Academy (School B)" },
    ],
    users: [
      { id: "parent-A-1", schoolId: "school-A", role: "PARENT", email: "parent1@school-a.edu", fullName: "Rajesh Sharma" },
      { id: "parent-A-2", schoolId: "school-A", role: "PARENT", email: "parent2@school-a.edu", fullName: "Vikram Mehta" },
      { id: "teacher-A-1", schoolId: "school-A", role: "TEACHER", email: "teacher1@school-a.edu", fullName: "Sunita Verma" },
      { id: "teacher-A-2", schoolId: "school-A", role: "TEACHER", email: "teacher2@school-a.edu", fullName: "Amit Patel" },
      { id: "principal-A", schoolId: "school-A", role: "PRINCIPAL", email: "principal@school-a.edu", fullName: "Dr. K. Sharma" },
      { id: "teacher-B-1", schoolId: "school-B", role: "TEACHER", email: "teacher1@school-b.edu", fullName: "Father Thomas" },
    ],
    persons: [
      { id: "per-parent-1", schoolId: "school-A", userId: "parent-A-1", primaryType: "PARENT" },
      { id: "per-parent-2", schoolId: "school-A", userId: "parent-A-2", primaryType: "PARENT" },
      { id: "per-teacher-1", schoolId: "school-A", userId: "teacher-A-1", primaryType: "STAFF" },
      { id: "per-teacher-2", schoolId: "school-A", userId: "teacher-A-2", primaryType: "STAFF" },
      { id: "per-principal", schoolId: "school-A", userId: "principal-A", primaryType: "STAFF" },
      { id: "per-teacher-B1", schoolId: "school-B", userId: "teacher-B-1", primaryType: "STAFF" },
    ],
    classes: [
      { id: "cls-A-1", schoolId: "school-A", name: "Class 10", displayName: "Class 10" },
      { id: "cls-A-2", schoolId: "school-A", name: "Class 12", displayName: "Class 12" },
      { id: "cls-B-1", schoolId: "school-B", name: "Class 10", displayName: "Class 10" },
    ],
    sections: [
      { id: "sec-A-1", schoolId: "school-A", classId: "cls-A-1", name: "A" },
      { id: "sec-A-2", schoolId: "school-A", classId: "cls-A-2", name: "B" },
      { id: "sec-B-1", schoolId: "school-B", classId: "cls-B-1", name: "A" },
    ],
    students: [
      {
        id: "stu-A-1",
        schoolId: "school-A",
        currentClassId: "cls-A-1",
        currentSectionId: "sec-A-1",
        admissionNumber: "ADM-A-001",
        firstNameEncrypted: "enc_Aarav",
        lastNameEncrypted: "enc_Sharma",
        isActive: true,
      },
      {
        id: "stu-A-2",
        schoolId: "school-A",
        currentClassId: "cls-A-2",
        currentSectionId: "sec-A-2",
        admissionNumber: "ADM-A-002",
        firstNameEncrypted: "enc_Rohan",
        lastNameEncrypted: "enc_Mehta",
        isActive: true,
      },
      {
        id: "stu-B-1",
        schoolId: "school-B",
        currentClassId: "cls-B-1",
        currentSectionId: "sec-B-1",
        admissionNumber: "ADM-B-001",
        firstNameEncrypted: "enc_David",
        lastNameEncrypted: "enc_Paul",
        isActive: true,
      },
    ],
    studentFamilyMembers: [
      { id: "fam-A-1", schoolId: "school-A", studentId: "stu-A-1", userId: "parent-A-1", relationship: "FATHER", isPrimaryContact: true },
      { id: "fam-A-2", schoolId: "school-A", studentId: "stu-A-2", userId: "parent-A-2", relationship: "FATHER", isPrimaryContact: true },
    ],
    classTeacherAssignments: [
      { id: "cta-A-1", schoolId: "school-A", sectionId: "sec-A-1", teacherId: "teacher-A-1", isActive: true },
      { id: "cta-A-2", schoolId: "school-A", sectionId: "sec-A-2", teacherId: "teacher-A-2", isActive: true },
    ],
    sectionSubjectTeachers: [] as any[],
    parentTeacherMessages: [] as any[],
    pushNotificationLogs: [] as any[],
    auditLogs: [] as any[],
  };

  return { activeSessionRef, mockTwoSchoolDb };
});

// ─── 3. Mock Server Auth ─────────────────────────────────────────────────────
vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async (allowedRoles?: readonly string[]) => {
    const s = activeSessionRef.current;
    if (!s) throw new Error("Unauthorized: No session");
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(s.role)) {
      throw new Error(`Forbidden: Role ${s.role} not in [${allowedRoles.join(", ")}]`);
    }
    return { userId: s.userId, role: s.role, schoolId: s.schoolId, email: s.email };
  }),
  requireSchool: vi.fn(async (ctx: any) => {
    return { id: ctx.schoolId, name: `School ${ctx.schoolId}` };
  }),
}));

// ─── 4. Mock Database with Multi-Tenant Filtering ───────────────────────────
vi.mock("@/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db")>();
  const createScopedDb = (schoolId: string) => {
    return {
      query: {
        schools: {
          findFirst: vi.fn(async ({ where }: any) =>
            mockTwoSchoolDb.schools.find((s) => s.id === schoolId)
          ),
        },
        users: {
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            for (const u of mockTwoSchoolDb.users) {
              if (u.schoolId === schoolId && str.includes(u.id)) {
                return u;
              }
            }
            return mockTwoSchoolDb.users.find((u) => u.schoolId === schoolId);
          }),
          findMany: vi.fn(async () =>
            mockTwoSchoolDb.users.filter((u) => u.schoolId === schoolId)
          ),
        },
        classes: {
          findMany: vi.fn(async () =>
            mockTwoSchoolDb.classes.filter((c) => c.schoolId === schoolId)
          ),
        },
        sections: {
          findMany: vi.fn(async () =>
            mockTwoSchoolDb.sections.filter((s) => s.schoolId === schoolId)
          ),
        },
        students: {
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            for (const s of mockTwoSchoolDb.students) {
              if (s.schoolId === schoolId && str.includes(s.id)) {
                return s;
              }
            }
            return mockTwoSchoolDb.students.find((s) => s.schoolId === schoolId);
          }),
          findMany: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockTwoSchoolDb.students.filter((s) => {
              if (s.schoolId !== schoolId) return false;
              if (str.includes("sec-") && !str.includes(s.currentSectionId)) return false;
              if (str.includes("stu-") && !str.includes(s.id)) return false;
              return true;
            });
          }),
        },
        studentFamilyMembers: {
          findMany: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockTwoSchoolDb.studentFamilyMembers.filter((f) => {
              if (f.schoolId !== schoolId) return false;
              if (str.includes("parent-") && !str.includes(f.userId)) return false;
              if (str.includes("stu-") && !str.includes(f.studentId)) return false;
              return true;
            });
          }),
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockTwoSchoolDb.studentFamilyMembers.find((f) => {
              if (f.schoolId !== schoolId) return false;
              if (str.includes("parent-") && !str.includes(f.userId)) return false;
              if (str.includes("stu-") && !str.includes(f.studentId)) return false;
              return true;
            }) || null;
          }),
        },
        classTeacherAssignments: {
          findMany: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockTwoSchoolDb.classTeacherAssignments.filter((cta) => {
              if (cta.schoolId !== schoolId || !cta.isActive) return false;
              if (str.includes("teacher-") && !str.includes(cta.teacherId)) return false;
              if (str.includes("sec-") && !str.includes(cta.sectionId)) return false;
              return true;
            });
          }),
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockTwoSchoolDb.classTeacherAssignments.find((cta) => {
              if (cta.schoolId !== schoolId || !cta.isActive) return false;
              if (str.includes("teacher-") && !str.includes(cta.teacherId)) return false;
              if (str.includes("sec-") && !str.includes(cta.sectionId)) return false;
              return true;
            }) || null;
          }),
        },
        sectionSubjectTeachers: {
          findMany: vi.fn(async () => []),
          findFirst: vi.fn(async () => null),
        },
        classSubjects: {
          findMany: vi.fn(async () => []),
          findFirst: vi.fn(async () => null),
        },
        subjects: {
          findMany: vi.fn(async () => []),
          findFirst: vi.fn(async () => null),
        },
        persons: {
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            for (const p of mockTwoSchoolDb.persons) {
              if (p.schoolId === schoolId && str.includes(p.userId)) {
                return p;
              }
            }
            return mockTwoSchoolDb.persons.find((p) => p.schoolId === schoolId);
          }),
          findMany: vi.fn(async () =>
            mockTwoSchoolDb.persons.filter((p) => p.schoolId === schoolId)
          ),
        },
        parentTeacherMessages: {
          findMany: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockTwoSchoolDb.parentTeacherMessages.filter((m) => {
              if (m.schoolId !== schoolId) return false;
              if (str.includes("teacher-") && !str.includes(m.senderUserId) && !str.includes(m.recipientUserId)) {
                return false;
              }
              return true;
            });
          }),
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            for (const m of mockTwoSchoolDb.parentTeacherMessages) {
              if (m.schoolId === schoolId && str.includes(m.id)) {
                return m;
              }
            }
            return mockTwoSchoolDb.parentTeacherMessages.find((m) => m.schoolId === schoolId) || null;
          }),
        },
        pushNotificationLogs: {
          findMany: vi.fn(async () =>
            mockTwoSchoolDb.pushNotificationLogs.filter((p) => p.schoolId === schoolId)
          ),
        },
        auditLogs: {
          findMany: vi.fn(async () =>
            mockTwoSchoolDb.auditLogs.filter((a) => a.schoolId === schoolId)
          ),
        },
      },
      insert: vi.fn((table: any) => ({
        values: vi.fn((val: any) => {
          const row = { id: `id-${Date.now()}-${Math.random()}`, ...val };
          if (val.schoolId !== schoolId) {
            throw new Error(`Multi-tenant breach: Attempted insert with schoolId ${val.schoolId} in tenant ${schoolId}`);
          }
          if (val.content !== undefined) {
            mockTwoSchoolDb.parentTeacherMessages.push(row);
          } else if (val.action !== undefined) {
            mockTwoSchoolDb.auditLogs.push(row);
          } else if (val.recipientUserId !== undefined) {
            mockTwoSchoolDb.pushNotificationLogs.push(row);
          }
          return {
            returning: vi.fn(() => [row]),
          };
        }),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((patch: any) => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })),
      transaction: vi.fn(async (cb: any) => {
        return await cb(createScopedDb(schoolId));
      }),
      execute: vi.fn(async () => []),
    };
  };

  const defaultDb = createScopedDb("school-A");

  return {
    ...actual,
    db: defaultDb,
    withTenant: vi.fn(async (schoolId: string, cb: any) => {
      const scopedDb = createScopedDb(schoolId);
      return await cb(scopedDb);
    }),
  };
});

// Import actions to test
import {
  sendParentTeacherMessage,
  getAdminModerationConversationsAction,
} from "../app/(parent)/parent/messages/actions";
import {
  validateMessageRecipient,
  getTeacherConversations,
} from "@/lib/communicationLoop";
import { generateVerhoeff } from "@schoolmitra/entity-engine/dpdp-ner";

describe("Sprint S22 Layer 5: Guard Matrix & Displacement Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTwoSchoolDb.parentTeacherMessages.length = 0;
    mockTwoSchoolDb.auditLogs.length = 0;
    mockTwoSchoolDb.pushNotificationLogs.length = 0;
    for (const cta of mockTwoSchoolDb.classTeacherAssignments) {
      cta.isActive = true;
    }
  });

  describe("1. Cross-Tenant Isolation Guard", () => {
    it("rejects when Parent in School A attempts to message Teacher in School B", async () => {
      activeSessionRef.current = {
        userId: "parent-A-1",
        role: "PARENT",
        schoolId: "school-A",
        email: "parent1@school-a.edu",
      };

      const result = await sendParentTeacherMessage({
        recipientUserId: "teacher-B-1", // Belongs to School B
        studentId: "stu-A-1",
        subject: "Cross-Tenant Probe",
        content: "Hello from School A parent to School B teacher",
      });

      expect(result.success).toBe(false);
      expect("error" in result && result.error).toContain("Recipient is not currently assigned");
      expect(mockTwoSchoolDb.parentTeacherMessages.length).toBe(0);
    });
  });

  describe("2. Cross-Child / Unallocated Teacher Restriction", () => {
    it("rejects when Parent attempts to message a teacher not assigned to their child", async () => {
      activeSessionRef.current = {
        userId: "parent-A-1",
        role: "PARENT",
        schoolId: "school-A",
        email: "parent1@school-a.edu",
      };

      // teacher-A-2 teaches Class 12B (stu-A-2), but parent-A-1's child stu-A-1 is in Class 10A
      await expect(
        validateMessageRecipient(
          "school-A",
          "parent-A-1",
          "PARENT",
          "teacher-A-2",
          "stu-A-1"
        )
      ).rejects.toThrow("Recipient is not currently assigned as a teacher for your child");
    });
  });

  describe("3. Allocation Displacement Law", () => {
    it("causes messages to immediately vanish from teacher inbox when section allocation is revoked", async () => {
      // Step A: Seed message in School A for stu-A-1 (Class 10A) to teacher-A-1
      mockTwoSchoolDb.parentTeacherMessages.push({
        id: "msg-disp-1",
        schoolId: "school-A",
        senderUserId: "parent-A-1",
        recipientUserId: "teacher-A-1",
        studentId: "stu-A-1",
        subject: "Chapter 4 Homework",
        content: "Please clarify problem 3.",
        parentMessageId: null,
        isRead: false,
        createdAt: new Date("2026-10-30T09:00:00Z"),
      });

      // Step B: Active allocation exists -> teacher sees thread in inbox
      const initialThreads = await getTeacherConversations("school-A", "teacher-A-1");
      expect(initialThreads.length).toBe(1);
      expect(initialThreads[0]?.subject).toBe("Chapter 4 Homework");

      // Step C: Displacement event occurs: teacher's allocation is deactivated
      const cta = mockTwoSchoolDb.classTeacherAssignments.find(
        (a) => a.teacherId === "teacher-A-1" && a.sectionId === "sec-A-1"
      );
      if (cta) cta.isActive = false;

      // Step D: Displacement law check -> conversation immediately vanishes from inbox
      const displacedThreads = await getTeacherConversations("school-A", "teacher-A-1");
      expect(displacedThreads.length).toBe(0);
    });
  });

  describe("4. Reply Participant Continuity Guard", () => {
    it("rejects when an unassociated user attempts to inject a reply into someone else's thread", async () => {
      // Thread exists between parent-A-1 and teacher-A-1
      mockTwoSchoolDb.parentTeacherMessages.push({
        id: "msg-root-confidential",
        schoolId: "school-A",
        senderUserId: "parent-A-1",
        recipientUserId: "teacher-A-1",
        studentId: "stu-A-1",
        subject: "Confidential Student Matter",
        content: "Private medical note.",
        parentMessageId: null,
        isRead: false,
        createdAt: new Date("2026-10-30T09:00:00Z"),
      });

      // Outsider parent-A-2 attempts to reply
      await expect(
        validateMessageRecipient(
          "school-A",
          "parent-A-2", // Outsider
          "PARENT",
          "teacher-A-1",
          "stu-A-1",
          "msg-root-confidential" // Target thread
        )
      ).rejects.toThrow("Not authorized to reply to this thread");
    });
  });

  describe("5. Principal & School Admin Moderation Audit Logging (OD4)", () => {
    it("logs forensic MESSAGES_MODERATION_AUDIT audit row when Principal inspects school threads", async () => {
      activeSessionRef.current = {
        userId: "principal-A",
        role: "PRINCIPAL",
        schoolId: "school-A",
        email: "principal@school-a.edu",
      };

      const res = await getAdminModerationConversationsAction();
      expect(res.success).toBe(true);

      // Verify forensic audit row was logged
      expect(mockTwoSchoolDb.auditLogs.length).toBe(1);
      const log = mockTwoSchoolDb.auditLogs[0];
      expect(log.action).toBe("READ");
      expect(log.purposeId).toBe("communication_moderation_audit");
      expect(log.userId).toBe("principal-A");
      expect(log.userEmail).toBe("principal@school-a.edu");
    });

    it("rejects when a regular parent attempts to invoke admin moderation action", async () => {
      activeSessionRef.current = {
        userId: "parent-A-1",
        role: "PARENT",
        schoolId: "school-A",
        email: "parent1@school-a.edu",
      };

      const res = await getAdminModerationConversationsAction();
      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden: Role PARENT not in [SUPER_ADMIN, SCHOOL_ADMIN, PRINCIPAL]");
      expect(mockTwoSchoolDb.auditLogs.length).toBe(0);
    });
  });

  describe("6. DPDP PII Scan Enforcement at Write Point", () => {
    it("blocks critical PII (Aadhaar number) unconditionally", async () => {
      activeSessionRef.current = {
        userId: "parent-A-1",
        role: "PARENT",
        schoolId: "school-A",
        email: "parent1@school-a.edu",
      };

      const validAadhaar = "23456789012" + generateVerhoeff("23456789012");
      const res = await sendParentTeacherMessage({
        recipientUserId: "teacher-A-1",
        studentId: "stu-A-1",
        content: `Here is student Aadhaar: ${validAadhaar} for school bus form.`,
      });

      expect(res.success).toBe(false);
      expect("blocked" in res && res.blocked).toBe(true);
      expect("decision" in res && res.decision).toBe("BLOCKED");
      expect(mockTwoSchoolDb.parentTeacherMessages.length).toBe(0);
    });

    it("requires confirmation for high-risk contact info and redacts when MASKED is chosen", async () => {
      activeSessionRef.current = {
        userId: "parent-A-1",
        role: "PARENT",
        schoolId: "school-A",
        email: "parent1@school-a.edu",
      };

      // Step A: Without decision override -> requires confirmation
      const res1 = await sendParentTeacherMessage({
        recipientUserId: "teacher-A-1",
        studentId: "stu-A-1",
        content: "Contact at +91 9876543210 or email parent.lead@gmail.com urgently.",
      });

      expect(res1.success).toBe(false);
      expect("requiresConfirmation" in res1 && res1.requiresConfirmation).toBe(true);
      expect(mockTwoSchoolDb.parentTeacherMessages.length).toBe(0);

      // Step B: User chooses MASKED -> sends successfully with redacted content
      const res2 = await sendParentTeacherMessage({
        recipientUserId: "teacher-A-1",
        studentId: "stu-A-1",
        content: "Contact at +91 9876543210 or email parent.lead@gmail.com urgently.",
        decisionOverride: "MASKED",
      });

      expect(res2.success).toBe(true);
      expect(mockTwoSchoolDb.parentTeacherMessages.length).toBe(1);
      const inserted = mockTwoSchoolDb.parentTeacherMessages[0];
      expect(inserted.content).not.toContain("9876543210");
    });
  });
});
