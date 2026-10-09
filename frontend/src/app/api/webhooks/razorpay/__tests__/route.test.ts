import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { POST } from "../route";
import { db } from "@/db";
import { archiveReceiptPdfToS3 } from "@/workers/financeAutomation";

const mockSet = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue([]);
const mockReturning = vi.fn().mockResolvedValue([{ id: "mock-payment-uuid" }]);
const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });

const mockTx = {
  update: vi.fn().mockReturnValue({ set: mockSet, where: mockWhere }),
  insert: vi.fn().mockReturnValue({ values: mockValues }),
  query: {
    bankAccounts: {
      findFirst: vi.fn().mockResolvedValue({ id: "bank_01", currentBalance: "1000.00" }),
    },
  },
};

vi.mock("@/lib/chartOfAccountsEngine", () => ({
  getBankAccountChartAccountId: vi.fn().mockResolvedValue("coa-bank-acc-id"),
  getCashMainChartAccountId: vi.fn().mockResolvedValue("coa-cash-acc-id"),
  getStudentReceivableChartAccountId: vi.fn().mockResolvedValue("coa-rec-acc-id"),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      paymentGatewayLogs: {
        findFirst: vi.fn(),
      },
      feePayments: {
        findFirst: vi.fn(),
      },
      feeInvoices: {
        findFirst: vi.fn(),
      },
      bankAccounts: {
        findFirst: vi.fn().mockResolvedValue({ id: "bank_01", currentBalance: "1000.00" }),
      },
    },
    transaction: vi.fn(async (cb: any) => cb(mockTx)),
  },
}));

vi.mock("@/workers/financeAutomation", () => ({
  archiveReceiptPdfToS3: vi.fn().mockResolvedValue({ success: true, s3Key: "test.pdf" }),
}));

describe("Razorpay Webhook Handler", () => {
  const secret = "test-razorpay-webhook-secret-key-1234";
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.RAZORPAY_WEBHOOK_SECRET = secret;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function createSignedRequest(body: object, secretKey: string, tamperedSig = false): Request {
    const rawBody = JSON.stringify(body);
    let signature = crypto
      .createHmac("sha256", secretKey)
      .update(rawBody)
      .digest("hex");

    if (tamperedSig) {
      signature = signature.replace(/^[0-9a-f]/, "z");
    }

    return new Request("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
      body: rawBody,
    });
  }

  it("returns 400 when x-razorpay-signature header is missing", async () => {
    const req = new Request("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      body: JSON.stringify({ event: "payment.captured" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Missing signature");
  });

  it("returns 503 when RAZORPAY_WEBHOOK_SECRET is unset or default 'change-me'", async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "change-me";
    const req = createSignedRequest({ event: "payment.captured" }, "change-me");

    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain("unavailable");
  });

  it("returns 400 when signature verification fails (tampered payload or sig)", async () => {
    const req = createSignedRequest(
      { event: "payment.captured", id: "pay_123" },
      secret,
      true // tampered
    );

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Invalid signature");
  });

  it("AZ-04: processes payment.captured, extracts feeAmount & tax, sanitizes payload, and initiates S3 archival", async () => {
    const mockLog = {
      id: "log-uuid-001",
      schoolId: "school-uuid-001",
      feeInvoiceId: "inv-uuid-001",
      status: "CREATED",
      gatewayOrderId: "order_test_999",
      gatewayPaymentId: null,
      amount: "1000.00",
      feeAmount: "0.00",
    };

    const mockInvoice = {
      id: "inv-uuid-001",
      schoolId: "school-uuid-001",
      studentId: "stu-uuid-001",
      invoiceNumber: "INV-2026-001",
      paidAmount: "0.00",
      netAmount: "1000.00",
      balanceAmount: "1000.00",
      status: "PENDING",
    };

    vi.mocked(db.query.paymentGatewayLogs.findFirst).mockResolvedValueOnce(mockLog as any);
    vi.mocked(db.query.feePayments.findFirst).mockResolvedValueOnce(undefined);
    vi.mocked(db.query.feeInvoices.findFirst).mockResolvedValueOnce(mockInvoice as any);

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_rzr_12345",
            order_id: "order_test_999",
            amount: 100000, // 1000.00 INR in paise
            fee: 2360,     // 23.60 INR fee in paise (inclusive of tax)
            tax: 360,      // 3.60 INR GST component
            currency: "INR",
            method: "upi",
          },
        },
      },
    };

    const req = createSignedRequest(payload, secret);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.receiptAvailable).toBe(true);
    expect(body.downloadUrl).toBe("/api/receipt/mock-payment-uuid");
    expect(body.paymentId).toBe("mock-payment-uuid");

    // Verify feeAmount is wired correctly to 23.60
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PAID",
        gatewayPaymentId: "pay_rzr_12345",
        feeAmount: "23.60",
        webhookPayload: expect.stringContaining('"fee":2360'),
      })
    );

    // Verify S3 archival was triggered
    expect(archiveReceiptPdfToS3).toHaveBeenCalledWith(
      "school-uuid-001",
      "mock-payment-uuid"
    );
  });

  it("AZ-04: idempotency guard skips processing if log is already PAID or fulfilled", async () => {
    const fulfilledLog = {
      id: "log-uuid-002",
      feeInvoiceId: "inv-uuid-002",
      status: "PAID",
      gatewayOrderId: "order_test_888",
      gatewayPaymentId: "pay_rzr_88888",
      amount: "500.00",
    };

    vi.mocked(db.query.paymentGatewayLogs.findFirst).mockResolvedValueOnce(fulfilledLog as any);

    const payload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: "pay_rzr_88888",
            order_id: "order_test_888",
            amount: 50000,
          },
        },
      },
    };

    const req = createSignedRequest(payload, secret);
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Order already fulfilled");
  });
});
