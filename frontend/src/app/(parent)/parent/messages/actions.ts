"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { parentTeacherMessages } from "@/db/schema";
import { revalidatePath } from "next/cache";
import { scanContentForPII } from "@/lib/pii/scanEnforcement";
import { redactPII } from "@schoolmitra/entity-engine/dpdp-ner";

/**
 * Server Action: Parent-teacher message send with DPDP PII scan enforcement (Write-Point 2).
 */
export async function sendParentTeacherMessage(input: {
  recipientUserId: string;
  studentId: string;
  subject?: string;
  content: string;
  parentMessageId?: string;
  decisionOverride?: "CONFIRMED_SEND" | "MASKED";
}) {
  const ctx = await requireAuth([
    "PARENT",
    "TEACHER",
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
  ] as const);
  const school = await requireSchool(ctx);

  const surface =
    ctx.role === "PARENT" ? "parent.message.send" : "teacher.message.send";

  const piiCheck = await scanContentForPII({
    schoolId: school.id,
    actorUserId: ctx.userId,
    surface,
    sourceTable: "parent_teacher_messages",
    text: input.content,
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
      })
      .returning({ id: parentTeacherMessages.id });

    revalidatePath("/parent/messages");
    return { success: true, messageId: inserted?.id };
  });
}
