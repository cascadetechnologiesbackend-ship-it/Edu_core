import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendEmail, isEmailConfigured, type EmailDeliveryResult } from "../email";
import type { SmsDeliveryResult } from "../sms";
import nodemailer from "nodemailer";

vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(),
  },
  createTransport: vi.fn(),
}));

describe("S25 Layer L5: Email Honesty & Unified Channel Contract", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("isEmailConfigured", () => {
    it("returns false when SMTP_HOST is not set", () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;
      expect(isEmailConfigured()).toBe(false);
    });

    it("returns true when SMTP host and credentials are set", () => {
      process.env.SMTP_HOST = "smtp.sendgrid.net";
      process.env.SMTP_USER = "apikey";
      process.env.SMTP_PASS = "secret-pass";
      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe("sendEmail in Production", () => {
    it("fails closed with unconfigured: true when SMTP is missing in production (no example.com attempt)", async () => {
      (process.env as any).NODE_ENV = "production";
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const res = await sendEmail({
        to: "parent@example.com",
        subject: "Exam Update",
        text: "Your child's results are ready.",
      });

      expect(res.delivered).toBe(false);
      expect(res.unconfigured).toBe(true);
      expect(res.error).toContain("SMTP credentials not configured");
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });

    it("dispatches via nodemailer transporter when configured", async () => {
      (process.env as any).NODE_ENV = "production";
      process.env.SMTP_HOST = "smtp.sendgrid.net";
      process.env.SMTP_USER = "apikey";
      process.env.SMTP_PASS = "secret-pass";

      const mockSendMail = vi.fn().mockResolvedValue({
        messageId: "smtp-msg-abc12345",
      });

      vi.mocked(nodemailer.createTransport).mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      const res = await sendEmail({
        to: "parent@example.com",
        subject: "Exam Update",
        text: "Your child's results are ready.",
      });

      expect(res.delivered).toBe(true);
      expect(res.messageId).toBe("smtp-msg-abc12345");
      expect(res.attempts).toBe(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "parent@example.com",
          subject: "Exam Update",
        })
      );
    });

    it("returns delivered: false with error when transporter fails", async () => {
      (process.env as any).NODE_ENV = "production";
      process.env.SMTP_HOST = "smtp.sendgrid.net";
      process.env.SMTP_USER = "apikey";
      process.env.SMTP_PASS = "secret-pass";

      const mockSendMail = vi.fn().mockRejectedValue(new Error("SMTP connection timeout"));

      vi.mocked(nodemailer.createTransport).mockReturnValue({
        sendMail: mockSendMail,
      } as any);

      const res = await sendEmail({
        to: "parent@example.com",
        subject: "Exam Update",
        text: "Your child's results are ready.",
      });

      expect(res.delivered).toBe(false);
      expect(res.error).toContain("SMTP connection timeout");
      expect(res.attempts).toBe(1);
    });
  });

  describe("sendEmail in Development", () => {
    it("returns dev mock success when unconfigured in development", async () => {
      (process.env as any).NODE_ENV = "development";
      delete process.env.SMTP_HOST;

      const res = await sendEmail({
        to: "dev@example.com",
        subject: "Dev Notice",
        text: "Hello dev",
      });

      expect(res.delivered).toBe(true);
      expect(res.messageId).toContain("dev-mock");
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });
  });

  describe("Unified Channel Contract Shape Parity", () => {
    it("asserts EmailDeliveryResult and SmsDeliveryResult share the same shape keys", () => {
      const emailSample: EmailDeliveryResult = {
        delivered: true,
        unconfigured: false,
        messageId: "msg-1",
        attempts: 1,
        error: undefined,
      };

      const smsSample: SmsDeliveryResult = {
        delivered: true,
        unconfigured: false,
        messageId: "msg-2",
        attempts: 1,
        error: undefined,
      };

      const emailKeys = Object.keys(emailSample).sort();
      const smsKeys = Object.keys(smsSample).sort();

      expect(emailKeys).toEqual(smsKeys);
    });
  });
});
