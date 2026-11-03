// @vitest-environment jsdom
import React from "react";
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import NotificationDeliveryHealthPage from "../app/(admin)/admin/notifications/delivery/page";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async () => ({
    userId: "admin-1",
    email: "admin@school.org",
    role: "SCHOOL_ADMIN",
    schoolId: "school-101",
  })),
}));

vi.mock("@/lib/routeGuards", () => ({
  assertRouteAccess: vi.fn(() => ({ allowed: true })),
}));

vi.mock("@/lib/tenant", () => ({
  withTenant: vi.fn(async (schoolId: string, cb: any) => {
    const tx = {
      query: {
        schools: {
          findFirst: vi.fn(async () => ({ name: "Delhi Academy of Sciences", udiseCode: "DAS-01" })),
        },
        pushNotificationLogs: {
          findMany: vi.fn(async () => [
            { id: "p-1", schoolId: "school-101", title: "Results Released", body: "Term 1 Results", status: "DELIVERED", createdAt: new Date() },
          ]),
        },
        smsLogs: {
          findMany: vi.fn(async () => []),
        },
      },
    };
    return await cb(tx);
  }),
}));

vi.mock("@schoolmitra/backend/lib/webPushDispatcher", () => ({
  isWebPushConfigured: vi.fn(() => true),
}));

vi.mock("@schoolmitra/backend/lib/sms", () => ({
  isSmsConfigured: vi.fn(() => true),
}));

vi.mock("@schoolmitra/backend/lib/email", () => ({
  isEmailConfigured: vi.fn(() => true),
}));

describe("S25 Layer L6: Mobile Law & Universal Touch-Target Ergonomics (390px, min-h-[38px])", () => {
  it("enforces mobile viewport constraints: overflow-x-hidden container and zero horizontal table scroll", async () => {
    const pageElement = await NotificationDeliveryHealthPage();
    const { container } = render(pageElement);

    // Root container must have overflow-x-hidden
    const root = container.querySelector(".overflow-x-hidden");
    expect(root).toBeInTheDocument();

    // Universal Scroll-and-Click Law: No <table> elements allowed; card-per-record design
    const tables = container.querySelectorAll("table");
    expect(tables.length).toBe(0);
  });

  it("enforces touch target ergonomics: interactive navigation anchors have min-h-[38px] and min-w-[38px]", async () => {
    const pageElement = await NotificationDeliveryHealthPage();
    const { container } = render(pageElement);

    const backButton = container.querySelector('a[aria-label="Back to dashboard"]');
    expect(backButton).toBeInTheDocument();
    expect(backButton?.className).toContain("min-h-[38px]");
    expect(backButton?.className).toContain("min-w-[38px]");
  });
});
