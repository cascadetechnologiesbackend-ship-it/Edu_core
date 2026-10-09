import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../order/route";
import { db } from "@/db";

const mockRazorpayOrdersCreate = vi.fn();

vi.mock("razorpay", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      orders: {
        create: mockRazorpayOrdersCreate,
      },
    })),
  };
});

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: {
    query: {
      feeInvoices: {
        findFirst: vi.fn(),
      },
      students: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([{ id: "mock-log-id" }]),
    })),
  },
}));

describe("POST /api/razorpay/order", () => {
  const originalEnv = { ...process.env };
  const mockSchoolId = "sch_12345678_school";

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.RAZORPAY_KEY_ID = "rzp_test_TlW4pDX3FlFmRx";
    process.env.RAZORPAY_KEY_SECRET = "u43q6hmds0h51Ri7qkkI8Bru";
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns 401 when unauthenticated", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/razorpay/order", {
      method: "POST",
      body: JSON.stringify({ invoiceId: "inv_1", amount: 5000 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when missing invoiceId or amount", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({
      user: { id: "usr_1", role: "PARENT", schoolId: mockSchoolId },
    });

    const req = new Request("http://localhost:3000/api/razorpay/order", {
      method: "POST",
      body: JSON.stringify({ invoiceId: "inv_1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when invoice does not exist", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({
      user: { id: "usr_1", role: "PARENT", schoolId: mockSchoolId },
    });

    (db.query.feeInvoices.findFirst as any).mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/razorpay/order", {
      method: "POST",
      body: JSON.stringify({ invoiceId: "inv_missing", amount: 5000 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 403 on cross-tenant invoice access", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({
      user: { id: "usr_1", role: "PARENT", schoolId: "sch_another_school" },
    });

    (db.query.feeInvoices.findFirst as any).mockResolvedValue({
      id: "inv_1",
      schoolId: mockSchoolId,
      balanceAmount: "5000.00",
    });

    const req = new Request("http://localhost:3000/api/razorpay/order", {
      method: "POST",
      body: JSON.stringify({ invoiceId: "inv_1", amount: 5000 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("cross-tenant");
  });

  it("creates Razorpay order successfully for authorized user", async () => {
    const { auth } = await import("@/lib/auth");
    (auth as any).mockResolvedValue({
      user: { id: "usr_parent_01", role: "PARENT", schoolId: mockSchoolId },
    });

    (db.query.feeInvoices.findFirst as any).mockResolvedValue({
      id: "inv_1",
      schoolId: mockSchoolId,
      studentId: "stu_1",
      invoiceNumber: "INV-2026-001",
      balanceAmount: "5000.00",
    });

    (db.query.students.findFirst as any).mockResolvedValue({
      id: "stu_1",
      primaryParentUserId: "usr_parent_01",
    });

    mockRazorpayOrdersCreate.mockResolvedValue({
      id: "order_rzp_12345",
      amount: 500000,
      currency: "INR",
      receipt: "RCPT_INV-2026-001",
      status: "created",
    });

    const req = new Request("http://localhost:3000/api/razorpay/order", {
      method: "POST",
      body: JSON.stringify({ invoiceId: "inv_1", amount: 5000 }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("order_rzp_12345");
    expect(mockRazorpayOrdersCreate).toHaveBeenCalledWith({
      amount: 500000,
      currency: "INR",
      receipt: "RCPT_INV-2026-001",
    });
  });
});
