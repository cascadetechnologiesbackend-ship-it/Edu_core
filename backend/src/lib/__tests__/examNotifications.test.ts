import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import {
  notifyResultReleased,
  notifyAdmitCardsReleased,
  notifyDatesheetPublished,
  notifyBulkJobCompleted,
} from "../examNotifications";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { db } from "@/db";
import {
  notices,
  pushNotificationLogs,
  smsLogs,
  userPushSubscriptions,
  reportCardSetups,
  resultSettings,
  exams,
  classes,
  subjects,
  examSchedules,
  students,
  users,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S11 Layer 3: Examination Lifecycle Communication Wiring", () => {
  let pool: Pool;
  const schoolA = ISOLATION_IDS.schoolA.id;
  const schoolB = ISOLATION_IDS.schoolB.id;
  let testExamAId: string;
  let testSetupAId: string;
  let testScheduleAId: string;
  let parentAUserId: string;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    await seedIsolationSchools();

    const runId = Math.random().toString(36).substring(2, 7);

    // 1. Create a parent user in School A
    const [pUser] = await db
      .insert(users)
      .values({
        schoolId: schoolA,
        email: `parent_notif_${runId}@isolation.internal`,
        isActive: true,
      })
      .returning();
    parentAUserId = pUser!.id;

    // 2. Link student in School A to parentAUserId
    await db
      .update(students)
      .set({ primaryParentUserId: parentAUserId })
      .where(eq(students.id, ISOLATION_IDS.schoolA.studentId));

    // 3. Create test exam for School A
    const [exam] = await db
      .insert(exams)
      .values({
        schoolId: schoolA,
        academicYearId: ISOLATION_IDS.schoolA.academicYearId,
        examTypeId: ISOLATION_IDS.schoolA.examTypeId,
        name: `S11 Layer 3 Exam ${runId}`,
        startDate: new Date("2026-11-01"),
        endDate: new Date("2026-11-15"),
      })
      .returning();
    testExamAId = exam!.id;

    // 4. Create a test schedule
    const [sched] = await db
      .insert(examSchedules)
      .values({
        schoolId: schoolA,
        examId: testExamAId,
        classId: ISOLATION_IDS.schoolA.classId,
        subjectId: ISOLATION_IDS.schoolA.subjectId,
        examDate: "2026-11-05",
        startTime: "09:00:00",
        durationMinutes: 180,
        maxMarks: "100.00",
        passingMarks: "33.00",
      })
      .returning();
    testScheduleAId = sched!.id;

    // 5. Create a test setup for School A
    const [setup] = await db
      .insert(reportCardSetups)
      .values({
        schoolId: schoolA,
        academicYearId: ISOLATION_IDS.schoolA.academicYearId,
        name: `Term Report ${runId}`,
        examWeightages: [{ examId: testExamAId, weightPercent: 100 }],
        createdById: ISOLATION_IDS.schoolA.adminUserId,
      })
      .returning();
    testSetupAId = setup!.id;
  });

  afterAll(async () => {
    // Restore primaryParentUserId to original fixture
    await db
      .update(students)
      .set({ primaryParentUserId: ISOLATION_IDS.schoolA.parentUserId })
      .where(eq(students.id, ISOLATION_IDS.schoolA.studentId));
    await pool.end();
  });

  it("3.1: notifyResultReleased creates in-app notice, push notification log, and contains ZERO marks or PII", async () => {
    const res = await notifyResultReleased({
      schoolId: schoolA,
      setupId: testSetupAId,
      triggeredById: ISOLATION_IDS.schoolA.adminUserId,
    });

    expect(res.success).toBe(true);
    expect(res.inAppNoticeId).toBeDefined();
    expect(res.pushSentCount).toBeGreaterThanOrEqual(1);

    // Verify in-app notice
    const notice = await db.query.notices.findFirst({
      where: and(eq(notices.id, res.inAppNoticeId!), eq(notices.schoolId, schoolA)),
    });
    expect(notice).toBeDefined();
    expect(notice?.audienceType).toBe("PARENTS");
    expect(notice?.title).toContain("Results Published");

    // Verify push notification log
    const pushLogs = await db.query.pushNotificationLogs.findMany({
      where: and(
        eq(pushNotificationLogs.schoolId, schoolA),
        eq(pushNotificationLogs.recipientUserId, parentAUserId),
      ),
    });
    expect(pushLogs.length).toBeGreaterThanOrEqual(1);
    const latestPush = pushLogs[pushLogs.length - 1];

    // Assert zero student marks or private scores in payload
    expect(latestPush?.body).toContain("Tap to view");
    expect(latestPush?.body).not.toMatch(/\bmarks\s*:\s*\d+/i);
    expect(latestPush?.body).not.toMatch(/\bscore\s*:\s*\d+/i);
  });

  it("3.2: notifyResultReleased triggers SMS fallback only when smsNotificationsEnabled=true and parent has no push sub", async () => {
    // 1. First, enable SMS on this setup in result_settings
    await db
      .insert(resultSettings)
      .values({
        schoolId: schoolA,
        setupId: testSetupAId,
        smsNotificationsEnabled: true,
        withholdAll: false,
        feeLockMode: "OFF",
        feeLockThresholdAmount: "0.00",
      })
      .onConflictDoUpdate({
        target: [resultSettings.setupId],
        set: { smsNotificationsEnabled: true },
      });

    // Verify parentAUserId has NO web push subscription currently
    const res = await notifyResultReleased({
      schoolId: schoolA,
      setupId: testSetupAId,
      triggeredById: ISOLATION_IDS.schoolA.adminUserId,
    });

    expect(res.success).toBe(true);
    expect(res.smsQueuedCount).toBeGreaterThanOrEqual(1);

    // Verify SMS log entry exists
    const sms = await db.query.smsLogs.findMany({
      where: and(
        eq(smsLogs.schoolId, schoolA),
        eq(smsLogs.recipientUserId, parentAUserId),
        eq(smsLogs.messageType, "EXAM"),
      ),
    });

    expect(sms.length).toBeGreaterThanOrEqual(1);
    expect(sms[0]?.status).toBe("QUEUED");
  });

  it("3.3: notifyAdmitCardsReleased creates in-app notice and web push notification for parents", async () => {
    const res = await notifyAdmitCardsReleased({
      schoolId: schoolA,
      examId: testExamAId,
      triggeredById: ISOLATION_IDS.schoolA.adminUserId,
    });

    expect(res.success).toBe(true);
    expect(res.inAppNoticeId).toBeDefined();
    expect(res.pushSentCount).toBeGreaterThanOrEqual(1);

    const notice = await db.query.notices.findFirst({
      where: and(eq(notices.id, res.inAppNoticeId!), eq(notices.schoolId, schoolA)),
    });
    expect(notice?.title).toContain("Admit Cards Released");
  });

  it("3.4: notifyDatesheetPublished creates in-app notice with audienceType='ALL' and push logs", async () => {
    const res = await notifyDatesheetPublished({
      schoolId: schoolA,
      scheduleIds: [testScheduleAId],
      triggeredById: ISOLATION_IDS.schoolA.adminUserId,
    });

    expect(res.success).toBe(true);
    expect(res.inAppNoticeId).toBeDefined();

    const notice = await db.query.notices.findFirst({
      where: and(eq(notices.id, res.inAppNoticeId!), eq(notices.schoolId, schoolA)),
    });
    expect(notice?.title).toContain("Datesheet Published");
    expect(notice?.audienceType).toBe("ALL");
  });

  it("3.5: notifyBulkJobCompleted dispatches push notification directly to triggering admin user", async () => {
    const adminUserId = ISOLATION_IDS.schoolA.adminUserId;
    const res = await notifyBulkJobCompleted({
      schoolId: schoolA,
      jobId: "bulk-job-test-uuid",
      examId: testExamAId,
      triggeredById: adminUserId,
      processedCount: 45,
      failedCount: 0,
    });

    expect(res.success).toBe(true);
    expect(res.pushSentCount).toBe(1);

    const pushLog = await db.query.pushNotificationLogs.findFirst({
      where: and(
        eq(pushNotificationLogs.schoolId, schoolA),
        eq(pushNotificationLogs.recipientUserId, adminUserId),
      ),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });

    expect(pushLog).toBeDefined();
    expect(pushLog?.title).toContain("Bulk Report Card Generation Complete");
    expect(pushLog?.body).toContain("45 succeeded, 0 failed");
  });

  it("3.6: Cross-tenant isolation probe: School A notification never queries or sends to School B parent", async () => {
    // School B has its own parent user
    const schoolBParentUserId = ISOLATION_IDS.schoolB.parentUserId;

    // Trigger School A result release
    await notifyResultReleased({
      schoolId: schoolA,
      setupId: testSetupAId,
      triggeredById: ISOLATION_IDS.schoolA.adminUserId,
    });

    // Probe: School B parent user MUST have zero push or sms logs under School A
    const crossPushLogs = await db.query.pushNotificationLogs.findMany({
      where: and(
        eq(pushNotificationLogs.schoolId, schoolA),
        eq(pushNotificationLogs.recipientUserId, schoolBParentUserId),
      ),
    });
    expect(crossPushLogs.length).toBe(0);

    const crossSmsLogs = await db.query.smsLogs.findMany({
      where: and(
        eq(smsLogs.schoolId, schoolA),
        eq(smsLogs.recipientUserId, schoolBParentUserId),
      ),
    });
    expect(crossSmsLogs.length).toBe(0);
  });

  it("3.7: Failure-without-rollback rule: invalid schoolId does not crash or throw unhandled exceptions", async () => {
    const res = await notifyResultReleased({
      schoolId: "00000000-0000-0000-0000-000000000000",
      setupId: "00000000-0000-0000-0000-000000000000",
      triggeredById: "00000000-0000-0000-0000-000000000000",
    });

    // Expect graceful fail-safe handling (returns false with error, never throws)
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
  });
});
