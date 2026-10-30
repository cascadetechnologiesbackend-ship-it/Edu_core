"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { parentTeacherMessages } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { scanContentForPII } from "@/lib/pii/scanEnforcement";
import { redactPII } from "@schoolmitra/entity-engine/dpdp-ner";
import {
  resolveChildTeachers,
  validateMessageRecipient,
  getParentConversations,
  getThreadMessages,
  markThreadRead,
  getAdminModerationConversations,
  dispatchMessagePushNotification,
  type ComposableTeacherRecipient,
  type ConversationThreadSummary,
  type ThreadMessageItem,
} from "@/lib/communicationLoop";

export type { ComposableTeacherRecipient, ConversationThreadSummary, ThreadMessageItem };

export type SendMessageResult =
  | { success: true; messageId: string }
  | { success: false; blocked: true; decision: "BLOCKED"; detectedTypes: string[]; error: string }
  | { success: false; requiresConfirmation: true; riskLevel: "HIGH"; detectedTypes: string[]; message: string }
  | { success: false; error: string };

/**
 * Server Action: Parent-teacher message send with DPDP PII scan enforcement (Write-Point 2)
 * and allocation-scoped recipient verification.
 */
export async function sendParentTeacherMessage(input: {
  recipientUserId: string;
  studentId: string;
  subject?: string | undefined;
  content: string;
  parentMessageId?: string | undefined;
  decisionOverride?: ("CONFIRMED_SEND" | "MASKED") | undefined;
}): Promise<SendMessageResult> {
  const ctx = await requireAuth([
    "PARENT",
    "TEACHER",
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  try {
    // Validate recipient authorization (guard against raw ID injection)
    await validateMessageRecipient(
      school.id,
      ctx.userId,
      ctx.role,
      input.recipientUserId,
      input.studentId,
      input.parentMessageId,
    );
  } catch (err: any) {
    return { success: false, error: err.message || "Unauthorized recipient." };
  }

  const surface =
    ctx.role === "PARENT" ? "parent.message.send" : "teacher.message.send";

  const piiCheck = await scanContentForPII({
    schoolId: school.id,
    actorUserId: ctx.userId,
    surface,
    sourceTable: "parent_teacher_messages",
    text: input.content,
    isRelaxedHighWarn: true,
    ...(input.decisionOverride ? { decisionOverride: input.decisionOverride } : {}),
  });

  if (piiCheck.decision === "BLOCKED") {
    return {
      success: false,
      blocked: true,
      decision: "BLOCKED",
      detectedTypes: piiCheck.detectedTypes,
      error: `Message contains critical personal data (${piiCheck.detectedTypes.join(
        ", "
      )}). Please remove this sensitive data before sending.`,
    };
  }

  if (piiCheck.riskLevel === "HIGH" && !input.decisionOverride) {
    return {
      success: false,
      requiresConfirmation: true,
      riskLevel: "HIGH",
      detectedTypes: piiCheck.detectedTypes,
      message:
        "Message contains sensitive contact details. Choose whether to mask these values or confirm sending as-is.",
    };
  }

  let finalContent = input.content;
  if (input.decisionOverride === "MASKED") {
    const red = redactPII(input.content, { mode: "MASK_PARTIAL" });
    finalContent = red.redactedText;
  }

  return await withTenant(school.id, async (tx) => {
    const [inserted] = await tx
      .insert(parentTeacherMessages)
      .values({
        schoolId: school.id,
        senderUserId: ctx.userId,
        recipientUserId: input.recipientUserId,
        studentId: input.studentId,
        subject: input.subject || "Message",
        content: finalContent,
        parentMessageId: input.parentMessageId || null,
        isRead: false,
      })
      .returning({ id: parentTeacherMessages.id });

    // Non-blocking Web Push dispatch respecting quiet hours (21:30 - 07:00) and daily caps
    try {
      await dispatchMessagePushNotification(
        school.id,
        ctx.userId,
        input.recipientUserId,
        input.subject || "Message",
        finalContent,
        { txDb: tx },
      );
    } catch (pushErr) {
      console.error("Non-blocking message push notification error:", pushErr);
    }

    revalidatePath("/parent/messages");
    revalidatePath("/teacher/messages");
    revalidatePath("/parent/dashboard");
    revalidatePath("/teacher/dashboard");
    return { success: true, messageId: inserted?.id || "" };
  });
}

/**
 * Server Action: Discovers all active teachers (homeroom + subject) for a parent's children.
 */
export async function resolveChildTeachersAction(
  studentIdFilter?: string,
): Promise<{ success: boolean; teachers: ComposableTeacherRecipient[]; error?: string }> {
  try {
    const ctx = await requireAuth(["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);
    const teachers = await resolveChildTeachers(school.id, ctx.userId, studentIdFilter);
    return { success: true, teachers };
  } catch (err: any) {
    console.error("resolveChildTeachersAction error:", err);
    return { success: false, teachers: [], error: err.message || "Failed to load teachers" };
  }
}

/**
 * Server Action: Retrieves conversation threads for the authenticated parent.
 */
export async function getParentConversationsAction(
  studentId?: string,
): Promise<{ success: boolean; threads: ConversationThreadSummary[]; error?: string }> {
  try {
    const ctx = await requireAuth(["PARENT", "SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);
    const threads = await getParentConversations(
      school.id,
      ctx.userId,
      studentId ? { studentId } : undefined,
    );
    return { success: true, threads };
  } catch (err: any) {
    console.error("getParentConversationsAction error:", err);
    return { success: false, threads: [], error: err.message || "Failed to load conversations" };
  }
}

/**
 * Server Action: Retrieves messages for a conversation thread.
 */
export async function getThreadMessagesAction(
  threadId: string,
): Promise<{ success: boolean; subject?: string; messages: ThreadMessageItem[]; error?: string }> {
  try {
    const ctx = await requireAuth([
      "PARENT",
      "TEACHER",
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
    ] as const);
    const school = await requireSchool(ctx);
    const res = await getThreadMessages(school.id, ctx.userId, threadId, ctx.role);
    return { success: true, subject: res.subject, messages: res.messages };
  } catch (err: any) {
    console.error("getThreadMessagesAction error:", err);
    return { success: false, messages: [], error: err.message || "Failed to load thread messages" };
  }
}

/**
 * Server Action: Marks all unread messages in a thread as read by the recipient.
 */
export async function markThreadReadAction(
  threadId: string,
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  try {
    const ctx = await requireAuth([
      "PARENT",
      "TEACHER",
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
    ] as const);
    const school = await requireSchool(ctx);
    const res = await markThreadRead(school.id, ctx.userId, threadId);
    revalidatePath("/parent/messages");
    revalidatePath("/teacher/messages");
    return { success: true, updatedCount: res.updatedCount };
  } catch (err: any) {
    console.error("markThreadReadAction error:", err);
    return { success: false, updatedCount: 0, error: err.message || "Failed to mark thread as read" };
  }
}

/**
 * Server Action: Logged read-only moderation audit view for principals and admins (OD4).
 */
export async function getAdminModerationConversationsAction(options?: {
  limit?: number;
  offset?: number;
}): Promise<{ success: boolean; threads: ConversationThreadSummary[]; error?: string }> {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"] as const);
    const school = await requireSchool(ctx);
    const threads = await getAdminModerationConversations(school.id, ctx.userId, options);
    return { success: true, threads };
  } catch (err: any) {
    console.error("getAdminModerationConversationsAction error:", err);
    return { success: false, threads: [], error: err.message || "Failed to load moderation conversations" };
  }
}
