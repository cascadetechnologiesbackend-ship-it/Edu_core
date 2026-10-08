export const dynamic = "force-dynamic";

import { db } from "@/db";
import { academicYears, feeInvoices, feeCarryForwards, classes, sections } from "@/db/schema";
import { eq, and, gt, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FinanceTabs } from "@/components/finance/FinanceTabs";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { CarryForwardClient } from "./CarryForwardClient";
import { decryptData } from "@/lib/encryption";

export default async function FeesCarryForwardPage() {
  const session = await auth();
  if (!session?.user?.schoolId) redirect("/login");

  const role = session.user.role;
  if (role !== "SUPER_ADMIN" && role !== "SCHOOL_ADMIN") {
    redirect("/school/finance");
  }

  const schoolId = session.user.schoolId;

  // 1. Fetch academic years
  const allYears = await db.query.academicYears.findMany({
    where: eq(academicYears.schoolId, schoolId),
    orderBy: [desc(academicYears.startDate)],
  });

  if (allYears.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        Please configure at least one academic session before using carry forward.
      </div>
    );
  }

  // 2. Fetch classes & sections lookup
  const [allClasses, allSections] = await Promise.all([
    db.query.classes.findMany({ where: eq(classes.schoolId, schoolId) }),
    db.query.sections.findMany({ where: eq(sections.schoolId, schoolId) }),
  ]);
  const classMap = new Map(allClasses.map((c) => [c.id, c.displayName]));
  const sectionMap = new Map(allSections.map((s) => [s.id, s.name]));

  // 3. Fetch pending invoices for the primary/active academic year
  const activeYear = allYears.find((y) => y.isActive) || allYears[0];
  if (!activeYear) {
    return (
      <div className="p-8 text-center text-gray-500">
        No active academic session found.
      </div>
    );
  }

  const pendingInvoices = await db.query.feeInvoices.findMany({
    where: and(
      eq(feeInvoices.schoolId, schoolId),
      eq(feeInvoices.academicYearId, activeYear.id),
      gt(feeInvoices.balanceAmount, "0")
    ),
    with: {
      student: true,
    },
  });

  // Consolidate balance dues per student
  const studentMap = new Map<
    string,
    {
      studentId: string;
      name: string;
      admissionNumber: string;
      className: string;
      sectionName: string | null;
      pendingDue: number;
    }
  >();

  for (const inv of pendingInvoices) {
    if (!inv.student) continue;
    const existing = studentMap.get(inv.studentId);
    const bal = parseFloat(inv.balanceAmount || "0");
    if (existing) {
      existing.pendingDue += bal;
    } else {
      const sFirst = decryptData(inv.student.firstNameEncrypted) || "";
      const sLast = decryptData(inv.student.lastNameEncrypted) || "";
      studentMap.set(inv.studentId, {
        studentId: inv.studentId,
        name: `${sFirst} ${sLast}`.trim() || "Student",
        admissionNumber: inv.student.admissionNumber,
        className: (inv.student.currentClassId && classMap.get(inv.student.currentClassId)) || "N/A",
        sectionName: inv.student.currentSectionId ? (sectionMap.get(inv.student.currentSectionId) ?? null) : null,
        pendingDue: bal,
      });
    }
  }

  const studentsWithDues = Array.from(studentMap.values()).sort(
    (a, b) => b.pendingDue - a.pendingDue
  );

  // 4. Fetch past carry forward records
  const pastMigrations = await db.query.feeCarryForwards.findMany({
    where: eq(feeCarryForwards.schoolId, schoolId),
    with: {
      student: true,
      fromAcademicYear: true,
      toAcademicYear: true,
    },
    orderBy: [desc(feeCarryForwards.createdAt)],
    limit: 25,
  });

  const formattedPastMigrations = pastMigrations.map((m) => {
    const sFirst = m.student ? decryptData(m.student.firstNameEncrypted) || "" : "";
    const sLast = m.student ? decryptData(m.student.lastNameEncrypted) || "" : "";
    return {
      id: m.id,
      studentName: m.student ? `${sFirst} ${sLast}`.trim() || "Student" : "Unknown Student",
      fromYear: m.fromAcademicYear?.label || "Prior Year",
      toYear: m.toAcademicYear?.label || "Next Year",
      carriedAmount: m.carriedAmount,
      status: m.status,
      appliedAt: m.appliedAt,
    };
  });

  return (
    <div className="space-y-6">
      <FinanceTabs activeSection="finance" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            <RefreshCw className="w-3.5 h-3.5" /> End-Of-Year Migration
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white mt-2">
            Fees Carry Forward Utility
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Roll forward unpaid dues from one academic session into opening balance invoices in the subsequent academic session.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-4 py-2 rounded-xl border border-indigo-200 dark:border-indigo-800">
          <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Double-entry verified with audit logging</span>
        </div>
      </div>

      <CarryForwardClient
        academicYears={allYears.map((y) => ({
          id: y.id,
          name: y.label,
          isActive: y.isActive,
        }))}
        studentsWithDues={studentsWithDues}
        previousMigrations={formattedPastMigrations}
      />
    </div>
  );
}
