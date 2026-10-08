export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeChallans, feeInvoices, schools } from "@/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { decryptData } from "@/lib/encryption";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import {
  ChallansClient,
  ChallanRow,
} from "./ChallansClient";
import { FileText } from "lucide-react";

export default async function FeeChallansPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const [activeSchool, challans, unpaidInvoicesRaw] = await Promise.all([
    db.query.schools.findFirst({
      where: eq(schools.id, schoolId),
    }),
    db.query.feeChallans.findMany({
      where: eq(feeChallans.schoolId, schoolId),
      with: {
        student: true,
        invoice: {
          with: {
            feeStructure: {
              with: {
                feeHead: true,
              },
            },
          },
        },
      },
      orderBy: [desc(feeChallans.createdAt)],
      limit: 100,
    }),
    db.query.feeInvoices.findMany({
      where: and(
        eq(feeInvoices.schoolId, schoolId),
        inArray(feeInvoices.status, ["PENDING", "PARTIAL", "OVERDUE"])
      ),
      with: {
        student: true,
      },
      orderBy: [desc(feeInvoices.dueDate)],
      limit: 50,
    }),
  ]);

  if (!activeSchool) return <div>School not found</div>;

  const mappedChallans: ChallanRow[] = challans.map((ch) => {
    const fn = decryptData(ch.student?.firstNameEncrypted) || "";
    const ln = decryptData(ch.student?.lastNameEncrypted) || "";
    const sName = `${fn} ${ln}`.trim() || "Student";

    return {
      id: ch.id,
      challanNumber: ch.challanNumber,
      studentId: ch.studentId,
      studentName: sName,
      admissionNumber: ch.student?.admissionNumber || "N/A",
      feeHeadName: ch.invoice?.feeStructure?.feeHead?.name || "Tuition Fee",
      invoiceNumber: ch.invoice?.invoiceNumber || "N/A",
      dueDate: ch.dueDate.toISOString(),
      amount: parseFloat(ch.amount),
      status: ch.status,
      referenceNumber: ch.referenceNumber || undefined,
    };
  });

  const mappedUnpaidInvoices = unpaidInvoicesRaw.map((inv) => {
    const fn = decryptData(inv.student?.firstNameEncrypted) || "";
    const ln = decryptData(inv.student?.lastNameEncrypted) || "";
    const sName = `${fn} ${ln}`.trim() || "Student";

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      studentName: sName,
      admissionNumber: inv.student?.admissionNumber || "N/A",
      balanceAmount: parseFloat(inv.balanceAmount),
    };
  });

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="finance" />

      {/* Header Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <FileText className="w-3.5 h-3.5" /> Operations & Banking
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Bank Fee Challans
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Offline 3-part bank deposit challan generator (Student Copy, School Copy, Bank Copy) and settlement clearance.
          </p>
        </div>

        <QuickActionBar userRole={session.user.role} />
      </div>

      {/* Interactive Challans Client */}
      <ChallansClient
        challans={mappedChallans}
        schoolName={activeSchool.name}
        unpaidInvoices={mappedUnpaidInvoices}
      />
    </div>
  );
}
