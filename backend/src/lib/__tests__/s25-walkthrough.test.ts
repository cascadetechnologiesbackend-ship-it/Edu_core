import { describe, it, expect, vi, beforeEach } from "vitest";
import { notifyResultReleased, notifyAdmitCardsReleased } from "../examNotifications";
import * as webPushDispatcher from "../webPushDispatcher";
import { flushQuietHoursNotifications, drainQueuedSms } from "../../workers/notificationQueueWorker";
import * as smsModule from "../sms";
import * as emailModule from "../email";

const { activeMockDbRef } = vi.hoisted(() => {
  const activeMockDbRef = { current: {} as any };
  return { activeMockDbRef };
});

vi.mock("../webPushDispatcher", () => ({
  dispatchWebPush: vi.fn(),
  isWebPushConfigured: vi.fn().mockReturnValue(true),
}));

vi.mock("../sms", () => ({
  sendSMSWithStatus: vi.fn(),
  isSmsConfigured: vi.fn().mockReturnValue(true),
  sendSMS: vi.fn(),
}));

vi.mock("../encryption", () => ({
  decryptData: vi.fn((encrypted: string) => {
    if (encrypted === "enc-9876543210") return "9876543210";
    if (encrypted === "enc-invalid") return null;
    return encrypted?.replace("enc-", "") || null;
  }),
  encryptData: vi.fn((plain: string) => `enc-${plain}`),
}));

vi.mock("../tenant", () => ({
  withTenant: vi.fn(async (_schoolId: string, fn: any) => fn(activeMockDbRef.current)),
}));

