import { describe, it, expect, vi, beforeEach } from "vitest";
import { drainQueuedSms } from "../notificationQueueWorker";
import * as smsModule from "../../lib/sms";
import * as encryptionModule from "../../lib/encryption";

vi.mock("../../lib/sms", () => ({
  sendSMSWithStatus: vi.fn(),
  isSmsConfigured: vi.fn(),
  sendSMS: vi.fn(),
}));

vi.mock("../../lib/encryption", () => ({
  decryptData: vi.fn((encrypted: string) => {
    if (encrypted === "enc-9876543210") return "9876543210";
    if (encrypted === "enc-invalid") return null;
    return encrypted.replace("enc-", "");
  }),
  encryptData: vi.fn((plain: string) => `enc-${plain}`),
}));

vi.mock("../../lib/tenant", () => ({
  withTenant: vi.fn(async (_schoolId: string, fn: any) => fn()),
}));

describe("S25 Layer L2: SMS Drain Truth & Zero Fake-SENT", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defers drain without fabricating SENT when SMS provider is unconfigured (OD2)", async () => {
    vi.mocked(smsModule.isSmsConfigured).mockReturnValue(false);

    const mockDb = {
      query: {
        smsLogs: {
          findMany: vi.fn().mockResolvedValue([
            { id: "sms-1", schoolId: "school-1", recipientUserId: "user-1", status: "QUEUED" },
          ]),
        },
      },
    };

    const res = await drainQueuedSms("school-1", mockDb as any);

    expect(res.sentCount).toBe(0);
    expect(smsModule.sendSMSWithStatus).not.toHaveBeenCalled();
  });

  it("decrypts recipient mobile, calls sendSMSWithStatus, and transitions to SENT on delivery", async () => {
    vi.mocked(smsModule.isSmsConfigured).mockReturnValue(true);
    vi.mocked(smsModule.sendSMSWithStatus).mockResolvedValue({
      delivered: true,
      messageId: "gw-msg-12345",
      attempts: 1,
    });

    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      }),
    });

    const mockDb = {
      query: {
        smsLogs: {
          findMany: vi
            .fn()
            // 1st call: queued SMS items
            .mockResolvedValueOnce([
              {
                id: "sms-1",
                schoolId: "school-1",
                recipientUserId: "user-parent-1",
                templateId: "EXAM_RESULT_PUBLISHED",
                messageType: "EXAM",
                status: "QUEUED",
              },
            ])
            // 2nd call: today's SENT logs for daily cap check
            .mockResolvedValueOnce([]),
        },
        users: {
          findFirst: vi.fn().mockResolvedValue({
            id: "user-parent-1",
            mobileEncrypted: "enc-9876543210",
          }),
        },
        studentFamilyMembers: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      update: mockUpdate,
    };

    const res = await drainQueuedSms("school-1", mockDb as any);

    expect(smsModule.sendSMSWithStatus).toHaveBeenCalledWith(
      "9876543210",
      expect.stringContaining("Examination results"),
      expect.objectContaining({ templateId: "EXAM_RESULT_PUBLISHED" })
    );

    expect(res.sentCount).toBe(1);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it("records FAILED with provider error when delivery fails, without consuming quota", async () => {
    vi.mocked(smsModule.isSmsConfigured).mockReturnValue(true);
    vi.mocked(smsModule.sendSMSWithStatus).mockResolvedValue({
      delivered: false,
      error: "Twilio DLT route rejection: 400",
      attempts: 3,
    });

    let updatedSetValues: any = null;
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn((vals: any) => {
        updatedSetValues = vals;
        return {
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        };
      }),
    });

    const mockDb = {
      query: {
        smsLogs: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([
              {
                id: "sms-2",
                schoolId: "school-1",
                recipientUserId: "user-parent-2",
                templateId: "EXAM_RESULT_PUBLISHED",
                messageType: "EXAM",
                status: "QUEUED",
              },
            ])
            .mockResolvedValueOnce([]),
        },
        users: {
          findFirst: vi.fn().mockResolvedValue({
            id: "user-parent-2",
            mobileEncrypted: "enc-9876543210",
          }),
        },
        studentFamilyMembers: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      update: mockUpdate,
    };

    const res = await drainQueuedSms("school-1", mockDb as any);

    expect(res.sentCount).toBe(0);
    expect(updatedSetValues).toEqual(
      expect.objectContaining({
        status: "FAILED",
        failureReason: "Twilio DLT route rejection: 400",
      })
    );
  });

  it("marks FAILED when recipient has no mobile on file", async () => {
    vi.mocked(smsModule.isSmsConfigured).mockReturnValue(true);

    let updatedSetValues: any = null;
    const mockUpdate = vi.fn().mockReturnValue({
      set: vi.fn((vals: any) => {
        updatedSetValues = vals;
        return {
          where: vi.fn().mockResolvedValue({ rowCount: 1 }),
        };
      }),
    });

    const mockDb = {
      query: {
        smsLogs: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([
              {
                id: "sms-3",
                schoolId: "school-1",
                recipientUserId: "user-no-phone",
                templateId: "EXAM_RESULT_PUBLISHED",
                messageType: "EXAM",
                status: "QUEUED",
              },
            ])
            .mockResolvedValueOnce([]),
        },
        users: {
          findFirst: vi.fn().mockResolvedValue({
            id: "user-no-phone",
            mobileEncrypted: null,
          }),
        },
        studentFamilyMembers: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
      },
      update: mockUpdate,
    };

    const res = await drainQueuedSms("school-1", mockDb as any);

    expect(smsModule.sendSMSWithStatus).not.toHaveBeenCalled();
    expect(res.sentCount).toBe(0);
    expect(updatedSetValues).toEqual(
      expect.objectContaining({
        status: "FAILED",
        failureReason: "No mobile number on file for recipient",
      })
    );
  });

  it("strictly enforces 500 SMS/day limit per school", async () => {
    vi.mocked(smsModule.isSmsConfigured).mockReturnValue(true);

    // Mock that today already has 500 sent rows
    const existing500 = new Array(500).fill({ id: "sent-id" });

    const mockDb = {
      query: {
        smsLogs: {
          findMany: vi
            .fn()
            .mockResolvedValueOnce([
              {
                id: "sms-capped",
                schoolId: "school-1",
                recipientUserId: "user-1",
                templateId: "EXAM_RESULT_PUBLISHED",
                messageType: "EXAM",
                status: "QUEUED",
              },
            ])
            .mockResolvedValueOnce(existing500),
        },
      },
    };

    const res = await drainQueuedSms("school-1", mockDb as any);

    expect(res.sentCount).toBe(0);
    expect(res.cappedCount).toBe(1);
    expect(smsModule.sendSMSWithStatus).not.toHaveBeenCalled();
  });
});
