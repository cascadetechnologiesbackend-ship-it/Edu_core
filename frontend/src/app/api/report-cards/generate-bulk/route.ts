// ─── Bulk Report Card Generation API ─────────────────────────────────────────
// POST /api/report-cards/generate-bulk
// Body: { examId: string, classId: string }
// Enqueues a BullMQ job per student in the class.

import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { students, exams, classes, reportCardJobs, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { reportCardQueue } from "@/workers/reportCard";

const GenerateBulkSchema = z.object({
  examId: z.string().uuid(),
  classId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });
    if (!dbUser) {
      return NextResponse.json(
        {
          error:
            "Your session is invalid or stale (the database may have been re-seeded). Please sign out and sign back in.",
        },
        { status: 401 },
      );
    }

    const body = (await req.json()) as unknown;
    const parsed = GenerateBulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { examId, classId } = parsed.data;

    // Verify exam exists
    const exam = await db.query.exams.findFirst({
      where: eq(exams.id, examId),
    });
    if (!exam)
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });

    // Verify class exists
    const classRecord = await db.query.classes.findFirst({
      where: eq(classes.id, classId),
    });
    if (!classRecord)
      return NextResponse.json({ error: "Class not found" }, { status: 404 });

    // Get all active students in this class
    const classStudents = await db.query.students.findMany({
      where: and(
        eq(students.currentClassId, classId),
        eq(students.isActive, true),
      ),
    });

    if (classStudents.length === 0) {
      return NextResponse.json(
        { error: "No active students in this class" },
        { status: 400 },
      );
    }

    // Create batch job record
    const [jobRecord] = await db
      .insert(reportCardJobs)
      .values({
        schoolId: exam.schoolId,
        examId,
        classId,
        totalStudents: classStudents.length,
        processedCount: 0,
        failedCount: 0,
        status: "QUEUED",
        triggeredById: session.user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!jobRecord) {
      return NextResponse.json(
        { error: "Failed to create batch job record" },
        { status: 500 },
      );
    }

    // Enqueue one job per student
    const jobs = classStudents.map((s) => ({
      name: `report-card:${s.id}:${examId}`,
      data: {
        studentId: s.id,
        examId,
        schoolId: exam.schoolId,
        jobId: jobRecord.id,
      },
    }));

    await reportCardQueue.addBulk(jobs);

    return NextResponse.json({
      success: true,
      message: `Queued ${classStudents.length} report card generation jobs.`,
      batchJobId: jobRecord.id,
      totalStudents: classStudents.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[generate-bulk]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get("examId");
    const classId = searchParams.get("classId");

    if (!examId || !classId) {
      return NextResponse.json(
        { error: "examId and classId query params required" },
        { status: 400 },
      );
    }

    const jobs = await db.query.reportCardJobs.findMany({
      where: and(
        eq(reportCardJobs.examId, examId),
        eq(reportCardJobs.classId, classId),
      ),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    return NextResponse.json({ jobs });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
