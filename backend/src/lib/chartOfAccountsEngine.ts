import { db } from "@/db";
import {
  chartOfAccounts,
  bankAccounts,
  incomeHeads,
  expenseHeads,
  academicYears,
} from "@/db/schema";
import { eq, and, sql, or } from "drizzle-orm";

export const SYSTEM_ACCOUNT_CODES = {
  CASH_MAIN: "1000",
  STUDENT_RECEIVABLE: "1200",
  CAUTION_DEPOSIT: "2100",
  OPENING_BALANCE_EQUITY: "3000",
  FEE_REVENUE_CLEARING: "4000",
  GATEWAY_FEES_EXPENSE: "5200",
} as const;

export type SystemAccountCode =
  (typeof SYSTEM_ACCOUNT_CODES)[keyof typeof SYSTEM_ACCOUNT_CODES];

export interface EnsureAccountsResult {
  cashMainId: string;
  studentReceivableId: string;
  cautionDepositId: string;
  openingBalanceEquityId: string;
  feeRevenueClearingId: string;
  gatewayFeesExpenseId: string;
}

/**
 * Ensures that a school has the core Chart of Accounts provisioned,
 * including standard system accounts and mirroring of all bank accounts,
 * income heads, and expense heads into double-entry ledger accounts.
 */
export async function ensureSchoolChartOfAccounts(
  schoolId: string,
  executor?: any,
): Promise<EnsureAccountsResult> {
  const client = executor || db;

  // 1. Core System Accounts Template
  const systemAccounts = [
    {
      code: SYSTEM_ACCOUNT_CODES.CASH_MAIN,
      name: "Cash-in-Hand (Main Vault)",
      type: "ASSET" as const,
      isSystem: true,
    },
    {
      code: SYSTEM_ACCOUNT_CODES.STUDENT_RECEIVABLE,
      name: "Student Receivable",
      type: "ASSET" as const,
      isSystem: true,
    },
    {
      code: SYSTEM_ACCOUNT_CODES.CAUTION_DEPOSIT,
      name: "Caution Deposit & Refund Liability",
      type: "LIABILITY" as const,
      isSystem: true,
    },
    {
      code: SYSTEM_ACCOUNT_CODES.OPENING_BALANCE_EQUITY,
      name: "Opening Balance Equity",
      type: "EQUITY" as const,
      isSystem: true,
    },
    {
      code: SYSTEM_ACCOUNT_CODES.FEE_REVENUE_CLEARING,
      name: "Fee Revenue Clearing",
      type: "REVENUE" as const,
      isSystem: true,
    },
    {
      code: SYSTEM_ACCOUNT_CODES.GATEWAY_FEES_EXPENSE,
      name: "Gateway & Payment Processing Fees",
      type: "EXPENSE" as const,
      isSystem: true,
    },
  ];

  // Insert or fetch system accounts
  for (const sysAcc of systemAccounts) {
    const existing = await client.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.schoolId, schoolId),
        eq(chartOfAccounts.code, sysAcc.code),
      ),
    });

    if (!existing) {
      await client.insert(chartOfAccounts).values({
        schoolId,
        code: sysAcc.code,
        name: sysAcc.name,
        type: sysAcc.type,
        isSystem: true,
        isActive: true,
      });
    }
  }

  // 2. Mirror Bank Accounts -> ASSET (1010-XXXX)
  const schoolBanks = await client.query.bankAccounts.findMany({
    where: eq(bankAccounts.schoolId, schoolId),
  });

  for (const b of schoolBanks) {
    const code = `1010-${b.id.slice(0, 8).toUpperCase()}`;
    const name = `Bank - ${b.bankName} (${b.accountNumber.slice(-4)})`;
    const existing = await client.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.schoolId, schoolId),
        eq(chartOfAccounts.code, code),
      ),
    });
    if (!existing) {
      await client.insert(chartOfAccounts).values({
        schoolId,
        code,
        name,
        type: "ASSET",
        parentCode: "1000",
        isSystem: false,
        isActive: b.isActive,
      });
    }
  }

  // 3. Mirror Income Heads -> REVENUE (4010-XXXX)
  const schoolIncomeHeads = await client.query.incomeHeads.findMany({
    where: eq(incomeHeads.schoolId, schoolId),
  });

  for (const ih of schoolIncomeHeads) {
    const code = `4010-${ih.id.slice(0, 8).toUpperCase()}`;
    const name = `Income - ${ih.name}`;
    const existing = await client.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.schoolId, schoolId),
        eq(chartOfAccounts.code, code),
      ),
    });
    if (!existing) {
      await client.insert(chartOfAccounts).values({
        schoolId,
        code,
        name,
        type: "REVENUE",
        parentCode: "4000",
        isSystem: false,
        isActive: ih.isActive,
      });
    }
  }

  // 4. Mirror Expense Heads -> EXPENSE (5010-XXXX)
  const schoolExpenseHeads = await client.query.expenseHeads.findMany({
    where: eq(expenseHeads.schoolId, schoolId),
  });

  for (const eh of schoolExpenseHeads) {
    const code = `5010-${eh.id.slice(0, 8).toUpperCase()}`;
    const name = `Expense - ${eh.name}`;
    const existing = await client.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.schoolId, schoolId),
        eq(chartOfAccounts.code, code),
      ),
    });
    if (!existing) {
      await client.insert(chartOfAccounts).values({
        schoolId,
        code,
        name,
        type: "EXPENSE",
        isSystem: false,
        isActive: eh.isActive,
      });
    }
  }

  // Retrieve IDs for the 6 core system accounts
  const allAccounts = await client.query.chartOfAccounts.findMany({
    where: eq(chartOfAccounts.schoolId, schoolId),
  });

  const getAccountId = (code: string) => {
    const found = allAccounts.find((a: any) => a.code === code);
    return found ? found.id : "";
  };

  return {
    cashMainId: getAccountId(SYSTEM_ACCOUNT_CODES.CASH_MAIN),
    studentReceivableId: getAccountId(SYSTEM_ACCOUNT_CODES.STUDENT_RECEIVABLE),
    cautionDepositId: getAccountId(SYSTEM_ACCOUNT_CODES.CAUTION_DEPOSIT),
    openingBalanceEquityId: getAccountId(SYSTEM_ACCOUNT_CODES.OPENING_BALANCE_EQUITY),
    feeRevenueClearingId: getAccountId(SYSTEM_ACCOUNT_CODES.FEE_REVENUE_CLEARING),
    gatewayFeesExpenseId: getAccountId(SYSTEM_ACCOUNT_CODES.GATEWAY_FEES_EXPENSE),
  };
}

