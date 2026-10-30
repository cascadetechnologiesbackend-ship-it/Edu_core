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

const { activeSessionRef, mockWalkthroughDb } = vi.hoisted(() => {
  const activeSessionRef = {
    current: {
      userId: "parent-walk-1",
      role: "PARENT",
      schoolId: "school-walk-1",
      email: "rajesh.parent@delhipublic.edu",
    } as any,
  };

  const mockWalkthroughDb = {
    schools: [
      { id: "school-walk-1", name: "Delhi Public School" },
    ],
    users: [
      { id: "parent-walk-1", schoolId: "school-walk-1", role: "PARENT", email: "rajesh.parent@delhipublic.edu", fullName: "Rajesh Sharma" },
      { id: "teacher-walk-1", schoolId: "school-walk-1", role: "TEACHER", email: "sunita.verma@delhipublic.edu", fullName: "Sunita Verma" },
    ],
    persons: [
      { id: "per-p1", schoolId: "school-walk-1", userId: "parent-walk-1", firstNameEncrypted: "enc_Rajesh", lastNameEncrypted: "enc_Sharma", primaryType: "GUARDIAN" },
      { id: "per-t1", schoolId: "school-walk-1", userId: "teacher-walk-1", firstNameEncrypted: "enc_Sunita", lastNameEncrypted: "enc_Verma", primaryType: "STAFF" },
    ],
    classes: [
      { id: "cls-10", schoolId: "school-walk-1", name: "Class 10", displayName: "Class 10" },
    ],
    sections: [
      { id: "sec-10a", schoolId: "school-walk-1", classId: "cls-10", name: "A" },
    ],
    students: [
      {
        id: "stu-aarav",
        schoolId: "school-walk-1",
        currentClassId: "cls-10",
        currentSectionId: "sec-10a",
        admissionNumber: "ADM-2026-001",
        firstNameEncrypted: "enc_Aarav",
        lastNameEncrypted: "enc_Sharma",
        isActive: true,
      },
    ],
    studentFamilyMembers: [
      { id: "fam-1", schoolId: "school-walk-1", studentId: "stu-aarav", userId: "parent-walk-1", relationship: "FATHER", isPrimaryContact: true },
    ],
    classTeacherAssignments: [
      { id: "cta-1", schoolId: "school-walk-1", sectionId: "sec-10a", teacherId: "teacher-walk-1", isActive: true },
    ],
    sectionSubjectTeachers: [] as any[],
    classSubjects: [] as any[],
    subjects: [] as any[],
    parentTeacherMessages: [] as any[],
    pushNotificationLogs: [] as any[],
    auditLogs: [] as any[],
  };

  return { activeSessionRef, mockWalkthroughDb };
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
    return { id: ctx.schoolId, name: "Delhi Public School" };
  }),
}));

