export const dynamic = "force-dynamic";

import { db } from "@/db";
import { feeDiscounts, feeHeads, feeConcessions, classes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { decryptData } from "@/lib/encryption";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { QuickActionBar } from "@/components/finance/QuickActionBar";
import {
  ConcessionsClient,
  DiscountTemplateItem,
  StudentConcessionItem,
} from "./ConcessionsClient";
import { Percent } from "lucide-react";

export default async function FeesDiscountPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const schoolId = session.user.schoolId;

  const [discounts, heads, studentConcessions, allClasses] = await Promise.all([
    db.query.feeDiscounts.findMany({
      where: eq(feeDiscounts.schoolId, schoolId),
      with: {
        feeHead: true,
      },
      orderBy: [desc(feeDiscounts.createdAt)],
    }),
    db.query.feeHeads.findMany({
      where: eq(feeHeads.schoolId, schoolId),
      orderBy: [desc(feeHeads.priority)],
    }),
    db.query.feeConcessions.findMany({
      where: eq(feeConcessions.schoolId, schoolId),
      with: {
        student: true,
      },
      orderBy: [desc(feeConcessions.createdAt)],
      limit: 100,
    }),
    db.query.classes.findMany({
      where: eq(classes.schoolId, schoolId),
    }),
  ]);

  const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));

  const mappedDiscounts: DiscountTemplateItem[] = discounts.map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code || undefined,
    discountType: d.discountType,
    discountValue: d.discountValue,
    appliesToHeadName: d.feeHead?.name || undefined,
    requiresApproval: d.requiresApproval,
    isActive: d.isActive,
  }));

  const mappedConcessions: StudentConcessionItem[] = studentConcessions.map((c) => {
    const fn = decryptData(c.student?.firstNameEncrypted || null) || "";
    const ln = decryptData(c.student?.lastNameEncrypted || null) || "";
    const sName = `${fn} ${ln}`.trim() || "Student";
    const className = c.student?.currentClassId
      ? classMap.get(c.student.currentClassId) || "Enrolled"
      : "Enrolled";

    return {
      id: c.id,
      studentName: sName,
      admissionNumber: c.student?.admissionNumber || "N/A",
      className,
      concessionType: c.concessionType,
      concessionName: c.concessionName,
      discountPercentage: c.discountPercentage || undefined,
      discountAmount: c.discountAmount || undefined,
      isActive: c.isActive,
    };
  });

  const headsList = heads.map((h) => ({
    id: h.id,
    name: h.name,
  }));

  return (
    <div className="space-y-6">
      {/* Finance Navigation Tabs */}
      <FinanceTabs activeSection="finance" />

      {/* Header Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Percent className="w-3.5 h-3.5" /> Setup & Concessions
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Fees Concessions & Discount Policies
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Configure institutional discount policies, sibling concessions, staff-ward waivers, and student allocations.
          </p>
        </div>

        <QuickActionBar userRole={session.user.role} />
      </div>

      {/* Interactive Concessions Client */}
      <ConcessionsClient
        discounts={mappedDiscounts}
        concessions={mappedConcessions}
        heads={headsList}
      />
    </div>
  );
}
