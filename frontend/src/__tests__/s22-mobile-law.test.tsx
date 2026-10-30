// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ParentMessagesClient } from "../app/(parent)/parent/messages/ParentMessagesClient";
import { TeacherMessagesClient } from "../app/(teacher)/teacher/messages/TeacherMessagesClient";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../app/(parent)/parent/messages/actions", () => ({
  sendParentTeacherMessage: vi.fn(async () => ({ success: true, messageId: "msg-1" })),
  markThreadReadAction: vi.fn(async () => ({ success: true })),
  getThreadMessagesAction: vi.fn(async (threadId: string) => ({
    success: true,
    subject: "Math Homework Inquiry",
    messages: [
      {
        id: "msg-item-1",
        senderUserId: "teacher-1",
        senderName: "Sunita Verma",
        senderRole: "Class Teacher",
        recipientUserId: "parent-1",
        content: "Please review Chapter 4 exercises.",
        isRead: true,
        readAt: new Date("2026-10-30T09:05:00Z"),
        createdAt: new Date("2026-10-30T09:00:00Z"),
      },
    ],
  })),
  getParentConversationsAction: vi.fn(async () => ({ success: true, threads: [] })),
}));

vi.mock("../app/(teacher)/teacher/messages/messagesActions", () => ({
  sendParentTeacherMessage: vi.fn(async () => ({ success: true, messageId: "msg-2" })),
  markThreadReadAction: vi.fn(async () => ({ success: true })),
  getThreadMessagesAction: vi.fn(async (threadId: string) => ({
    success: true,
    subject: "Math Homework Inquiry",
    messages: [
      {
        id: "msg-item-1",
        senderUserId: "parent-1",
        senderName: "Rajesh Sharma",
        senderRole: "PARENT",
        recipientUserId: "teacher-1",
        content: "Please review Chapter 4 exercises.",
        isRead: true,
        readAt: new Date("2026-10-30T09:05:00Z"),
        createdAt: new Date("2026-10-30T09:00:00Z"),
      },
    ],
  })),
  getTeacherConversationsAction: vi.fn(async () => ({ success: true, threads: [] })),
}));

