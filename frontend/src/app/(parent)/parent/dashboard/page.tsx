export const dynamic = "force-dynamic";

import { requireAuth, requireSchool } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import {
  students,
  classes,
  sections,
  studentAttendance,
  feeInvoices,
  feePayments,
  paymentGatewayLogs,
  reportCards,
  assignments,
  assignmentSubmissions,
  classSubjects,
  subjects,
  studentBusPasses,
  routes,
  routeStops,
  gpsPings,
  notices,
  events,
  parentTeacherMessages,
  parentFeedCards,
  auditLogs,
  staff,
  studentLeaveRequests,
  ptmEvents,
  ptmSlots,
  ptmBookings,
  feeQueries,
  noticeAcknowledgments,
  users,
} from "@/db/schema";
import { eq, and, or, desc, asc, gte, lte, isNull, isNotNull, gt, inArray } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";
import { deriveParentFeed } from "@schoolmitra/backend/parentEventEngine/deriveParentFeed";
import type {
  ParentDataSnapshot,
  InvoiceSnapshot,
  AttendanceSnapshot,
  BusPassSnapshot,
  RouteStopSnapshot,
  GpsPingSnapshot,
  HomeworkSnapshot,
  ReportCardSnapshot,
  NoticeSnapshot,
  UpcomingEventSnapshot,
  UnreadMessageSnapshot,
  LeaveRequestSnapshot,
  FeeQuerySnapshot,
  WeeklyDigestSnapshot,
} from "@schoolmitra/backend/parentEventEngine/types";
import { ParentFeedContainer } from "@/components/parent/ParentFeedContainer";
import type { StudentWardOption } from "@/components/parent/ParentIdentityHeader";

export const metadata = {
  title: "Parent Companion Feed | SchoolMitra ERP",
  description: "High-intent event-driven feed for student attendance, fees, transit, and academics.",
};

