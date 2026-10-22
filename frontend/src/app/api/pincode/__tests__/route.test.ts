import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../[pincode]/route";
import { NextRequest } from "next/server";

describe("GET /api/pincode/[pincode]", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for invalid pincode format", async () => {
    const req = new NextRequest("http://localhost:3000/api/pincode/1234");
    const res = await GET(req, { params: { pincode: "1234" } });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("resolves online address for valid Hubli pincode", async () => {
    const mockPostalData = [
      {
        Status: "Success",
        PostOffice: [
          {
            Name: "Hubli",
            State: "Karnataka",
            District: "Dharwad",
            Block: "Hubli",
            Division: "Dharwad",
          },
          {
            Name: "Hubli City",
            State: "Karnataka",
            District: "Dharwad",
            Block: "Hubli",
            Division: "Dharwad",
          },
        ],
      },
    ];

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockPostalData,
    } as any);

    const req = new NextRequest("http://localhost:3000/api/pincode/580020");
    const res = await GET(req, { params: { pincode: "580020" } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.source).toBe("online");
    expect(data.state).toBe("Karnataka");
    expect(data.stateCode).toBe("KA");
    expect(data.district).toBe("Dharwad");
    expect(data.city).toBe("Hubli");
    expect(data.localities).toContain("Hubli");
    expect(data.localities).toContain("Hubli City");
  });

  it("falls back to offline index when online fetch fails", async () => {
    vi.spyOn(global, "fetch").mockRejectedValueOnce(new Error("Network timeout"));

    const req = new NextRequest("http://localhost:3000/api/pincode/560001");
    const res = await GET(req, { params: { pincode: "560001" } });
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.source).toBe("offline-fallback");
    expect(data.state).toBe("Karnataka");
    expect(data.stateCode).toBe("KA");
  });
});
