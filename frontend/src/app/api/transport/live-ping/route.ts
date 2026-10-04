import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { gpsPings } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const vehicleId = searchParams.get("vehicleId");

    if (!vehicleId) {
      return NextResponse.json(
        { success: false, error: "vehicleId query parameter is required" },
        { status: 400 }
      );
    }

    const latestPing = await db.query.gpsPings.findFirst({
      where: eq(gpsPings.vehicleId, vehicleId),
      orderBy: [desc(gpsPings.recordedAt)],
    });

    if (!latestPing) {
      return NextResponse.json({
        success: true,
        ping: null,
      });
    }

    return NextResponse.json({
      success: true,
      ping: {
        latitude: parseFloat(latestPing.latitude),
        longitude: parseFloat(latestPing.longitude),
        speed: latestPing.speed ? parseFloat(latestPing.speed) : 0,
        recordedAt: latestPing.recordedAt,
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch latest GPS ping:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch GPS ping" },
      { status: 500 }
    );
  }
}
