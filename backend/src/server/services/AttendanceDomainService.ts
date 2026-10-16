import { db } from "@/db";
import { studentAttendance, domainEvents } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export interface AttendanceRecordEntry {
  studentId: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "HALF_DAY" | "LEAVE" | "HOLIDAY";
  remarks?: string;
}

export interface MarkBulkAttendanceInput {
  schoolId: string;
  sectionId: string;
  academicYearId: string;
  date: Date;
  markedByUserId: string;
  records: AttendanceRecordEntry[];
}

export class AttendanceDomainService {
  /**
   * Bulk records student attendance for a section and emits AttendanceMarkedEvent.
   */
  public static async markBulkAttendance(input: MarkBulkAttendanceInput) {
    const { schoolId, sectionId, academicYearId, date, markedByUserId, records } = input;

    return await db.transaction(async (tx) => {
      let totalPresent = 0;
      let totalAbsent = 0;

      for (const rec of records) {
        if (rec.status === "PRESENT") totalPresent++;
        if (rec.status === "ABSENT") totalAbsent++;

        // Upsert student attendance entry
        const existing = await tx.query.studentAttendance.findFirst({
          where: and(
            eq(studentAttendance.studentId, rec.studentId),
            eq(studentAttendance.attendanceDate, date),
          ),
        });

        if (existing) {
          await tx
            .update(studentAttendance)
            .set({
              status: rec.status,
              remarks: rec.remarks || null,
              markedById: markedByUserId,
              updatedAt: new Date(),
            })
            .where(eq(studentAttendance.id, existing.id));
        } else {
          await tx.insert(studentAttendance).values({
            schoolId,
            academicYearId,
            studentId: rec.studentId,
            sectionId,
            attendanceDate: date,
            status: rec.status,
            remarks: rec.remarks || null,
            markedById: markedByUserId,
          });
        }
      }

      // Insert durable outbox domain event (Migration 0042)
      await tx.insert(domainEvents).values({
        schoolId,
        aggregateId: sectionId,
        eventType: "AttendanceMarkedEvent",
        payload: {
          sectionId,
          date: date.toISOString().split("T")[0],
          totalPresent,
          totalAbsent,
          markedByUserId,
        },
        status: "PENDING",
      });

      return { totalPresent, totalAbsent, totalRecords: records.length };
    });
  }
}
