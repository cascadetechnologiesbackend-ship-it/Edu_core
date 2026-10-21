import { NextRequest, NextResponse } from "next/server";
import { declineSubstitutionAction } from "@/app/(teacher)/teacher/classes/substitutionsActions";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    let reason: string | undefined;
    try {
      const body = await req.json();
      reason = body.reason;
    } catch {
      // Body is optional
    }
    const result = await declineSubstitutionAction(params.id, reason);
    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.message?.includes("Unauthorized") ? 403 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to decline substitution" },
      { status }
    );
  }
}
