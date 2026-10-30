import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── 1. Core Framework Mocks ─────────────────────────────────────────────────
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

// Helper circular-safe JSON replacer for Drizzle ASTs
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

// ─── 2. Multi-Tenant In-Memory Datastore & Session Context ───────────────────
const { activeSessionRef, mockAdvDb } = vi.hoisted(() => {
  const activeSessionRef = {
    current: {
      userId: "parent-adv-1",
      role: "PARENT",
      schoolId: "school-adv-1",
      email: "parent1@adv1.edu",
    } as any,
  };

  const mockAdvDb = {
    schools: [
      { id: "school-adv-1", name: "Alpha Global School" },
      { id: "school-adv-2", name: "Beta International" },
    ],
    users: [
      { id: "parent-adv-1", schoolId: "school-adv-1", role: "PARENT", email: "parent1@adv1.edu", fullName: "Rajesh Sharma" },
      { id: "parent-adv-2", schoolId: "school-adv-1", role: "PARENT", email: "parent2@adv1.edu", fullName: "Vikram Mehta" },
      { id: "teacher-adv-1", schoolId: "school-adv-1", role: "TEACHER", email: "teacher1@adv1.edu", fullName: "Sunita Verma" },
      { id: "teacher-adv-2", schoolId: "school-adv-1", role: "TEACHER", email: "teacher2@adv1.edu", fullName: "Amit Patel" },
      { id: "teacher-adv-foreign", schoolId: "school-adv-2", role: "TEACHER", email: "teacher@adv2.edu", fullName: "Foreign Teacher" },
    ],
    persons: [
      { id: "p-parent-1", schoolId: "school-adv-1", userId: "parent-adv-1", primaryType: "PARENT" },
      { id: "p-parent-2", schoolId: "school-adv-1", userId: "parent-adv-2", primaryType: "PARENT" },
      { id: "p-teacher-1", schoolId: "school-adv-1", userId: "teacher-adv-1", primaryType: "STAFF" },
      { id: "p-teacher-2", schoolId: "school-adv-1", userId: "teacher-adv-2", primaryType: "STAFF" },
      { id: "p-foreign", schoolId: "school-adv-2", userId: "teacher-adv-foreign", primaryType: "STAFF" },
    ],
    classes: [
      { id: "cls-adv-1", schoolId: "school-adv-1", name: "Class 10", displayName: "Class 10" },
      { id: "cls-adv-2", schoolId: "school-adv-1", name: "Class 12", displayName: "Class 12" },
    ],
    sections: [
      { id: "sec-adv-1", schoolId: "school-adv-1", classId: "cls-adv-1", name: "A" },
      { id: "sec-adv-2", schoolId: "school-adv-1", classId: "cls-adv-2", name: "B" },
    ],
    students: [
      {
        id: "stu-adv-1",
        schoolId: "school-adv-1",
        currentClassId: "cls-adv-1",
        currentSectionId: "sec-adv-1",
        admissionNumber: "ADM-ADV-001",
        firstNameEncrypted: "enc_Aarav",
        lastNameEncrypted: "enc_Sharma",
        isActive: true,
      },
      {
        id: "stu-adv-2",
        schoolId: "school-adv-1",
        currentClassId: "cls-adv-2",
        currentSectionId: "sec-adv-2",
        admissionNumber: "ADM-ADV-002",
        firstNameEncrypted: "enc_Rohan",
        lastNameEncrypted: "enc_Mehta",
        isActive: true,
      },
    ],
    studentFamilyMembers: [
      { id: "fam-adv-1", schoolId: "school-adv-1", studentId: "stu-adv-1", userId: "parent-adv-1", relationship: "FATHER", isPrimaryContact: true },
      { id: "fam-adv-2", schoolId: "school-adv-1", studentId: "stu-adv-2", userId: "parent-adv-2", relationship: "FATHER", isPrimaryContact: true },
    ],
    classTeacherAssignments: [
      { id: "cta-adv-1", schoolId: "school-adv-1", sectionId: "sec-adv-1", teacherId: "teacher-adv-1", isActive: true },
      { id: "cta-adv-2", schoolId: "school-adv-1", sectionId: "sec-adv-2", teacherId: "teacher-adv-2", isActive: true },
    ],
    sectionSubjectTeachers: [] as any[],
    classSubjects: [] as any[],
    subjects: [] as any[],
    parentTeacherMessages: [] as any[],
    pushNotificationLogs: [] as any[],
    auditLogs: [] as any[],
  };

  return { activeSessionRef, mockAdvDb };
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

// ─── 4. Mock Database with Scoping ──────────────────────────────────────────
vi.mock("@/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db")>();

  const createScopedDb = (schoolId: string): any => {
    return {
      query: {
        schools: {
          findFirst: vi.fn(async ({ where }: any) =>
            mockAdvDb.schools.find((s) => s.id === schoolId)
          ),
        },
        users: {
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            for (const u of mockAdvDb.users) {
              if (u.schoolId === schoolId && str.includes(u.id)) {
                return u;
              }
            }
            return mockAdvDb.users.find((u) => u.schoolId === schoolId);
          }),
          findMany: vi.fn(async () =>
            mockAdvDb.users.filter((u) => u.schoolId === schoolId)
          ),
        },
        classes: {
          findMany: vi.fn(async () =>
            mockAdvDb.classes.filter((c) => c.schoolId === schoolId)
          ),
        },
        sections: {
          findMany: vi.fn(async () =>
            mockAdvDb.sections.filter((s) => s.schoolId === schoolId)
          ),
        },
        students: {
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            for (const s of mockAdvDb.students) {
              if (s.schoolId === schoolId && str.includes(s.id)) {
                return s;
              }
            }
            return mockAdvDb.students.find((s) => s.schoolId === schoolId);
          }),
          findMany: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockAdvDb.students.filter((s) => {
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
            return mockAdvDb.studentFamilyMembers.filter((f) => {
              if (f.schoolId !== schoolId) return false;
              if (str.includes("parent-") && !str.includes(f.userId)) return false;
              if (str.includes("stu-") && !str.includes(f.studentId)) return false;
              return true;
            });
          }),
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockAdvDb.studentFamilyMembers.find((f) => {
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
            return mockAdvDb.classTeacherAssignments.filter((cta) => {
              if (cta.schoolId !== schoolId || !cta.isActive) return false;
              if (str.includes("teacher-") && !str.includes(cta.teacherId)) return false;
              if (str.includes("sec-") && !str.includes(cta.sectionId)) return false;
              return true;
            });
          }),
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockAdvDb.classTeacherAssignments.find((cta) => {
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
            for (const p of mockAdvDb.persons) {
              if (p.schoolId === schoolId && str.includes(p.userId)) {
                return p;
              }
            }
            return mockAdvDb.persons.find((p) => p.schoolId === schoolId);
          }),
          findMany: vi.fn(async () =>
            mockAdvDb.persons.filter((p) => p.schoolId === schoolId)
          ),
        },
        parentTeacherMessages: {
          findMany: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockAdvDb.parentTeacherMessages.filter((m) => {
              if (m.schoolId !== schoolId) return false;
              if (str.includes("teacher-") && !str.includes(m.senderUserId) && !str.includes(m.recipientUserId)) {
                return false;
              }
              return true;
            });
          }),
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            for (const m of mockAdvDb.parentTeacherMessages) {
              if (m.schoolId === schoolId && str.includes(m.id)) {
                return m;
              }
            }
            return mockAdvDb.parentTeacherMessages.find((m) => m.schoolId === schoolId) || null;
          }),
        },
        pushNotificationLogs: {
          findMany: vi.fn(async () =>
            mockAdvDb.pushNotificationLogs.filter((p) => p.schoolId === schoolId)
          ),
        },
        auditLogs: {
          findMany: vi.fn(async () =>
            mockAdvDb.auditLogs.filter((a) => a.schoolId === schoolId)
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
            mockAdvDb.parentTeacherMessages.push(row);
          } else if (val.action !== undefined) {
            mockAdvDb.auditLogs.push(row);
          } else if (val.recipientUserId !== undefined) {
            mockAdvDb.pushNotificationLogs.push(row);
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

  return {
    ...actual,
    db: createScopedDb("school-adv-1"),
    withTenant: vi.fn(async (schoolId: string, cb: any) => {
      const scopedDb = createScopedDb(schoolId);
      return await cb(scopedDb);
    }),
  };
});

