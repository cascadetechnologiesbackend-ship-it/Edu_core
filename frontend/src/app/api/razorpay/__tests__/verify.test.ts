import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { POST } from "../verify/route";
import { db } from "@/db";

const mockSet = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue([]);
const mockReturning = vi.fn().mockResolvedValue([{ id: "mock-payment-uuid", receiptNumber: "RCPT-TEST-001" }]);
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

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

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

describe("POST /api/razorpay/verify", () => {
  const secret = "u43q6hmds0h51Ri7qkkI8Bru";
  const originalEnv = { ...process.env };
  const mockSchoolId = "sch_12345678_school";

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.RAZORPAY_KEY_SECRET = secret;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 401 when user is not authenticated", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when missing required signature parameters", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({
      user: { id: "usr_parent_01", role: "PARENT", schoolId: mockSchoolId },
    });

    const req = new Request("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({ razorpay_order_id: "order_123" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Missing required");
  });

  it("returns 503 when RAZORPAY_KEY_SECRET is unset or default 'change-me'", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({
      user: { id: "usr_parent_01", role: "PARENT", schoolId: mockSchoolId },
    });
    process.env.RAZORPAY_KEY_SECRET = "change-me";

    const req = new Request("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: "order_123",
        razorpay_payment_id: "pay_123",
        razorpay_signature: "sig_123",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toContain("unavailable");
  });

  it("returns 400 when HMAC signature verification fails", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({
      user: { id: "usr_parent_01", role: "PARENT", schoolId: mockSchoolId },
    });

    const req = new Request("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: "order_123",
        razorpay_payment_id: "pay_123",
        razorpay_signature: "invalid_hmac_signature",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("signature verification failed");
  });

  it("returns 404 when gateway order log is not found", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({
      user: { id: "usr_parent_01", role: "PARENT", schoolId: mockSchoolId },
    });

    const orderId = "order_valid_123";
    const paymentId = "pay_valid_456";
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    (db.query.paymentGatewayLogs.findFirst as any).mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("successfully verifies valid payment signature and creates receipt", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({
      user: { id: "usr_parent_01", role: "PARENT", schoolId: mockSchoolId },
    });

    const orderId = "order_valid_123";
    const paymentId = "pay_valid_456";
    const validSignature = crypto
      .createHmac("sha256", secret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    (db.query.paymentGatewayLogs.findFirst as any).mockResolvedValue({
      id: "log_1",
      schoolId: mockSchoolId,
      feeInvoiceId: "inv_1",
      gatewayOrderId: orderId,
      amount: "5000.00",
      status: "CREATED",
    });

    (db.query.feeInvoices.findFirst as any).mockResolvedValue({
      id: "inv_1",
      schoolId: mockSchoolId,
      studentId: "stu_1",
      paidAmount: "0.00",
      netAmount: "5000.00",
      balanceAmount: "5000.00",
      status: "PENDING",
    });

    const req = new Request("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.paymentId).toBe("mock-payment-uuid");
    expect(data.receiptNumber).toBeDefined();
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockTx.insert).toHaveBeenCalled();
  });
});
