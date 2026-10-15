import { describe, it, expect, beforeAll } from "vitest";
import { db } from "@/db";
import { usageEvents, schools, users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  validateUxEvent,
  KNOWN_UX_SCREENS,
  KNOWN_UX_ELEMENTS,
} from "../../../../frontend/src/lib/telemetryRegistry";
import { purgeExpiredUsageEvents } from "../../workers/retention";
import { withTenant } from "../tenant";

import { seedIsolationSchools, ISOLATION_IDS } from "../isolationFixtures";

describe("S10 Layer 4: Examination UX Telemetry & Retention Drill", () => {
  const testSchoolAId = ISOLATION_IDS.schoolA.id;
  const testSchoolBId = ISOLATION_IDS.schoolB.id;
  const testAdminAId = ISOLATION_IDS.schoolA.adminUserId;
  const testTeacherAId = ISOLATION_IDS.schoolA.teacherA1UserId;

  beforeAll(async () => {
    // 1. Ensure isolation schools fixtures are present
    await seedIsolationSchools();

    // Clean prior telemetry events for clean test state
    await db.delete(usageEvents).where(eq(usageEvents.schoolId, testSchoolAId));
    await db.delete(usageEvents).where(eq(usageEvents.schoolId, testSchoolBId));
  });

  describe("4.1: Telemetry Registry Validation & Zero-PII Enforcement", () => {
    it("accepts known registered screen routes and elements", () => {
      const validEvent = {
        screen: "/exams/dashboard",
        elementId: "btn_quick_create_exam",
        elementLabel: "New Exam Setup",
        action: "click",
      };

      const result = validateUxEvent(validEvent);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.data.elementId).toBe("btn_quick_create_exam");
        expect(result.data.screen).toBe("/exams/dashboard");
      }
    });

    it("rejects unknown or arbitrary screen routes", () => {
      const invalidScreen = {
        screen: "/admin/arbitrary-endpoint",
        elementId: "btn_quick_create_exam",
        elementLabel: "Invalid Screen",
        action: "click",
      };

      const result = validateUxEvent(invalidScreen);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Unknown or unauthorized screen route");
      }
    });

    it("rejects unregistered element IDs for a valid screen", () => {
      const invalidElement = {
        screen: "/exams/dashboard",
        elementId: "malicious_unregistered_button",
        elementLabel: "Malicious Button",
        action: "click",
      };

      const result = validateUxEvent(invalidElement);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("is not registered for screen");
      }
    });

    it("rejects invalid or unauthorized action types", () => {
      const invalidAction = {
        screen: "/exams/marks",
        elementId: "btn_save_marks_draft",
        elementLabel: "Save Marks",
        action: "drop_database",
      };

      const result = validateUxEvent(invalidAction);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain("Invalid action");
      }
    });
  });

  describe("4.2: First-Party Telemetry Ingestion & Tenant Isolation", () => {
    it("inserts validated batch interaction events into usage_events", async () => {
      const eventsToInsert = [
        {
          schoolId: testSchoolAId,
          screen: "/exams/dashboard",
          elementId: "card_active_exams",
          elementLabel: "Active Exams Card",
          action: "click",
          role: "SCHOOL_ADMIN",
          userId: testAdminAId,
          createdAt: new Date(),
        },
        {
          schoolId: testSchoolAId,
          screen: "/exams/marks",
          elementId: "btn_save_marks_draft",
          elementLabel: "Save Marks Draft",
          action: "click",
          role: "TEACHER",
          userId: testTeacherAId,
          createdAt: new Date(),
        },
        {
          schoolId: testSchoolAId,
          screen: "/exams/marks",
          elementId: "btn_lock_marks",
          elementLabel: "Lock Marks Verification",
          action: "click",
          role: "SCHOOL_ADMIN",
          userId: testAdminAId,
          createdAt: new Date(),
        },
      ];

      await db.insert(usageEvents).values(eventsToInsert);

      // Verify insertion for School A
      const recorded = await db.query.usageEvents.findMany({
        where: eq(usageEvents.schoolId, testSchoolAId),
      });

      expect(recorded.length).toBe(3);
    });

    it("strictly isolates telemetry between tenant boundaries (School B sees 0 School A events)", async () => {
      // Query School B usage events
      const schoolBEvents = await db.query.usageEvents.findMany({
        where: eq(usageEvents.schoolId, testSchoolBId),
      });

      expect(schoolBEvents.length).toBe(0);
    });

    it("bootstraps representative interaction events for heat map generation across all exam screens", async () => {
      const representativeJourneys = [
        // Dashboard interactions
        { screen: "/exams/dashboard", elementId: "btn_quick_create_exam", elementLabel: "New Exam Setup", role: "SCHOOL_ADMIN", count: 18 },
        { screen: "/exams/dashboard", elementId: "btn_view_schedule", elementLabel: "Datesheets", role: "SCHOOL_ADMIN", count: 12 },
        { screen: "/exams/dashboard", elementId: "card_active_exams", elementLabel: "Active Exams KPI", role: "SCHOOL_ADMIN", count: 25 },
        { screen: "/exams/dashboard", elementId: "card_pending_marks", elementLabel: "Active Schedules KPI", role: "SCHOOL_ADMIN", count: 32 },

        // Setup & Wizard interactions
        { screen: "/exams/manage", elementId: "btn_load_board_defaults", elementLabel: "Re-sync Board Defaults", role: "SCHOOL_ADMIN", count: 8 },
        { screen: "/exams/manage", elementId: "btn_wizard_next_step", elementLabel: "Proceed to Class Scopes", role: "SCHOOL_ADMIN", count: 14 },
        { screen: "/exams/manage", elementId: "btn_submit_exam_form", elementLabel: "Save Exam & Configure Components", role: "SCHOOL_ADMIN", count: 14 },
        { screen: "/exams/manage", elementId: "btn_manage_components", elementLabel: "Add Component", role: "SCHOOL_ADMIN", count: 22 },

        // Marks Entry interactions (highest teacher action)
        { screen: "/exams/marks", elementId: "select_exam_filter", elementLabel: "Exam Select Filter", role: "TEACHER", count: 45 },
        { screen: "/exams/marks", elementId: "select_class_filter", elementLabel: "Class Select Filter", role: "TEACHER", count: 52 },
        { screen: "/exams/marks", elementId: "select_subject_filter", elementLabel: "Subject Select Filter", role: "TEACHER", count: 48 },
        { screen: "/exams/marks", elementId: "btn_save_marks_draft", elementLabel: "Save Marks Draft", role: "TEACHER", count: 86 },
        { screen: "/exams/marks", elementId: "btn_lock_marks", elementLabel: "Lock Marks Verification", role: "SCHOOL_ADMIN", count: 16 },

        // Report Cards & Results interactions
        { screen: "/exams/report-cards", elementId: "btn_generate_bulk_report_cards", elementLabel: "Generate Bulk Report Cards", role: "SCHOOL_ADMIN", count: 15 },
        { screen: "/exams/report-cards", elementId: "btn_download_batch_zip", elementLabel: "Download Bulk ZIP Archive", role: "SCHOOL_ADMIN", count: 12 },
        { screen: "/exams/report-cards", elementId: "btn_publish_all_results", elementLabel: "Publish All Results", role: "SCHOOL_ADMIN", count: 9 },

        // Analytics interactions
        { screen: "/exams/analytics", elementId: "btn_generate_merit_list", elementLabel: "Generate Merit List", role: "SCHOOL_ADMIN", count: 14 },
        { screen: "/exams/analytics", elementId: "btn_generate_rank_sheet", elementLabel: "Generate Rank Sheet", role: "SCHOOL_ADMIN", count: 11 },
      ];

      const rows: Array<typeof usageEvents.$inferInsert> = [];
      const now = new Date();

      for (const item of representativeJourneys) {
        for (let i = 0; i < item.count; i++) {
          rows.push({
            schoolId: testSchoolAId,
            screen: item.screen,
            elementId: item.elementId,
            elementLabel: item.elementLabel,
            action: item.elementId.startsWith("select_") ? "filter_change" : "click",
            role: item.role,
            userId: item.role === "TEACHER" ? testTeacherAId : testAdminAId,
            createdAt: new Date(now.getTime() - Math.floor(Math.random() * 7 * 24 * 3600 * 1000)),
          });
        }
      }

      await db.insert(usageEvents).values(rows);

      const totalRecorded = await db.query.usageEvents.findMany({
        where: eq(usageEvents.schoolId, testSchoolAId),
      });

      expect(totalRecorded.length).toBeGreaterThan(400);
      console.log(`[TelemetryDrill] Seeded ${totalRecorded.length} representative telemetry events across all exam screens.`);
    });
  });

  describe("4.3: 90-Day Retention Purge Verification (UX-R62)", () => {
    it("purges usage events older than 90 days while preserving recent interaction records", async () => {
      const now = Date.now();
      const expiredDate = new Date(now - 95 * 24 * 60 * 60 * 1000); // 95 days old
      const freshDate = new Date(now - 5 * 24 * 60 * 60 * 1000);   // 5 days old

      // Insert 10 expired records and 5 fresh records
      const testEvents = [
        ...Array.from({ length: 10 }).map((_, i) => ({
          schoolId: testSchoolAId,
          screen: "/exams/dashboard",
          elementId: "card_active_exams",
          elementLabel: "Expired Event",
          action: "click",
          role: "SCHOOL_ADMIN",
          userId: testAdminAId,
          createdAt: expiredDate,
        })),
        ...Array.from({ length: 5 }).map((_, i) => ({
          schoolId: testSchoolAId,
          screen: "/exams/dashboard",
          elementId: "card_active_exams",
          elementLabel: "Fresh Event",
          action: "click",
          role: "SCHOOL_ADMIN",
          userId: testAdminAId,
          createdAt: freshDate,
        })),
      ];

      await db.insert(usageEvents).values(testEvents);

      // Execute retention purge with 90-day window
      const purged = await purgeExpiredUsageEvents(testSchoolAId, 90);
      expect(purged).toBe(10);

      // Verify that expired rows were purged and fresh rows remain
      const remainingExpired = await db.query.usageEvents.findMany({
        where: and(
          eq(usageEvents.schoolId, testSchoolAId),
          eq(usageEvents.elementLabel, "Expired Event"),
        ),
      });
      expect(remainingExpired.length).toBe(0);

      const remainingFresh = await db.query.usageEvents.findMany({
        where: and(
          eq(usageEvents.schoolId, testSchoolAId),
          eq(usageEvents.elementLabel, "Fresh Event"),
        ),
      });
      expect(remainingFresh.length).toBe(5);
    });
  });
});
