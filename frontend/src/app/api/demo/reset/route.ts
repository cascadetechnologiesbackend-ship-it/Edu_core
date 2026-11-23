import { NextRequest, NextResponse } from "next/server";
import { auth } from "@schoolmitra/backend/lib/auth";
import { seedAllDemoSchools } from "@schoolmitra/database/seed_demo";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const authHeader = req.headers.get("authorization");
    const configuredSecret = process.env.DEMO_RESET_SECRET || "schoolmitra-demo-reset-secret-2026";

    const isTokenAuthorized =
      authHeader &&
      (authHeader === `Bearer ${configuredSecret}` || authHeader === configuredSecret);

    const isDemoSession = Boolean((session?.user as any)?.isDemo);
    const isDev = process.env.NODE_ENV !== "production";

    if (!isTokenAuthorized && !isDemoSession && !isDev) {
      return NextResponse.json(
        { error: "Unauthorized. Demo reset requires an active demo session or valid authorization token." },
        { status: 401 }
      );
    }

    let board: string | undefined;
    try {
      const body = await req.json();
      board = body?.board;
    } catch {
      // Body is optional
    }

    console.log(`[DEMO API RESET] Initiating demo reset${board ? ` for board: ${board}` : " for all boards"}`);
    const resetOptions: { reset?: boolean | undefined; board?: string | undefined } = { reset: true };
    if (board) resetOptions.board = board;
    const results = await seedAllDemoSchools(resetOptions);

    return NextResponse.json({
      success: true,
      message: "Demo tenant sandbox restored to pristine state.",
      seededSchools: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[DEMO API RESET ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to reset demo tenant data",
      },
      { status: 500 }
    );
  }
}
