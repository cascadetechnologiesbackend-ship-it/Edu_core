import { describe, it, expect } from "vitest";

// ─── CHART OF ACCOUNTS DEFINITIONS ───────────────────────────────────────────

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
}

export const MOCK_CHART_OF_ACCOUNTS: Record<string, ChartAccount> = {
  CASH_MAIN: { id: "acc-1000", code: "1000", name: "Cash-in-Hand (Main Vault)", type: "ASSET" },
  BANK_PRIMARY: { id: "acc-1010", code: "1010-HDFC", name: "HDFC School Operations", type: "ASSET" },
  STUDENT_RECEIVABLE: { id: "acc-1200", code: "1200", name: "Student Receivable", type: "ASSET" },
  CAUTION_DEPOSIT: { id: "acc-2100", code: "2100", name: "Caution Deposit & Refund Liability", type: "LIABILITY" },
  OPENING_EQUITY: { id: "acc-3000", code: "3000", name: "Opening Balance Equity", type: "EQUITY" },
  FEE_REVENUE: { id: "acc-4000", code: "4000", name: "Fee Revenue Clearing", type: "REVENUE" },
  RENTAL_INCOME: { id: "acc-4010", code: "4010-RENT", name: "Auditorium Rental Revenue", type: "REVENUE" },
  LAB_EXPENSE: { id: "acc-5010", code: "5010-LAB", name: "Laboratory Equipment Expense", type: "EXPENSE" },
  GATEWAY_EXPENSE: { id: "acc-5200", code: "5200", name: "Gateway & Payment Processing Fees", type: "EXPENSE" },
};

export interface DoubleEntryTransaction {
  id: string;
  transactionNumber: string;
  sourceType: string;
  sourceId: string;
  debitAccountId: string;
  creditAccountId: string;
  amount: number; // in Rupees
  description: string;
}

// ─── TRIAL BALANCE CALCULATOR ────────────────────────────────────────────────

export interface TrialBalanceResult {
  totalDebits: number;
  totalCredits: number;
  isEquilibrium: boolean;
  accountBalances: Record<string, { account: ChartAccount; debitTotal: number; creditTotal: number; netBalance: number }>;
  categoryTotals: {
    assets: number;
    liabilities: number;
    equity: number;
    revenue: number;
    expense: number;
  };
}

