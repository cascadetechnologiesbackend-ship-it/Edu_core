"use server";

import { db } from "@/db";
import {
  exams,
  academicYears,
  students,
  reportCards,
  certificates,
  examSchedules,
  users,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { calculateRanks } from "@/lib/gradeEngine";

const CreateExamSchema = z.object({
  name: z.string().min(2, "Name required"),
  examTypeId: z.string().uuid("Invalid exam type"),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().min(1, "End date required"),
});

export async function createExam(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = CreateExamSchema.safeParse({
    name: formData.get("name"),
    examTypeId: formData.get("examTypeId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
  });

  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  const { name, examTypeId, startDate, endDate } = parsed.data;

  const activeYear = await db.query.academicYears.findFirst({
    where: eq(academicYears.isActive, true),
  });

  if (!activeYear)
    return { success: false, errors: { _: ["No active academic year"] } };

  const school = await db.query.schools.findFirst();
  if (!school) return { success: false, errors: { _: ["No school found"] } };

  await db.insert(exams).values({
    schoolId: school.id,
    academicYearId: activeYear.id,
    examTypeId,
    name,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    isLocked: false,
  });

  revalidatePath("/exams");
  redirect("/exams");
}

export async function lockExam(examId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  if (!dbUser) {
    throw new Error(
      "Your session is invalid or stale (the database may have been re-seeded). Please sign out and sign back in.",
    );
  }

  const allowed = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL"].includes(
    session.user.role as string,
  );
  if (!allowed) throw new Error("Only Principal or Admin can lock exams");

  await db
    .update(exams)
    .set({
      isLocked: true,
      lockedById: session.user.id,
      lockedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(exams.id, examId));

  revalidatePath(`/exams/${examId}`);
  revalidatePath("/exams");
}

export async function unlockExam(examId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });
  if (!dbUser) {
    throw new Error(
      "Your session is invalid or stale (the database may have been re-seeded). Please sign out and sign back in.",
    );
  }

  const allowed = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(
    session.user.role as string,
  );
  if (!allowed) throw new Error("Only Admin can unlock exams");

  await db
    .update(exams)
    .set({
      isLocked: false,
      lockedById: null,
      lockedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(exams.id, examId));

  revalidatePath(`/exams/${examId}`);
  revalidatePath("/exams");
}

export async function generateMeritList(examId: string, classId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const classStudents = await db.query.students.findMany({
      where: eq(students.currentClassId, classId),
    });

    if (classStudents.length === 0) {
      return { success: false, message: "No students in this class" };
    }

    const studentIds = classStudents.map((s) => s.id);

    // Fetch report cards
    const cards = await db.query.reportCards.findMany({
      where: and(
        eq(reportCards.examId, examId),
        inArray(reportCards.studentId, studentIds),
      ),
    });

    if (cards.length === 0) {
      return {
        success: false,
        message: "No report cards generated yet for this class",
      };
    }

    // Prepare ranking inputs
    const rankingInput = cards.map((c) => {
      const gData = c.gradeData as Record<string, any>;
      return {
        studentId: c.studentId,
        totalMarks: gData["totalMarks"] || 0,
        isPassed: gData["isPassed"] !== false,
      };
    });

    // Calculate ranks
    const ranked = calculateRanks(rankingInput);

    // Save ranks to DB
    for (const item of ranked) {
      const card = cards.find((c) => c.studentId === item.studentId);
      if (card) {
        await db
          .update(reportCards)
          .set({ rank: item.rank, updatedAt: new Date() })
          .where(eq(reportCards.id, card.id));
      }
    }

    revalidatePath(`/exams/report-cards`);
    return {
      success: true,
      message: `Successfully ranked ${ranked.length} students`,
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function issueTopperCertificate(
  studentId: string,
  examId: string,
  rank: number,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });
    if (!dbUser) {
      return {
        success: false,
        message:
          "Your session is invalid or stale (the database may have been re-seeded). Please sign out and sign back in.",
      };
    }

    const examRecord = await db.query.exams.findFirst({
      where: eq(exams.id, examId),
    });

    if (!examRecord) return { success: false, message: "Exam not found" };

    // Generate unique cert number
    const yearStr = new Date().getFullYear();
    const countResult = await db.query.certificates.findMany({
      where: eq(certificates.schoolId, examRecord.schoolId),
    });
    const certNum = `CERT/${yearStr}/TOPPER/${1000 + countResult.length + 1}`;

    const [cert] = await db
      .insert(certificates)
      .values({
        schoolId: examRecord.schoolId,
        studentId,
        certificateType: "TOPPER",
        certificateNumber: certNum,
        issuedDate: new Date(),
        issuedById: session.user.id,
        remarks: `Issued to Topper with Class Rank ${rank} in ${examRecord.name}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return {
      success: true,
      certificate: cert,
      message: `Successfully issued certificate ${certNum}`,
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

const CreateScheduleSchema = z.object({
  examId: z.string().uuid(),
  subjectId: z.string().uuid(),
  classId: z.string().uuid(),
  examDate: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Time is required"),
  durationMinutes: z.number().positive(),
  roomNumber: z.string().optional(),
  maxMarks: z.number().positive(),
  passingMarks: z.number().positive(),
});

export async function createExamSchedule(
  input: z.infer<typeof CreateScheduleSchema>,
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const parsed = CreateScheduleSchema.parse(input);

    const examRecord = await db.query.exams.findFirst({
      where: eq(exams.id, parsed.examId),
    });

    if (!examRecord) return { success: false, message: "Exam not found" };

    await db.insert(examSchedules).values({
      schoolId: examRecord.schoolId,
      examId: parsed.examId,
      subjectId: parsed.subjectId,
      classId: parsed.classId,
      examDate: parsed.examDate,
      startTime: parsed.startTime,
      durationMinutes: parsed.durationMinutes,
      roomNumber: parsed.roomNumber || null,
      maxMarks: parsed.maxMarks.toFixed(2),
      passingMarks: parsed.passingMarks.toFixed(2),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    revalidatePath(`/exams/${parsed.examId}`);
    return { success: true, message: "Exam scheduled successfully!" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function deleteExamSchedule(id: string, examId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    await db.delete(examSchedules).where(eq(examSchedules.id, id));

    revalidatePath(`/exams/${examId}`);
    return {
      success: true,
      message: "Exam schedule entry deleted successfully!",
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}
