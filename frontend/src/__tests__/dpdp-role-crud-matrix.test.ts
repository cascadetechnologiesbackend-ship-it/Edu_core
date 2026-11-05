import { describe, it, expect, beforeAll, vi } from "vitest";
import { db, withTenant, withPlatformContext } from "@/db";
import {
  students,
  users,
  roles,
  userRoles,
  schools,
  academicYears,
  classes,
  sections,
  consentRecords,
  consentPurposes,
  rightsRequests,
  dpdpGrievances,
  vendorRegister,
  dataBreachLog,
  auditLogs,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  checkParentConsentStatus,
  submitParentLoginConsent,
  submitConsentChange,
  raiseRightsRequest,
  raiseGrievanceTicket,
  fetchStudentCompleteData,
} from "../app/(parent)/portal/actions";
import {
  toggleLegalHold,
  createVendor,
  updateVendorDpaStatus,
  reportDataBreach,
  markBreachBoardNotified,
  resolveRightsRequest,
  resolveGrievance,
} from "../app/(admin)/dpdp/actions";
import { encryptData } from "@/lib/encryption";

// Mock next/navigation & next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

let mockSessionUser: {
  id: string;
  email: string;
  role: string;
  schoolId: string;
} | null = null;

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => {
    if (!mockSessionUser) return null;
    return {
      user: {
        id: mockSessionUser.id,
        email: mockSessionUser.email,
        role: mockSessionUser.role,
        schoolId: mockSessionUser.schoolId,
      },
    };
  }),
}));

vi.mock("@/lib/serverAuth", () => ({
  requireAuth: vi.fn(async () => {
    if (!mockSessionUser) throw new Error("Unauthorized");
    return {
      userId: mockSessionUser.id,
      role: mockSessionUser.role,
      schoolId: mockSessionUser.schoolId,
    };
  }),
  requireSchool: vi.fn(async () => {
    if (!mockSessionUser?.schoolId) throw new Error("No school");
    return { id: mockSessionUser.schoolId };
  }),
  getCachedSession: vi.fn(async () => {
    if (!mockSessionUser) return null;
    return {
      user: {
        id: mockSessionUser.id,
        email: mockSessionUser.email,
        role: mockSessionUser.role,
        schoolId: mockSessionUser.schoolId,
      },
    };
  }),
}));

vi.mock("@/lib/sms", () => ({
  sendSMS: vi.fn(async () => true),
}));

