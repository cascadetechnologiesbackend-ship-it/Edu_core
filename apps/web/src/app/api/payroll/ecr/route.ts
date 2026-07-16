import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payrollRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { generatePfEcrFile } from "@/lib/payrollEngine";
import { decryptData } from "@/lib/encryption";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const runId = searchParams.get("runId");

    if (!runId) {
      return new NextResponse("Missing runId parameter", { status: 400 });
    }

    // Authorization checks
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "HR_MANAGER"];
    if (!allowedRoles.includes(session.user.role)) {
      return new NextResponse("Access denied: Insufficient permissions", { status: 403 });
    }

    // Fetch payroll run
    const run = await db.query.payrollRuns.findFirst({
      where: eq(payrollRuns.id, runId),
      with: {
        payslips: {
          with: {
            staff: true,
          },
        },
      },
    });

    if (!run) {
      return new NextResponse("Payroll run not found", { status: 404 });
    }

    if (run.status !== "APPROVED") {
      return new NextResponse("Payroll run must be locked and approved to export ECR", { status: 400 });
    }

    // Map to ECR record inputs
    const ecrRecords = run.payslips.map((slip) => {
      // Decrypt staff names using our AES decryption helper
      const decryptedName = () => {
        try {
          const first = decryptData(slip.staff.firstNameEncrypted) || "";
          const last = decryptData(slip.staff.lastNameEncrypted) || "";
          return `${first} ${last}`.trim();
        } catch {
          return "Staff Member";
        }
      };

      const basic = parseFloat(slip.basicSalary);
      const da = parseFloat(slip.da);
      const epfWages = basic + da; // EPF wages is Basic + DA

      return {
        memberId: slip.staff.employeeCode,
        memberName: decryptedName(),
        grossWages: parseFloat(slip.grossSalary),
        epfWages,
        ncpDays: slip.workingDays - slip.presentDays, // NCP days is unpaid leave / absent days
      };
    });

    const fileContent = generatePfEcrFile(ecrRecords);

    // Return ECR text file attachment
    const response = new NextResponse(fileContent, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="ECR_EPFO_${run.month}.txt"`,
      },
    });

    return response;
  } catch (error: any) {
    console.error("ECR Generation Error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
