"use server";

import { withTenant } from "@/db";
import { feeStructures, feeInvoices, students, feeConcessions } from "@/db/schema";
import { eq, and, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { logFeeAuditEvent } from "@/lib/auditLogger";
import crypto from "crypto";

function toPaise(val: number | string | null | undefined): number {
  const n = typeof val === "string" ? parseFloat(val) : Number(val ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function fromPaise(paise: number): string {
  return (paise / 100).toFixed(2);
}

export async function assignFeeStructure(formData: FormData) {
  try {
    const ctx = await requireAuth(["SUPER_ADMIN", "SCHOOL_ADMIN"] as const);
    const school = await requireSchool(ctx);

    const academicYearId = formData.get("academicYearId") as string;
    const classId = formData.get("classId") as string;
    const feeHeadId = formData.get("feeHeadId") as string;
    const term = (formData.get("term") as any) || "ANNUAL";
    const amountStr = formData.get("amount") as string;
    const dueDateStr = formData.get("dueDate") as string;
    const lateFeeAmountStr = (formData.get("lateFeeAmount") as string) || "0";
    const autoGenerateInvoices =
      formData.get("autoGenerateInvoices") === "on" ||
      formData.get("autoGenerateInvoices") === "true";

    const amountPaise = toPaise(amountStr);
    const lateFeePaise = Math.max(0, toPaise(lateFeeAmountStr));
    if (!academicYearId || !classId || !feeHeadId || amountPaise <= 0 || !dueDateStr) {
      return { success: false, message: "Missing or invalid required structure fields" };
    }

    const dueDate = new Date(dueDateStr);

    await withTenant(school.id, async (tx) => {
      let structureId: string;

      const existing = await tx.query.feeStructures.findFirst({
        where: and(
          eq(feeStructures.schoolId, school.id),
          eq(feeStructures.academicYearId, academicYearId),
          eq(feeStructures.classId, classId),
          eq(feeStructures.feeHeadId, feeHeadId),
          eq(feeStructures.term, term),
        ),
      });

      if (existing) {
        await tx
          .update(feeStructures)
          .set({
            amount: fromPaise(amountPaise),
            dueDate,
            lateFeeAmount: fromPaise(lateFeePaise),
            updatedAt: new Date(),
          })
          .where(and(eq(feeStructures.id, existing.id), eq(feeStructures.schoolId, school.id)));
        structureId = existing.id;
      } else {
        const [newStruct] = await tx
          .insert(feeStructures)
          .values({
            schoolId: school.id,
            academicYearId,
            classId,
            feeHeadId,
            term,
            amount: fromPaise(amountPaise),
            dueDate,
            lateFeeAmount: fromPaise(lateFeePaise),
            isActive: true,
          })
          .returning();
        if (!newStruct) throw new Error("Failed to create fee structure.");
        structureId = newStruct.id;
      }

      let generatedCount = 0;

      if (autoGenerateInvoices) {
        const classStudents = await tx.query.students.findMany({
          where: and(
            eq(students.schoolId, school.id),
            eq(students.currentClassId, classId),
            eq(students.isActive, true),
          ),
        });

        const studentIds = classStudents.map((s) => s.id);
        const studentConcessions =
          studentIds.length > 0
            ? await tx.query.feeConcessions.findMany({
                where: and(
                  eq(feeConcessions.schoolId, school.id),
                  eq(feeConcessions.academicYearId, academicYearId),
                  eq(feeConcessions.isActive, true),
                  isNotNull(feeConcessions.studentId),
                  isNotNull(feeConcessions.approvedAt),
                  inArray(feeConcessions.studentId, studentIds),
                ),
              })
            : [];

        for (const st of classStudents) {
          const existingInv = await tx.query.feeInvoices.findFirst({
            where: and(
              eq(feeInvoices.studentId, st.id),
              eq(feeInvoices.feeStructureId, structureId),
            ),
          });

          if (!existingInv) {
            const studentConcessionList = studentConcessions.filter(
              (c) => c.studentId === st.id,
            );
            const applicableConcession = studentConcessionList.find(
              (c) => c.appliesTo === "ALL" || c.appliesTo === feeHeadId,
            );

            let discountPaise = 0;
            if (applicableConcession) {
              if (applicableConcession.discountPercentage) {
                const pctBps = Math.round(
                  parseFloat(applicableConcession.discountPercentage) * 100,
                );
                discountPaise = Math.round((amountPaise * pctBps) / 10000);
              } else if (applicableConcession.discountAmount) {
                discountPaise = toPaise(applicableConcession.discountAmount);
              }
            }
            if (discountPaise > amountPaise) discountPaise = amountPaise;
            if (discountPaise < 0) discountPaise = 0;
            const netPaise = Math.max(0, amountPaise - discountPaise);

            const invNum = `INV-${new Date().getFullYear()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
            await tx.insert(feeInvoices).values({
              invoiceNumber: invNum,
              schoolId: school.id,
              studentId: st.id,
              academicYearId,
              feeStructureId: structureId,
              grossAmount: fromPaise(amountPaise),
              discountAmount: fromPaise(discountPaise),
              lateFeeAmount: "0.00",
              taxAmount: "0.00",
              netAmount: fromPaise(netPaise),
              paidAmount: "0.00",
              balanceAmount: fromPaise(netPaise),
              dueDate,
              term,
              status: "PENDING",
            });
            generatedCount++;
          }
        }
      }

      await logFeeAuditEvent(tx, {
        schoolId: school.id,
        action: existing ? "UPDATE_FEE_STRUCTURE" : "ASSIGN_FEE_STRUCTURE",
        entityType: "FEE_STRUCTURE",
        entityId: structureId,
        newData: {
          academicYearId,
          classId,
          feeHeadId,
          term,
          amount: fromPaise(amountPaise),
          generatedCount,
        },
        reason: `Fee structure assigned (${term}, ₹${fromPaise(amountPaise)}), ${generatedCount} invoices generated`,
        performedById: ctx.userId,
      });
    });

    revalidatePath("/school/assign-fees");
    revalidatePath("/school/due-fees");
    revalidatePath("/school/fees-dashboard");
    return { success: true, message: "Fee structure assigned and invoices generated!" };
  } catch (error: any) {
    console.error("Assign Fee Error:", error);
    return { success: false, message: error.message || "Failed to assign fees" };
  }
}
