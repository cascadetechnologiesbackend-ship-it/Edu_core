// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import NotificationDeliveryHealthPage from "../app/(admin)/admin/notifications/delivery/page";

const { configRef, authUserRef, mockDbLogs } = vi.hoisted(() => {
  const configRef = {
    webPushOk: false,
    smsOk: false,
    emailOk: false,
  };

  const authUserRef = {
    userId: "admin-1",
    email: "admin@school.org",
    role: "SCHOOL_ADMIN",
    schoolId: "school-101",
  };

  const mockDbLogs = {
    push: [
      { id: "p-1", schoolId: "school-101", title: "Results Released", body: "Term 1 Results", status: "DELIVERED", createdAt: new Date() },
      { id: "p-2", schoolId: "school-101", title: "Admit Card", body: "Term 1 Admit Card", status: "DELIVERED", createdAt: new Date() },
      { id: "p-3", schoolId: "school-101", title: "Datesheet", body: "Exam Datesheet", status: "FAILED", createdAt: new Date() },
      { id: "p-4", schoolId: "school-101", title: "Night Notice", body: "Night Alert", status: "DEFERRED_QUIET_HOURS", createdAt: new Date() },
      { id: "p-5", schoolId: "school-101", title: "Unregistered", body: "No Sub", status: "SKIPPED_UNCONFIGURED", createdAt: new Date() },
    ],
    sms: [
      { id: "s-1", schoolId: "school-101", status: "SENT", createdAt: new Date() },
      { id: "s-2", schoolId: "school-101", status: "SENT", createdAt: new Date() },
      { id: "s-3", schoolId: "school-101", status: "FAILED", createdAt: new Date() },
      { id: "s-4", schoolId: "school-101", status: "QUEUED", createdAt: new Date() },
    ],
  };

  return { configRef, authUserRef, mockDbLogs };
});

const redirectMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    redirectMock(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async () => {
    if (!authUserRef.userId) throw new Error("Unauthorized");
    return { ...authUserRef };
  }),
}));

vi.mock("@/lib/routeGuards", () => ({
  assertRouteAccess: vi.fn((role: string) => {
    if (role === "STUDENT" || role === "PARENT") {
      return { allowed: false, redirectUrl: "/unauthorized" };
    }
    return { allowed: true };
  }),
}));

vi.mock("@/lib/tenant", () => ({
  withTenant: vi.fn(async (schoolId: string, cb: any) => {
    const tx = {
      query: {
        schools: {
          findFirst: vi.fn(async () => ({ name: "Delhi Academy of Sciences", udiseCode: "DAS-01" })),
        },
        pushNotificationLogs: {
          findMany: vi.fn(async () => mockDbLogs.push),
        },
        smsLogs: {
          findMany: vi.fn(async () => mockDbLogs.sms),
        },
      },
    };
    return await cb(tx);
  }),
}));

vi.mock("@schoolmitra/backend/lib/webPushDispatcher", () => ({
  isWebPushConfigured: vi.fn(() => configRef.webPushOk),
}));

vi.mock("@schoolmitra/backend/lib/sms", () => ({
  isSmsConfigured: vi.fn(() => configRef.smsOk),
}));

vi.mock("@schoolmitra/backend/lib/email", () => ({
  isEmailConfigured: vi.fn(() => configRef.emailOk),
}));

describe("S25 Layer L6: Admin Notification Delivery Health Surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configRef.webPushOk = false;
    configRef.smsOk = false;
    configRef.emailOk = false;
    authUserRef.userId = "admin-1";
    authUserRef.role = "SCHOOL_ADMIN";
    authUserRef.schoolId = "school-101";
  });

  it("renders honest warning banners when all notification channels are unconfigured", async () => {
    configRef.webPushOk = false;
    configRef.smsOk = false;
    configRef.emailOk = false;

    const pageElement = await NotificationDeliveryHealthPage();
    render(pageElement);

    expect(screen.getByText(/Web Push \(VAPID\) is unconfigured/i)).toBeInTheDocument();
    expect(screen.getByText(/SMS Gateway is unconfigured/i)).toBeInTheDocument();
    expect(screen.getByText(/SMTP Email Transporter is unconfigured/i)).toBeInTheDocument();
  });

  it("renders all-configured success banner when all 3 channels are active", async () => {
    configRef.webPushOk = true;
    configRef.smsOk = true;
    configRef.emailOk = true;

    const pageElement = await NotificationDeliveryHealthPage();
    render(pageElement);

    expect(
      screen.getByText(/All 3 notification channels \(Web Push, SMS, Email\) are actively configured/i)
    ).toBeInTheDocument();
  });

  it("renders accurate 7-day delivery counts from tenant-scoped logs", async () => {
    const pageElement = await NotificationDeliveryHealthPage();
    render(pageElement);

    // Push metrics: 2 DELIVERED, 1 FAILED
    const pushDelivered = screen.getByTestId("push-delivered-count");
    expect(pushDelivered.textContent?.trim()).toBe("2");

    const pushFailed = screen.getByTestId("push-failed-count");
    expect(pushFailed.textContent?.trim()).toBe("1");

    // SMS metrics: 2 SENT, 1 FAILED, 2 sent today -> remaining cap = 500 - 2 = 498
    const smsSent = screen.getByTestId("sms-sent-count");
    expect(smsSent.textContent?.trim()).toBe("2");

    const smsFailed = screen.getByTestId("sms-failed-count");
    expect(smsFailed.textContent?.trim()).toBe("1");

    const smsRemainingCap = screen.getByTestId("sms-remaining-cap");
    expect(smsRemainingCap.textContent?.trim()).toBe("498 / 500");
  });

  it("enforces RBAC: redirects non-admin role to unauthorized", async () => {
    authUserRef.role = "STUDENT";

    await expect(NotificationDeliveryHealthPage()).rejects.toThrow("NEXT_REDIRECT:/unauthorized");
  });

  it("enforces tenant boundary: redirects when schoolId is missing", async () => {
    authUserRef.schoolId = "";

    await expect(NotificationDeliveryHealthPage()).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});
