import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { POST as verifyPost } from "../verify/route";
import { POST as webhookPost } from "../../webhooks/razorpay/route";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/chartOfAccountsEngine", () => ({
  getBankAccountChartAccountId: vi.fn().mockResolvedValue("coa-bank-acc-id"),
  getCashMainChartAccountId: vi.fn().mockResolvedValue("coa-cash-acc-id"),
  getStudentReceivableChartAccountId: vi.fn().mockResolvedValue("coa-rec-acc-id"),
}));

vi.mock("@/workers/financeAutomation", () => ({
  archiveReceiptPdfToS3: vi.fn().mockResolvedValue({ success: true, s3Key: "test.pdf" }),
}));

describe("Money Path Concurrency & Idempotency Tests (S2-B)", () => {
  const secretKey = "u43q6hmds0h51Ri7qkkI8Bru";
  const webhookSecret = "test-webhook-secret-key-concurrency";
  const mockSchoolId = "sch_concurrency_test_001";
  const orderId = "order_concur_999";
  const paymentId = "pay_concur_999";

  let state: {
    log: any;
    invoice: any;
    payments: any[];
    ledger: any[];
    bank: any;
  };

  const createValidVerifySignature = () => {
    return crypto
      .createHmac("sha256", secretKey)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
  };

  const createSignedWebhookRequest = (body: object): Request => {
    const rawBody = JSON.stringify(body);
    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    return new Request("http://localhost:3000/api/webhooks/razorpay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-razorpay-signature": signature,
      },
      body: rawBody,
    });
  };

  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = secretKey;
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

    state = {
      log: {
        id: "log_c1",
        schoolId: mockSchoolId,
        feeInvoiceId: "inv_c1",
        gatewayOrderId: orderId,
        amount: "5000.00",
        feeAmount: "100.00",
        status: "CREATED",
        gatewayPaymentId: null,
      },
      invoice: {
        id: "inv_c1",
        schoolId: mockSchoolId,
        studentId: "stu_c1",
        grossAmount: "5000.00",
        paidAmount: "0.00",
        netAmount: "5000.00",
        balanceAmount: "5000.00",
        status: "PENDING",
      },
      payments: [],
      ledger: [],
      bank: {
        id: "bank_c1",
        schoolId: mockSchoolId,
        currentBalance: "10000.00",
        isActive: true,
      },
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  function createMockTx() {
    return {
      update: vi.fn((table: any) => ({
        set: vi.fn((values: any) => ({
          where: vi.fn((condition: any) => {
            const p = (async () => {
              // Non-returning updates (invoice, bank)
              if (values.paidAmount !== undefined) {
                state.invoice.paidAmount = values.paidAmount;
                state.invoice.balanceAmount = values.balanceAmount;
                state.invoice.status = values.status;
              }
              if (values.currentBalance !== undefined) {
                state.bank.currentBalance = (
                  parseFloat(state.bank.currentBalance) + 5000
                ).toFixed(2);
              }
              return [];
            })() as any;

            p.returning = vi.fn(async () => {
              // CAS on paymentGatewayLogs: only update if status is not already PAID
              if (state.log.status !== "PAID") {
                state.log.status = "PAID";
                state.log.gatewayPaymentId = values.gatewayPaymentId || paymentId;
                return [{ ...state.log }];
              }
              // CAS failed!
              return [];
            });

            return p;
          }),
        })),
      })),
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            for: vi.fn(async () => [{ ...state.invoice }]),
          })),
        })),
      })),
      insert: vi.fn((table: any) => ({
        values: vi.fn((vals: any) => {
          if (vals.receiptNumber) {
            // feePayments insert: simulate 0027 unique index on (schoolId, transactionReference)
            const exists = state.payments.some(
              (p) =>
                p.schoolId === vals.schoolId &&
                p.transactionReference === vals.transactionReference
            );
            if (exists) {
              const err = new Error(
                'duplicate key value violates unique constraint "fee_payments_school_id_txn_ref_unique_idx"'
              ) as any;
              err.code = "23505";
              throw err;
            }
            const record = {
              id: `pmt_${state.payments.length + 1}`,
              ...vals,
            };
            state.payments.push(record);
            return {
              returning: vi.fn().mockResolvedValue([record]),
            };
          }
          if (vals.transactionNumber) {
            // ledger insert
            state.ledger.push(vals);
            return {
              returning: vi.fn().mockResolvedValue([vals]),
            };
          }
          return {
            returning: vi.fn().mockResolvedValue([]),
          };
        }),
      })),
      query: {
        bankAccounts: {
          findFirst: vi.fn(async () => ({ ...state.bank })),
        },
        feePayments: {
          findFirst: vi.fn(async () =>
            state.payments.find((p) => p.transactionReference === paymentId) || null
          ),
        },
      },
    };
  }

  it("handles 10 concurrent requests to /api/razorpay/verify with exactly 1 payment record and 1 ledger entry", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({
      user: { id: "usr_parent_01", role: "PARENT", schoolId: mockSchoolId },
    });

    const { db } = await import("@/db");
    const mockTx = createMockTx();

    (db as any).query = {
      paymentGatewayLogs: {
        findFirst: vi.fn(async () => ({ ...state.log })),
      },
      feeInvoices: {
        findFirst: vi.fn(async () => ({ ...state.invoice })),
      },
      feePayments: {
        findFirst: vi.fn(async () =>
          state.payments.find((p) => p.transactionReference === paymentId) || null
        ),
      },
      bankAccounts: {
        findFirst: vi.fn(async () => ({ ...state.bank })),
      },
    };
    (db as any).transaction = vi.fn(async (cb: any) => cb(mockTx));

    const validSignature = createValidVerifySignature();

    // Spawn 10 concurrent verify requests
    const promises = Array.from({ length: 10 }).map(() => {
      const req = new Request("http://localhost:3000/api/razorpay/verify", {
        method: "POST",
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSignature,
        }),
      });
      return verifyPost(req);
    });

    const responses = await Promise.all(promises);

    // All 10 responses must return HTTP 200
    for (const res of responses) {
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    }

    // Exactly 1 payment created
    expect(state.payments.length).toBe(1);
    expect(state.payments[0].transactionReference).toBe(paymentId);

    // Exactly 1 ledger entry created
    expect(state.ledger.length).toBe(1);

    // Invoice paidAmount updated exactly once to 5000.00
    expect(parseFloat(state.invoice.paidAmount)).toBe(5000.0);
    expect(parseFloat(state.invoice.balanceAmount)).toBe(0.0);
    expect(state.invoice.status).toBe("PAID");
  });

  it("handles race between user /api/razorpay/verify and async /api/webhooks/razorpay safely", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({
      user: { id: "usr_parent_01", role: "PARENT", schoolId: mockSchoolId },
    });

    const { db } = await import("@/db");
    const mockTx = createMockTx();

    (db as any).query = {
      paymentGatewayLogs: {
        findFirst: vi.fn(async () => ({ ...state.log })),
      },
      feeInvoices: {
        findFirst: vi.fn(async () => ({ ...state.invoice })),
      },
      feePayments: {
        findFirst: vi.fn(async () =>
          state.payments.find((p) => p.transactionReference === paymentId) || null
        ),
      },
      bankAccounts: {
        findFirst: vi.fn(async () => ({ ...state.bank })),
      },
    };
    (db as any).transaction = vi.fn(async (cb: any) => cb(mockTx));

    const validSignature = createValidVerifySignature();
    const verifyReq = new Request("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
      }),
    });

    const webhookPayload = {
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount: 500000, // in paise
            fee: 10000,
            tax: 1800,
            method: "upi",
            currency: "INR",
          },
        },
      },
    };
    const webhookReq = createSignedWebhookRequest(webhookPayload);

    // Fire verify and webhook concurrently
    const [verifyRes, webhookRes] = await Promise.all([
      verifyPost(verifyReq),
      webhookPost(webhookReq),
    ]);

    expect(verifyRes.status).toBe(200);
    expect(webhookRes.status).toBe(200);

    const verifyJson = await verifyRes.json();
    const webhookJson = await webhookRes.json();

    expect(verifyJson.success).toBe(true);
    expect(webhookJson.success).toBe(true);

    // One of them is the winner and the other reports fulfilled/already processed
    const alreadyProcessedEncountered =
      verifyJson.alreadyProcessed === true ||
      webhookJson.message === "Order already fulfilled";
    expect(alreadyProcessedEncountered).toBe(true);

    // Exactly 1 payment and 1 ledger entry
    expect(state.payments.length).toBe(1);
    expect(state.ledger.length).toBe(1);
    expect(parseFloat(state.invoice.paidAmount)).toBe(5000.0);
  });

  it("handles Postgres 23505 unique constraint violation on fee_payments idempotently", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({
      user: { id: "usr_parent_01", role: "PARENT", schoolId: mockSchoolId },
    });

    // Seed existing payment record to trigger unique collision on fee_payments
    state.payments.push({
      id: "pmt_pre_existing_001",
      schoolId: mockSchoolId,
      feeInvoiceId: "inv_c1",
      transactionReference: paymentId,
      receiptNumber: "RZR-2026-PRIOR",
      amountPaid: "5000.00",
    });

    const { db } = await import("@/db");
    const mockTx = createMockTx();

    (db as any).query = {
      paymentGatewayLogs: {
        findFirst: vi.fn(async () => ({ ...state.log })),
      },
      feeInvoices: {
        findFirst: vi.fn(async () => ({ ...state.invoice })),
      },
      feePayments: {
        findFirst: vi.fn(async () => state.payments[0]),
      },
      bankAccounts: {
        findFirst: vi.fn(async () => ({ ...state.bank })),
      },
    };
    (db as any).transaction = vi.fn(async (cb: any) => cb(mockTx));

    const validSignature = createValidVerifySignature();
    const req = new Request("http://localhost:3000/api/razorpay/verify", {
      method: "POST",
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
      }),
    });

    const res = await verifyPost(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.alreadyProcessed).toBe(true);
    expect(json.receiptNumber).toBe("RZR-2026-PRIOR");
    expect(state.payments.length).toBe(1);
  });
});