/**
 * Resolves the Chart of Accounts ID for a Bank Account
 */
export async function getBankAccountChartAccountId(
  schoolId: string,
  bankAccountId: string | null | undefined,
  executor?: any,
): Promise<string> {
  const client = executor || db;
  if (!bankAccountId) {
    const defaultCash = await client.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.schoolId, schoolId),
        eq(chartOfAccounts.code, SYSTEM_ACCOUNT_CODES.CASH_MAIN),
      ),
    });
    return defaultCash?.id || "";
  }

  const code = `1010-${bankAccountId.slice(0, 8).toUpperCase()}`;
  let acc = await client.query.chartOfAccounts.findFirst({
    where: and(
      eq(chartOfAccounts.schoolId, schoolId),
      eq(chartOfAccounts.code, code),
    ),
  });

  if (!acc) {
    const bank = await client.query.bankAccounts.findFirst({
      where: eq(bankAccounts.id, bankAccountId),
    });
    const name = bank
      ? `Bank - ${bank.bankName} (${bank.accountNumber.slice(-4)})`
      : `Bank Account #${bankAccountId.slice(0, 6)}`;
    const [created] = await client
      .insert(chartOfAccounts)
      .values({
        schoolId,
        code,
        name,
        type: "ASSET",
        parentCode: "1000",
        isSystem: false,
        isActive: true,
      })
      .returning();
    return created?.id || "";
  }

  return acc.id;
}

