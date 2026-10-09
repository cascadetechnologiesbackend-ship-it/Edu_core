import { describe, it, expect } from "vitest";
import { collectFeeSchema } from "@schoolmitra/validators";

describe("OPEN-7: collectFeeSchema payment method enum alignment", () => {
  const validMethods = [
    "CASH",
    "CHEQUE",
    "ONLINE",
    "DD",
    "NEFT",
    "RTGS",
    "UPI",
  ] as const;

  const validBasePayload = {
    schoolId: "11111111-1111-1111-1111-111111111111",
    studentId: "22222222-2222-2222-2222-222222222222",
    feeInvoiceId: "33333333-3333-3333-3333-333333333333",
    amountPaid: 5000,
    paymentDate: "2026-10-09",
    remarks: "Fee collection payment mode test",
  };

  it.each(validMethods)("accepts payment method: %s", (method) => {
    const result = collectFeeSchema.safeParse({
      ...validBasePayload,
      paymentMethod: method,
    });
    expect(result.success).toBe(true);
  });

  it("rejects unsupported payment method", () => {
    const result = collectFeeSchema.safeParse({
      ...validBasePayload,
      paymentMethod: "CRYPTO",
    });
    expect(result.success).toBe(false);
  });
});
