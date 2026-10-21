"use server";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  studentBusPasses,
  students,
  routes,
  routeStops,
  busBoardingEvents,
  studentAttendance,
  classes,
  sections,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import {
  evaluateDriverScan,
  checkAbsentButBoarded,
  type DriverScanInput,
} from "../../../../../backend/src/lib/parentEventEngine/busBoardingEngine";
import { dispatchParentNotification } from "@/lib/parentEventEngine/notificationMatrix";
import { revalidatePath } from "next/cache";

export interface DriverScanPayload {
  qrCodeData: string;
  direction: "BOARDING" | "ALIGHTING";
  gpsLat?: number | null;
  gpsLng?: number | null;
}

export interface DriverScanResponse {
  success: boolean;
  studentName?: string;
  className?: string;
  stopName?: string;
  direction?: "BOARDING" | "ALIGHTING";
  scannedAt?: string;
  error?: string;
  absentCrossCheckTriggered?: boolean;
}

/**
 * Driver Scan Action (Workflow OP9, AC-P19).
 * Append-only insertion into bus_boarding_events.
 * Strictly PII-minimal: drivers receive ONLY first name, class, stop name, direction, and timestamp.
 */
export async function driverScanStudent(
  payload: DriverScanPayload
): Promise<DriverScanResponse> {
  try {
    const ctx = await requireAuth([
      "DRIVER",
      "TRANSPORT_MANAGER",
      "SCHOOL_ADMIN",
      "SUPER_ADMIN",
    ] as const);
    const school = await requireSchool(ctx);

    return await withTenant(school.id, async () => {
      // 1. Locate student bus pass by QR code
      const [pass] = await db
        .select()
        .from(studentBusPasses)
        .where(
          and(
            eq(studentBusPasses.schoolId, school.id),
            eq(studentBusPasses.qrCodeData, payload.qrCodeData),
            eq(studentBusPasses.isActive, true)
          )
        );

      if (!pass) {
        return {
          success: false,
          error: "Invalid, expired, or inactive bus pass QR code.",
        };
      }

      // 2. Fetch student minimal details
      const [student] = await db
        .select({
          id: students.id,
          primaryParentUserId: students.primaryParentUserId,
          firstNameEncrypted: students.firstNameEncrypted,
          lastNameEncrypted: students.lastNameEncrypted,
          currentClassId: students.currentClassId,
          currentSectionId: students.currentSectionId,
        })
        .from(students)
        .where(
          and(
            eq(students.id, pass.studentId),
            eq(students.schoolId, school.id),
            eq(students.isActive, true)
          )
        );

      if (!student) {
        return {
          success: false,
          error: "Student profile not found or inactive.",
        };
      }

      // Decrypt student name safely
      let firstName = "Student";
      let lastName = "";
      try {
        if (student.firstNameEncrypted) {
          const dec = decryptData(student.firstNameEncrypted);
          if (dec) firstName = dec;
        }
        if (student.lastNameEncrypted) {
          const dec = decryptData(student.lastNameEncrypted);
          if (dec) lastName = dec;
        }
      } catch {
        // Fallback to anonymous safe name
      }

      // Fetch stop & route details
      const [stop] = await db
        .select({ stopName: routeStops.stopName })
        .from(routeStops)
        .where(eq(routeStops.id, pass.routeStopId));

      const [route] = await db
        .select({ vehicleId: routes.vehicleId, routeName: routes.routeName })
        .from(routes)
        .where(eq(routes.id, pass.routeId));

      // Resolve class/section name
      let className = "Class";
      if (student.currentClassId) {
        const [c] = await db
          .select({ displayName: classes.displayName })
          .from(classes)
          .where(eq(classes.id, student.currentClassId));
        if (c?.displayName) className = c.displayName;
      }
      if (student.currentSectionId) {
        const [s] = await db
          .select({ name: sections.name })
          .from(sections)
          .where(eq(sections.id, student.currentSectionId));
        if (s?.name) className = `${className}-${s.name}`;
      }

      // 3. Evaluate scan with pure engine to sanitize PII
      const scanInput: DriverScanInput = {
        qrCodeData: payload.qrCodeData,
        direction: payload.direction,
        scannedByUserId: ctx.userId,
        scannedAt: new Date(),
        gpsLat: payload.gpsLat,
        gpsLng: payload.gpsLng,
      };

      const evaluation = evaluateDriverScan(
        scanInput,
        {
          id: student.id,
          firstName,
          lastName,
          className,
        },
        {
          id: pass.id,
          passNumber: pass.passNumber,
          routeId: pass.routeId,
          routeStopId: pass.routeStopId,
          stopName: stop?.stopName,
          isActive: pass.isActive,
        }
      );

      if (!evaluation.success || !evaluation.eventPayload || !evaluation.sanitizedStudent) {
        return {
          success: false,
          error: evaluation.error || "Failed to process scan.",
        };
      }

      // 4. Append-Only Insert into bus_boarding_events (AC-P19)
      const now = evaluation.eventPayload.scannedAt;
      await db.insert(busBoardingEvents).values({
        schoolId: school.id,
        studentId: student.id,
        routeId: pass.routeId,
        direction: payload.direction,
        scannedByUserId: ctx.userId,
        vehicleId: route?.vehicleId || null,
        scannedAt: now,
        gpsLat: payload.gpsLat !== undefined && payload.gpsLat !== null ? String(payload.gpsLat) : null,
        gpsLng: payload.gpsLng !== undefined && payload.gpsLng !== null ? String(payload.gpsLng) : null,
      });

      // 5. Cross-Check: Absent-But-Boarded (OP9)
      let absentCrossCheckTriggered = false;
      if (payload.direction === "BOARDING" && student.primaryParentUserId) {
        const todayStr = now.toISOString().split("T")[0]!;
        const [todayAtt] = await db
          .select({ status: studentAttendance.status })
          .from(studentAttendance)
          .where(
            and(
              eq(studentAttendance.studentId, student.id),
              eq(studentAttendance.schoolId, school.id),
              sql`date(${studentAttendance.attendanceDate}) = ${todayStr}`
            )
          );

        if (todayAtt && todayAtt.status === "ABSENT") {
          absentCrossCheckTriggered = true;
          const abbCheck = checkAbsentButBoarded(
            student.id,
            firstName,
            todayAtt.status,
            [{ direction: "BOARDING", scannedAt: now }]
          );

          if (abbCheck.triggered) {
            try {
              await dispatchParentNotification(school.id, {
                studentId: student.id,
                parentUserId: student.primaryParentUserId,
                tier: "T1_action_required",
                eventKind: "ABSENT_BUT_BOARDED",
                now,
                todayPushCountForParent: 0,
                previouslyDispatchedDedupeKeys: new Set(),
              }, {
                title: abbCheck.title || "Attendance & Commute Mismatch",
                body: abbCheck.body || "Boarded bus today but marked absent in classroom.",
              });
            } catch {
              // Notification failure is non-blocking
            }
          }
        }
      }

      revalidatePath("/parent/dashboard");
      revalidatePath("/parent/bus");

      // 6. Return strictly sanitized, PII-minimal response (AC-P19)
      return {
        success: true,
        studentName: evaluation.sanitizedStudent.studentName,
        className: evaluation.sanitizedStudent.className,
        stopName: evaluation.sanitizedStudent.stopName,
        direction: evaluation.sanitizedStudent.direction,
        scannedAt: evaluation.sanitizedStudent.scannedAt,
        absentCrossCheckTriggered,
      };
    });
  } catch (error: any) {
    console.error("[driverScanStudent] Error:", error);
    return {
      success: false,
      error: error?.message || "Failed to process boarding scan.",
    };
  }
}
