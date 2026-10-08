import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isSmsConfigured,
  normalizeIndianMobile,
  sendSMS,
  sendSMSWithStatus,
  sendDLTTransactionalSMS,
} from "../sms";

describe("AZ-01: Production Indian DLT SMS & Retry Resilience", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    delete process.env.SMS_API_KEY;
    delete process.env.SMS_PROVIDER;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Configuration & Mobile Normalization", () => {
    it("reports unconfigured when environment credentials are unset", () => {
      expect(isSmsConfigured()).toBe(false);
    });

    it("reports configured when Twilio credentials are fully supplied", () => {
      process.env.SMS_PROVIDER = "TWILIO";
      process.env.TWILIO_ACCOUNT_SID = "AC_mock_sid";
      process.env.TWILIO_AUTH_TOKEN = "mock_token";
      process.env.TWILIO_FROM_NUMBER = "+1234567890";
      expect(isSmsConfigured()).toBe(true);
    });

    it("reports configured when SMS_API_KEY is supplied for alternative providers", () => {
      process.env.SMS_PROVIDER = "MSG91";
      process.env.SMS_API_KEY = "mock_msg91_key";
      expect(isSmsConfigured()).toBe(true);
    });

    it("normalizes Indian mobile numbers reliably to E.164 (+91)", () => {
      expect(normalizeIndianMobile("9876543210")).toBe("+919876543210");
      expect(normalizeIndianMobile("09876543210")).toBe("+919876543210");
      expect(normalizeIndianMobile("919876543210")).toBe("+919876543210");
      expect(normalizeIndianMobile("+919876543210")).toBe("+919876543210");
      expect(normalizeIndianMobile("+91 98765 43210")).toBe("+919876543210");
    });
  });

  describe("Zero Fake-Success Guard (AZ-01 Invariant)", () => {
    it("strictly returns false and unconfigured status when no credentials exist", async () => {
      const boolRes = await sendSMS("9876543210", "Test notification");
      expect(boolRes).toBe(false);

      const statusRes = await sendSMSWithStatus("9876543210", "Test notification");
      expect(statusRes.delivered).toBe(false);
      expect(statusRes.unconfigured).toBe(true);
      expect(statusRes.error).toBeDefined();
    });
  });

  describe("Provider Dispatch & 3x Retry Handling", () => {
    beforeEach(() => {
      process.env.SMS_PROVIDER = "TWILIO";
      process.env.TWILIO_ACCOUNT_SID = "AC_test";
      process.env.TWILIO_AUTH_TOKEN = "token_test";
      process.env.TWILIO_FROM_NUMBER = "+15551234";
      process.env.SMS_DLT_PE_ID = "110123456789012";
      process.env.SMS_DLT_TEMPLATE_ID = "120156789012345";
    });

    it("dispatches Twilio request with DLT parameters and returns delivered: true on HTTP 200", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ sid: "SM_test_message_sid" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const res = await sendSMSWithStatus("9876543210", "Your fee receipt has been generated.", {
        entityId: "110123456789012",
        templateId: "120156789012345",
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(res.delivered).toBe(true);
      expect(res.messageId).toBe("SM_test_message_sid");
      expect(res.attempts).toBe(1);

      const [, callOptions] = fetchSpy.mock.calls[0];
      const bodyStr = callOptions?.body?.toString() || "";
      expect(bodyStr).toContain("To=%2B919876543210");
      expect(bodyStr).toContain("EntityId=110123456789012");
      expect(bodyStr).toContain("TemplateId=120156789012345");
    });

    it("retries up to 3 times on transient 500 error and succeeds on recovery", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(new Response("Gateway 502 Bad Gateway", { status: 502 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ sid: "SM_recovered_sid" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );

      const res = await sendSMSWithStatus("9876543210", "Retry test message");

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(res.delivered).toBe(true);
      expect(res.messageId).toBe("SM_recovered_sid");
      expect(res.attempts).toBe(2);
    });

    it("returns delivered: false with attempts: 3 when service fails continuously", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(new Response("Service Unavailable", { status: 503 }));

      const res = await sendSMSWithStatus("9876543210", "Fail test message");

      expect(fetchSpy).toHaveBeenCalledTimes(3);
      expect(res.delivered).toBe(false);
      expect(res.attempts).toBe(3);
      expect(res.error).toContain("Twilio delivery failed: HTTP 503");
    });

    it("formats template variables correctly in sendDLTTransactionalSMS", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ sid: "SM_otp_sid" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const res = await sendDLTTransactionalSMS("9876543210", "TMPL_OTP_01", {
        otp: "452109",
        validity: "5 mins",
      });

      expect(res.delivered).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
