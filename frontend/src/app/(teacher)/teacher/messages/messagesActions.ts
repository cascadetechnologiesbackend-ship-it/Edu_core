"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import {
  getTeacherConversations,
  type ConversationThreadSummary,
  type ThreadMessageItem,
} from "@/lib/communicationLoop";
import {
  sendParentTeacherMessage as sendMsgAction,
  markThreadReadAction as markReadAction,
  getThreadMessagesAction as getMessagesAction,
  type SendMessageResult,
} from "@/app/(parent)/parent/messages/actions";

// Delegate Server Actions to preserve single write-path and read-path invariants
export async function sendParentTeacherMessage(
  input: Parameters<typeof sendMsgAction>[0]
): Promise<SendMessageResult> {
  return sendMsgAction(input);
}

export async function markThreadReadAction(
  threadId: string
): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
  return markReadAction(threadId);
}

export async function getThreadMessagesAction(
  threadId: string
): Promise<{
  success: boolean;
  subject?: string;
  messages: ThreadMessageItem[];
  error?: string;
}> {
  return getMessagesAction(threadId);
}

/**
 * Server Action: Retrieves conversation threads for the authenticated teacher,
 * strictly scoped to active allocations (homeroom + subject).
 */
export async function getTeacherConversationsAction(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ success: boolean; threads: ConversationThreadSummary[]; error?: string }> {
  try {
    const ctx = await requireAuth(["TEACHER", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);
    const threads = await getTeacherConversations(school.id, ctx.userId, options);
    return { success: true, threads };
  } catch (err: any) {
    console.error("getTeacherConversationsAction error:", err);
    return { success: false, threads: [], error: err.message || "Failed to load teacher conversations" };
  }
}

