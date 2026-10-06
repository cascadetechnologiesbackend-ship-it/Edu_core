import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { POST } from "../route";

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
});
