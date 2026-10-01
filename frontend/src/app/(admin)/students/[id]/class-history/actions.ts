"use server";

import { db } from "@/db";
import {
  studentClassHistory,
  students,
  classes,
  sections,
  academicYears,
  auditLogs,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAuth, requireSchool } from "@/lib/serverAuth";

function safeRevalidate(path: string) {
  try {
    revalidatePath(path);
  } catch {}
}

export interface PromoteStudentInput {
  academicYearId: string;
  classId: string;
  sectionId: string;
}

/**
 * Authoritative, atomic student promotion action.
 * Appends a new promotion record to student_class_history and synchronizes
 * the denormalized currentClassId & currentSectionId in the students table.
 */
export async function promoteStudent(
  studentIdOrInput:
    | string
    | (PromoteStudentInput & {
        studentId?: string;
        newAcademicYearId?: string;
        newClassId?: string;
        newSectionId?: string;
      }),
  inputOrFormData?: PromoteStudentInput | FormData,
) {
  try {
    const ctx = await requireAuth([
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
    ] as const);
    const school = await requireSchool(ctx);

    let studentId: string;
    let academicYearId: string;
    let classId: string;
    let sectionId: string;

    if (typeof studentIdOrInput === "object" && studentIdOrInput !== null) {
      studentId = studentIdOrInput.studentId || "";
      academicYearId =
        studentIdOrInput.academicYearId ||
        studentIdOrInput.newAcademicYearId ||
        "";
      classId =
        studentIdOrInput.classId || studentIdOrInput.newClassId || "";
      sectionId =
        studentIdOrInput.sectionId || studentIdOrInput.newSectionId || "";
    } else {
      studentId = studentIdOrInput;
      if (inputOrFormData instanceof FormData) {
        academicYearId = inputOrFormData.get("academicYearId") as string;
        classId = inputOrFormData.get("classId") as string;
        sectionId = inputOrFormData.get("sectionId") as string;
      } else if (inputOrFormData) {
        academicYearId = inputOrFormData.academicYearId;
        classId = inputOrFormData.classId;
        sectionId = inputOrFormData.sectionId;
      } else {
        return { success: false, message: "Missing input parameters" };
      }
    }

    if (!studentId || !academicYearId || !classId || !sectionId) {
      return { success: false, message: "Missing required fields" };
    }

    // Verify student belongs to school
    const student = await db.query.students.findFirst({
      where: and(
        eq(students.id, studentId),
        eq(students.schoolId, school.id),
      ),
    });
    if (!student) {
      return { success: false, message: "Student not found or access denied" };
    }

    // Verify target academic year belongs to school
    const year = await db.query.academicYears.findFirst({
      where: and(
        eq(academicYears.id, academicYearId),
        eq(academicYears.schoolId, school.id),
      ),
    });
    if (!year) {
      return { success: false, message: "Academic year not found or invalid" };
    }

    // Verify target class belongs to school
    const targetClass = await db.query.classes.findFirst({
      where: and(
        eq(classes.id, classId),
        eq(classes.schoolId, school.id),
        eq(classes.isActive, true),
      ),
    });
    if (!targetClass) {
      return { success: false, message: "Target class not found or inactive" };
    }

    // Verify target section belongs to target class and school
    const targetSection = await db.query.sections.findFirst({
      where: and(
        eq(sections.id, sectionId),
        eq(sections.classId, classId),
        eq(sections.schoolId, school.id),
        eq(sections.isActive, true),
      ),
    });
    if (!targetSection) {
      return {
        success: false,
        message: "Target section not found or does not belong to class",
      };
    }

    // Atomic transaction
    await db.transaction(async (tx) => {
      // 1. Insert or update studentClassHistory
      await tx
        .insert(studentClassHistory)
        .values({
          studentId,
          schoolId: school.id,
          academicYearId,
          classId,
          sectionId,
          promotionStatus: "PROMOTED",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [
            studentClassHistory.studentId,
            studentClassHistory.academicYearId,
          ],
          set: {
            classId,
            sectionId,
            promotionStatus: "PROMOTED",
            updatedAt: new Date(),
          },
        });

      // 2. Synchronize denormalized currentClassId & currentSectionId in students
      await tx
        .update(students)
        .set({
          currentClassId: classId,
          currentSectionId: sectionId,
          academicYearId,
          updatedAt: new Date(),
        })
        .where(eq(students.id, studentId));

      // 3. Audit log
      await tx.insert(auditLogs).values({
        schoolId: school.id,
        userId: ctx.userId,
        userEmail: ctx.email,
        userRole: ctx.role,
        action: "WRITE",
        tableName: "student_class_history",
        recordId: studentId,
        purposeId: "student_promotion",
        ipAddress: "127.0.0.1",
        userAgent: "SchoolMitra SIS",
        metadata: {
          previousClassId: student.currentClassId,
          previousSectionId: student.currentSectionId,
          newClassId: classId,
          newSectionId: sectionId,
          academicYearId,
        },
      });
    });

    safeRevalidate(`/students/${studentId}`);
    safeRevalidate(`/students/${studentId}/class-history`);
    return { success: true as const };
  } catch (error: any) {
    console.error("Promotion error:", error);
    return {
      success: false,
      message: error?.message || "Failed to promote student",
    };
  }
}
