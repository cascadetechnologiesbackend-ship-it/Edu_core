import { NextResponse } from "next/server";
import { db } from "@/db";
import { exams, markEntries, students, subjects, auditLogs } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { assertTeacherTeaches } from "@/lib/examPermissions";
import { decryptData } from "@/lib/encryption";

const STAFF_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER"] as const;

export async function GET(
  req: Request,
  { params }: { params: { examId: string } },
) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = session.user.role;
    if (!STAFF_ROLES.includes(role as any)) {
      return NextResponse.json(
        { error: "Forbidden: role lacks staff examination access" },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId") ?? undefined;
    const subjectId = searchParams.get("subjectId") ?? undefined;

    const userSchoolId = (session.user as any).schoolId;
    const isSuperAdmin = role === "SUPER_ADMIN";

    // 1. Fetch exam record
    const exam = await db.query.exams.findFirst({
      where: eq(exams.id, params.examId),
    });

    // Uniform 404 if not found OR if belonging to a different tenant (zero cross-tenant disclosure)
    if (!exam || (!isSuperAdmin && userSchoolId && exam.schoolId !== userSchoolId)) {
      return NextResponse.json(
        { error: "Exam not found" },
        { status: 404 },
      );
    }

    // 2. Teacher-specific subject assignment boundary
    if (role === "TEACHER") {
      const isAssigned = await assertTeacherTeaches({
        teacherId: session.user.id,
        schoolId: exam.schoolId,
        role: "TEACHER",
        classId,
        subjectId,
      });

      if (!isAssigned) {
        // Persist audit record of out-of-scope access attempt
        try {
          await db.insert(auditLogs).values({
            userId: session.user.id,
            userEmail: session.user.email || "teacher@schoolmitra.internal",
            userRole: "TEACHER",
            schoolId: exam.schoolId,
            action: "READ",
            tableName: "mark_entries",
            recordId: params.examId,
            purposeId: "rbac_security_enforcement",
            ipAddress: "127.0.0.1",
            userAgent: "StaffAPI",
            metadata: {
              event: "TEACHER_UNASSIGNED_EXAM_QUERY",
              examId: params.examId,
              classId: classId ?? null,
              subjectId: subjectId ?? null,
              timestamp: new Date().toISOString(),
            },
          });
        } catch {}

        return NextResponse.json(
          { error: "Forbidden: teacher is not assigned to this class/subject in this school" },
          { status: 403 },
        );
      }
    }

    // 3. Query marks scoped strictly to exam and school
    const marksConditions = [
      eq(markEntries.examId, params.examId),
      eq(markEntries.schoolId, exam.schoolId),
    ];
    if (subjectId) {
      marksConditions.push(eq(markEntries.subjectId, subjectId));
    }

    const marks = await db.query.markEntries.findMany({
      where: and(...marksConditions),
      limit: 500,
    });

    const studentIds = Array.from(new Set(marks.map((m) => m.studentId)));
    const subjectIds = Array.from(new Set(marks.map((m) => m.subjectId)));

    const [studentsList, subjectsList] = await Promise.all([
      studentIds.length > 0
        ? db.query.students.findMany({
            where: inArray(students.id, studentIds),
          })
        : [],
      subjectIds.length > 0
        ? db.query.subjects.findMany({
            where: inArray(subjects.id, subjectIds),
          })
        : [],
    ]);

    const studentMap = new Map(studentsList.map((s) => [s.id, s]));
    const subjectMap = new Map(subjectsList.map((s) => [s.id, s]));

    // Decrypt and format
    const results = marks.map((m) => {
      const st = studentMap.get(m.studentId);
      const sub = subjectMap.get(m.subjectId);

      let studentName = "Student";
      if (st) {
        try {
          const first = decryptData(st.firstNameEncrypted);
          const last = st.lastNameEncrypted ? decryptData(st.lastNameEncrypted) : "";
          studentName = `${first} ${last}`.trim();
        } catch {
          studentName = "Student";
        }
      }

      return {
        id: m.id,
        studentId: m.studentId,
        studentName,
        admissionNumber: st?.admissionNumber ?? "—",
        subjectId: m.subjectId,
        subjectName: sub?.name ?? "—",
        marksObtained: m.marksObtained,
        maxMarks: m.maxMarks,
        isAbsent: m.isAbsent,
        isMedicalExempt: m.isMedicalExempt,
      };
    });

    return NextResponse.json({
      success: true,
      exam: {
        id: exam.id,
        name: exam.name,
        startDate: exam.startDate,
        endDate: exam.endDate,
        isLocked: exam.isLocked,
      },
      count: results.length,
      results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