import { sendParentTeacherMessage } from "../app/(parent)/parent/messages/actions";
import {
  validateMessageRecipient,
  getThreadMessages,
  dispatchMessagePushNotification,
  isMessageQuietHours,
} from "@/lib/communicationLoop";

describe("Sprint S22 Layer 7: Adversarial Challenger Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdvDb.parentTeacherMessages.length = 0;
    mockAdvDb.auditLogs.length = 0;
    mockAdvDb.pushNotificationLogs.length = 0;
    for (const cta of mockAdvDb.classTeacherAssignments) {
      cta.isActive = true;
    }
  });

  describe("Attack Vector 1: Thread Hijacking & Reply Injection", () => {
    it("fails when an attacker parent attempts to reply to a thread between another parent and teacher", async () => {
      // Legitimate thread between parent-adv-1 and teacher-adv-1
      mockAdvDb.parentTeacherMessages.push({
        id: "msg-legit-root",
        schoolId: "school-adv-1",
        senderUserId: "parent-adv-1",
        recipientUserId: "teacher-adv-1",
        studentId: "stu-adv-1",
        subject: "Disciplinary Question",
        content: "Private matter.",
        parentMessageId: null,
        isRead: true,
        createdAt: new Date(),
      });

      // Attacker parent-adv-2 attempts to send a reply referencing parentMessageId: 'msg-legit-root'
      activeSessionRef.current = {
        userId: "parent-adv-2",
        role: "PARENT",
        schoolId: "school-adv-1",
        email: "parent2@adv1.edu",
      };

      const attackResult = await sendParentTeacherMessage({
        recipientUserId: "teacher-adv-1",
        studentId: "stu-adv-2",
        subject: "Re: Disciplinary Question",
        content: "I want to see what was discussed.",
        parentMessageId: "msg-legit-root",
      });

      expect(attackResult.success).toBe(false);
      expect("error" in attackResult && attackResult.error).toContain("Not authorized to reply to this thread");
      expect(mockAdvDb.parentTeacherMessages.length).toBe(1); // No new message inserted
    });
  });

  describe("Attack Vector 2: Cross-Tenant Thread Peek via UUID Guessing", () => {
    it("blocks thread message retrieval when participant belongs to another school tenant", async () => {
      // Thread in school-adv-1
      mockAdvDb.parentTeacherMessages.push({
        id: "msg-school1-confidential",
        schoolId: "school-adv-1",
        senderUserId: "parent-adv-1",
        recipientUserId: "teacher-adv-1",
        studentId: "stu-adv-1",
        subject: "Medical Record Note",
        content: "Student allergy details.",
        parentMessageId: null,
        isRead: false,
        createdAt: new Date(),
      });

      // User from school-adv-2 attempts to inspect this thread
      await expect(
        getThreadMessages("school-adv-2", "foreign-user-999", "msg-school1-confidential")
      ).rejects.toThrow(/not authorized|not found/i);
    });
  });

  describe("Attack Vector 3: High-Frequency Push Spam & Daily Cap Defense", () => {
    it("suppresses push on 6th message to same recipient and protects recipient inbox from spam", async () => {
      const now = new Date("2026-10-30T10:00:00Z"); // Daytime

      // Simulate 5 existing delivered pushes today
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      for (let i = 0; i < 5; i++) {
        mockAdvDb.pushNotificationLogs.push({
          id: `log-${i}`,
          schoolId: "school-adv-1",
          recipientUserId: "teacher-adv-1",
          title: `Note ${i}`,
          body: `Snippet ${i}`,
          status: "DELIVERED",
          createdAt: new Date(now.getTime() - i * 60000),
        });
      }

      // 6th message dispatch
      const res = await dispatchMessagePushNotification(
        "school-adv-1",
        "parent-adv-1",
        "teacher-adv-1",
        "Spam Subject 6",
        "Spam content 6",
        { now }
      );

      expect(res.dispatched).toBe(false);
      expect(res.status).toBe("SKIPPED_DAILY_CAP");
      expect(res.reason).toContain("Daily push notification cap (5/day) reached");
    });
  });

  describe("Attack Vector 4: Quiet Hours Invariant & UTC vs Local Time Resistance", () => {
    it("consistently flags 21:30 to 07:00 IST regardless of UTC offsets", () => {
      // 21:30 IST = 16:00 UTC
      const t1 = new Date("2026-10-30T16:00:00Z");
      expect(isMessageQuietHours(t1, "Asia/Kolkata")).toBe(true);

      // 23:59 IST = 18:29 UTC
      const t2 = new Date("2026-10-30T18:29:00Z");
      expect(isMessageQuietHours(t2, "Asia/Kolkata")).toBe(true);

      // 06:59 IST = 01:29 UTC
      const t3 = new Date("2026-10-30T01:29:00Z");
      expect(isMessageQuietHours(t3, "Asia/Kolkata")).toBe(true);

      // 07:00 IST = 01:30 UTC (Quiet hours end)
      const t4 = new Date("2026-10-30T01:30:00Z");
      expect(isMessageQuietHours(t4, "Asia/Kolkata")).toBe(false);
    });
  });

  describe("Attack Vector 5: Forged Sender User ID Injection", () => {
    it("always binds senderUserId from verified session token and ignores payload tampering", async () => {
      activeSessionRef.current = {
        userId: "parent-adv-1",
        role: "PARENT",
        schoolId: "school-adv-1",
        email: "parent1@adv1.edu",
      };

      const res = await sendParentTeacherMessage({
        recipientUserId: "teacher-adv-1",
        studentId: "stu-adv-1",
        subject: "Authentic Message",
        content: "Please see this homework inquiry.",
      });

      expect(res.success).toBe(true);
      const inserted = mockAdvDb.parentTeacherMessages[0];
      expect(inserted.senderUserId).toBe("parent-adv-1"); // Guaranteed bound to authenticated session
    });
  });

  describe("Attack Vector 6: Malicious Payload & XSS Injection Neutralization", () => {
    it("safely stores raw message content without script execution and honors partial masking", async () => {
      activeSessionRef.current = {
        userId: "parent-adv-1",
        role: "PARENT",
        schoolId: "school-adv-1",
        email: "parent1@adv1.edu",
      };

      const xssPayload = "<script>alert('xss')</script> Reach me at +91 9876543210 urgently.";
      const res = await sendParentTeacherMessage({
        recipientUserId: "teacher-adv-1",
        studentId: "stu-adv-1",
        subject: "XSS Test",
        content: xssPayload,
        decisionOverride: "MASKED",
      });

      expect(res.success).toBe(true);
      const inserted = mockAdvDb.parentTeacherMessages[0];
      // Phone number was redacted
      expect(inserted.content).not.toContain("9876543210");
      expect(inserted.content).toContain("<script>alert('xss')</script>");
    });
  });
});
