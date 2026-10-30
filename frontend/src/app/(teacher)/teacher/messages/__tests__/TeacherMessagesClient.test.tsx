// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TeacherMessagesClient } from "../TeacherMessagesClient";
import type { ConversationThreadSummary, ThreadMessageItem } from "../messagesActions";

// Mock server actions
vi.mock("../messagesActions", () => ({
  sendParentTeacherMessage: vi.fn().mockResolvedValue({ success: true, messageId: "msg-reply-1" }),
  markThreadReadAction: vi.fn().mockResolvedValue({ success: true }),
  getThreadMessagesAction: vi.fn().mockImplementation((threadId: string) => {
    return Promise.resolve({
      success: true,
      subject: "Math Homework Inquiry",
      messages: [
        {
          id: threadId,
          senderUserId: "parent-1",
          senderName: "Rajesh Sharma",
          senderRole: "PARENT",
          recipientUserId: "teacher-1",
          content: "Please check chapter 4 homework.",
          isRead: true,
          readAt: new Date("2026-10-30T09:05:00Z"),
          createdAt: new Date("2026-10-30T09:00:00Z"),
        },
      ] as ThreadMessageItem[],
    });
  }),
  getTeacherConversationsAction: vi.fn().mockResolvedValue({ success: true, threads: [] }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Sprint S22 Layer 3: Teacher PWA Messages Surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockThreads: ConversationThreadSummary[] = [
    {
      threadId: "msg-root-1",
      studentId: "student-1",
      studentName: "Aarav Sharma",
      className: "Class 10",
      sectionName: "Section A",
      counterpartUserId: "parent-1",
      counterpartName: "Rajesh Sharma",
      counterpartRole: "Guardian",
      subject: "Math Homework Inquiry",
      lastMessageSnippet: "Please check chapter 4 homework.",
      lastMessageAt: new Date("2026-10-30T09:00:00Z"),
      lastMessageSenderId: "parent-1",
      unreadCount: 1,
      totalMessages: 1,
    },
  ];

  it("1. Empty state renders with clean explanation and ZERO mailto links", () => {
    const { container } = render(
      <TeacherMessagesClient
        initialThreads={[]}
        currentUserId="teacher-1"
      />
    );

    // Verify ZERO mailto links exist in DOM
    const mailtoLinks = container.querySelectorAll('a[href^="mailto:"]');
    expect(mailtoLinks.length).toBe(0);

    // Verify clean empty state
    expect(screen.getByText("No Parent Messages Yet")).toBeDefined();
    expect(
      screen.getByText(/When parents of students in your assigned classes or subjects send academic inquiries/)
    ).toBeDefined();
  });

  it("2. Renders conversation thread with parent name, student info, and unread badge", () => {
    render(
      <TeacherMessagesClient
        initialThreads={mockThreads}
        currentUserId="teacher-1"
      />
    );

    expect(screen.getByText("Rajesh Sharma")).toBeDefined();
    expect(screen.getByText(/Aarav Sharma/)).toBeDefined();
    expect(screen.getByText("Math Homework Inquiry")).toBeDefined();
    expect(screen.getAllByText("1 new").length).toBe(2);
  });

  it("3. Opening a thread displays messages and sticky reply box with >= 38px touch targets", async () => {
    render(
      <TeacherMessagesClient
        initialThreads={mockThreads}
        currentUserId="teacher-1"
      />
    );

    const threadCard = screen.getByTestId("teacher-thread-msg-root-1");
    fireEvent.click(threadCard);

    await waitFor(() => {
      expect(screen.getByText("Please check chapter 4 homework.")).toBeDefined();
      expect(screen.getByTestId("teacher-reply-input")).toBeDefined();
      expect(screen.getByTestId("teacher-send-reply-btn")).toBeDefined();
    });

    // Touch target law: send reply button min-h >= 38px
    const sendBtn = screen.getByTestId("teacher-send-reply-btn");
    expect(sendBtn.className).toContain("min-h-[38px]");
  });

  it("4. Back button returns to thread list view", async () => {
    render(
      <TeacherMessagesClient
        initialThreads={mockThreads}
        currentUserId="teacher-1"
      />
    );

    const threadCard = screen.getByTestId("teacher-thread-msg-root-1");
    fireEvent.click(threadCard);

    await waitFor(() => {
      expect(screen.getByTestId("back-to-threads-button")).toBeDefined();
    });

    fireEvent.click(screen.getByTestId("back-to-threads-button"));

    await waitFor(() => {
      expect(screen.getByText("Rajesh Sharma")).toBeDefined();
    });
  });
});
