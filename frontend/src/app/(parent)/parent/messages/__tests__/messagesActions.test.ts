import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks
const mockSession = {
  userId: "user-parent-1",
  role: "PARENT",
  email: "parent@school.internal",
};

const mockSchool = {
  id: "school-uuid-1",
  name: "Test School",
};

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async () => mockSession),
  requireSchool: vi.fn(async () => mockSchool),
}));

vi.mock("@/db", () => ({
  db: {},
  withTenant: vi.fn(async (schoolId, callback) => callback({})),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockTeachers = [
  {
    teacherUserId: "teacher-1",
    teacherName: "Sunita Verma",
    roleTitle: "Class Teacher",
    subjectName: null,
    isClassTeacher: true,
    studentId: "student-1",
    studentName: "Aarav Sharma",
    className: "Class 10",
    sectionName: "Section A",
  },
];

const mockThreads = [
  {
    threadId: "thread-1",
    studentId: "student-1",
    studentName: "Aarav Sharma",
    className: "Class 10",
    sectionName: "Section A",
    counterpartUserId: "teacher-1",
    counterpartName: "Sunita Verma",
    counterpartRole: "Teacher",
    subject: "Math Homework Inquiry",
    lastMessageSnippet: "Please submit homework",
    lastMessageAt: new Date(),
    lastMessageSenderId: "teacher-1",
    unreadCount: 1,
    totalMessages: 2,
  },
];

vi.mock("@/lib/communicationLoop", () => ({
  resolveChildTeachers: vi.fn(async () => mockTeachers),
  validateMessageRecipient: vi.fn(async () => true),
  getParentConversations: vi.fn(async () => mockThreads),
  getTeacherConversations: vi.fn(async () => mockThreads),
  getThreadMessages: vi.fn(async () => ({
    subject: "Math Homework Inquiry",
    messages: [
      {
        id: "msg-1",
        threadId: "thread-1",
        senderUserId: "user-parent-1",
        senderName: "You",
        senderRole: "Parent",
        recipientUserId: "teacher-1",
        studentId: "student-1",
        subject: "Math Homework Inquiry",
        content: "Question about chapter 3",
        isRead: true,
        readAt: new Date(),
        createdAt: new Date(),
        isMe: true,
      },
    ],
  })),
  markThreadRead: vi.fn(async () => ({ success: true, updatedCount: 1 })),
  getAdminModerationConversations: vi.fn(async () => mockThreads),
}));

vi.mock("@/lib/pii/scanEnforcement", () => ({
  scanContentForPII: vi.fn(async ({ text }: { text: string }) => {
    if (text.includes("4123 4567 8901")) {
      return {
        decision: "BLOCKED",
        riskLevel: "CRITICAL",
        detectedTypes: ["AADHAAR"],
      };
    }
    if (text.includes("9876543210")) {
      return {
        decision: "REQUIRES_CONFIRMATION",
        riskLevel: "HIGH",
        detectedTypes: ["PHONE_NUMBER"],
      };
    }
    return {
      decision: "ALLOWED",
      riskLevel: "LOW",
      detectedTypes: [],
    };
  }),
}));

import {
  resolveChildTeachersAction,
  getParentConversationsAction,
  getThreadMessagesAction,
  markThreadReadAction,
  sendParentTeacherMessage,
} from "../actions";

describe("Parent-Teacher Messaging Server Actions", () => {
  it("resolveChildTeachersAction returns mapped teacher recipients", async () => {
    const res = await resolveChildTeachersAction();
    expect(res.success).toBe(true);
    expect(res.teachers).toHaveLength(1);
    expect(res.teachers[0]?.isClassTeacher).toBe(true);
    expect(res.teachers[0]?.teacherName).toBe("Sunita Verma");
  });

  it("getParentConversationsAction retrieves conversation thread summaries", async () => {
    const res = await getParentConversationsAction();
    expect(res.success).toBe(true);
    expect(res.threads).toHaveLength(1);
    expect(res.threads[0]?.unreadCount).toBe(1);
    expect(res.threads[0]?.subject).toBe("Math Homework Inquiry");
  });

  it("getThreadMessagesAction retrieves ordered messages for thread", async () => {
    const res = await getThreadMessagesAction("thread-1");
    expect(res.success).toBe(true);
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0]?.isMe).toBe(true);
  });

  it("markThreadReadAction marks thread as read", async () => {
    const res = await markThreadReadAction("thread-1");
    expect(res.success).toBe(true);
    expect(res.updatedCount).toBe(1);
  });

  it("sendParentTeacherMessage blocks critical PII (Aadhaar)", async () => {
    const res = await sendParentTeacherMessage({
      recipientUserId: "teacher-1",
      studentId: "student-1",
      subject: "Test",
      content: "Student Aadhaar is 4123 4567 8901",
    });

    expect(res.success).toBe(false);
    expect(res.blocked).toBe(true);
    expect(res.decision).toBe("BLOCKED");
    expect(res.detectedTypes).toContain("AADHAAR");
  });

  it("sendParentTeacherMessage warns on high risk contact info without confirmation", async () => {
    const res = await sendParentTeacherMessage({
      recipientUserId: "teacher-1",
      studentId: "student-1",
      subject: "Test",
      content: "Call me at 9876543210 urgently",
    });

    expect(res.success).toBe(false);
    expect(res.requiresConfirmation).toBe(true);
    expect(res.riskLevel).toBe("HIGH");
  });
});