/**
 * Resolves the Chart of Accounts ID for an Income Head
 */
export async function getIncomeHeadChartAccountId(
  schoolId: string,
  incomeHeadId: string,
  executor?: any,
): Promise<string> {
  const client = executor || db;
  const code = `4010-${incomeHeadId.slice(0, 8).toUpperCase()}`;
  let acc = await client.query.chartOfAccounts.findFirst({
    where: and(
      eq(chartOfAccounts.schoolId, schoolId),
      eq(chartOfAccounts.code, code),
    ),
  });

  if (!acc) {
    const head = await client.query.incomeHeads.findFirst({
      where: eq(incomeHeads.id, incomeHeadId),
    });
    const name = head ? `Income - ${head.name}` : "General Income";
    const [created] = await client
      .insert(chartOfAccounts)
      .values({
        schoolId,
        code,
        name,
        type: "REVENUE",
        parentCode: "4000",
        isSystem: false,
        isActive: true,
      })
      .returning();
    return created?.id || "";
  }

  return acc.id;
}

/**
 * Resolves the Chart of Accounts ID for an Expense Head
 */
export async function getExpenseHeadChartAccountId(
  schoolId: string,
  expenseHeadId: string,
  executor?: any,
): Promise<string> {
  const client = executor || db;
  const code = `5010-${expenseHeadId.slice(0, 8).toUpperCase()}`;
  let acc = await client.query.chartOfAccounts.findFirst({
    where: and(
      eq(chartOfAccounts.schoolId, schoolId),
      eq(chartOfAccounts.code, code),
    ),
  });

  if (!acc) {
    const head = await client.query.expenseHeads.findFirst({
      where: eq(expenseHeads.id, expenseHeadId),
    });
    const name = head ? `Expense - ${head.name}` : "General Expense";
    const [created] = await client
      .insert(chartOfAccounts)
      .values({
        schoolId,
        code,
        name,
        type: "EXPENSE",
        isSystem: false,
        isActive: true,
      })
      .returning();
    return created?.id || "";
  }

  return acc.id;
}

/**
 * Asserts that the academic year containing the specified date (or academicYearId)
 * is NOT locked. Throws a 403 Forbidden error if locked.
 */
export async function assertAcademicYearNotLocked(
  schoolId: string,
  academicYearIdOrDate?: string | Date | null,
  executor?: any,
): Promise<void> {
  const client = executor || db;
  if (!academicYearIdOrDate) {
    // Check if current active academic year is locked
    const activeAy = await client.query.academicYears.findFirst({
      where: and(
        eq(academicYears.schoolId, schoolId),
        eq(academicYears.isActive, true),
      ),
    });
    if (activeAy?.isLocked) {
      throw new Error(
        `Academic Year (${activeAy.label}) is fiscally locked. Financial modifications are prohibited.`,
      );
    }
    return;
  }

  if (typeof academicYearIdOrDate === "string" && academicYearIdOrDate.length === 36) {
    // Looks like a UUID
    const ay = await client.query.academicYears.findFirst({
      where: and(
        eq(academicYears.schoolId, schoolId),
        eq(academicYears.id, academicYearIdOrDate),
      ),
    });
    if (ay?.isLocked) {
      throw new Error(
        `Academic Year (${ay.label}) is fiscally locked. Financial modifications are prohibited.`,
      );
    }
    return;
  }

  // Otherwise interpret as Date
  const dateObj =
    typeof academicYearIdOrDate === "string"
      ? new Date(academicYearIdOrDate)
      : academicYearIdOrDate;

  if (isNaN(dateObj.getTime())) return;

  const targetAy = await client.query.academicYears.findFirst({
    where: and(
      eq(academicYears.schoolId, schoolId),
      sql`${academicYears.startDate} <= ${dateObj}`,
      sql`${academicYears.endDate} >= ${dateObj}`,
    ),
  });

  if (targetAy?.isLocked) {
    throw new Error(
      `Academic Year (${targetAy.label}) is fiscally locked for date ${dateObj.toLocaleDateString("en-IN")}. Financial modifications are prohibited.`,
    );
  }
}
