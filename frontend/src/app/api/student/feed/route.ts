export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getCachedSession } from "@/lib/serverAuth";
import { db, withTenant } from "@/db";
import { resolveStudentScope } from "@/lib/studentEventEngine/scopeResolver";
import { assembleStudentSnapshot } from "@/lib/studentEventEngine/snapshotAssembler";
import { deriveStudentFeed } from "@/lib/studentEventEngine/deriveStudentFeed";

export async function GET(req: Request) {
  try {
    const session = await getCachedSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const studentIdParam = searchParams.get("studentId");
    const schoolId = session.user.schoolId;

    if (!schoolId) {
      return NextResponse.json({ error: "School context missing" }, { status: 400 });
    }

    return await withTenant(schoolId, async (tx) => {
      const scope = await resolveStudentScope(session.user.id, {
        schoolId,
        studentId: studentIdParam || null,
        role: session.user.role,
        tx,
      });

      if (!scope) {
        return NextResponse.json({ error: "Student scope not found" }, { status: 404 });
      }

      const snapshot = await assembleStudentSnapshot(tx, scope);
      const cards = deriveStudentFeed(scope.studentId, new Date(), snapshot);

      return NextResponse.json({
        ok: true,
        studentId: scope.studentId,
        cards,
      });
    });
  } catch (err: any) {
    console.error("[StudentFeedAPI] Error fetching feed:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to derive student feed" },
      { status: 500 }
    );
  }
}
