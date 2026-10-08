import "dotenv/config";
import { db } from "./index";
import {
  schools,
  chartOfAccounts,
  bankAccounts,
  incomeHeads,
  expenseHeads,
  incomeVouchers,
  expenseVouchers,
  accountLedgerTransactions,
} from "./schema";
import { eq, and, sql, or } from "drizzle-orm";

const SYSTEM_ACCOUNTS = [
  { code: "1000", name: "Cash-in-Hand (Main Vault)", type: "ASSET" as const, isSystem: true },
  { code: "1200", name: "Student Receivable", type: "ASSET" as const, isSystem: true },
  { code: "2100", name: "Caution Deposit & Refund Liability", type: "LIABILITY" as const, isSystem: true },
  { code: "3000", name: "Opening Balance Equity", type: "EQUITY" as const, isSystem: true },
  { code: "4000", name: "Fee Revenue Clearing", type: "REVENUE" as const, isSystem: true },
  { code: "5200", name: "Gateway & Payment Processing Fees", type: "EXPENSE" as const, isSystem: true },
];

async function seedChartOfAccounts() {
  console.log("Starting Chart of Accounts Seeding & Backfill...");

  const allSchools = await db.query.schools.findMany();
  console.log(`Found ${allSchools.length} schools to configure.`);

  for (const school of allSchools) {
    const schoolId = school.id;
    console.log(`\nProcessing School: ${school.name} (${schoolId})`);

    // 1. Ensure System Accounts
    for (const sys of SYSTEM_ACCOUNTS) {
      const existing = await db.query.chartOfAccounts.findFirst({
        where: and(
          eq(chartOfAccounts.schoolId, schoolId),
          eq(chartOfAccounts.code, sys.code),
        ),
      });

      if (!existing) {
        await db.insert(chartOfAccounts).values({
          schoolId,
          code: sys.code,
          name: sys.name,
          type: sys.type,
          isSystem: true,
          isActive: true,
        });
        console.log(`  + Seeded System Account: [${sys.code}] ${sys.name}`);
      }
    }

    // 2. Mirror Bank Accounts
    const banks = await db.query.bankAccounts.findMany({
      where: eq(bankAccounts.schoolId, schoolId),
    });

    for (const b of banks) {
      const code = `1010-${b.id.slice(0, 8).toUpperCase()}`;
      const name = `Bank - ${b.bankName} (${b.accountNumber.slice(-4)})`;
      const existing = await db.query.chartOfAccounts.findFirst({
        where: and(
          eq(chartOfAccounts.schoolId, schoolId),
          eq(chartOfAccounts.code, code),
        ),
      });
      if (!existing) {
        await db.insert(chartOfAccounts).values({
          schoolId,
          code,
          name,
          type: "ASSET",
          parentCode: "1000",
          isSystem: false,
          isActive: b.isActive,
        });
        console.log(`  + Mirrored Bank Account: [${code}] ${name}`);
      }
    }

    // 3. Mirror Income Heads
    const incomes = await db.query.incomeHeads.findMany({
      where: eq(incomeHeads.schoolId, schoolId),
    });

    for (const ih of incomes) {
      const code = `4010-${ih.id.slice(0, 8).toUpperCase()}`;
      const name = `Income - ${ih.name}`;
      const existing = await db.query.chartOfAccounts.findFirst({
        where: and(
          eq(chartOfAccounts.schoolId, schoolId),
          eq(chartOfAccounts.code, code),
        ),
      });
      if (!existing) {
        await db.insert(chartOfAccounts).values({
          schoolId,
          code,
          name,
          type: "REVENUE",
          parentCode: "4000",
          isSystem: false,
          isActive: ih.isActive,
        });
        console.log(`  + Mirrored Income Head: [${code}] ${name}`);
      }
    }

    // 4. Mirror Expense Heads
    const expenses = await db.query.expenseHeads.findMany({
      where: eq(expenseHeads.schoolId, schoolId),
    });

    for (const eh of expenses) {
      const code = `5010-${eh.id.slice(0, 8).toUpperCase()}`;
      const name = `Expense - ${eh.name}`;
      const existing = await db.query.chartOfAccounts.findFirst({
        where: and(
          eq(chartOfAccounts.schoolId, schoolId),
          eq(chartOfAccounts.code, code),
        ),
      });
      if (!existing) {
        await db.insert(chartOfAccounts).values({
          schoolId,
          code,
          name,
          type: "EXPENSE",
          isSystem: false,
          isActive: eh.isActive,
        });
        console.log(`  + Mirrored Expense Head: [${code}] ${name}`);
      }
    }

    // 5. Backfill Legacy account_ledger_transactions
    const allAccounts = await db.query.chartOfAccounts.findMany({
      where: eq(chartOfAccounts.schoolId, schoolId),
    });

    const getAccountId = (code: string) => allAccounts.find((a) => a.code === code)?.id || null;
    const cashMainId = getAccountId("1000");
    const studentReceivableId = getAccountId("1200");
    const cautionDepositId = getAccountId("2100");
    const openingBalanceEquityId = getAccountId("3000");
    const feeRevenueClearingId = getAccountId("4000");
    const gatewayFeesExpenseId = getAccountId("5200");

    const pendingTx = await db.query.accountLedgerTransactions.findMany({
      where: and(
        eq(accountLedgerTransactions.schoolId, schoolId),
        or(
          sql`${accountLedgerTransactions.debitAccountId} IS NULL`,
          sql`${accountLedgerTransactions.creditAccountId} IS NULL`,
        ),
      ),
    });

    console.log(`  Found ${pendingTx.length} ledger transactions requiring backfill.`);
    let backfilledCount = 0;

    for (const txRow of pendingTx) {
      let bankCashChartId = cashMainId;
      if (txRow.bankAccountId) {
        const bankCode = `1010-${txRow.bankAccountId.slice(0, 8).toUpperCase()}`;
        bankCashChartId = getAccountId(bankCode) || cashMainId;
      }

      let debitId: string | null = null;
      let creditId: string | null = null;

      switch (txRow.sourceType) {
        case "FEE_COLLECTION": {
          if (txRow.transactionType === "DEBIT") {
            debitId = cautionDepositId;
            creditId = bankCashChartId;
          } else {
            debitId = bankCashChartId;
            creditId = studentReceivableId;
          }
          break;
        }
        case "INCOME_VOUCHER": {
          debitId = bankCashChartId;
          if (txRow.sourceId) {
            const v = await db.query.incomeVouchers.findFirst({
              where: and(
                eq(incomeVouchers.schoolId, schoolId),
                eq(incomeVouchers.id, txRow.sourceId),
              ),
            });
            if (v?.incomeHeadId) {
              const code = `4010-${v.incomeHeadId.slice(0, 8).toUpperCase()}`;
              creditId = getAccountId(code) || feeRevenueClearingId;
            } else {
              creditId = feeRevenueClearingId;
            }
          } else {
            creditId = feeRevenueClearingId;
          }
          break;
        }
        case "EXPENSE_VOUCHER": {
          creditId = bankCashChartId;
          if (txRow.sourceId) {
            const v = await db.query.expenseVouchers.findFirst({
              where: and(
                eq(expenseVouchers.schoolId, schoolId),
                eq(expenseVouchers.id, txRow.sourceId),
              ),
            });
            if (v?.expenseHeadId) {
              const code = `5010-${v.expenseHeadId.slice(0, 8).toUpperCase()}`;
              debitId = getAccountId(code) || gatewayFeesExpenseId;
            } else {
              debitId = gatewayFeesExpenseId;
            }
          } else {
            debitId = gatewayFeesExpenseId;
          }
          break;
        }
        case "OPENING_BALANCE": {
          debitId = bankCashChartId;
          creditId = openingBalanceEquityId;
          break;
        }
        case "MANUAL_ADJUSTMENT": {
          if (txRow.transactionType === "DEBIT") {
            debitId = studentReceivableId;
            creditId = bankCashChartId;
          } else {
            debitId = bankCashChartId;
            creditId = studentReceivableId;
          }
          break;
        }
        default: {
          if (txRow.transactionType === "CREDIT") {
            debitId = bankCashChartId;
            creditId = feeRevenueClearingId;
          } else {
            debitId = feeRevenueClearingId;
            creditId = bankCashChartId;
          }
          break;
        }
      }

      if (debitId && creditId) {
        await db
          .update(accountLedgerTransactions)
          .set({
            debitAccountId: debitId,
            creditAccountId: creditId,
          })
          .where(eq(accountLedgerTransactions.id, txRow.id));
        backfilledCount++;
      }
    }

    console.log(`  ✓ Successfully backfilled ${backfilledCount} transactions for ${school.name}.`);
  }

  console.log("\nChart of Accounts Seeding & Backfill complete.");
  process.exit(0);
}

seedChartOfAccounts().catch((err) => {
  console.error("Failed to seed Chart of Accounts:", err);
  process.exit(1);
});