export default async function ParentDashboardPage({
  searchParams,
}: {
  searchParams?: { studentId?: string; locale?: string };
}) {
  const ctx = await requireAuth([
    "SUPER_ADMIN",
    "SCHOOL_ADMIN",
    "PRINCIPAL",
    "PARENT",
  ] as const);
  const school = await requireSchool(ctx);
  const now = new Date();

  // 1. Identify the parent's wards
  const studentRows = await withTenant(school.id, async (tx) => {
    if (ctx.role === "PARENT") {
      return await tx.query.students.findMany({
        where: and(
          eq(students.schoolId, school.id),
          eq(students.primaryParentUserId, ctx.userId),
          eq(students.isActive, true)
        ),
        orderBy: [asc(students.admissionNumber)],
      });
    }

    // D7 FIX: Admins / Principals previewing parent portal require explicit ?studentId=
    if (!searchParams?.studentId) {
      return [];
    }

    return await tx.query.students.findMany({
      where: and(
        eq(students.schoolId, school.id),
        eq(students.id, searchParams.studentId),
        eq(students.isActive, true)
      ),
      limit: 1,
    });
  });

  if (studentRows.length === 0) {
    if (ctx.role !== "PARENT") {
      return (
        <div className="py-12 text-center" data-testid="admin-preview-prompt">
          <h2 className="text-base font-semibold text-slate-200">
            Parent Companion Feed Preview
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            Please specify an active student ID via <code className="text-emerald-400 font-mono">?studentId=</code> to preview their personalized companion feed.
          </p>
        </div>
      );
    }
    return (
      <div className="py-12 text-center">
        <h2 className="text-base font-semibold text-slate-200">
          No Student Profile Linked
        </h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          No active student is linked to your parent account. Please contact the school administrative office.
        </p>
      </div>
    );
  }

  // Fetch class names for all ward classes
  const classIds = studentRows
    .map((s) => s.currentClassId)
    .filter(Boolean) as string[];

  const schoolClasses =
    classIds.length > 0
      ? await withTenant(school.id, async (tx) =>
          tx.query.classes.findMany({
            where: inArray(classes.id, classIds),
            columns: { id: true, displayName: true, gradeLevel: true },
          })
        )
      : [];

  const classMap = new Map(
    schoolClasses.map((c) => [c.id, c.displayName || c.gradeLevel])
  );

  // 2. Select active student (searchParam or first)
  const selectedStudentId = searchParams?.studentId || studentRows[0]!.id;
  const currentStudentRow =
    studentRows.find((s) => s.id === selectedStudentId) || studentRows[0]!;

  // 3. Build available students list with decrypted names
  const availableStudents: StudentWardOption[] = studentRows.map((s) => {
    let studentName = `Student ${s.admissionNumber}`;
    try {
      if (s.firstNameEncrypted) {
        const first = decryptData(s.firstNameEncrypted);
        const last = s.lastNameEncrypted ? decryptData(s.lastNameEncrypted) : "";
        studentName = `${first} ${last}`.trim();
      }
    } catch {
      // Fallback to admission number if decryption fails in preview/sandbox
    }

    return {
      id: s.id,
      name: studentName,
      className: s.currentClassId ? classMap.get(s.currentClassId) || "Class" : "Class",
      sectionName: "",
      admissionNumber: s.admissionNumber,
      avatarUrl: s.photoS3Key,
    };
  });

  const currentStudent = availableStudents.find((s) => s.id === currentStudentRow.id)!;

  // 4. Fetch data snapshot for selected student
  const {
    attendanceSnap,
    attendanceRate30d,
    invoiceSnaps,
    homeworkSnaps,
    reportCardSnaps,
    busPassSnap,
    routeStopsSnap,
    latestBusPingSnap,
    noticeSnaps,
    eventSnaps,
    unreadMessageSnaps,
    leaveRequestSnaps,
    feeQuerySnaps,
  } = await withTenant(school.id, async (tx) => {
    // A. Attendance (last 30 days)
    const cutoff30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const attRows = await tx.query.studentAttendance.findMany({
      where: and(
        eq(studentAttendance.studentId, currentStudentRow.id),
        gte(studentAttendance.attendanceDate, cutoff30d)
      ),
      orderBy: [desc(studentAttendance.attendanceDate)],
    });

    const todayStr = now.toISOString().split("T")[0]!;
    const todayAtt = attRows.find(
      (r) => new Date(r.attendanceDate).toISOString().split("T")[0] === todayStr
    );

    let attendanceToday: AttendanceSnapshot | undefined;
    if (todayAtt) {
      attendanceToday = {
        status: todayAtt.status as any,
        markedAt: todayAtt.createdAt || now,
        remarks: todayAtt.remarks,
      };
    }

    const schoolDays = attRows.filter((r) => r.status !== "HOLIDAY");
    const attendedDays = schoolDays.filter(
      (r) => r.status === "PRESENT" || r.status === "LATE"
    ).length;
    const attRate = schoolDays.length > 0 ? attendedDays / schoolDays.length : 1.0;

    // B. Invoices (D1: lastPayment join, D8: term name mapping)
    const feeTermNames: Record<string, string> = {
      MONTHLY: "Monthly Fee",
      QUARTERLY: "Quarterly Fee",
      HALF_YEARLY: "Half-Yearly Fee",
      ANNUAL: "Annual Fee",
      ONE_TIME: "One-Time Fee",
    };

    const invRows = await tx.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.studentId, currentStudentRow.id),
        eq(feeInvoices.schoolId, school.id)
      ),
      orderBy: [desc(feeInvoices.dueDate)],
    });

    const invoiceIds = invRows.map((i) => i.id);

    // Fetch recent payments for invoices to map lastPayment (D1)
    const recentPayments =
      invoiceIds.length > 0
        ? await tx.query.feePayments.findMany({
            where: and(
              eq(feePayments.schoolId, school.id),
              inArray(feePayments.feeInvoiceId, invoiceIds)
            ),
            orderBy: [desc(feePayments.paymentDate), desc(feePayments.createdAt)],
          })
        : [];

    const recentLogs =
      invoiceIds.length > 0
        ? await tx.query.paymentGatewayLogs.findMany({
            where: and(
              eq(paymentGatewayLogs.schoolId, school.id),
              inArray(paymentGatewayLogs.feeInvoiceId, invoiceIds),
              eq(paymentGatewayLogs.status, "PAID")
            ),
            orderBy: [desc(paymentGatewayLogs.updatedAt), desc(paymentGatewayLogs.createdAt)],
          })
        : [];

    const paymentByInvoice = new Map<
      string,
      { status: string; paidAt: Date | string; amount?: number; receiptNumber?: string }
    >();

    for (const p of recentPayments) {
      if (!paymentByInvoice.has(p.feeInvoiceId)) {
        const item: {
          status: string;
          paidAt: Date | string;
          amount?: number;
          receiptNumber?: string;
        } = {
          status: "PAID",
          paidAt: p.paymentDate || p.createdAt,
          amount: Number(p.amountPaid || 0),
        };
        if (p.receiptNumber) {
          item.receiptNumber = p.receiptNumber;
        }
        paymentByInvoice.set(p.feeInvoiceId, item);
      }
    }

    for (const l of recentLogs) {
      if (l.feeInvoiceId && !paymentByInvoice.has(l.feeInvoiceId)) {
        const item: {
          status: string;
          paidAt: Date | string;
          amount?: number;
          receiptNumber?: string;
        } = {
          status: "PAID",
          paidAt: l.updatedAt || l.createdAt,
          amount: Number(l.amount || 0),
        };
        if (l.gatewayPaymentId) {
          item.receiptNumber = l.gatewayPaymentId;
        }
        paymentByInvoice.set(l.feeInvoiceId, item);
      }
    }

    const invoiceSnaps: InvoiceSnapshot[] = invRows.map((inv) => {
      const lastPayment = paymentByInvoice.get(inv.id);
      return {
        id: inv.id,
        termName: (inv.term && feeTermNames[inv.term]) || "School Term",
        status: inv.status as any,
        dueDate: inv.dueDate,
        balanceAmount: Number(inv.balanceAmount || 0),
        lateFeeAmount: Number(inv.lateFeeAmount || 0),
        reminderSentFlags: {
          d7: Boolean(inv.reminderSentD7),
          d15: Boolean(inv.reminderSentD15),
          d30: Boolean(inv.reminderSentD30),
        },
        ...(lastPayment ? { lastPayment } : {}),
      };
    });

    // C. Homework (D2: class assignments LEFT JOIN student submissions with real subject name)
    const cutoffPast14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const cutoffFuture14d = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

    const assignmentList = await tx.query.assignments.findMany({
      where: and(
        eq(assignments.schoolId, school.id),
        currentStudentRow.currentSectionId
          ? eq(assignments.sectionId, currentStudentRow.currentSectionId)
          : undefined,
        gte(assignments.dueDate, cutoffPast14d),
        lte(assignments.dueDate, cutoffFuture14d)
      ),
      with: {
        classSubject: {
          with: {
            subject: true,
          },
        },
      },
      orderBy: [asc(assignments.dueDate)],
    });

    const assignmentIds = assignmentList.map((a) => a.id);
    const studentSubmissions =
      assignmentIds.length > 0
        ? await tx.query.assignmentSubmissions.findMany({
            where: and(
              eq(assignmentSubmissions.studentId, currentStudentRow.id),
              eq(assignmentSubmissions.schoolId, school.id),
              inArray(assignmentSubmissions.assignmentId, assignmentIds)
            ),
          })
        : [];

    const submissionByAssignment = new Map(
      studentSubmissions.map((s) => [s.assignmentId, s])
    );

    const homeworkSnaps: HomeworkSnapshot[] = assignmentList.map((a) => {
      const sub = submissionByAssignment.get(a.id);
      const subjectName = a.classSubject?.subject?.name || "Academics";
      const isSubmitted = Boolean(sub);

      let subData:
        | {
            submittedAt: string | Date;
            grade?: string | null;
            feedback?: string | null;
          }
        | undefined = undefined;

      if (sub) {
        subData = {
          submittedAt: sub.submittedAt || sub.createdAt || now,
          grade:
            sub.marksAwarded !== null
              ? `${sub.marksAwarded}`
              : sub.gradedAt
              ? "Graded"
              : null,
          feedback: sub.remarks,
        };
      }

      return {
        id: a.id,
        title: a.title,
        subjectName,
        dueDate: a.dueDate,
        isSubmitted,
        ...(subData ? { submission: subData } : {}),
      };
    });

    // D. Report Cards (D4: viewedAt tracking + previousAverageScore join)
    const rcRows = await tx.query.reportCards.findMany({
      where: and(
        eq(reportCards.studentId, currentStudentRow.id),
        eq(reportCards.schoolId, school.id),
        isNotNull(reportCards.generatedAt)
      ),
      orderBy: [desc(reportCards.generatedAt)],
      limit: 2,
    });

    // Check if report card was previously viewed or dismissed in feed
    const existingRcCard = await tx.query.parentFeedCards.findFirst({
      where: and(
        eq(parentFeedCards.studentId, currentStudentRow.id),
        eq(parentFeedCards.cardType, "ReportCardCard")
      ),
    });

    // RC-C1 Hardening: The report card viewedAt auditLogs fallback matched ANY READ audit on the student record;
    // Phase P10 writes explicit viewedAt into parentFeedCards.payload when the parent opens the report card,
    // and the engine stops inferring from unrelated auditLogs.
    let viewedTimestamp: Date | undefined = undefined;
    if (existingRcCard?.dismissedAt) {
      viewedTimestamp = existingRcCard.dismissedAt;
    } else if (existingRcCard && (existingRcCard.payload as any)?.viewedAt) {
      viewedTimestamp = new Date((existingRcCard.payload as any).viewedAt);
    }

    const prevAverage =
      rcRows.length > 1 && rcRows[1]
        ? Number((rcRows[1].gradeData as any)?.percentage || 0)
        : null;

    const reportCardSnaps: ReportCardSnapshot[] = [];
    if (rcRows.length > 0 && rcRows[0]) {
      const latestRc = rcRows[0];
      reportCardSnaps.push({
        id: latestRc.id,
        termName: "Term Report",
        publishedAt: latestRc.generatedAt || latestRc.createdAt || now,
        averageScore: Number((latestRc.gradeData as any)?.percentage || 0),
        previousAverageScore: prevAverage,
        ...(viewedTimestamp ? { viewedAt: viewedTimestamp } : {}),
      });
    }

    // E. Bus Pass (D3: fetch routeStops, stopOrder, stopName, stopCoords, and latest gpsPing)
    const bp = await tx.query.studentBusPasses.findFirst({
      where: and(
        eq(studentBusPasses.studentId, currentStudentRow.id),
        eq(studentBusPasses.schoolId, school.id),
        eq(studentBusPasses.isActive, true)
      ),
    });

    let busPassSnap: BusPassSnapshot | undefined;
    let routeStopsSnap: RouteStopSnapshot[] = [];
    let latestBusPingSnap: GpsPingSnapshot | undefined;

    if (bp) {
      const stops = await tx.query.routeStops.findMany({
        where: and(
          eq(routeStops.routeId, bp.routeId),
          eq(routeStops.schoolId, school.id)
        ),
        orderBy: (t, { asc }) => [asc(t.stopOrder)],
      });

      const myStop = stops.find((s) => s.id === bp.routeStopId);
      const routeRow = await tx.query.routes.findFirst({
        where: and(eq(routes.id, bp.routeId), eq(routes.schoolId, school.id)),
      });

      const stopCoords =
        myStop?.gpsLatitude && myStop?.gpsLongitude
          ? {
              lat: Number(myStop.gpsLatitude),
              lng: Number(myStop.gpsLongitude),
            }
          : undefined;

      busPassSnap = {
        isActive: true,
        routeId: bp.routeId,
        routeName: routeRow?.routeName || "School Bus Route",
        stopId: bp.routeStopId,
        stopName: myStop?.stopName || "Bus Stop",
        stopOrder: myStop?.stopOrder ?? 1,
        ...(stopCoords ? { stopCoords } : {}),
      };

      routeStopsSnap = stops.map((s) => ({
        id: s.id,
        stopOrder: s.stopOrder,
        lat: Number(s.gpsLatitude || 0),
        lng: Number(s.gpsLongitude || 0),
        name: s.stopName,
        ...(s.estimatedArrivalTime ? { estimatedTime: s.estimatedArrivalTime } : {}),
      }));

      if (routeRow?.vehicleId) {
        const pingRow = await tx.query.gpsPings.findFirst({
          where: eq(gpsPings.vehicleId, routeRow.vehicleId),
          orderBy: [desc(gpsPings.recordedAt)],
        });

        if (pingRow) {
          latestBusPingSnap = {
            lat: Number(pingRow.latitude),
            lng: Number(pingRow.longitude),
            speed: Number(pingRow.speed || 0),
            recordedAt: pingRow.recordedAt,
          };
        }
      }
    }

    // F. Notices (D5: within 72h OR isPinned, unexpired)
    const cutoff72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const noticeRows = await tx.query.notices.findMany({
      where: and(
        eq(notices.schoolId, school.id),
        or(
          gte(notices.publishedAt, cutoff72h),
          eq(notices.isPinned, true)
        ),
        or(
          isNull(notices.expiresAt),
          gt(notices.expiresAt, now)
        )
      ),
      orderBy: [desc(notices.isPinned), desc(notices.publishedAt)],
      limit: 5,
    });

    const ackRows = await tx.query.noticeAcknowledgments.findMany({
      where: and(
        eq(noticeAcknowledgments.schoolId, school.id),
        eq(noticeAcknowledgments.parentUserId, ctx.userId)
      ),
    });
    const ackMap = new Map<string, Date>();
    for (const a of ackRows) {
      ackMap.set(a.noticeId, a.acknowledgedAt);
    }

    const noticeSnaps: NoticeSnapshot[] = noticeRows.map((n) => ({
      id: n.id,
      title: n.title,
      contentPreview: n.content?.slice(0, 100) || "",
      publishedAt: n.publishedAt || now,
      isPinned: Boolean(n.isPinned),
      requiresAcknowledgment: Boolean((n as any).requiresAcknowledgment),
      acknowledgedAt: ackMap.get(n.id) || null,
      ...(n.expiresAt ? { expiresAt: n.expiresAt } : {}),
    }));

    // G. Upcoming Events (e.g. PTM within 7 days, with real venue RC-C2 & slot booking OP4)
    const eventCutoff7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const eventRows = await tx.query.events.findMany({
      where: and(
        eq(events.schoolId, school.id),
        gte(events.startDate, now),
        lte(events.startDate, eventCutoff7d)
      ),
      orderBy: [asc(events.startDate)],
      limit: 3,
    });

    const eventSnaps: UpcomingEventSnapshot[] = [];
    for (const e of eventRows) {
      if (e.eventType === "PTM") {
        // Query ptm_events for real venue and booking details (resolving RC-C2 & Workflow OP4)
        const ptmEventRow = await tx.query.ptmEvents.findFirst({
          where: and(
            eq(ptmEvents.eventId, e.id),
            eq(ptmEvents.schoolId, school.id),
            or(
              isNull(ptmEvents.classId),
              currentStudentRow.currentClassId
                ? eq(ptmEvents.classId, currentStudentRow.currentClassId)
                : undefined
            )
          ),
        });

        let ptmBookingSnap: UpcomingEventSnapshot["booking"] = null;
        let bookingWindowSnap: UpcomingEventSnapshot["bookingWindow"] = null;
        const resolvedVenue = ptmEventRow?.venue || e.description;

        if (ptmEventRow) {
          bookingWindowSnap = {
            opensAt: ptmEventRow.bookingOpensAt,
            closesAt: ptmEventRow.bookingClosesAt,
            isOpen: now >= ptmEventRow.bookingOpensAt && now <= ptmEventRow.bookingClosesAt,
          };

          const [activeBooking] = await tx
            .select({
              id: ptmBookings.id,
              slotId: ptmBookings.slotId,
              status: ptmBookings.status,
              teacherNote: ptmBookings.teacherNote,
              startAt: ptmSlots.startAt,
              endAt: ptmSlots.endAt,
              teacherUserId: ptmSlots.teacherUserId,
              teacherFirstNameEncrypted: staff.firstNameEncrypted,
              teacherLastNameEncrypted: staff.lastNameEncrypted,
            })
            .from(ptmBookings)
            .innerJoin(ptmSlots, eq(ptmBookings.slotId, ptmSlots.id))
            .leftJoin(staff, eq(ptmSlots.teacherUserId, staff.userId))
            .where(
              and(
                eq(ptmBookings.ptmEventId, ptmEventRow.id),
                eq(ptmBookings.studentId, currentStudentRow.id),
                eq(ptmBookings.schoolId, school.id),
                eq(ptmBookings.status, "BOOKED")
              )
            )
            .limit(1);

          if (activeBooking) {
            let resolvedTeacher = "Class Teacher";
            if (activeBooking.teacherFirstNameEncrypted) {
              try {
                const fn = decryptData(activeBooking.teacherFirstNameEncrypted) || "";
                const ln = activeBooking.teacherLastNameEncrypted
                  ? decryptData(activeBooking.teacherLastNameEncrypted) || ""
                  : "";
                const full = `${fn} ${ln}`.trim();
                if (full) resolvedTeacher = full;
              } catch {}
            }

            ptmBookingSnap = {
              id: activeBooking.id,
              slotId: activeBooking.slotId,
              startAt: activeBooking.startAt,
              endAt: activeBooking.endAt,
              status: activeBooking.status as "BOOKED",
              teacherName: resolvedTeacher,
              teacherNote: activeBooking.teacherNote,
            };
          }
        }

        eventSnaps.push({
          id: e.id,
          title: e.title,
          eventType: e.eventType,
          startDate: e.startDate,
          endDate: e.endDate,
          venue: resolvedVenue,
          ptmEventId: ptmEventRow?.id || null,
          bookingWindow: bookingWindowSnap,
          booking: ptmBookingSnap,
        });
      } else {
        eventSnaps.push({
          id: e.id,
          title: e.title,
          eventType: e.eventType,
          startDate: e.startDate,
          endDate: e.endDate,
          venue: e.description,
        });
      }
    }

    // H. Unread Messages (D6: real teacher names resolved from staff/users)
    let unreadMessageSnaps: UnreadMessageSnapshot[] = [];
    if (ctx.role === "PARENT") {
      const msgRows = await tx.query.parentTeacherMessages.findMany({
        where: and(
          eq(parentTeacherMessages.schoolId, school.id),
          eq(parentTeacherMessages.studentId, currentStudentRow.id),
          eq(parentTeacherMessages.recipientUserId, ctx.userId),
          eq(parentTeacherMessages.isRead, false)
        ),
        orderBy: [desc(parentTeacherMessages.createdAt)],
        limit: 3,
      });

      const teacherUserIds = Array.from(
        new Set(msgRows.map((m) => m.senderUserId).filter(Boolean))
      );

      const staffProfiles =
        teacherUserIds.length > 0
          ? await tx.query.staff.findMany({
              where: and(
                eq(staff.schoolId, school.id),
                inArray(staff.userId, teacherUserIds)
              ),
            })
          : [];

      const staffNameMap = new Map<string, string>();
      for (const s of staffProfiles) {
        if (s.userId) {
          try {
            const fName = decryptData(s.firstNameEncrypted) || "";
            const lName = s.lastNameEncrypted ? decryptData(s.lastNameEncrypted) : "";
            const fullName = `${fName} ${lName}`.trim();
            if (fullName) staffNameMap.set(s.userId, fullName);
          } catch {
            // Decryption fallback
          }
        }
      }

      unreadMessageSnaps = msgRows.map((m) => {
        const teacherName =
          (m.senderUserId && staffNameMap.get(m.senderUserId)) || "Class Teacher";
        return {
          threadId: m.parentMessageId || m.id,
          teacherName,
          lastMessagePreview: m.content?.slice(0, 80) || "",
          sentAt: m.createdAt,
        };
      });
    }

    // I. Leave Requests (Workflow OP3 & Phase P10)
    const leaveRows = await tx.query.studentLeaveRequests.findMany({
      where: and(
        eq(studentLeaveRequests.schoolId, school.id),
        eq(studentLeaveRequests.studentId, currentStudentRow.id),
      ),
      orderBy: [desc(studentLeaveRequests.createdAt)],
      limit: 5,
    });

    const leaveRequestSnaps: LeaveRequestSnapshot[] = leaveRows.map((lr) => ({
      id: lr.id,
      leaveType: lr.leaveType,
      startDate: lr.startDate,
      endDate: lr.endDate,
      reason: lr.reason,
      status: lr.status,
      decidedAt: lr.decidedAt,
      decisionNote: lr.decisionNote,
    }));

    // J. Fee Queries (Workflow OP2 & Phase P12)
    const fqRows = await tx.query.feeQueries.findMany({
      where: and(
        eq(feeQueries.schoolId, school.id),
        eq(feeQueries.studentId, currentStudentRow.id),
      ),
      orderBy: [desc(feeQueries.createdAt)],
      limit: 5,
    });

    const fqResponderIds = Array.from(
      new Set(fqRows.map((q) => q.answeredByUserId).filter(Boolean) as string[])
    );

    const fqResponders =
      fqResponderIds.length > 0
        ? await tx.query.users.findMany({
            where: and(
              eq(users.schoolId, school.id),
              inArray(users.id, fqResponderIds)
            ),
          })
        : [];

    const fqResponderMap = new Map<string, string>();
    for (const u of fqResponders) {
      fqResponderMap.set(u.id, u.email || "School Staff");
    }

    const feeQuerySnaps: FeeQuerySnapshot[] = fqRows.map((fq) => ({
      id: fq.id,
      invoiceId: fq.invoiceId,
      category: fq.category,
      message: fq.message,
      status: fq.status,
      createdAt: fq.createdAt,
      answer: fq.answer,
      answeredAt: fq.answeredAt,
      escalatedAt: fq.escalatedAt,
      answeredByName: fq.answeredByUserId ? fqResponderMap.get(fq.answeredByUserId) || null : null,
      termName: invoiceSnaps.find((inv) => inv.id === fq.invoiceId)?.termName || "School Fee",
    }));

    return {
      attendanceSnap: attendanceToday,
      attendanceRate30d: attRate,
      invoiceSnaps,
      homeworkSnaps,
      reportCardSnaps,
      busPassSnap,
      routeStopsSnap,
      latestBusPingSnap,
      noticeSnaps,
      eventSnaps,
      unreadMessageSnaps,
      leaveRequestSnaps,
      feeQuerySnaps,
    };
  });

  currentStudent.attendanceRate = attendanceRate30d;

  // 5. Build snapshot & derive feed cards
  let weeklyDigestSnap: WeeklyDigestSnapshot | undefined = undefined;
  const dayOfWeek = now.getDay();
  const hour = now.getHours();
  // Active Monday 08:00 through Tuesday 23:59 (AC-P23)
  if ((dayOfWeek === 1 && hour >= 8) || dayOfWeek === 2) {
    const diffDays = dayOfWeek - 1 + 7;
    const lastMon = new Date(now);
    lastMon.setDate(now.getDate() - diffDays);
    const lastSun = new Date(lastMon);
    lastSun.setDate(lastMon.getDate() + 6);
    const weekLabel = `${lastMon.toLocaleDateString("en-IN", { month: "short", day: "numeric" })} - ${lastSun.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`;

    const gradedCount = homeworkSnaps.filter((h) => Boolean(h.submission?.grade)).length;
    const hasOverdue = invoiceSnaps.some((i) => i.status === "OVERDUE");
    const dueSoonInv = invoiceSnaps.find((i) => i.status === "PENDING" || i.status === "PARTIAL");
    const feesStatus = hasOverdue ? "OVERDUE" : dueSoonInv ? "DUE_SOON" : "UP_TO_DATE";
    const balanceAmount = invoiceSnaps.reduce((sum, inv) => sum + (inv.balanceAmount || 0), 0);

    weeklyDigestSnap = {
      weekLabel,
      attendanceDays: Math.min(5, Math.round(((attendanceRate30d || 100) / 100) * 5)),
      totalSchoolDays: 5,
      homeworkGradedCount: gradedCount,
      feesStatus,
      balanceAmount: balanceAmount > 0 ? balanceAmount : undefined,
      upcomingEventsCount: eventSnaps.length,
      upcomingEventSummary: eventSnaps[0]?.title || undefined,
    };
  }

  const snapshot: ParentDataSnapshot = {
    studentName: currentStudent.name,
    attendanceToday: attendanceSnap,
    invoices: invoiceSnaps,
    homework: homeworkSnaps,
    reportCards: reportCardSnaps,
    busPass: busPassSnap,
    routeStops: routeStopsSnap,
    latestBusPing: latestBusPingSnap,
    notices: noticeSnaps,
    upcomingEvents: eventSnaps,
    unreadMessages: unreadMessageSnaps,
    leaveRequests: leaveRequestSnaps,
    feeQueries: feeQuerySnaps,
    weeklyDigest: weeklyDigestSnap,
  };

  const initialCards = deriveParentFeed(currentStudent.id, now, snapshot);

  return (
    <div className="py-2">
      <ParentFeedContainer
        initialCards={initialCards}
        currentStudent={currentStudent}
        availableStudents={availableStudents}
        locale={searchParams?.locale || "en"}
      />
    </div>
  );
}
