import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { gpsPings, vehicles } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vehicleId, latitude, longitude, speed } = body;

    if (!vehicleId || latitude == null || longitude == null) {
      return NextResponse.json(
        { success: false, error: "vehicleId, latitude, and longitude are required" },
        { status: 400 }
      );
    }

    // Verify vehicle exists
    const vehicle = await db.query.vehicles.findFirst({
      where: eq(vehicles.id, vehicleId),
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: "Vehicle not found" },
        { status: 404 }
      );
    }

    const [ping] = await db
      .insert(gpsPings)
      .values({
        vehicleId,
        latitude: String(latitude),
        longitude: String(longitude),
        speed: speed != null ? String(speed) : "0",
        recordedAt: new Date(),
      })
      .returning();

    if (!ping) {
      return NextResponse.json(
        { success: false, error: "Failed to record ping" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pingId: ping.id,
      recordedAt: ping.recordedAt,
    });
  } catch (error: any) {
    console.error("GPS ping recording failed:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record GPS ping" },
      { status: 500 }
    );
  }
}