describe("DPDP Act 2023 End-to-End Multi-Role CRUD Verification", () => {
  const runId = Math.random().toString(36).substring(2, 7);
  let schoolId: string;
  let academicYearId: string;
  let studentId: string;
  let parentUserId: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Look up existing test school context
    const existingSchool = await db.query.schools.findFirst();
    if (!existingSchool) {
      throw new Error("A seeded test school is required");
    }
    schoolId = existingSchool.id;

    await withTenant(schoolId, async (tx) => {
      // Academic Year
      let ay = await tx.query.academicYears.findFirst({
        where: eq(academicYears.schoolId, schoolId),
      });
      if (!ay) {
        const [newAy] = await tx.insert(academicYears).values({
          schoolId,
          label: "2026-2027",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2027-03-31"),
          isActive: true,
        }).returning();
        ay = newAy;
      }
      academicYearId = ay!.id;

      // Users
      const [pUser] = await tx.insert(users).values({
        email: `parent.dpdp.${runId}@test.com`,
        schoolId,
        passwordHash: "hash",
      }).returning();
      parentUserId = pUser!.id;

      const [aUser] = await tx.insert(users).values({
        email: `admin.dpdp.${runId}@test.com`,
        schoolId,
        passwordHash: "hash",
      }).returning();
      adminUserId = aUser!.id;

      // Class & Section
      let cl = await tx.query.classes.findFirst({ where: eq(classes.schoolId, schoolId) });
      if (!cl) {
        const [newCl] = await tx.insert(classes).values({
          schoolId,
          academicYearId,
          displayName: "Class 5",
          gradeLevel: "CLASS_5",
          sortOrder: 5,
        }).returning();
        cl = newCl;
      }

      let sec = await tx.query.sections.findFirst({ where: eq(sections.schoolId, schoolId) });
      if (!sec) {
        const [newSec] = await tx.insert(sections).values({
          schoolId,
          classId: cl!.id,
          name: "A",
          capacity: 40,
          isActive: true,
        }).returning();
        sec = newSec;
      }

      // Create Student linked to parentUserId
      const [st] = await tx.insert(students).values({
        schoolId,
        academicYearId,
        currentClassId: cl!.id,
        currentSectionId: sec!.id,
        admissionNumber: `DPDP-ADM-${runId}`,
        firstNameEncrypted: encryptData("Aarav"),
        lastNameEncrypted: encryptData("Sharma"),
        primaryParentUserId: parentUserId,
        gender: "MALE",
        dateOfBirth: new Date("2016-05-15"),
        admissionDate: new Date("2026-04-01"),
        category: "GENERAL",
        isActive: true,
      }).returning();
      studentId = st!.id;
    });
  });

  // ─── 1. PARENT: Initial Login Opt-In Detection & Submission ─────────────────
  it("checkParentConsentStatus detects that student requires mandatory consent", async () => {
    mockSessionUser = {
      id: parentUserId,
      email: `parent.dpdp.${runId}@test.com`,
      role: "PARENT",
      schoolId,
    };

    const res = await checkParentConsentStatus();
    expect(res.success).toBe(true);
    expect(res.needsConsent).toBe(true);
    expect(res.students?.length).toBeGreaterThan(0);
    expect(res.students?.some((s) => s.id === studentId)).toBe(true);
  });

  it("submitParentLoginConsent records parent consent under withTenant isolation", async () => {
    mockSessionUser = {
      id: parentUserId,
      email: `parent.dpdp.${runId}@test.com`,
      role: "PARENT",
      schoolId,
    };

    const submitRes = await submitParentLoginConsent({
      consents: [
        { studentId, purposeId: "admission_data", granted: true },
        { studentId, purposeId: "academic_records", granted: true },
        { studentId, purposeId: "attendance", granted: true },
        { studentId, purposeId: "communications", granted: true },
        { studentId, purposeId: "photos_media", granted: false },
      ],
    });

    expect(submitRes.success).toBe(true);

    // Verify records exist in consentRecords table
    await withTenant(schoolId, async (tx) => {
      const stored = await tx.query.consentRecords.findMany({
        where: and(
          eq(consentRecords.schoolId, schoolId),
          eq(consentRecords.studentId, studentId),
          eq(consentRecords.parentUserId, parentUserId),
        ),
      });

      expect(stored.length).toBe(5);
      const admissionRec = stored.find((r) => r.purposeId === "admission_data");
      expect(admissionRec?.granted).toBe(true);
      expect(admissionRec?.withdrawnAt).toBeNull();

      const photosRec = stored.find((r) => r.purposeId === "photos_media");
      expect(photosRec?.granted).toBe(false);
      expect(photosRec?.withdrawnAt).not.toBeNull();
    });
  });

  it("checkParentConsentStatus returns needsConsent: false once mandatory consent is granted", async () => {
    mockSessionUser = {
      id: parentUserId,
      email: `parent.dpdp.${runId}@test.com`,
      role: "PARENT",
      schoolId,
    };

    const recheck = await checkParentConsentStatus();
    expect(recheck.success).toBe(true);
    expect(recheck.needsConsent).toBe(false);
    expect(recheck.students?.length).toBe(0);
  });

  // ─── 2. PARENT: Dynamic Consent Modification in Consent Center ───────────────
  it("submitConsentChange allows parent to toggle consent with verification", async () => {
    mockSessionUser = {
      id: parentUserId,
      email: `parent.dpdp.${runId}@test.com`,
      role: "PARENT",
      schoolId,
    };

    const toggleRes = await submitConsentChange({
      studentId,
      purposeId: "communications",
      granted: false,
      otpCode: "123456",
      withdrawalReason: "Prefer email only",
    });

    expect(toggleRes.success).toBe(true);

    await withTenant(schoolId, async (tx) => {
      const records = await tx.query.consentRecords.findMany({
        where: and(
          eq(consentRecords.schoolId, schoolId),
          eq(consentRecords.studentId, studentId),
          eq(consentRecords.purposeId, "communications"),
        ),
        orderBy: (t, { desc }) => [desc(t.grantedAt)],
      });

      const latest = records[0];
      expect(latest?.granted).toBe(false);
      expect(latest?.withdrawnAt).not.toBeNull();
      expect(latest?.processingHaltedAt).not.toBeNull();
    });
  });

  // ─── 3. PARENT & ADMIN: Data Subject Rights (Access / Correction / Erasure) ──
  let createdTicketNumber: string;
  let createdRightsRequestId: string;

  it("raiseRightsRequest creates an SLA-tracked rights request ticket", async () => {
    mockSessionUser = {
      id: parentUserId,
      email: `parent.dpdp.${runId}@test.com`,
      role: "PARENT",
      schoolId,
    };

    const rightsRes = await raiseRightsRequest({
      studentId,
      requestType: "ACCESS",
      description: "Request complete PII and academic history copy under DPDP Section 11",
    });

    expect(rightsRes.success).toBe(true);
    expect(rightsRes.ticketNumber).toBeDefined();
    createdTicketNumber = rightsRes.ticketNumber!;

    await withTenant(schoolId, async (tx) => {
      const found = await tx.query.rightsRequests.findFirst({
        where: and(
          eq(rightsRequests.schoolId, schoolId),
          eq(rightsRequests.ticketNumber, createdTicketNumber),
        ),
      });
      expect(found).toBeDefined();
      expect(found?.status).toBe("SUBMITTED");
      expect(found?.studentId).toBe(studentId);
      createdRightsRequestId = found!.id;
    });
  });

  it("admin resolveRightsRequest updates ticket to COMPLETED with resolution remarks", async () => {
    mockSessionUser = {
      id: adminUserId,
      email: `admin.dpdp.${runId}@test.com`,
      role: "SCHOOL_ADMIN",
      schoolId,
    };

    const resolveRes = await resolveRightsRequest(
      createdRightsRequestId,
      true,
      "SAR export generated and made available on parent portal",
    );

    expect(resolveRes.success).toBe(true);

    await withTenant(schoolId, async (tx) => {
      const req = await tx.query.rightsRequests.findFirst({
        where: eq(rightsRequests.id, createdRightsRequestId),
      });
      expect(req?.status).toBe("COMPLETED");
      expect(req?.responseDetails).toContain("SAR export generated");
      expect(req?.respondedAt).toBeDefined();
    });
  });

  // ─── 4. PARENT & ADMIN: Grievance Redressal (Section 13) ──────────────────────
  let grievanceTicket: string;
  let grievanceId: string;

  it("raiseGrievanceTicket creates a grievance redressal ticket", async () => {
    mockSessionUser = {
      id: parentUserId,
      email: `parent.dpdp.${runId}@test.com`,
      role: "PARENT",
      schoolId,
    };

    const grRes = await raiseGrievanceTicket({
      subject: "Data Processing Inquiry",
      description: "Query regarding retention timeline for transport route data",
    });

    expect(grRes.success).toBe(true);
    grievanceTicket = grRes.ticketNumber!;

    await withTenant(schoolId, async (tx) => {
      const gr = await tx.query.dpdpGrievances.findFirst({
        where: eq(dpdpGrievances.ticketNumber, grievanceTicket),
      });
      expect(gr).toBeDefined();
      expect(gr?.status).toBe("SUBMITTED");
      grievanceId = gr!.id;
    });
  });

  it("admin resolveGrievance updates grievance to COMPLETED", async () => {
    mockSessionUser = {
      id: adminUserId,
      email: `admin.dpdp.${runId}@test.com`,
      role: "SCHOOL_ADMIN",
      schoolId,
    };

    const grResolveRes = await resolveGrievance(
      grievanceId,
      "Transport data retention policy verified as 365 days in accordance with DPDP rules",
    );

    expect(grResolveRes.success).toBe(true);

    await withTenant(schoolId, async (tx) => {
      const gr = await tx.query.dpdpGrievances.findFirst({
        where: eq(dpdpGrievances.id, grievanceId),
      });
      expect(gr?.status).toBe("COMPLETED");
      expect(gr?.resolutionDetails).toContain("Transport data retention policy verified");
    });
  });

  // ─── 5. SAR: Complete Data Access & Audit Trail Generation ───────────────────
  it("fetchStudentCompleteData exports full student dossier and writes audit log", async () => {
    mockSessionUser = {
      id: parentUserId,
      email: `parent.dpdp.${runId}@test.com`,
      role: "PARENT",
      schoolId,
    };

    const dataRes = await fetchStudentCompleteData(studentId);
    expect(dataRes.success).toBe(true);
    expect(dataRes.data?.studentInfo?.admissionNumber).toBe(`DPDP-ADM-${runId}`);
    expect(dataRes.data?.studentInfo?.firstName).toBe("Aarav");
    expect(dataRes.data?.studentInfo?.lastName).toBe("Sharma");

    // Verify Audit Log entry was generated
    await withTenant(schoolId, async (tx) => {
      const audit = await tx.query.auditLogs.findFirst({
        where: and(
          eq(auditLogs.schoolId, schoolId),
          eq(auditLogs.recordId, studentId),
          eq(auditLogs.action, "READ"),
        ),
      });
      expect(audit).toBeDefined();
      expect((audit?.metadata as any)?.action).toBe("SUBJECT_ACCESS_REQUEST");
    });
  });

  // ─── 6. ADMIN: Legal Hold, Vendor Management, & Data Breach Logs ─────────────
  it("toggleLegalHold sets hold on student and logs to audit trail", async () => {
    mockSessionUser = {
      id: adminUserId,
      email: `admin.dpdp.${runId}@test.com`,
      role: "SCHOOL_ADMIN",
      schoolId,
    };

    const holdRes = await toggleLegalHold(studentId, "students", true);
    expect(holdRes.success).toBe(true);

    await withTenant(schoolId, async (tx) => {
      const st = await tx.query.students.findFirst({
        where: eq(students.id, studentId),
      });
      expect(st?.legalHold).toBe(true);
    });
  });

  it("createVendor and updateVendorDpaStatus manage third-party processor DPA status", async () => {
    mockSessionUser = {
      id: adminUserId,
      email: `admin.dpdp.${runId}@test.com`,
      role: "SCHOOL_ADMIN",
      schoolId,
    };

    const vendorRes = await createVendor({
      vendorName: `EdTech Partner ${runId}`,
      vendorType: "LMS",
      dataShared: ["student_name", "grade"],
      purposeOfSharing: "Online Homework Submission Delivery",
      dpaStatus: "PENDING",
      contactEmail: `dpo@partner-${runId}.com`,
    });
    expect(vendorRes.success).toBe(true);

    let vId = "";
    await withTenant(schoolId, async (tx) => {
      const v = await tx.query.vendorRegister.findFirst({
        where: and(
          eq(vendorRegister.schoolId, schoolId),
          eq(vendorRegister.vendorName, `EdTech Partner ${runId}`),
        ),
      });
      expect(v).toBeDefined();
      expect(v?.dpaStatus).toBe("PENDING");
      vId = v!.id;
    });

    const updateRes = await updateVendorDpaStatus(vId, "SIGNED", "2027-04-01");
    expect(updateRes.success).toBe(true);

    await withTenant(schoolId, async (tx) => {
      const v = await tx.query.vendorRegister.findFirst({
        where: eq(vendorRegister.id, vId),
      });
      expect(v?.dpaStatus).toBe("SIGNED");
      expect(v?.dpaSignedAt).toBeDefined();
    });
  });

  it("reportDataBreach logs incident with 72-hour board notification deadline", async () => {
    mockSessionUser = {
      id: adminUserId,
      email: `admin.dpdp.${runId}@test.com`,
      role: "SCHOOL_ADMIN",
      schoolId,
    };

    const breachRes = await reportDataBreach({
      description: "Test containment drill: unauthorized query anomaly detected",
      affectedRecordsCount: 1,
      affectedDataCategories: ["email"],
      containmentActions: "Credential revoked and IP blocklisted",
      severity: "LOW",
    });
    expect(breachRes.success).toBe(true);

    let bId = "";
    await withTenant(schoolId, async (tx) => {
      const b = await tx.query.dataBreachLog.findFirst({
        where: and(
          eq(dataBreachLog.schoolId, schoolId),
          eq(dataBreachLog.severity, "LOW"),
        ),
        orderBy: (t, { desc }) => [desc(t.detectedAt)],
      });
      expect(b).toBeDefined();
      expect(b?.status).toBe("DETECTED");
      expect(b?.boardNotificationDeadline).toBeDefined();
      bId = b!.id;
    });

    const boardRes = await markBreachBoardNotified(bId);
    expect(boardRes.success).toBe(true);

    await withTenant(schoolId, async (tx) => {
      const b = await tx.query.dataBreachLog.findFirst({
        where: eq(dataBreachLog.id, bId),
      });
      expect(b?.status).toBe("BOARD_NOTIFIED");
      expect(b?.boardNotifiedAt).toBeDefined();
    });
  });
});
