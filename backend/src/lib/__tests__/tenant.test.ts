import { describe, it, expect, vi, beforeEach } from "vitest";
import { withTenant } from "../tenant";
import { db } from "@/db";

vi.mock("@/db", () => {
  const mockTx = {
    execute: vi.fn().mockResolvedValue({}),
  };
  return {
    db: {
      transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(mockTx)),
      query: {
        schools: {
          findFirst: vi.fn(),
        },
      },
    },
  };
});

describe("Tenant Isolation withTenant helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes set_config to set app.current_school_id within transaction", async () => {
    const schoolId = "school-test-uuid-42";
    let executedInsideTx = false;

    const result = await withTenant(schoolId, async (tx) => {
      executedInsideTx = true;
      expect(tx).toBeDefined();
      expect(tx.execute).toHaveBeenCalled();
      return "success-result";
    });

    expect(result).toBe("success-result");
    expect(executedInsideTx).toBe(true);
    expect(db.transaction).toHaveBeenCalledTimes(1);
  });

  it("propagates error thrown inside transaction callback", async () => {
    const schoolId = "school-err-uuid";

    await expect(
      withTenant(schoolId, async () => {
        throw new Error("Tx callback failed");
      })
    ).rejects.toThrow("Tx callback failed");
  });
});
