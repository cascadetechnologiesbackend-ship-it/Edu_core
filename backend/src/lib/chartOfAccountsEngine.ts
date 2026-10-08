import { db } from "@/db";
import {
  chartOfAccounts,
  bankAccounts,
  incomeHeads,
  expenseHeads,
  academicYears,
  accountLedgerTransactions,
  incomeVouchers,
  expenseVouchers,
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

/**
 * Resolves the Chart of Accounts ID for Student Receivable (1200)
 */
export async function getStudentReceivableChartAccountId(
  schoolId: string,
  executor?: any,
): Promise<string> {
  const client = executor || db;
  const acc = await client.query.chartOfAccounts.findFirst({
    where: and(
      eq(chartOfAccounts.schoolId, schoolId),
      eq(chartOfAccounts.code, SYSTEM_ACCOUNT_CODES.STUDENT_RECEIVABLE),
    ),
  });
  if (!acc) {
    const res = await ensureSchoolChartOfAccounts(schoolId, client);
    return res.studentReceivableId;
  }
  return acc.id;
}

/**
 * Resolves the Chart of Accounts ID for Caution Deposit & Refund Liability (2100)
 */
export async function getCautionDepositChartAccountId(
  schoolId: string,
  executor?: any,
): Promise<string> {
  const client = executor || db;
  const acc = await client.query.chartOfAccounts.findFirst({
    where: and(
      eq(chartOfAccounts.schoolId, schoolId),
      eq(chartOfAccounts.code, SYSTEM_ACCOUNT_CODES.CAUTION_DEPOSIT),
    ),
  });
  if (!acc) {
    const res = await ensureSchoolChartOfAccounts(schoolId, client);
    return res.cautionDepositId;
  }
  return acc.id;
}

/**
 * Resolves the Chart of Accounts ID for Opening Balance Equity (3000)
 */
export async function getOpeningBalanceEquityChartAccountId(
  schoolId: string,
  executor?: any,
): Promise<string> {
  const client = executor || db;
  const acc = await client.query.chartOfAccounts.findFirst({
    where: and(
      eq(chartOfAccounts.schoolId, schoolId),
      eq(chartOfAccounts.code, SYSTEM_ACCOUNT_CODES.OPENING_BALANCE_EQUITY),
    ),
  });
  if (!acc) {
    const res = await ensureSchoolChartOfAccounts(schoolId, client);
    return res.openingBalanceEquityId;
  }
  return acc.id;
}

/**
 * Resolves the Chart of Accounts ID for Gateway & Payment Processing Fees (5200)
 */
export async function getGatewayFeesExpenseChartAccountId(
  schoolId: string,
  executor?: any,
): Promise<string> {
  const client = executor || db;
  const acc = await client.query.chartOfAccounts.findFirst({
    where: and(
      eq(chartOfAccounts.schoolId, schoolId),
      eq(chartOfAccounts.code, SYSTEM_ACCOUNT_CODES.GATEWAY_FEES_EXPENSE),
    ),
  });
  if (!acc) {
    const res = await ensureSchoolChartOfAccounts(schoolId, client);
    return res.gatewayFeesExpenseId;
  }
  return acc.id;
}

/**
 * Resolves the Chart of Accounts ID for Main Cash-in-Hand (1000)
 */
export async function getCashMainChartAccountId(
  schoolId: string,
  executor?: any,
): Promise<string> {
  const client = executor || db;
  const acc = await client.query.chartOfAccounts.findFirst({
    where: and(
      eq(chartOfAccounts.schoolId, schoolId),
      eq(chartOfAccounts.code, SYSTEM_ACCOUNT_CODES.CASH_MAIN),
    ),
  });
  if (!acc) {
    const res = await ensureSchoolChartOfAccounts(schoolId, client);
    return res.cashMainId;
  }
  return acc.id;
}

/**
 * Resolves the Chart of Accounts ID for Fee Revenue Clearing (4000)
 */
export async function getFeeRevenueClearingChartAccountId(
  schoolId: string,
  executor?: any,
): Promise<string> {
  const client = executor || db;
  const acc = await client.query.chartOfAccounts.findFirst({
    where: and(
      eq(chartOfAccounts.schoolId, schoolId),
      eq(chartOfAccounts.code, SYSTEM_ACCOUNT_CODES.FEE_REVENUE_CLEARING),
    ),
  });
  if (!acc) {
    const res = await ensureSchoolChartOfAccounts(schoolId, client);
    return res.feeRevenueClearingId;
  }
  return acc.id;
}

/**
 * One-time backfill helper for DECIDE-12 Option A:
 * Populates debitAccountId and creditAccountId for existing legacy ledger transactions
 * while leaving existing columns intact.
 */
export async function backfillDoubleEntryLedger(
  schoolId?: string,
  executor?: any,
): Promise<{ updatedCount: number }> {
  const client = executor || db;

  const conditions = [
    or(
      sql`${accountLedgerTransactions.debitAccountId} IS NULL`,
      sql`${accountLedgerTransactions.creditAccountId} IS NULL`,
    ),
  ];
  if (schoolId) {
    conditions.push(eq(accountLedgerTransactions.schoolId, schoolId));
  }

  const pendingRows = await client.query.accountLedgerTransactions.findMany({
    where: and(...conditions),
  });

  let updatedCount = 0;

  for (const row of pendingRows) {
    const sys = await ensureSchoolChartOfAccounts(row.schoolId, client);

    let bankCashChartId: string;
    if (row.bankAccountId) {
      bankCashChartId = await getBankAccountChartAccountId(
        row.schoolId,
        row.bankAccountId,
        client,
      );
    } else {
      bankCashChartId = sys.cashMainId;
    }

    let debitId: string = "";
    let creditId: string = "";

    switch (row.sourceType) {
      case "FEE_COLLECTION": {
        if (row.transactionType === "DEBIT") {
          // Fee Refund Payout restores Student Receivable
          debitId = sys.studentReceivableId;
          creditId = bankCashChartId;
        } else {
          // Fee Collection Deposit
          debitId = bankCashChartId;
          creditId = sys.studentReceivableId;
        }
        break;
      }
      case "INCOME_VOUCHER": {
        debitId = bankCashChartId;
        if (row.sourceId) {
          const voucher = await client.query.incomeVouchers.findFirst({
            where: and(
              eq(incomeVouchers.schoolId, row.schoolId),
              eq(incomeVouchers.id, row.sourceId),
            ),
          });
          if (voucher?.incomeHeadId) {
            creditId = await getIncomeHeadChartAccountId(
              row.schoolId,
              voucher.incomeHeadId,
              client,
            );
          } else {
            creditId = sys.feeRevenueClearingId;
          }
        } else {
          creditId = sys.feeRevenueClearingId;
        }
        break;
      }
      case "EXPENSE_VOUCHER": {
        creditId = bankCashChartId;
        if (row.sourceId) {
          const voucher = await client.query.expenseVouchers.findFirst({
            where: and(
              eq(expenseVouchers.schoolId, row.schoolId),
              eq(expenseVouchers.id, row.sourceId),
            ),
          });
          if (voucher?.expenseHeadId) {
            debitId = await getExpenseHeadChartAccountId(
              row.schoolId,
              voucher.expenseHeadId,
              client,
            );
          } else {
            debitId = sys.gatewayFeesExpenseId;
          }
        } else {
          debitId = sys.gatewayFeesExpenseId;
        }
        break;
      }
      case "OPENING_BALANCE": {
        debitId = bankCashChartId;
        creditId = sys.openingBalanceEquityId;
        break;
      }
      case "MANUAL_ADJUSTMENT": {
        if (row.transactionType === "DEBIT") {
          // Cancellation reversal
          debitId = sys.studentReceivableId;
          creditId = bankCashChartId;
        } else {
          debitId = bankCashChartId;
          creditId = sys.studentReceivableId;
        }
        break;
      }
      default: {
        if (row.transactionType === "CREDIT") {
          debitId = bankCashChartId;
          creditId = sys.feeRevenueClearingId;
        } else {
          debitId = sys.feeRevenueClearingId;
          creditId = bankCashChartId;
        }
        break;
      }
    }

    if (debitId && creditId) {
      await client
        .update(accountLedgerTransactions)
        .set({
          debitAccountId: debitId,
          creditAccountId: creditId,
        })
        .where(eq(accountLedgerTransactions.id, row.id));
      updatedCount++;
    }
  }

  // Corrective pass: Ensure any fee refunds previously mapped to Caution Deposit (2100) are remapped to 1200
  const schoolsToFix: string[] = schoolId
    ? [schoolId]
    : Array.from(new Set(pendingRows.map((r: any) => r.schoolId as string).filter(Boolean)));
  for (const sId of schoolsToFix) {
    if (!sId) continue;
    const sys = await ensureSchoolChartOfAccounts(sId, client);
    await client
      .update(accountLedgerTransactions)
      .set({ debitAccountId: sys.studentReceivableId })
      .where(
        and(
          eq(accountLedgerTransactions.schoolId, sId),
          eq(accountLedgerTransactions.sourceType, "FEE_COLLECTION"),
          eq(accountLedgerTransactions.transactionType, "DEBIT"),
          eq(accountLedgerTransactions.debitAccountId, sys.cautionDepositId),
        ),
      );
  }

  return { updatedCount };
}

