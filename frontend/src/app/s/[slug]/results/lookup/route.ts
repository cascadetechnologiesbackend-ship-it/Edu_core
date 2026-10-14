import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  schools,
  reportCardSetups,
  resultSettings,
  resultHolds,
  feeInvoices,
  students,
  classes,
  resultSnapshots,
  publicResultLookups,
} from "@/db/schema";
import { eq, and, isNull, gte, desc } from "drizzle-orm";
import { decryptData } from "@/lib/encryption";

// POST /s/[slug]/results/lookup (Amendment 4: Plain Route Handler with rate limit on x-forwarded-for)
export async function POST(
  req: Request,
  { params }: { params: { slug: string } },
) {
  try {
    const forwardedFor = req.headers.get("x-forwarded-for");
    const firstHop = forwardedFor ? forwardedFor.split(",")[0] : undefined;
    const clientIp = firstHop ? firstHop.trim() : "127.0.0.1";

    // 1. Resolve school by slug
    const school = await db.query.schools.findFirst({
      where: eq(schools.slug, params.slug),
    });

    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    // 2. Rate limiting: max 10 requests per minute per IP
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentLookups = await db.query.publicResultLookups.findMany({
      where: and(
        eq(publicResultLookups.ipAddress, clientIp),
        gte(publicResultLookups.attemptedAt, oneMinuteAgo),
      ),
    });

    if (recentLookups.length >= 10) {
      return NextResponse.json(
        {
          error:
            "Too many lookup attempts. Please wait 60 seconds before trying again.",
        },
        { status: 429 },
      );
    }

    const body = (await req.json()) as {
      setupId?: string;
      admissionNumber?: string;
      rollNumber?: string;
      dob?: string;
    };

    const identifier = (body.admissionNumber || body.rollNumber || "").trim();
    const dobInput = (body.dob || "").trim();

    if (!identifier || !dobInput) {
      return NextResponse.json(
        {
          error:
            "Admission number (or Roll number) and Date of Birth are mandatory.",
        },
        { status: 400 },
      );
    }

    // 3. Resolve setup (Amendment 6: Default to most recently published setup if setupId is omitted)
    let setupRecord = null;
    if (body.setupId) {
      setupRecord = await db.query.reportCardSetups.findFirst({
        where: and(
          eq(reportCardSetups.id, body.setupId),
          eq(reportCardSetups.schoolId, school.id),
        ),
      });
    } else {
      setupRecord = await db.query.reportCardSetups.findFirst({
        where: and(
          eq(reportCardSetups.schoolId, school.id),
          eq(reportCardSetups.isActive, true),
        ),
        orderBy: [desc(reportCardSetups.createdAt)],
      });

      if (!setupRecord) {
        setupRecord = await db.query.reportCardSetups.findFirst({
          where: eq(reportCardSetups.schoolId, school.id),
          orderBy: [desc(reportCardSetups.createdAt)],
        });
      }
    }

    if (!setupRecord) {
      return NextResponse.json(
        { error: "No published examination setups available for lookup." },
        { status: 404 },
      );
    }

    // 4. Check result settings for this setup
    const settings = await db.query.resultSettings.findFirst({
      where: and(
        eq(resultSettings.schoolId, school.id),
        eq(resultSettings.setupId, setupRecord.id),
      ),
    });

    if (!settings || !settings.publicLookupEnabled) {
      await db.insert(publicResultLookups).values({
        schoolId: school.id,
        setupId: setupRecord.id,
        ipAddress: clientIp,
        success: false,
      });
      return NextResponse.json(
        {
          error:
            "Public result lookup has not been enabled for this examination term.",
        },
        { status: 403 },
      );
    }

    if (settings.withholdAll) {
      await db.insert(publicResultLookups).values({
        schoolId: school.id,
        setupId: setupRecord.id,
        ipAddress: clientIp,
        success: false,
      });
      return NextResponse.json(
        {
          error:
            "Examination results are currently undergoing administrative verification and are withheld.",
        },
        { status: 403 },
      );
    }

    if (settings.releaseAt && new Date(settings.releaseAt) > new Date()) {
      await db.insert(publicResultLookups).values({
        schoolId: school.id,
        setupId: setupRecord.id,
        ipAddress: clientIp,
        success: false,
      });
      return NextResponse.json(
        {
          error: `Results for this term will be released on ${new Date(
            settings.releaseAt,
          ).toLocaleString("en-IN")}.`,
        },
        { status: 403 },
      );
    }

    // 5. Match Candidate Student
    const allStudents = await db.query.students.findMany({
      where: and(eq(students.schoolId, school.id), eq(students.isActive, true)),
    });

    const targetStudent = allStudents.find((st) => {
      const matchAdm =
        st.admissionNumber &&
        st.admissionNumber.toLowerCase() === identifier.toLowerCase();
      const matchRoll =
        st.rollNumber &&
        st.rollNumber.toLowerCase() === identifier.toLowerCase();
      return matchAdm || matchRoll;
    });

    if (!targetStudent) {
      await db.insert(publicResultLookups).values({
        schoolId: school.id,
        setupId: setupRecord.id,
        ipAddress: clientIp,
        success: false,
      });
      return NextResponse.json(
        {
          error:
            "No candidate found matching the provided identification details.",
        },
        { status: 404 },
      );
    }

    // Verify Date of Birth
    const studentDob = new Date(targetStudent.dateOfBirth);
    const parsedInputDob = new Date(dobInput);

    const isMatch =
      (parsedInputDob.getUTCFullYear() === studentDob.getUTCFullYear() &&
        parsedInputDob.getUTCMonth() === studentDob.getUTCMonth() &&
        parsedInputDob.getUTCDate() === studentDob.getUTCDate()) ||
      (parsedInputDob.getFullYear() === studentDob.getFullYear() &&
        parsedInputDob.getMonth() === studentDob.getMonth() &&
        parsedInputDob.getDate() === studentDob.getDate());

    if (!isMatch) {
      await db.insert(publicResultLookups).values({
        schoolId: school.id,
        setupId: setupRecord.id,
        ipAddress: clientIp,
        success: false,
      });
      return NextResponse.json(
        {
          error:
            "Date of Birth does not match institutional records for this student.",
        },
        { status: 401 },
      );
    }

    // 6. Check individual result holds
    const hold = await db.query.resultHolds.findFirst({
      where: and(
        eq(resultHolds.schoolId, school.id),
        eq(resultHolds.setupId, setupRecord.id),
        eq(resultHolds.studentId, targetStudent.id),
      ),
    });

    if (hold) {
      await db.insert(publicResultLookups).values({
        schoolId: school.id,
        setupId: setupRecord.id,
        ipAddress: clientIp,
        success: false,
      });
      return NextResponse.json(
        {
          error: `Result is withheld by school administration: ${hold.reason}. Please contact the school office.`,
        },
        { status: 403 },
      );
    }

    // 7. Check financial clearance gate (HARD lock)
    if (settings.feeLockMode === "HARD") {
      const invoices = await db.query.feeInvoices.findMany({
        where: and(
          eq(feeInvoices.schoolId, school.id),
          eq(feeInvoices.studentId, targetStudent.id),
          isNull(feeInvoices.deletedAt),
        ),
        columns: { balanceAmount: true },
      });
      let dueAmount = 0;
      for (const inv of invoices) {
        const bal = parseFloat(inv.balanceAmount || "0");
        if (bal > 0) dueAmount += bal;
      }
      const threshold = parseFloat(settings.feeLockThresholdAmount || "0");
      if (dueAmount > threshold) {
        await db.insert(publicResultLookups).values({
          schoolId: school.id,
          setupId: setupRecord.id,
          ipAddress: clientIp,
          success: false,
        });
        return NextResponse.json(
          {
            error:
              "Result access locked due to pending tuition accounts clearance. Please contact school administration.",
          },
          { status: 403 },
        );
      }
    }

    // 8. Find result snapshot
    const snapshot = await db.query.resultSnapshots.findFirst({
      where: and(
        eq(resultSnapshots.schoolId, school.id),
        eq(resultSnapshots.setupId, setupRecord.id),
        eq(resultSnapshots.studentId, targetStudent.id),
        eq(resultSnapshots.isCurrent, true),
      ),
      orderBy: [desc(resultSnapshots.version)],
    });

    if (!snapshot) {
      await db.insert(publicResultLookups).values({
        schoolId: school.id,
        setupId: setupRecord.id,
        ipAddress: clientIp,
        success: false,
      });
      return NextResponse.json(
        {
          error:
            "Result snapshot has not yet been compiled or published for this candidate.",
        },
        { status: 404 },
      );
    }

    // Resolve class display
    let className = "Standard";
    if (targetStudent.currentClassId) {
      const cls = await db.query.classes.findFirst({
        where: eq(classes.id, targetStudent.currentClassId),
      });
      if (cls) className = cls.displayName;
    }

    // Decrypt student name
    const firstName = decryptData(targetStudent.firstNameEncrypted) || "";
    const lastName = decryptData(targetStudent.lastNameEncrypted) || "";
    const fullName = `${firstName} ${lastName}`.trim() || "Student";

    // 9. Log successful lookup attempt
    await db.insert(publicResultLookups).values({
      schoolId: school.id,
      setupId: setupRecord.id,
      ipAddress: clientIp,
      success: true,
    });

    return NextResponse.json({
      success: true,
      school: {
        id: school.id,
        name: school.name,
        code: school.udiseCode,
      },
      setup: {
        id: setupRecord.id,
        name: setupRecord.name,
      },
      candidate: {
        name: fullName,
        admissionNumber: targetStudent.admissionNumber,
        rollNumber: targetStudent.rollNumber,
        className,
      },
      snapshotId: snapshot.id,
      version: snapshot.version,
      frozenAt: snapshot.frozenAt.toISOString(),
      payload: snapshot.payload,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[public-result-lookup]", message);
    return NextResponse.json(
      { error: "An unexpected error occurred while processing result lookup." },
      { status: 500 },
    );
  }
}
