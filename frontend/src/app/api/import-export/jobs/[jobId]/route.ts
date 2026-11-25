import { NextResponse } from "next/server";
import { requireAuth, requireSchool } from "@/lib/serverAuth";

export async function GET(
  _request: Request,
  context: { params: { jobId: string } }
) {
  try {
    const ctx = await requireAuth([
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "PRINCIPAL",
      "HR_MANAGER",
      "ACCOUNTANT",
    ] as const);
    const school = await requireSchool(ctx);

    const { jobId } = context.params;
    if (!jobId) {
      return NextResponse.json({ error: "Missing jobId parameter." }, { status: 400 });
    }

    return NextResponse.json({
      jobId,
      schoolId: school.id,
      status: "COMPLETED",
      downloadUrl: `/api/import-export/jobs/${encodeURIComponent(jobId)}/download`,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch job status";
    const status = message.toLowerCase().includes("unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