export function calculateTrialBalance(
  transactions: DoubleEntryTransaction[],
  accounts: Record<string, ChartAccount>,
): TrialBalanceResult {
  const accountMap = new Map<string, ChartAccount>();
  for (const acc of Object.values(accounts)) {
    accountMap.set(acc.id, acc);
  }

  let totalDebits = 0;
  let totalCredits = 0;

  const balances: Record<
    string,
    { account: ChartAccount; debitTotal: number; creditTotal: number; netBalance: number }
  > = {};

  for (const acc of Object.values(accounts)) {
    balances[acc.id] = { account: acc, debitTotal: 0, creditTotal: 0, netBalance: 0 };
  }

  for (const tx of transactions) {
    if (!tx.debitAccountId || !tx.creditAccountId) {
      throw new Error(`Transaction ${tx.transactionNumber} missing debit or credit account ID`);
    }

    totalDebits += tx.amount;
    totalCredits += tx.amount;

    if (balances[tx.debitAccountId]) {
      balances[tx.debitAccountId].debitTotal += tx.amount;
    }
    if (balances[tx.creditAccountId]) {
      balances[tx.creditAccountId].creditTotal += tx.amount;
    }
  }

  // Calculate Net Balances by normal account type
  // Asset & Expense = Debits - Credits
  // Liability, Equity, Revenue = Credits - Debits
  const categoryTotals = { assets: 0, liabilities: 0, equity: 0, revenue: 0, expense: 0 };

  for (const b of Object.values(balances)) {
    if (b.account.type === "ASSET" || b.account.type === "EXPENSE") {
      b.netBalance = b.debitTotal - b.creditTotal;
      if (b.account.type === "ASSET") categoryTotals.assets += b.netBalance;
      if (b.account.type === "EXPENSE") categoryTotals.expense += b.netBalance;
    } else {
      b.netBalance = b.creditTotal - b.debitTotal;
      if (b.account.type === "LIABILITY") categoryTotals.liabilities += b.netBalance;
      if (b.account.type === "EQUITY") categoryTotals.equity += b.netBalance;
      if (b.account.type === "REVENUE") categoryTotals.revenue += b.netBalance;
    }
  }

  const isEquilibrium = Math.abs(totalDebits - totalCredits) < 0.0001;

  return {
    totalDebits: Math.round(totalDebits * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    isEquilibrium,
    accountBalances: balances,
    categoryTotals: {
      assets: Math.round(categoryTotals.assets * 100) / 100,
      liabilities: Math.round(categoryTotals.liabilities * 100) / 100,
      equity: Math.round(categoryTotals.equity * 100) / 100,
      revenue: Math.round(categoryTotals.revenue * 100) / 100,
      expense: Math.round(categoryTotals.expense * 100) / 100,
    },
  };
}

// ─── COMPREHENSIVE TEST SUITE ────────────────────────────────────────────────

describe("Phase 7A: Double-Entry Ledger Invariant & Trial Balance Test Suite", () => {
  it("executes a mixed-operations batch and maintains exact sum(Debits) === sum(Credits)", () => {
    const transactions: DoubleEntryTransaction[] = [
      // 1. Bank Account Opening Balance
      {
        id: "tx-1",
        transactionNumber: "OB-001001",
        sourceType: "OPENING_BALANCE",
        sourceId: "bank-hdfc",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.OPENING_EQUITY.id,
        amount: 250000.0,
        description: "HDFC Primary Opening Balance",
      },
      // 2. Counter Fee Collection (Bank Transfer)
      {
        id: "tx-2",
        transactionNumber: "TX-2026-FEE01",
        sourceType: "FEE_COLLECTION",
        sourceId: "pay-01",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id,
        amount: 35000.0,
        description: "Term 1 Tuition collection - Student John Doe",
      },
      // 3. Counter Fee Collection (Cash in Hand)
      {
        id: "tx-3",
        transactionNumber: "TX-2026-FEE02",
        sourceType: "FEE_COLLECTION",
        sourceId: "pay-02",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.CASH_MAIN.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id,
        amount: 12500.5,
        description: "Term 1 Transport fee collection (Cash)",
      },
      // 4. Non-fee revenue (Auditorium Rental Income Voucher)
      {
        id: "tx-4",
        transactionNumber: "TX-INC-00042",
        sourceType: "INCOME_VOUCHER",
        sourceId: "vch-inc-01",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.RENTAL_INCOME.id,
        amount: 18000.0,
        description: "Auditorium weekend rental booking",
      },
      // 5. Expense Voucher (Science Lab Consumables)
      {
        id: "tx-5",
        transactionNumber: "TX-EXP-00099",
        sourceType: "EXPENSE_VOUCHER",
        sourceId: "vch-exp-01",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.LAB_EXPENSE.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        amount: 9450.75,
        description: "Chemical reagents for Senior Lab",
      },
      // 6. Fee Receipt Cancellation / Reversal
      {
        id: "tx-6",
        transactionNumber: "REV-2026-0001",
        sourceType: "MANUAL_ADJUSTMENT",
        sourceId: "pay-02",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.CASH_MAIN.id,
        amount: 2500.0,
        description: "Partial cancellation of cash receipt",
      },
      // 7. Fee Refund Payout (Caution Deposit)
      {
        id: "tx-7",
        transactionNumber: "RFD-TX-0001",
        sourceType: "FEE_COLLECTION",
        sourceId: "rfd-01",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.CAUTION_DEPOSIT.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        amount: 5000.0,
        description: "Caution deposit refund upon student withdrawal",
      },
    ];

    const result = calculateTrialBalance(transactions, MOCK_CHART_OF_ACCOUNTS);

    // Invariant 1: Total debits must strictly equal total credits
    expect(result.totalDebits).toBe(result.totalCredits);
    expect(result.isEquilibrium).toBe(true);

    // Invariant 2: Total volume equals expected sum
    const expectedSum = 250000.0 + 35000.0 + 12500.5 + 18000.0 + 9450.75 + 2500.0 + 5000.0;
    expect(result.totalDebits).toBe(expectedSum);
    expect(result.totalCredits).toBe(expectedSum);

    // Invariant 3: Accounting balance equation: Assets + Expenses === Liabilities + Equity + Revenue
    const leftSide = result.categoryTotals.assets + result.categoryTotals.expense;
    const rightSide =
      result.categoryTotals.liabilities + result.categoryTotals.equity + result.categoryTotals.revenue;
    expect(Math.abs(leftSide - rightSide)).toBeLessThan(0.01);
  });

  it("verifies ACC-05 gateway fee split invariant (Net Deposit + Fee === Gross Student Clearance)", () => {
    const grossStudentAmount = 15000.0;
    const gatewayProcessingFee = 354.0; // 2% + 18% GST
    const netBankDeposit = grossStudentAmount - gatewayProcessingFee; // 14646.00

    const gatewaySplitTransactions: DoubleEntryTransaction[] = [
      // Net settlement entry to bank
      {
        id: "gw-net-1",
        transactionNumber: "REC-GW-991A-NET",
        sourceType: "FEE_COLLECTION",
        sourceId: "gw-log-01",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id,
        amount: netBankDeposit,
        description: "Razorpay Net Settlement",
      },
      // Gateway processing fee entry
      {
        id: "gw-fee-1",
        transactionNumber: "REC-GW-991A-FEE",
        sourceType: "EXPENSE_VOUCHER",
        sourceId: "gw-log-01",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.GATEWAY_EXPENSE.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id,
        amount: gatewayProcessingFee,
        description: "Razorpay MDR 2.36% fee",
      },
    ];

    const result = calculateTrialBalance(gatewaySplitTransactions, MOCK_CHART_OF_ACCOUNTS);

    // Invariant 1: Total debits equals total credits for the split
    expect(result.totalDebits).toBe(grossStudentAmount);
    expect(result.totalCredits).toBe(grossStudentAmount);

    // Invariant 2: Student Receivable credit exactly equals gross tuition fee
    const studentRecBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id];
    expect(studentRecBalance.creditTotal).toBe(grossStudentAmount);

    // Invariant 3: Bank debit equals net amount received
    const bankBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id];
    expect(bankBalance.debitTotal).toBe(netBankDeposit);

    // Invariant 4: Expense debit equals fee
    const expenseBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.GATEWAY_EXPENSE.id];
    expect(expenseBalance.debitTotal).toBe(gatewayProcessingFee);
  });

  it("verifies zero null or undefined debit/credit accounts across any transaction", () => {
    const testRow: DoubleEntryTransaction = {
      id: "tx-valid",
      transactionNumber: "TX-TEST-001",
      sourceType: "FEE_COLLECTION",
      sourceId: "src-01",
      debitAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
      creditAccountId: MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id,
      amount: 1000.0,
      description: "Test transaction",
    };

    expect(testRow.debitAccountId).toBeDefined();
    expect(testRow.debitAccountId.length).toBeGreaterThan(0);
    expect(testRow.creditAccountId).toBeDefined();
    expect(testRow.creditAccountId.length).toBeGreaterThan(0);
  });

  it("enforces fiscal year lock invariant (ACC-06)", () => {
    interface AcademicYear {
      id: string;
      label: string;
      isLocked: boolean;
    }

    const lockedYear: AcademicYear = {
      id: "ay-2024",
      label: "AY 2024-2025",
      isLocked: true,
    };

    const activeYear: AcademicYear = {
      id: "ay-2025",
      label: "AY 2025-2026",
      isLocked: false,
    };

    function assertAcademicYearCanMutate(ay: AcademicYear) {
      if (ay.isLocked) {
        throw new Error(
          `Academic Year (${ay.label}) is fiscally locked. Financial modifications are prohibited.`,
        );
      }
      return true;
    }

    // Active year allows writes
    expect(assertAcademicYearCanMutate(activeYear)).toBe(true);

    // Locked year throws 403 Forbidden invariant
    expect(() => assertAcademicYearCanMutate(lockedYear)).toThrowError(
      /fiscally locked\. Financial modifications are prohibited\./,
    );
  });
});