// ─── 4. Mock Database with Scoping ──────────────────────────────────────────
vi.mock("@/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/db")>();

  const createScopedDb = (schoolId: string): any => {
    return {
      query: {
        schools: {
          findFirst: vi.fn(async () =>
            mockWalkthroughDb.schools.find((s) => s.id === schoolId)
          ),
        },
        users: {
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            for (const u of mockWalkthroughDb.users) {
              if (u.schoolId === schoolId && str.includes(u.id)) {
                return u;
              }
            }
            return mockWalkthroughDb.users.find((u) => u.schoolId === schoolId);
          }),
          findMany: vi.fn(async () =>
            mockWalkthroughDb.users.filter((u) => u.schoolId === schoolId)
          ),
        },
        classes: {
          findMany: vi.fn(async () =>
            mockWalkthroughDb.classes.filter((c) => c.schoolId === schoolId)
          ),
        },
        sections: {
          findMany: vi.fn(async () =>
            mockWalkthroughDb.sections.filter((s) => s.schoolId === schoolId)
          ),
        },
        students: {
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            for (const s of mockWalkthroughDb.students) {
              if (s.schoolId === schoolId && str.includes(s.id)) {
                return s;
              }
            }
            return mockWalkthroughDb.students.find((s) => s.schoolId === schoolId);
          }),
          findMany: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockWalkthroughDb.students.filter((s) => {
              if (s.schoolId !== schoolId) return false;
              if (str.includes("sec-10a") && s.currentSectionId !== "sec-10a") return false;
              return true;
            });
          }),
        },
        studentFamilyMembers: {
          findMany: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockWalkthroughDb.studentFamilyMembers.filter((f) => {
              if (f.schoolId !== schoolId) return false;
              if (str.includes("parent-walk-1") && f.userId !== "parent-walk-1") return false;
              return true;
            });
          }),
          findFirst: vi.fn(async () => mockWalkthroughDb.studentFamilyMembers[0] || null),
        },
        classTeacherAssignments: {
          findMany: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockWalkthroughDb.classTeacherAssignments.filter((cta) => {
              if (cta.schoolId !== schoolId || !cta.isActive) return false;
              if (str.includes("teacher-walk-1") && cta.teacherId !== "teacher-walk-1") return false;
              return true;
            });
          }),
          findFirst: vi.fn(async () => mockWalkthroughDb.classTeacherAssignments[0] || null),
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
            for (const p of mockWalkthroughDb.persons) {
              if (p.schoolId === schoolId && str.includes(p.userId)) {
                return p;
              }
            }
            return mockWalkthroughDb.persons.find((p) => p.schoolId === schoolId);
          }),
          findMany: vi.fn(async () =>
            mockWalkthroughDb.persons.filter((p) => p.schoolId === schoolId)
          ),
        },
        parentTeacherMessages: {
          findMany: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            return mockWalkthroughDb.parentTeacherMessages.filter((m) => {
              if (m.schoolId !== schoolId) return false;
              if (str.includes("teacher-walk-1") && m.senderUserId !== "teacher-walk-1" && m.recipientUserId !== "teacher-walk-1") {
                return false;
              }
              if (str.includes("parent-walk-1") && m.senderUserId !== "parent-walk-1" && m.recipientUserId !== "parent-walk-1") {
                return false;
              }
              return true;
            });
          }),
          findFirst: vi.fn(async (opts?: any) => {
            const str = safeInspect(opts?.where);
            for (const m of mockWalkthroughDb.parentTeacherMessages) {
              if (m.schoolId === schoolId && str.includes(m.id)) {
                return m;
              }
            }
            return mockWalkthroughDb.parentTeacherMessages.find((m) => m.schoolId === schoolId) || null;
          }),
        },
        pushNotificationLogs: {
          findMany: vi.fn(async () =>
            mockWalkthroughDb.pushNotificationLogs.filter((p) => p.schoolId === schoolId)
          ),
        },
        auditLogs: {
          findMany: vi.fn(async () =>
            mockWalkthroughDb.auditLogs.filter((a) => a.schoolId === schoolId)
          ),
        },
      },
      insert: vi.fn((table: any) => ({
        values: vi.fn((val: any) => {
          const row = {
            id: val.id || `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            createdAt: new Date(),
            isRead: false,
            readAt: null,
            ...val,
          };
          if (val.content !== undefined) {
            mockWalkthroughDb.parentTeacherMessages.push(row);
          } else if (val.recipientUserId !== undefined) {
            mockWalkthroughDb.pushNotificationLogs.push(row);
          }
          return {
            returning: vi.fn(() => [row]),
          };
        }),
      })),
      update: vi.fn((table: any) => ({
        set: vi.fn((patch: any) => ({
          where: vi.fn((condition: any) => {
            const str = safeInspect(condition);
            for (const m of mockWalkthroughDb.parentTeacherMessages) {
              if (str.includes(m.id) || (m.parentMessageId && str.includes(m.parentMessageId))) {
                Object.assign(m, patch);
              }
            }
            return Promise.resolve();
          }),
        })),
      })),
      transaction: vi.fn(async (cb: any) => {
        return await cb(createScopedDb(schoolId));
      }),
      execute: vi.fn(async () => []),
    };
  };

  const defaultDb = createScopedDb("school-walk-1");

  return {
    ...actual,
    db: defaultDb,
    withTenant: vi.fn(async (schoolId: string, cb: any) => {
      const scopedDb = createScopedDb(schoolId);
      return await cb(scopedDb);
    }),
  };
});

import { sendParentTeacherMessage } from "../app/(parent)/parent/messages/actions";
import {
  resolveChildTeachers,
  getParentConversations,
  getTeacherConversations,
  getThreadMessages,
  markThreadRead,
} from "@/lib/communicationLoop";

describe("Sprint S22 Layer 8: Live Two-Way Communication Loop Walkthrough", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWalkthroughDb.parentTeacherMessages.length = 0;
    mockWalkthroughDb.pushNotificationLogs.length = 0;
    mockWalkthroughDb.auditLogs.length = 0;
  });

  it("completes the full parent-to-teacher inquiry and teacher-to-parent reply loop with read receipts", async () => {
    const schoolId = "school-walk-1";

    // ─── Step 1: Parent Rajesh logs in and discovers assigned teachers ───────
    activeSessionRef.current = {
      userId: "parent-walk-1",
      role: "PARENT",
      schoolId,
      email: "rajesh.parent@delhipublic.edu",
    };

    const teachers = await resolveChildTeachers(schoolId, "parent-walk-1", "stu-aarav");
    expect(teachers.length).toBe(1);
    expect(teachers[0]!.teacherName).toBe("Sunita Verma");
    expect(teachers[0]!.roleTitle).toBe("Class Teacher");
    expect(teachers[0]!.isClassTeacher).toBe(true);

    // ─── Step 2: Parent Rajesh composes message to Teacher Sunita ───────────
    const sendInquiryResult = await sendParentTeacherMessage({
      recipientUserId: teachers[0]!.teacherUserId,
      studentId: "stu-aarav",
      subject: "Math Homework Doubt - Chapter 5",
      content: "Sunita ma'am, Aarav had a question regarding problem #4 from chapter 5. Could you please clarify?",
    });

    expect(sendInquiryResult.success).toBe(true);
    expect(mockWalkthroughDb.parentTeacherMessages.length).toBe(1);
    const rootMsg = mockWalkthroughDb.parentTeacherMessages[0]!;
    const threadId = rootMsg.id;
    expect(rootMsg.senderUserId).toBe("parent-walk-1");
    expect(rootMsg.recipientUserId).toBe("teacher-walk-1");
    expect(rootMsg.isRead).toBe(false);

    // ─── Step 3: Teacher Sunita checks educator inbox ────────────────────────
    activeSessionRef.current = {
      userId: "teacher-walk-1",
      role: "TEACHER",
      schoolId,
      email: "sunita.verma@delhipublic.edu",
    };

    const teacherInbox = await getTeacherConversations(schoolId, "teacher-walk-1");
    expect(teacherInbox.length).toBe(1);
    expect(teacherInbox[0]!.threadId).toBe(threadId);
    expect(teacherInbox[0]!.unreadCount).toBe(1);
    expect(teacherInbox[0]!.counterpartName).toBe("Rajesh Sharma");
    expect(teacherInbox[0]!.counterpartRole).toBe("Parent");
    expect(teacherInbox[0]!.studentName).toBe("Aarav Sharma");
    expect(teacherInbox[0]!.className).toBe("Class 10");
    expect(teacherInbox[0]!.sectionName).toBe("A");

    // ─── Step 4: Teacher Sunita opens thread and marks it read ───────────────
    const threadBeforeReply = await getThreadMessages(schoolId, "teacher-walk-1", threadId, "TEACHER");
    expect(threadBeforeReply.messages.length).toBe(1);
    expect(threadBeforeReply.messages[0]!.isMe).toBe(false); // Sent by parent
    expect(threadBeforeReply.messages[0]!.senderName).toBe("Rajesh Sharma");

    await markThreadRead(schoolId, "teacher-walk-1", threadId);
    expect(mockWalkthroughDb.parentTeacherMessages[0]!.isRead).toBe(true);
    expect(mockWalkthroughDb.parentTeacherMessages[0]!.readAt).toBeDefined();

    // ─── Step 5: Teacher Sunita replies to Parent Rajesh ─────────────────────
    const sendReplyResult = await sendParentTeacherMessage({
      recipientUserId: "parent-walk-1",
      studentId: "stu-aarav",
      parentMessageId: threadId,
      subject: "Re: Math Homework Doubt - Chapter 5",
      content: "Namaste Rajesh ji, problem #4 asks for prime factorization. I will review this with the class tomorrow morning.",
    });

    expect(sendReplyResult.success).toBe(true);
    expect(mockWalkthroughDb.parentTeacherMessages.length).toBe(2);
    const replyMsg = mockWalkthroughDb.parentTeacherMessages[1]!;
    expect(replyMsg.parentMessageId).toBe(threadId);
    expect(replyMsg.senderUserId).toBe("teacher-walk-1");
    expect(replyMsg.recipientUserId).toBe("parent-walk-1");
    expect(replyMsg.isRead).toBe(false);

    // ─── Step 6: Parent Rajesh opens app and views updated thread ────────────
    activeSessionRef.current = {
      userId: "parent-walk-1",
      role: "PARENT",
      schoolId,
      email: "rajesh.parent@delhipublic.edu",
    };

    const parentInbox = await getParentConversations(schoolId, "parent-walk-1");
    expect(parentInbox.length).toBe(1);
    expect(parentInbox[0]!.totalMessages).toBe(2);
    expect(parentInbox[0]!.unreadCount).toBe(1);
    expect(parentInbox[0]!.lastMessageSnippet).toContain("problem #4 asks for prime factorization");

    // Parent inspects full thread
    const fullThread = await getThreadMessages(schoolId, "parent-walk-1", threadId, "PARENT");
    expect(fullThread.messages.length).toBe(2);

    // Message 1 (Parent's inquiry)
    expect(fullThread.messages[0]!.isMe).toBe(true);
    expect(fullThread.messages[0]!.senderName).toBe("You");
    expect(fullThread.messages[0]!.isRead).toBe(true); // Seen by teacher!

    // Message 2 (Teacher's reply)
    expect(fullThread.messages[1]!.isMe).toBe(false);
    expect(fullThread.messages[1]!.senderName).toBe("Sunita Verma");
    expect(fullThread.messages[1]!.isRead).toBe(false);

    // Parent marks reply as read
    await markThreadRead(schoolId, "parent-walk-1", threadId);
    expect(mockWalkthroughDb.parentTeacherMessages[1]!.isRead).toBe(true);

    // Post-read inbox check: zero unread messages
    const postReadInbox = await getParentConversations(schoolId, "parent-walk-1");
    expect(postReadInbox[0]!.unreadCount).toBe(0);
  });
});
