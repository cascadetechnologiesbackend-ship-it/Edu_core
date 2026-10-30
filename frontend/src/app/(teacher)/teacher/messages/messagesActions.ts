"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import {
  getTeacherConversations,
  type ConversationThreadSummary,
} from "@/lib/communicationLoop";

// Re-export single write path & read actions to strictly preserve one write path per invariant
export {
  sendParentTeacherMessage,
  markThreadReadAction,
  getThreadMessagesAction,
  type ConversationThreadSummary,
  type ThreadMessageItem,
} from "@/app/(parent)/parent/messages/actions";

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

