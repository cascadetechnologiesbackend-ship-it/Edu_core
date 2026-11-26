export const dynamic = "force-dynamic";

import { db, withTenant } from "@/db";
import { feeDiscounts, feeHeads, feeConcessions, classes } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { assertRouteAccess } from "@/lib/routeGuards";
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

  const access = assertRouteAccess(session.user.role, "/school/fees-discount", {
    id: session.user.id,
    email: session.user.email ?? undefined,
    schoolId: session.user.schoolId,
  });
  if (!access.allowed) {
    redirect(access.redirectUrl || "/login");
  }

  const schoolId = session.user.schoolId;

  const [discounts, heads, studentConcessions, allClasses] = await withTenant(
    schoolId,
    async (tx) => {
      return await Promise.all([
        tx.query.feeDiscounts.findMany({
          where: eq(feeDiscounts.schoolId, schoolId),
          with: {
            feeHead: true,
          },
          orderBy: [desc(feeDiscounts.createdAt)],
        }),
        tx.query.feeHeads.findMany({
          where: eq(feeHeads.schoolId, schoolId),
          orderBy: [desc(feeHeads.priority)],
        }),
        tx.query.feeConcessions.findMany({
          where: eq(feeConcessions.schoolId, schoolId),
          with: {
            student: true,
          },
          orderBy: [desc(feeConcessions.createdAt)],
          limit: 100,
        }),
        tx.query.classes.findMany({
          where: eq(classes.schoolId, schoolId),
        }),
      ]);
    }
  );

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
      <FinanceTabs activeSection="finance" userRole={session.user.role} />

      {/* Header Banner & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-card p-6 rounded-3xl border border-border/40 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <Percent className="w-3.5 h-3.5" /> Setup & Concessions
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mt-2">
            Fees Concessions & Discount Policies
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
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
