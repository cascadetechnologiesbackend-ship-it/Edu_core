import { NextRequest, NextResponse } from "next/server";
import { acceptSubstitutionAction } from "@/app/(teacher)/teacher/classes/substitutionsActions";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await acceptSubstitutionAction(params.id);
    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.message?.includes("Unauthorized")
      ? 403
      : error.message?.includes("conflict")
      ? 400
      : 500;
    return NextResponse.json(
      { error: error.message || "Failed to accept substitution" },
      { status }
    );
  }
}