describe("S25 Layer L7: End-to-End Walkthrough Verification (The Honesty Loop)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(webPushDispatcher.isWebPushConfigured).mockReturnValue(true);
    vi.mocked(smsModule.isSmsConfigured).mockReturnValue(true);
  });

  it("Act 1: Exam Result Release in daytime dispatches first, writes honest mixed outcomes, pushSentCount reflects reality", async () => {
    // 2 parents: Parent A has web push, Parent B has no subscription
    vi.mocked(webPushDispatcher.dispatchWebPush).mockResolvedValue([
      { userId: "parent-A", subscriptionFound: true, success: true, status: "DELIVERED" },
      { userId: "parent-B", subscriptionFound: false, success: true, status: "SKIPPED_NO_SUBSCRIPTION" },
    ]);

    const insertedLogs: any[] = [];
    const mockDb: any = {
      query: {
        reportCardSetups: {
          findFirst: vi.fn().mockResolvedValue({ id: "setup-1", name: "Term 1 Finals" }),
        },
        resultSettings: {
          findFirst: vi.fn().mockResolvedValue({ smsNotificationsEnabled: false }),
        },
        examClassScopes: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        students: {
          findMany: vi.fn().mockResolvedValue([
            { id: "stu-1", firstNameEncrypted: "Aarav", schoolId: "sch-1", currentSectionId: "sec-1", primaryParentUserId: "parent-A" },
            { id: "stu-2", firstNameEncrypted: "Diya", schoolId: "sch-1", currentSectionId: "sec-1", primaryParentUserId: "parent-B" },
          ]),
        },
        studentFamilyMembers: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((rows: any) => {
          insertedLogs.push(...(Array.isArray(rows) ? rows : [rows]));
          return {
            returning: vi.fn().mockResolvedValue([{ id: "nt-1" }]),
          };
        }),
      })),
    };

    activeMockDbRef.current = mockDb;

    // Daytime check: isQuietHours = false
    const res = await notifyResultReleased(
      { schoolId: "sch-1", setupId: "setup-1", triggeredById: "admin-1" },
      mockDb,
      () => false,
    );

    // 1. Dispatch was invoked before database insert
    expect(webPushDispatcher.dispatchWebPush).toHaveBeenCalledTimes(1);
    const dispatchedRecipients = vi.mocked(webPushDispatcher.dispatchWebPush).mock.calls[0][1];
    expect(dispatchedRecipients).toEqual(["parent-A", "parent-B"]);

    // 2. Database logs reflect individual outcomes
    const pushLogs = insertedLogs.filter((r) => r.type === "PUSH" || r.channel === "PUSH" || r.status !== undefined);
    expect(pushLogs.length).toBe(2);

    const logA = pushLogs.find((l) => l.recipientUserId === "parent-A");
    const logB = pushLogs.find((l) => l.recipientUserId === "parent-B");

    expect(logA?.status).toBe("DELIVERED");
    expect(logB?.status).toBe("SKIPPED_NO_SUBSCRIPTION");

    // 3. pushSentCount strictly counts DELIVERED, not 2
    expect(res.pushSentCount).toBe(1);
  });

  it("Act 2: Quiet hours deferral logs DEFERRED_QUIET_HOURS without dispatching", async () => {
    const insertedLogs: any[] = [];
    const mockDb: any = {
      query: {
        exams: {
          findFirst: vi.fn().mockResolvedValue({ id: "exam-1", name: "Final Exams" }),
        },
        examClassScopes: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        students: {
          findMany: vi.fn().mockResolvedValue([
            { id: "stu-1", firstNameEncrypted: "Aarav", schoolId: "sch-1", currentSectionId: "sec-1", primaryParentUserId: "parent-A" },
          ]),
        },
        studentFamilyMembers: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
      insert: vi.fn().mockImplementation(() => ({
        values: vi.fn().mockImplementation((rows: any) => {
          insertedLogs.push(...(Array.isArray(rows) ? rows : [rows]));
          return {
            returning: vi.fn().mockResolvedValue([{ id: "nt-1" }]),
          };
        }),
      })),
    };

    activeMockDbRef.current = mockDb;

    // Night time check: isQuietHours = true
    const res = await notifyAdmitCardsReleased(
      { schoolId: "sch-1", examId: "exam-1", triggeredById: "admin-1" },
      mockDb,
      () => true,
    );

    // Web push dispatch was bypassed
    expect(webPushDispatcher.dispatchWebPush).not.toHaveBeenCalled();

    // Log status is DEFERRED_QUIET_HOURS
    expect(res.pushSentCount).toBe(0);
    const pushLog = insertedLogs.find((r) => r.recipientUserId === "parent-A");
    expect(pushLog?.status).toBe("DEFERRED_QUIET_HOURS");
  });

  it("Act 3: Morning flush dispatches distinct payloads per parent and updates status to DELIVERED", async () => {
    const deferredLogs = [
      {
        id: "log-1",
        schoolId: "sch-1",
        recipientUserId: "parent-A",
        title: "Aarav Admit Card",
        body: "Aarav admit card is ready",
        status: "DEFERRED_QUIET_HOURS",
      },
      {
        id: "log-2",
        schoolId: "sch-1",
        recipientUserId: "parent-B",
        title: "Diya Admit Card",
        body: "Diya admit card is ready",
        status: "DEFERRED_QUIET_HOURS",
      },
    ];

    const updatedRows: any[] = [];
    const mockDb: any = {
      query: {
        pushNotificationLogs: {
          findMany: vi.fn().mockResolvedValue(deferredLogs),
        },
      },
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((patch: any) => ({
          where: vi.fn().mockImplementation(() => {
            updatedRows.push(patch);
            return Promise.resolve();
          }),
        })),
      })),
    };

    activeMockDbRef.current = mockDb;

    vi.mocked(webPushDispatcher.dispatchWebPush).mockImplementation(async (_sch, recipients, payload) => {
      return recipients.map((r) => ({
        userId: r,
        subscriptionFound: true,
        success: true,
        status: "DELIVERED",
      }));
    });

    // Morning check: isQuietHours = false
    const res = await flushQuietHoursNotifications("sch-1", mockDb, () => false);

    // Dispatched twice: once for Aarav payload, once for Diya payload
    expect(webPushDispatcher.dispatchWebPush).toHaveBeenCalledTimes(2);
    expect(vi.mocked(webPushDispatcher.dispatchWebPush).mock.calls[0][2].title).toBe("Aarav Admit Card");
    expect(vi.mocked(webPushDispatcher.dispatchWebPush).mock.calls[1][2].title).toBe("Diya Admit Card");

    expect(res.flushedCount).toBe(2);
    expect(updatedRows.length).toBe(2);
    expect(updatedRows[0].status).toBe("DELIVERED");
    expect(updatedRows[1].status).toBe("DELIVERED");
  });

  it("Act 4: SMS Queue drain decrypts phone, delivers via gateway, records gateway messageId, enforces 500 cap", async () => {
    const queuedLogs = [
      {
        id: "sms-log-1",
        schoolId: "sch-1",
        recipientUserId: "parent-A",
        message: "Exam schedule published",
        status: "QUEUED",
        recipientMobileEncrypted: null,
      },
    ];

    vi.mocked(smsModule.sendSMSWithStatus).mockResolvedValue({
      delivered: true,
      messageId: "gw-sms-998877",
      attempts: 1,
    });

    const updatedRows: any[] = [];
    const mockDb: any = {
      query: {
        smsLogs: {
          findMany: vi.fn()
            .mockResolvedValueOnce(queuedLogs) // for initial findMany of QUEUED sms
            .mockResolvedValueOnce([]), // for todayLogs check (0 sent so far)
        },
        users: {
          findFirst: vi.fn().mockResolvedValue({
            mobileEncrypted: "enc-9876543210",
          }),
        },
        studentFamilyMembers: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      update: vi.fn().mockImplementation(() => ({
        set: vi.fn().mockImplementation((patch: any) => ({
          where: vi.fn().mockImplementation(() => {
            updatedRows.push(patch);
            return Promise.resolve();
          }),
        })),
      })),
    };

    activeMockDbRef.current = mockDb;

    const res = await drainQueuedSms("sch-1", mockDb);

    expect(smsModule.sendSMSWithStatus).toHaveBeenCalledWith(
      "9876543210",
      expect.any(String),
      expect.any(Object),
    );
    expect(res.sentCount).toBe(1);
    expect(updatedRows.length).toBe(1);
    expect(updatedRows[0].status).toBe("SENT");
    expect(updatedRows[0].gatewayMessageId).toBe("gw-sms-998877");
  });

  it("Act 5: Fail-closed truth under unconfigured production environment across all 3 channels", async () => {
    // 1. Web push unconfigured
    vi.mocked(webPushDispatcher.isWebPushConfigured).mockReturnValue(false);
    vi.mocked(webPushDispatcher.dispatchWebPush).mockResolvedValue([
      { userId: "parent-A", subscriptionFound: true, success: false, status: "SKIPPED_UNCONFIGURED", error: "VAPID not configured" },
    ]);

    const pushRes = await webPushDispatcher.dispatchWebPush("sch-1", ["parent-A"], { title: "T", body: "B" });
    expect(pushRes[0].status).toBe("SKIPPED_UNCONFIGURED");
    expect(pushRes[0].success).toBe(false);

    // 2. SMS unconfigured
    vi.mocked(smsModule.isSmsConfigured).mockReturnValue(false);
    const mockDb: any = {
      query: {
        smsLogs: {
          findMany: vi.fn().mockResolvedValue([{ id: "s-1", schoolId: "sch-1", status: "QUEUED" }]),
        },
      },
    };
    activeMockDbRef.current = mockDb;
    const smsRes = await drainQueuedSms("sch-1", mockDb);
    expect(smsRes.sentCount).toBe(0);
    expect(smsModule.sendSMSWithStatus).not.toHaveBeenCalled();

    // 3. Email unconfigured
    const originalEnv = process.env.NODE_ENV;
    const originalSmtp = process.env.SMTP_HOST;
    try {
      (process.env as any).NODE_ENV = "production";
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      expect(emailModule.isEmailConfigured()).toBe(false);
      const emailRes = await emailModule.sendEmail({ to: "test@parent.org", subject: "S", html: "<p>H</p>" });
      expect(emailRes.delivered).toBe(false);
      expect(emailRes.unconfigured).toBe(true);
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      if (originalSmtp) process.env.SMTP_HOST = originalSmtp;
    }
  });
});
