import { db } from "@/db";
import {
  chartOfAccounts,
  accountLedgerTransactions,
  schools,
  academicYears,
  classes,
  students,
  feeConcessions,
  feeInvoices,
  feeStructures,
} from "@/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { ensureSchoolChartOfAccounts } from "./chartOfAccountsEngine";

export interface DateFilterOptions {
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}

export interface AsOfDateOptions {
  asOfDate?: Date | string | null;
}

export interface AccountReportRow {
  accountId: string;
  code: string;
  name: string;
  type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
  parentCode?: string | null;
  debitTotal: number;
  creditTotal: number;
  netDebit: number;
  netCredit: number;
  balance: number;
}

export interface TrialBalanceReport {
  schoolId: string;
  schoolName: string;
  startDate?: string | undefined;
  endDate?: string | undefined;
  generatedAt: string;
  rows: AccountReportRow[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  discrepancy: number;
}

export interface IncomeExpenditureReport {
  schoolId: string;
  schoolName: string;
  startDate?: string | undefined;
  endDate?: string | undefined;
  generatedAt: string;
  incomeRows: AccountReportRow[];
  expenditureRows: AccountReportRow[];
  totalIncome: number;
  totalExpenditure: number;
  netSurplus: number;
  isSurplus: boolean;
}

export interface BalanceSheetReport {
  schoolId: string;
  schoolName: string;
  asOfDate: string;
  generatedAt: string;
  assetRows: AccountReportRow[];
  liabilityRows: AccountReportRow[];
  equityRows: AccountReportRow[];
  totalAssets: number;
  totalLiabilities: number;
  baseEquity: number;
  currentPeriodSurplus: number;
  totalEquityAndSurplus: number;
  totalLiabilitiesAndEquity: number;
  tieOutDifference: number;
  isTiedOut: boolean;
}

/**
 * Generates the Trial Balance report for a school across an optional date range.
 * Surfaces explicit discrepancy when sum(Debits) !== sum(Credits).
 */
export async function generateTrialBalanceReport(
  schoolId: string,
  options?: DateFilterOptions,
  executor?: any,
): Promise<TrialBalanceReport> {
  const client = executor || db;
  await ensureSchoolChartOfAccounts(schoolId, client);

  const school = await client.query.schools.findFirst({
    where: eq(schools.id, schoolId),
  });

  const allAccounts = await client.query.chartOfAccounts.findMany({
    where: and(
      eq(chartOfAccounts.schoolId, schoolId),
      eq(chartOfAccounts.isActive, true),
    ),
    orderBy: (t: any, { asc }: any) => [asc(t.code)],
  });

  const txConditions = [eq(accountLedgerTransactions.schoolId, schoolId)];
  if (options?.startDate) {
    txConditions.push(gte(accountLedgerTransactions.transactionDate, new Date(options.startDate)));
  }
  if (options?.endDate) {
    const end = new Date(options.endDate);
    end.setHours(23, 59, 59, 999);
    txConditions.push(lte(accountLedgerTransactions.transactionDate, end));
  }

  const transactions = await client.query.accountLedgerTransactions.findMany({
    where: and(...txConditions),
  });

  // Accumulate debits and credits per account
  const debitMap = new Map<string, number>();
  const creditMap = new Map<string, number>();

  for (const tx of transactions) {
    const amt = parseFloat(tx.amount || "0");
    if (tx.debitAccountId) {
      debitMap.set(tx.debitAccountId, (debitMap.get(tx.debitAccountId) || 0) + amt);
    }
    if (tx.creditAccountId) {
      creditMap.set(tx.creditAccountId, (creditMap.get(tx.creditAccountId) || 0) + amt);
    }
  }

  const rows: AccountReportRow[] = [];
  let totalDebits = 0;
  let totalCredits = 0;

  for (const acc of allAccounts) {
    const debits = debitMap.get(acc.id) || 0;
    const credits = creditMap.get(acc.id) || 0;

    if (debits === 0 && credits === 0) continue;

    let netDebit = 0;
    let netCredit = 0;
    let balance = 0;

    if (acc.type === "ASSET" || acc.type === "EXPENSE") {
      balance = debits - credits;
      if (balance >= 0) {
        netDebit = balance;
      } else {
        netCredit = Math.abs(balance);
      }
    } else {
      balance = credits - debits;
      if (balance >= 0) {
        netCredit = balance;
      } else {
        netDebit = Math.abs(balance);
      }
    }

    totalDebits += netDebit;
    totalCredits += netCredit;

    rows.push({
      accountId: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      parentCode: acc.parentCode,
      debitTotal: Math.round(debits * 100) / 100,
      creditTotal: Math.round(credits * 100) / 100,
      netDebit: Math.round(netDebit * 100) / 100,
      netCredit: Math.round(netCredit * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }

  const roundedDebits = Math.round(totalDebits * 100) / 100;
  const roundedCredits = Math.round(totalCredits * 100) / 100;
  const discrepancy = Math.round(Math.abs(roundedDebits - roundedCredits) * 100) / 100;
  const isBalanced = discrepancy < 0.01;

  return {
    schoolId,
    schoolName: school?.name || "SchoolMitra Campus",
    startDate: options?.startDate ? new Date(options.startDate).toISOString() : undefined,
    endDate: options?.endDate ? new Date(options.endDate).toISOString() : undefined,
    generatedAt: new Date().toISOString(),
    rows,
    totalDebits: roundedDebits,
    totalCredits: roundedCredits,
    isBalanced,
    discrepancy,
  };
}

/**
 * Generates the Income & Expenditure statement for a school.
 * Revenue accounts (Credits - Debits) vs Expense accounts (Debits - Credits).
 */
export async function generateIncomeExpenditureReport(
  schoolId: string,
  options?: DateFilterOptions,
  executor?: any,
): Promise<IncomeExpenditureReport> {
  const trialBalance = await generateTrialBalanceReport(schoolId, options, executor);

  const incomeRows = trialBalance.rows.filter((r) => r.type === "REVENUE");
  const expenditureRows = trialBalance.rows.filter((r) => r.type === "EXPENSE");

  const totalIncome = incomeRows.reduce((acc, r) => acc + (r.netCredit > 0 ? r.netCredit : -r.netDebit), 0);
  const totalExpenditure = expenditureRows.reduce((acc, r) => acc + (r.netDebit > 0 ? r.netDebit : -r.netCredit), 0);

  const netSurplus = Math.round((totalIncome - totalExpenditure) * 100) / 100;

  return {
    schoolId,
    schoolName: trialBalance.schoolName,
    startDate: trialBalance.startDate,
    endDate: trialBalance.endDate,
    generatedAt: trialBalance.generatedAt,
    incomeRows,
    expenditureRows,
    totalIncome: Math.round(totalIncome * 100) / 100,
    totalExpenditure: Math.round(totalExpenditure * 100) / 100,
    netSurplus,
    isSurplus: netSurplus >= 0,
  };
}

/**
 * Generates the Balance Sheet report for a school as of a specified cutoff date.
 * Ties out: Assets === Liabilities + BaseEquity + CurrentPeriodSurplus.
 */
export async function generateBalanceSheetReport(
  schoolId: string,
  options?: AsOfDateOptions,
  executor?: any,
): Promise<BalanceSheetReport> {
  const asOf = options?.asOfDate ? new Date(options.asOfDate) : new Date();

  // Full history up to asOf date
  const trialBalance = await generateTrialBalanceReport(
    schoolId,
    { endDate: asOf },
    executor,
  );

  const assetRows = trialBalance.rows.filter((r) => r.type === "ASSET");
  const liabilityRows = trialBalance.rows.filter((r) => r.type === "LIABILITY");
  const equityRows = trialBalance.rows.filter((r) => r.type === "EQUITY");

  const incomeRows = trialBalance.rows.filter((r) => r.type === "REVENUE");
  const expenditureRows = trialBalance.rows.filter((r) => r.type === "EXPENSE");

  const totalAssets = Math.round(assetRows.reduce((acc, r) => acc + (r.netDebit > 0 ? r.netDebit : -r.netCredit), 0) * 100) / 100;
  const totalLiabilities = Math.round(liabilityRows.reduce((acc, r) => acc + (r.netCredit > 0 ? r.netCredit : -r.netDebit), 0) * 100) / 100;
  const baseEquity = Math.round(equityRows.reduce((acc, r) => acc + (r.netCredit > 0 ? r.netCredit : -r.netDebit), 0) * 100) / 100;

  const totalIncome = incomeRows.reduce((acc, r) => acc + (r.netCredit > 0 ? r.netCredit : -r.netDebit), 0);
  const totalExpenditure = expenditureRows.reduce((acc, r) => acc + (r.netDebit > 0 ? r.netDebit : -r.netCredit), 0);
  const currentPeriodSurplus = Math.round((totalIncome - totalExpenditure) * 100) / 100;

  const totalEquityAndSurplus = Math.round((baseEquity + currentPeriodSurplus) * 100) / 100;
  const totalLiabilitiesAndEquity = Math.round((totalLiabilities + totalEquityAndSurplus) * 100) / 100;

  const tieOutDifference = Math.round(Math.abs(totalAssets - totalLiabilitiesAndEquity) * 100) / 100;
  const isTiedOut = tieOutDifference < 0.01;

  return {
    schoolId,
    schoolName: trialBalance.schoolName,
    asOfDate: asOf.toISOString(),
    generatedAt: new Date().toISOString(),
    assetRows,
    liabilityRows,
    equityRows,
    totalAssets,
    totalLiabilities,
    baseEquity,
    currentPeriodSurplus,
    totalEquityAndSurplus,
    totalLiabilitiesAndEquity,
    tieOutDifference,
    isTiedOut,
  };
}

export interface ConcessionSummaryRow {
  policyName: string;
  concessionType: string;
  term: string;
  classId?: string | null;
  className: string;
  studentCount: number;
  grossAmount: number;
  concessionAmount: number;
  netRealized: number;
  realizationRate: number; // percentage, e.g. 85.5%
}

export interface ConcessionPolicyBreakdown {
  policyName: string;
  concessionType: string;
  concessionAmount: number;
  studentCount: number;
  percentageOfTotal: number;
}

export interface ConcessionSummaryReport {
  schoolId: string;
  schoolName: string;
  academicYearId?: string | null;
  academicYearName: string;
  generatedAt: string;
  rows: ConcessionSummaryRow[];
  totalGross: number;
  totalConcessions: number;
  totalNetRealized: number;
  totalBeneficiaries: number;
  overallRealizationRate: number;
  policyBreakdown: ConcessionPolicyBreakdown[];
}

/**
 * Generates the Concession & Waiver Summary Report for a school.
 * Aggregates applied concessions / revenue foregone grouped by Policy x Term x Class.
 */
export async function generateConcessionSummaryReport(
  schoolId: string,
  academicYearId?: string | null,
  executor?: any,
): Promise<ConcessionSummaryReport> {
  const client = executor || db;

  const school = await client.query.schools.findFirst({
    where: eq(schools.id, schoolId),
  });

  // Resolve target academic year
  let targetYear: any = null;
  if (academicYearId) {
    targetYear = await client.query.academicYears.findFirst({
      where: and(
        eq(academicYears.id, academicYearId),
        eq(academicYears.schoolId, schoolId),
      ),
    });
  }

  if (!targetYear) {
    targetYear = await client.query.academicYears.findFirst({
      where: and(
        eq(academicYears.schoolId, schoolId),
        eq(academicYears.isActive, true),
      ),
    });
  }

  if (!targetYear) {
    targetYear = await client.query.academicYears.findFirst({
      where: eq(academicYears.schoolId, schoolId),
      orderBy: (t: any, { desc }: any) => [desc(t.startDate)],
    });
  }

  const academicYearName = targetYear?.label || "Current Academic Session";
  const effectiveYearId = targetYear?.id;

  // Fetch classes for school
  const schoolClasses = await client.query.classes.findMany({
    where: eq(classes.schoolId, schoolId),
  });
  const classMap = new Map<string, string>();
  for (const c of schoolClasses) {
    classMap.set(c.id, c.displayName || c.name);
  }

  // Fetch students for school
  const schoolStudents = await client.query.students.findMany({
    where: eq(students.schoolId, schoolId),
  });
  const studentClassMap = new Map<string, { classId: string | null; className: string }>();
  for (const s of schoolStudents) {
    const cId = s.currentClassId || null;
    const cName = cId ? (classMap.get(cId) || "Enrolled Class") : "General / Unassigned";
    studentClassMap.set(s.id, { classId: cId, className: cName });
  }

  // Fetch fee structures if effectiveYearId is present
  const structureConditions = [eq(feeStructures.schoolId, schoolId)];
  if (effectiveYearId) {
    structureConditions.push(eq(feeStructures.academicYearId, effectiveYearId));
  }
  const schoolStructures = await client.query.feeStructures.findMany({
    where: and(...structureConditions),
  });
  const structureMap = new Map<string, { classId: string | null; feeHeadId: string | null }>();
  for (const fs of schoolStructures) {
    structureMap.set(fs.id, { classId: fs.classId || null, feeHeadId: fs.feeHeadId || null });
  }

  // Fetch concessions for school & year
  const concessionConditions = [
    eq(feeConcessions.schoolId, schoolId),
    eq(feeConcessions.isActive, true),
    sql`"deleted_at" IS NULL`,
  ];
  if (effectiveYearId) {
    concessionConditions.push(eq(feeConcessions.academicYearId, effectiveYearId));
  }
  const schoolConcessions = await client.query.feeConcessions.findMany({
    where: and(...concessionConditions),
  });

  // Map studentId -> list of active concessions
  const studentConcessionsMap = new Map<string, typeof schoolConcessions>();
  for (const c of schoolConcessions) {
    if (c.studentId) {
      const list = studentConcessionsMap.get(c.studentId) || [];
      list.push(c);
      studentConcessionsMap.set(c.studentId, list);
    }
  }

  // Fetch invoices for school & year
  const invoiceConditions = [
    eq(feeInvoices.schoolId, schoolId),
    sql`"deleted_at" IS NULL`,
  ];
  if (effectiveYearId) {
    invoiceConditions.push(eq(feeInvoices.academicYearId, effectiveYearId));
  }
  const invoices = await client.query.feeInvoices.findMany({
    where: and(...invoiceConditions),
  });

  // Group accumulator: Policy x ConcessionType x Term x Class
  interface GroupAcc {
    policyName: string;
    concessionType: string;
    term: string;
    classId: string | null;
    className: string;
    studentIds: Set<string>;
    grossAmount: number;
    concessionAmount: number;
  }
  const groups = new Map<string, GroupAcc>();
  const trackedStudentsWithInvoiceDiscount = new Set<string>();

  for (const inv of invoices) {
    const discount = parseFloat(inv.discountAmount || "0");
    if (discount <= 0) continue;

    trackedStudentsWithInvoiceDiscount.add(inv.studentId);
    const gross = parseFloat(inv.grossAmount || "0");
    const term = inv.term || "ANNUAL";

    // Resolve class
    const struct = inv.feeStructureId ? structureMap.get(inv.feeStructureId) : null;
    const studentInfo = studentClassMap.get(inv.studentId);
    const classId = struct?.classId || studentInfo?.classId || null;
    const className = (classId ? classMap.get(classId) : null) || studentInfo?.className || "General / Unassigned";

    // Resolve concession policy
    const studentConcessions = studentConcessionsMap.get(inv.studentId) || [];
    let policyName = "Administrative Fee Waiver";
    let concessionType = "SPECIAL";

    if (studentConcessions.length > 0) {
      const matched = struct?.feeHeadId
        ? studentConcessions.find((c: any) => c.appliesTo === "ALL" || c.appliesTo === struct.feeHeadId)
        : studentConcessions[0];
      const selected = matched || studentConcessions[0];
      policyName = selected.concessionName;
      concessionType = selected.concessionType;
    }

    const groupKey = `${policyName}::${concessionType}::${term}::${className}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        policyName,
        concessionType,
        term,
        classId,
        className,
        studentIds: new Set<string>(),
        grossAmount: 0,
        concessionAmount: 0,
      };
      groups.set(groupKey, group);
    }

    group.studentIds.add(inv.studentId);
    group.grossAmount += gross;
    group.concessionAmount += discount;
  }

  // Account for configured student concessions that have not yet generated discounted invoices
  for (const c of schoolConcessions) {
    if (!c.studentId || trackedStudentsWithInvoiceDiscount.has(c.studentId)) continue;

    const studentInfo = studentClassMap.get(c.studentId);
    const classId = studentInfo?.classId || null;
    const className = studentInfo?.className || "General / Unassigned";
    const term = "ANNUAL";
    const policyName = c.concessionName;
    const concessionType = c.concessionType;

    const groupKey = `${policyName}::${concessionType}::${term}::${className}`;
    let group = groups.get(groupKey);
    if (!group) {
      group = {
        policyName,
        concessionType,
        term,
        classId,
        className,
        studentIds: new Set<string>(),
        grossAmount: 0,
        concessionAmount: 0,
      };
      groups.set(groupKey, group);
    }

    group.studentIds.add(c.studentId);
    const fixedDiscount = parseFloat(c.discountAmount || "0");
    group.concessionAmount += fixedDiscount;
    group.grossAmount += fixedDiscount; // baseline commitment
  }

  // Build rows
  const allBeneficiaryIds = new Set<string>();
  const rows: ConcessionSummaryRow[] = [];

  for (const g of groups.values()) {
    g.studentIds.forEach((id) => allBeneficiaryIds.add(id));
    const gross = Math.round(g.grossAmount * 100) / 100;
    const concession = Math.round(g.concessionAmount * 100) / 100;
    const net = Math.round(Math.max(0, gross - concession) * 100) / 100;
    const rate = gross > 0 ? Math.round(((net / gross) * 100) * 10) / 10 : 0;

    rows.push({
      policyName: g.policyName,
      concessionType: g.concessionType,
      term: g.term,
      classId: g.classId,
      className: g.className,
      studentCount: g.studentIds.size,
      grossAmount: gross,
      concessionAmount: concession,
      netRealized: net,
      realizationRate: rate,
    });
  }

  // Sort rows: Policy asc, Term asc, Class asc
  rows.sort((a, b) => {
    if (a.policyName !== b.policyName) return a.policyName.localeCompare(b.policyName);
    if (a.term !== b.term) return a.term.localeCompare(b.term);
    return a.className.localeCompare(b.className);
  });

  const totalGross = Math.round(rows.reduce((sum, r) => sum + r.grossAmount, 0) * 100) / 100;
  const totalConcessions = Math.round(rows.reduce((sum, r) => sum + r.concessionAmount, 0) * 100) / 100;
  const totalNetRealized = Math.round(Math.max(0, totalGross - totalConcessions) * 100) / 100;
  const overallRealizationRate = totalGross > 0 ? Math.round(((totalNetRealized / totalGross) * 100) * 10) / 10 : (totalConcessions > 0 ? 0 : 100);

  // Policy breakdown
  const policyMap = new Map<string, { type: string; amount: number; students: Set<string> }>();
  for (const g of groups.values()) {
    let p = policyMap.get(g.policyName);
    if (!p) {
      p = { type: g.concessionType, amount: 0, students: new Set<string>() };
      policyMap.set(g.policyName, p);
    }
    p.amount += g.concessionAmount;
    g.studentIds.forEach((id) => p?.students.add(id));
  }

  const policyBreakdown: ConcessionPolicyBreakdown[] = Array.from(policyMap.entries()).map(([policyName, p]) => {
    const amount = Math.round(p.amount * 100) / 100;
    return {
      policyName,
      concessionType: p.type,
      concessionAmount: amount,
      studentCount: p.students.size,
      percentageOfTotal: totalConcessions > 0 ? Math.round(((amount / totalConcessions) * 100) * 10) / 10 : 0,
    };
  }).sort((a, b) => b.concessionAmount - a.concessionAmount);

  return {
    schoolId,
    schoolName: school?.name || "SchoolMitra Campus",
    academicYearId: effectiveYearId || null,
    academicYearName,
    generatedAt: new Date().toISOString(),
    rows,
    totalGross,
    totalConcessions,
    totalNetRealized,
    totalBeneficiaries: allBeneficiaryIds.size,
    overallRealizationRate,
    policyBreakdown,
  };
}
