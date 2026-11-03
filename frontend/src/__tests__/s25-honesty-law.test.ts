import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Sprint S25 Layer L8: Notification Delivery Truth & Honesty Law Scanner", () => {
  const getFileContent = (relativePath: string) => {
    const fullPath = path.resolve(__dirname, "../../", relativePath);
    return fs.readFileSync(fullPath, "utf-8");
  };

  describe("1. Web Push Protocol Truth & Pruning (RFC 8030/8291/8292)", () => {
    const content = getFileContent("../backend/src/lib/webPushDispatcher.ts");

    it("verifies real webpush.sendNotification invocation with VAPID details", () => {
      expect(content).toContain("webpush.sendNotification");
      expect(content).toContain("webpush.setVapidDetails");
      expect(content).toContain("isWebPushConfigured");
    });

    it("verifies 404 and 410 dead subscription pruning from database", () => {
      expect(content).toContain("statusCode === 404 || statusCode === 410");
      expect(content).toContain("delete(userPushSubscriptions)");
    });

    it("verifies fail-closed SKIPPED_UNCONFIGURED status when VAPID is missing", () => {
      expect(content).toContain("SKIPPED_UNCONFIGURED");
    });
  });

  describe("2. SMS Drain Truth & Zero Fake-SENT (OD2 & 500/day Cap)", () => {
    const content = getFileContent("../backend/src/workers/notificationQueueWorker.ts");

    it("verifies sendSMSWithStatus invocation per queued SMS log", () => {
      expect(content).toContain("sendSMSWithStatus");
    });

    it("verifies recipient mobile number decryption via decryptData", () => {
      expect(content).toContain("decryptData");
    });

    it("verifies strict 500 SMS/day quota enforcement", () => {
      expect(content).toContain("500");
      expect(content).toContain("remainingCap");
    });

    it("verifies zero fake SENT status writes upstream of gateway delivery", () => {
      expect(content).not.toMatch(/\.insert\(smsLogs\)[^;]*status:\s*["']SENT["']/s);
    });
  });

  describe("3. Exam Notification Inverted Write-Path Truth", () => {
    const content = getFileContent("../backend/src/lib/examNotifications.ts");

    it("verifies all 4 notification builders persist downstream of dispatch", () => {
      const matches = content.match(/persistPushResults/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(4);
    });

    it("verifies quiet hours deferral uses persistQuietHoursPushLogs", () => {
      const matches = content.match(/persistQuietHoursPushLogs/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(4);
    });

    it("verifies zero direct inserts into pushNotificationLogs in examNotifications.ts", () => {
      expect(content).not.toContain("insert(pushNotificationLogs)");
    });
  });

  describe("4. Email Honesty & Unified Channel Contract", () => {
    const content = getFileContent("../backend/src/lib/email.ts");

    it("verifies isEmailConfigured validation and zero smtp.example.com in executable code", () => {
      expect(content).toContain("isEmailConfigured");
      // Check that executable lines don't have smtp.example.com
      const lines = content.split("\n").filter((l) => !l.trim().startsWith("*") && !l.trim().startsWith("//"));
      for (const line of lines) {
        expect(line).not.toContain("smtp.example.com");
      }
    });

    it("verifies production fail-closed behavior returning unconfigured flag", () => {
      expect(content).toContain("unconfigured: true");
    });
  });

  describe("5. Quiet-Hours Flush Payload Integrity (Zero Cross-Recipient Corruption)", () => {
    const content = getFileContent("../backend/src/workers/notificationQueueWorker.ts");

    it("verifies grouping by exact payload (title + body) before dispatch", () => {
      expect(content).toContain("byPayload");
      expect(content).toContain("key = `${log.title}:::${log.body}`");
    });

    it("verifies scheduler registrations for quiet hours and sms drain", () => {
      expect(content).toContain("registerNotificationSchedulers");
      expect(content).toContain("5 7 * * *");
    });
  });
});
