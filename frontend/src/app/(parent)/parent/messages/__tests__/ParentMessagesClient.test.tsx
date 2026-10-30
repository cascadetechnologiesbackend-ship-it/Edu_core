// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ParentMessagesClient } from "../ParentMessagesClient";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../actions", () => ({
  sendParentTeacherMessage: vi.fn(async () => ({ success: true, messageId: "msg-123" })),
  markThreadReadAction: vi.fn(async () => ({ success: true, updatedCount: 1 })),
  getThreadMessagesAction: vi.fn(async () => ({
    success: true,
    subject: "Math Homework Inquiry",
    messages: [
      {
        id: "msg-1",
        threadId: "thread-101",
        senderUserId: "teacher-1",
        senderName: "Sunita Verma",
        senderRole: "Teacher",
        recipientUserId: "parent-1",
        studentId: "student-1",
        subject: "Math Homework Inquiry",
        content: "Please check chapter 4 homework.",
        isRead: false,
        readAt: null,
        createdAt: new Date(),
        isMe: false,
      },
    ],
  })),
  getParentConversationsAction: vi.fn(async () => ({ success: true, threads: [] })),
}));

describe("ParentMessagesClient Component", () => {
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
      threadId: "thread-101",
      studentId: "student-1",
      studentName: "Aarav Sharma",
      className: "Class 10",
      sectionName: "Section A",
      counterpartUserId: "teacher-1",
      counterpartName: "Sunita Verma",
      counterpartRole: "Class Teacher",
      subject: "Math Homework Inquiry",
      lastMessageSnippet: "Please check chapter 4 homework.",
      lastMessageAt: new Date("2026-10-30T09:00:00Z"),
      lastMessageSenderId: "teacher-1",
      unreadCount: 1,
      totalMessages: 1,
    },
  ];

  it("1. Empty state renders without mailto placeholder and includes in-app compose action", () => {
    const { container } = render(
      <ParentMessagesClient
        initialThreads={[]}
        availableTeachers={mockTeachers}
        currentUserId="parent-1"
      />
    );

    // Verify ZERO mailto links exist in DOM (Flaw S22-F01 resolution)
    const mailtoLinks = container.querySelectorAll('a[href^="mailto:"]');
    expect(mailtoLinks.length).toBe(0);

    // Verify empty state text
    expect(screen.getByText("No Messages Yet")).toBeDefined();
    expect(screen.getByText(/Send Note to Teacher/)).toBeDefined();
  });

  it("2. Renders conversation thread with truthful teacher name, role, and unread badge", () => {
    render(
      <ParentMessagesClient
        initialThreads={mockThreads}
        availableTeachers={mockTeachers}
        currentUserId="parent-1"
      />
    );

    expect(screen.getByText("Sunita Verma")).toBeDefined();
    expect(screen.getByText("Class Teacher")).toBeDefined();
    expect(screen.getByText(/Aarav Sharma/)).toBeDefined();
    expect(screen.getByText("Math Homework Inquiry")).toBeDefined();
    expect(screen.getByText("1 new")).toBeDefined();
  });

  it("3. Clicking compose button opens AppModal compose sheet with teacher options", async () => {
    render(
      <ParentMessagesClient
        initialThreads={mockThreads}
        availableTeachers={mockTeachers}
        currentUserId="parent-1"
      />
    );

    const composeBtn = screen.getByTestId("compose-message-button");
    fireEvent.click(composeBtn);

    await waitFor(() => {
      expect(screen.getByText("Compose Message to Teacher")).toBeDefined();
      expect(screen.getAllByText(/Sunita Verma/).length).toBeGreaterThanOrEqual(2);
    });
  });

  it("4. Universal Scroll-and-Click Law: Compose button has minimum 38px touch target", () => {
    render(
      <ParentMessagesClient
        initialThreads={mockThreads}
        availableTeachers={mockTeachers}
        currentUserId="parent-1"
      />
    );

    const composeBtn = screen.getByTestId("compose-message-button");
    expect(composeBtn.className).toContain("min-h-[38px]");
  });
});
