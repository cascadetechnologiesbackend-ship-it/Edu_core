import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  projectToParentStudentFeeLedger,
  assertNoProhibitedParentLedgerKeys,
  fetchParentStudentFeeLedger,
} from "../parentStudentFeeLedger";
import {
  generateFeePaymentDeepLink,
  sendFeeReminderSMS,
  sendDLTTransactionalSMS,
} from "../sms";
import {
  ParentStudentFeeLedgerSchema,
  PROHIBITED_PARENT_LEDGER_KEYS,
} from "@schoolmitra/validators";
import { encryptData } from "../encryption";

describe("Phase B1 AZ-07: Parent Finance Readiness & Receipt Deep-Links", () => {
  describe("1. ParentStudentFeeLedger Field Projection & Data Isolation", () => {
    const validSampleRecord = {
      studentId: "stu_1001",
      studentName: "Aarav Sharma",
      admissionNumber: "ADM-2026-001",
      className: "Class 10",
      sectionName: "A",
      totalOutstanding: 15000,
      creditBalance: 2000,
      invoices: [
        {
          invoiceId: "inv_01",
          invoiceNumber: "INV-2026-001",
          term: "Term 1",
          feeHeadName: "Tuition Fee",
          dueDate: "2026-05-15T00:00:00.000Z",
          grossAmount: 15000,
          discountAmount: 0,
          lateFeeAmount: 0,
          paidAmount: 0,
          balanceAmount: 15000,
          status: "PENDING",
          isAvailableForPayment: true,
        },
      ],
      payments: [
        {
          paymentId: "pay_01",
          receiptNumber: "REC-2026-001",
          amountPaid: 5000,
          paymentDate: "2026-04-10T10:00:00.000Z",
          paymentMethod: "ONLINE",
          receiptUrl: "/api/receipt/pay_01",
          receiptAvailable: true,
        },
      ],
    };

    it("successfully parses and validates against ParentStudentFeeLedgerSchema", () => {
      const parsed = ParentStudentFeeLedgerSchema.parse(validSampleRecord);
      expect(parsed.studentId).toBe("stu_1001");
      expect(parsed.studentName).toBe("Aarav Sharma");
      expect(parsed.invoices.length).toBe(1);
      expect(parsed.payments.length).toBe(1);
      expect(parsed.invoices[0]!.isAvailableForPayment).toBe(true);
      expect(parsed.payments[0]!.receiptAvailable).toBe(true);
      expect(parsed.creditBalance).toBe(2000);
    });

    it("projectToParentStudentFeeLedger calculates totalOutstanding and assigns receipt download URLs", () => {
      const rawInput = {
        id: "stu_2002",
        studentName: "Priya Patel",
        admissionNumber: "ADM-2026-002",
        className: "Class 8",
        creditBalance: 500,
        invoices: [
          {
            id: "inv_201",
            invoiceNumber: "INV-2026-201",
            balanceAmount: 8000,
            status: "PENDING",
            grossAmount: 8000,
            dueDate: new Date("2026-06-01"),
          },
          {
            id: "inv_202",
            invoiceNumber: "INV-2026-202",
            balanceAmount: 0,
            status: "PAID",
            grossAmount: 4000,
            paidAmount: 4000,
            dueDate: new Date("2026-04-01"),
          },
        ],
        payments: [
          {
            id: "pay_999",
            receiptNumber: "REC-999",
            amountPaid: 4000,
            paymentDate: new Date("2026-04-01"),
            paymentMethod: "ONLINE",
          },
        ],
      };

      const projected = projectToParentStudentFeeLedger(rawInput);
      expect(projected.studentId).toBe("stu_2002");
      expect(projected.totalOutstanding).toBe(8000);
      expect(projected.invoices[0]!.isAvailableForPayment).toBe(true);
      expect(projected.invoices[1]!.isAvailableForPayment).toBe(false);
      expect(projected.payments[0]!.receiptUrl).toBe("/api/receipt/pay_999");
      expect(projected.payments[0]!.receiptAvailable).toBe(true);
      expect(projected.creditBalance).toBe(500);
    });

    it("assertNoProhibitedParentLedgerKeys throws SecurityViolation on student PII or staff remarks", () => {
      for (const prohibitedKey of PROHIBITED_PARENT_LEDGER_KEYS) {
        const payloadWithLeak = {
          ...validSampleRecord,
          [prohibitedKey]: "sensitive_leaked_value",
        };
        expect(() => assertNoProhibitedParentLedgerKeys(payloadWithLeak)).toThrow(
          /SecurityViolation/
        );
      }
    });

    it("assertNoProhibitedParentLedgerKeys detects leaks in nested invoice or payment objects", () => {
      const leakedNestedInvoice = {
        ...validSampleRecord,
        invoices: [
          {
            ...validSampleRecord.invoices[0],
            internalRemarks: "Confidential accountant notes",
          },
        ],
      };
      expect(() => assertNoProhibitedParentLedgerKeys(leakedNestedInvoice)).toThrow(
        /SecurityViolation.*internalRemarks/
      );
    });
  });

  describe("2. SMS Fee Payment Deep-Link & Template Variable Substitution", () => {
    it("generateFeePaymentDeepLink generates normalized, valid portal URLs", () => {
      const link1 = generateFeePaymentDeepLink("school.educore.in", "inv_abc_123");
      expect(link1).toBe("https://school.educore.in/portal?tab=fees&invoiceId=inv_abc_123");

      // Strip https:// prefix and trailing slash if present
      const link2 = generateFeePaymentDeepLink("https://myschool.org/", "inv_456");
      expect(link2).toBe("https://myschool.org/portal?tab=fees&invoiceId=inv_456");

      // With security token
      const link3 = generateFeePaymentDeepLink("myschool.org", "inv_789", "sec_token_999");
      expect(link3).toBe(
        "https://myschool.org/portal?tab=fees&invoiceId=inv_789&token=sec_token_999"
      );
    });

    it("sendDLTTransactionalSMS replaces {payment_link} and {variable} placeholders in DLT templates", async () => {
      const originalEnv = { ...process.env };
      process.env.SMS_PROVIDER = "TWILIO";
      process.env.TWILIO_ACCOUNT_SID = "AC_test_account";
      process.env.TWILIO_AUTH_TOKEN = "test_auth_token";
      process.env.TWILIO_FROM_NUMBER = "+15005550006";

      // Mock fetch
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ sid: "SM_test_deep_link_sid", status: "sent" }),
      } as any);

      const res = await sendDLTTransactionalSMS(
        "9876543210",
        "DLT_FEE_REMINDER_01",
        {
          student_name: "Aarav",
          amount: "5000",
          payment_link: "https://school.educore.in/portal?tab=fees&invoiceId=inv_123",
        },
        "Fee for {student_name} of Rs.{amount} is due. Pay: {payment_link}"
      );

      expect(res.delivered).toBe(true);
      expect(fetchSpy).toHaveBeenCalled();

      // Check request body sent to Twilio
      const callArgs = fetchSpy.mock.calls[0]!;
      const sentBody = callArgs[1]?.body?.toString() || "";
      expect(sentBody).toContain("https%3A%2F%2Fschool.educore.in%2Fportal%3Ftab%3Dfees%26invoiceId%3Dinv_123");

      fetchSpy.mockRestore();
      process.env = originalEnv;
    });

    it("sendFeeReminderSMS builds full reminder payload with deep-link", async () => {
      const originalEnv = { ...process.env };
      process.env.SMS_PROVIDER = "TWILIO";
      process.env.TWILIO_ACCOUNT_SID = "AC_test_account";
      process.env.TWILIO_AUTH_TOKEN = "test_auth_token";
      process.env.TWILIO_FROM_NUMBER = "+15005550006";

      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ sid: "SM_reminder_sid", status: "sent" }),
      } as any);

      const res = await sendFeeReminderSMS({
        mobileNumber: "9876543210",
        studentName: "Rohan",
        amountDue: 12500,
        dueDate: "15 May 2026",
        schoolDomain: "demo.schoolmitra.in",
        invoiceId: "inv_rohan_99",
      });

      expect(res.delivered).toBe(true);
      const callArgs = fetchSpy.mock.calls[0]!;
      const sentBody = callArgs[1]?.body?.toString() || "";
      expect(sentBody).toContain("Rohan");
      expect(sentBody).toContain("12500");
      expect(sentBody).toContain("demo.schoolmitra.in");

      fetchSpy.mockRestore();
      process.env = originalEnv;
    });
  });

  describe("3. Ward & Tenant Isolation in fetchParentStudentFeeLedger", () => {
    it("denies access when requesting parent does not match student primaryParentUserId", async () => {
      const mockDb = {
        query: {
          students: {
            findFirst: vi.fn().mockResolvedValue({
              id: "stu_foreign_01",
              schoolId: "school_1",
              primaryParentUserId: "usr_parent_ALICE",
              firstNameEncrypted: encryptData("Sneha"),
              lastNameEncrypted: encryptData("Sharma"),
              admissionNumber: "ADM-999",
            }),
          },
        },
      };

      await expect(
        fetchParentStudentFeeLedger(
          mockDb,
          "school_1",
          "stu_foreign_01",
          "usr_parent_BOB", // BOB trying to view ALICE's child
          false // not admin
        )
      ).rejects.toThrow(/Forbidden: Student 'stu_foreign_01' is not linked to parent 'usr_parent_BOB'/);
    });

    it("allows access when requesting parent matches primaryParentUserId", async () => {
      const mockDb = {
        query: {
          students: {
            findFirst: vi.fn().mockResolvedValue({
              id: "stu_ward_01",
              schoolId: "school_1",
              primaryParentUserId: "usr_parent_ALICE",
              firstNameEncrypted: encryptData("Sneha"),
              lastNameEncrypted: encryptData("Sharma"),
              admissionNumber: "ADM-100",
              class: { name: "Class 10" },
              section: { name: "A" },
            }),
          },
          feeInvoices: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: "inv_1",
                invoiceNumber: "INV-001",
                grossAmount: "5000",
                balanceAmount: "5000",
                status: "PENDING",
                dueDate: new Date("2026-06-01"),
                feeStructure: { feeHead: { name: "Tuition" } },
              },
            ]),
          },
          feePayments: {
            findMany: vi.fn().mockResolvedValue([
              {
                id: "pay_1",
                receiptNumber: "REC-001",
                amountPaid: "2000",
                paymentDate: new Date("2026-05-01"),
                paymentMethod: "ONLINE",
              },
            ]),
          },
          studentFeeAdvances: {
            findMany: vi.fn().mockResolvedValue([
              {
                balanceAmount: "1500.00",
                status: "UNALLOCATED",
              },
            ]),
          },
        },
      };

      const ledger = await fetchParentStudentFeeLedger(
        mockDb,
        "school_1",
        "stu_ward_01",
        "usr_parent_ALICE",
        false
      );

      expect(ledger).not.toBeNull();
      expect(ledger?.studentName).toBe("Sneha Sharma");
      expect(ledger?.totalOutstanding).toBe(5000);
      expect(ledger?.creditBalance).toBe(1500);
      expect(ledger?.invoices[0]?.isAvailableForPayment).toBe(true);
      expect(ledger?.payments[0]?.receiptUrl).toBe("/api/receipt/pay_1");
      expect(ledger?.payments[0]?.receiptAvailable).toBe(true);
    });

    it("allows access when requester is admin regardless of primaryParentUserId", async () => {
      const mockDb = {
        query: {
          students: {
            findFirst: vi.fn().mockResolvedValue({
              id: "stu_ward_02",
              schoolId: "school_1",
              primaryParentUserId: "usr_parent_ALICE",
              firstNameEncrypted: encryptData("Rahul"),
              lastNameEncrypted: encryptData("Verma"),
              admissionNumber: "ADM-101",
            }),
          },
          feeInvoices: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          feePayments: {
            findMany: vi.fn().mockResolvedValue([]),
          },
          studentFeeAdvances: {
            findMany: vi.fn().mockResolvedValue([]),
          },
        },
      };

      const ledger = await fetchParentStudentFeeLedger(
        mockDb,
        "school_1",
        "stu_ward_02",
        "usr_admin_SUPER",
        true // isAdmin = true
      );

      expect(ledger).not.toBeNull();
      expect(ledger?.studentName).toBe("Rahul Verma");
    });
  });
});