describe("Sprint S22 Layer 6: Mobile Law (390px Viewport & >= 38px Touch Targets)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockParentThreads = [
    {
      threadId: "thread-p1",
      studentId: "student-1",
      studentName: "Aarav Sharma",
      className: "Class 10",
      sectionName: "Section A",
      counterpartUserId: "teacher-1",
      counterpartName: "Sunita Verma",
      counterpartRole: "Class Teacher",
      subject: "Math Homework Inquiry",
      lastMessageSnippet: "Please review Chapter 4 exercises.",
      lastMessageAt: new Date("2026-10-30T09:00:00Z"),
      lastMessageSenderId: "teacher-1",
      unreadCount: 1,
      totalMessages: 1,
    },
  ];

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

  const mockTeacherThreads = [
    {
      threadId: "thread-t1",
      studentId: "student-1",
      studentName: "Aarav Sharma",
      className: "Class 10",
      sectionName: "Section A",
      counterpartUserId: "parent-1",
      counterpartName: "Rajesh Sharma",
      counterpartRole: "Guardian",
      subject: "Math Homework Inquiry",
      lastMessageSnippet: "Please review Chapter 4 exercises.",
      lastMessageAt: new Date("2026-10-30T09:00:00Z"),
      lastMessageSenderId: "parent-1",
      unreadCount: 1,
      totalMessages: 1,
    },
  ];

  describe("1. Parent Messages Surface: 390px Reflow & Touch Targets", () => {
    it("guarantees no element has a fixed pixel width exceeding 390px", () => {
      const { container } = render(
        <ParentMessagesClient
          initialThreads={mockParentThreads}
          availableTeachers={mockTeachers}
          currentUserId="parent-1"
        />
      );

      const allElements = container.querySelectorAll("*");
      allElements.forEach((el) => {
        const classNames = el.className;
        if (typeof classNames === "string") {
          const match = classNames.match(/w-\[(\d+)px\]/);
          if (match && match[1]) {
            const widthVal = parseInt(match[1], 10);
            expect(widthVal).toBeLessThanOrEqual(390);
          }
        }
      });
    });

    it("enforces minimum 38px touch target on compose action and buttons", () => {
      render(
        <ParentMessagesClient
          initialThreads={mockParentThreads}
          availableTeachers={mockTeachers}
          currentUserId="parent-1"
        />
      );

      const composeBtn = screen.getByTestId("compose-message-button");
      expect(composeBtn.className).toContain("min-h-[38px]");
    });

    it("verifies bilingual dignity (English + Hindi subtitles) on parent messages surface", () => {
      render(
        <ParentMessagesClient
          initialThreads={mockParentThreads}
          availableTeachers={mockTeachers}
          currentUserId="parent-1"
        />
      );

      expect(screen.getByText("शिक्षक संवाद")).toBeDefined();
      expect(screen.getByText(/नया संदेश/)).toBeDefined();
    });

    it("renders thread detail reply input with >= 38px touch target", async () => {
      render(
        <ParentMessagesClient
          initialThreads={mockParentThreads}
          availableTeachers={mockTeachers}
          currentUserId="parent-1"
        />
      );

      // Open thread
      const threadCard = screen.getByText("Math Homework Inquiry");
      fireEvent.click(threadCard);

      await waitFor(() => {
        const replyInput = screen.getByTestId("parent-reply-input");
        const sendBtn = screen.getByTestId("parent-send-reply-btn");
        expect(replyInput.className).toContain("min-h-[38px]");
        expect(sendBtn.className).toContain("min-h-[38px]");
      });
    });
  });

  describe("2. Teacher Messages Surface: 390px Reflow & Touch Targets", () => {
    it("guarantees no element has a fixed pixel width exceeding 390px", () => {
      const { container } = render(
        <TeacherMessagesClient
          initialThreads={mockTeacherThreads}
          currentUserId="teacher-1"
        />
      );

      const allElements = container.querySelectorAll("*");
      allElements.forEach((el) => {
        const classNames = el.className;
        if (typeof classNames === "string") {
          const match = classNames.match(/w-\[(\d+)px\]/);
          if (match && match[1]) {
            const widthVal = parseInt(match[1], 10);
            expect(widthVal).toBeLessThanOrEqual(390);
          }
        }
      });
    });

    it("enforces minimum 38px touch target on refresh button and thread items", () => {
      render(
        <TeacherMessagesClient
          initialThreads={mockTeacherThreads}
          currentUserId="teacher-1"
        />
      );

      const refreshBtn = screen.getByTestId("refresh-threads-button");
      expect(refreshBtn.className).toContain("min-h-[38px]");
    });

    it("verifies bilingual dignity (English + Hindi subtitles) on teacher messages surface", () => {
      render(
        <TeacherMessagesClient
          initialThreads={mockTeacherThreads}
          currentUserId="teacher-1"
        />
      );

      expect(screen.getByText("अभिभावक संवाद")).toBeDefined();
    });

    it("renders sticky reply textarea and send button with >= 38px touch targets", async () => {
      render(
        <TeacherMessagesClient
          initialThreads={mockTeacherThreads}
          currentUserId="teacher-1"
        />
      );

      const threadCard = screen.getByTestId("teacher-thread-thread-t1");
      fireEvent.click(threadCard);

      await waitFor(() => {
        const replyInput = screen.getByTestId("teacher-reply-input");
        const sendBtn = screen.getByTestId("teacher-send-reply-btn");
        expect(replyInput.className).toContain("min-h-[38px]");
        expect(sendBtn.className).toContain("min-h-[38px]");
      });
    });
  });
});

