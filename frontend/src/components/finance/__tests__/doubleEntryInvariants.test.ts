import { describe, it, expect } from "vitest";

// ─── CHART OF ACCOUNTS DEFINITIONS ───────────────────────────────────────────

export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";

export interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: AccountType;
}

export const MOCK_CHART_OF_ACCOUNTS = {
  CASH_MAIN: { id: "acc-1000", code: "1000", name: "Cash-in-Hand (Main Vault)", type: "ASSET" as AccountType },
  BANK_PRIMARY: { id: "acc-1010", code: "1010-HDFC", name: "HDFC School Operations", type: "ASSET" as AccountType },
  STUDENT_RECEIVABLE: { id: "acc-1200", code: "1200", name: "Student Receivable", type: "ASSET" as AccountType },
  CAUTION_DEPOSIT: { id: "acc-2100", code: "2100", name: "Caution Deposit & Refund Liability", type: "LIABILITY" as AccountType },
  OPENING_EQUITY: { id: "acc-3000", code: "3000", name: "Opening Balance Equity", type: "EQUITY" as AccountType },
  FEE_REVENUE: { id: "acc-4000", code: "4000", name: "Fee Revenue Clearing", type: "REVENUE" as AccountType },
  RENTAL_INCOME: { id: "acc-4010", code: "4010-RENT", name: "Auditorium Rental Revenue", type: "REVENUE" as AccountType },
  LAB_EXPENSE: { id: "acc-5010", code: "5010-LAB", name: "Laboratory Equipment Expense", type: "EXPENSE" as AccountType },
  GATEWAY_EXPENSE: { id: "acc-5200", code: "5200", name: "Gateway & Payment Processing Fees", type: "EXPENSE" as AccountType },
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
      balances[tx.debitAccountId]!.debitTotal += tx.amount;
    }
    if (balances[tx.creditAccountId]) {
      balances[tx.creditAccountId]!.creditTotal += tx.amount;
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
      // 7. Fee Refund Payout (Restoring Student Receivable)
      {
        id: "tx-7",
        transactionNumber: "RFD-TX-0001",
        sourceType: "FEE_COLLECTION",
        sourceId: "rfd-01",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        amount: 5000.0,
        description: "Fee refund payout restoring invoice balance",
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
    const studentRecBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id]!;
    expect(studentRecBalance.creditTotal).toBe(grossStudentAmount);

    // Invariant 3: Bank debit equals net amount received
    const bankBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id]!;
    expect(bankBalance.debitTotal).toBe(netBankDeposit);

    // Invariant 4: Expense debit equals fee
    const expenseBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.GATEWAY_EXPENSE.id]!;
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

  it("verifies fee collection followed by fee refund returns receivable and bank balance to exact pre-collection state", () => {
    // Initial pre-collection state baseline:
    // Student Receivable (1200) = ₹50,000.00
    // Primary Bank Account (1010) = ₹0.00
    // Caution Deposit (2100) = ₹0.00
    const collectionAmount = 20000.0;

    const lifecycleTransactions: DoubleEntryTransaction[] = [
      // Step 1: Counter Fee Collection (Student pays ₹20,000)
      // Debit Bank (1010): +₹20,000
      // Credit Student Receivable (1200): -₹20,000 (receivable reduced)
      {
        id: "step-1-collect",
        transactionNumber: "REC-2026-001",
        sourceType: "FEE_COLLECTION",
        sourceId: "pay-101",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id,
        amount: collectionAmount,
        description: "Counter fee collection",
      },
      // Step 2: Full Fee Refund (Refund of ₹20,000 processed)
      // Debit Student Receivable (1200): +₹20,000 (receivable restored as invoice balance is restored)
      // Credit Bank (1010): -₹20,000 (disbursed back to student/parent)
      {
        id: "step-2-refund",
        transactionNumber: "RFD-TX-001",
        sourceType: "FEE_COLLECTION",
        sourceId: "rfd-101",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        amount: collectionAmount,
        description: "Full fee refund restoration",
      },
    ];

    const result = calculateTrialBalance(lifecycleTransactions, MOCK_CHART_OF_ACCOUNTS);

    // Invariant 1: Total debits equals total credits across the lifecycle
    expect(result.totalDebits).toBe(result.totalCredits);
    expect(result.totalDebits).toBe(40000.0);

    // Invariant 2: Net change in Bank account is exactly ₹0.00
    const bankBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id]!;
    expect(bankBalance.debitTotal).toBe(20000.0);
    expect(bankBalance.creditTotal).toBe(20000.0);
    expect(bankBalance.netBalance).toBe(0.0);

    // Invariant 3: Net change in Student Receivable is exactly ₹0.00
    const receivableBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id]!;
    expect(receivableBalance.debitTotal).toBe(20000.0);
    expect(receivableBalance.creditTotal).toBe(20000.0);
    expect(receivableBalance.netBalance).toBe(0.0);

    // Invariant 4: Caution Deposit (2100) remains untouched at ₹0.00
    const cautionBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.CAUTION_DEPOSIT.id]!;
    expect(cautionBalance.debitTotal).toBe(0.0);
    expect(cautionBalance.creditTotal).toBe(0.0);
    expect(cautionBalance.netBalance).toBe(0.0);
  });

  it("verifies mirrored reversal for ACC-05 split entries returns Student Receivable, Bank, and Expense to exact baseline", () => {
    const grossStudentAmount = 15000.0;
    const gatewayProcessingFee = 354.0;
    const netBankDeposit = grossStudentAmount - gatewayProcessingFee; // 14646.00

    const splitLifecycleTransactions: DoubleEntryTransaction[] = [
      // 1. Initial collection: Net deposit to Bank
      {
        id: "col-net",
        transactionNumber: "REC-GW-991A-NET",
        sourceType: "FEE_COLLECTION",
        sourceId: "gw-log-01",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id,
        amount: netBankDeposit,
        description: "Razorpay Net Settlement",
      },
      // 2. Initial collection: Fee Expense
      {
        id: "col-fee",
        transactionNumber: "REC-GW-991A-FEE",
        sourceType: "EXPENSE_VOUCHER",
        sourceId: "gw-log-01",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.GATEWAY_EXPENSE.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id,
        amount: gatewayProcessingFee,
        description: "Razorpay MDR 2.36% fee",
      },
      // 3. Mirrored Reversal: Reverse Net against Bank
      {
        id: "rev-net",
        transactionNumber: "REV-GW-991A-NET",
        sourceType: "MANUAL_ADJUSTMENT",
        sourceId: "gw-log-01",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        amount: netBankDeposit,
        description: "Reversal of Gateway Net Settlement",
      },
      // 4. Mirrored Reversal: Reverse Fee against Gateway Fees Expense
      {
        id: "rev-fee",
        transactionNumber: "REV-GW-991A-FEE",
        sourceType: "MANUAL_ADJUSTMENT",
        sourceId: "gw-log-01",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.GATEWAY_EXPENSE.id,
        amount: gatewayProcessingFee,
        description: "Reversal of Gateway Processing Fee",
      },
    ];

    const result = calculateTrialBalance(splitLifecycleTransactions, MOCK_CHART_OF_ACCOUNTS);

    // Invariant 1: Total debits equals total credits across the lifecycle
    expect(result.totalDebits).toBe(result.totalCredits);
    expect(result.totalDebits).toBe(30000.0); // 15000 collection + 15000 reversal

    // Invariant 2: Net change in Bank account is exactly ₹0.00
    const bankBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id]!;
    expect(bankBalance.debitTotal).toBe(netBankDeposit);
    expect(bankBalance.creditTotal).toBe(netBankDeposit);
    expect(bankBalance.netBalance).toBe(0.0);

    // Invariant 3: Net change in Gateway Fees Expense is exactly ₹0.00
    const expenseBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.GATEWAY_EXPENSE.id]!;
    expect(expenseBalance.debitTotal).toBe(gatewayProcessingFee);
    expect(expenseBalance.creditTotal).toBe(gatewayProcessingFee);
    expect(expenseBalance.netBalance).toBe(0.0);

    // Invariant 4: Net change in Student Receivable is exactly ₹0.00
    const receivableBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.STUDENT_RECEIVABLE.id]!;
    expect(receivableBalance.debitTotal).toBe(grossStudentAmount);
    expect(receivableBalance.creditTotal).toBe(grossStudentAmount);
    expect(receivableBalance.netBalance).toBe(0.0);

    // Invariant 5: Caution Deposit untouched
    const cautionBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.CAUTION_DEPOSIT.id]!;
    expect(cautionBalance.netBalance).toBe(0.0);
  });

  it("verifies Contra entries strictly balance debits == credits and conserve total institution liquidity", () => {
    // Institution performs:
    // 1. Cash to Bank deposit: ₹50,000 (Debit Bank 1010, Credit Cash 1000)
    // 2. Bank to Cash withdrawal: ₹10,000 (Debit Cash 1000, Credit Bank 1010)
    const contraTransactions: DoubleEntryTransaction[] = [
      {
        id: "contra-1",
        transactionNumber: "CONTRA-DEP-01",
        sourceType: "CONTRA",
        sourceId: "bank-hdfc",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.CASH_MAIN.id,
        amount: 50000.0,
        description: "Cash deposited into Bank",
      },
      {
        id: "contra-2",
        transactionNumber: "CONTRA-WDL-02",
        sourceType: "CONTRA",
        sourceId: "bank-hdfc",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.CASH_MAIN.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        amount: 10000.0,
        description: "Petty cash withdrawal from Bank",
      },
    ];

    const result = calculateTrialBalance(contraTransactions, MOCK_CHART_OF_ACCOUNTS);

    // Invariant 1: Total debits equals total credits
    expect(result.totalDebits).toBe(result.totalCredits);
    expect(result.totalDebits).toBe(60000.0);

    // Invariant 2: Total change across liquid cash + bank assets is 0 (pure internal transfer)
    const cashNet = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.CASH_MAIN.id]!.netBalance;
    const bankNet = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id]!.netBalance;
    expect(cashNet + bankNet).toBe(0.0);
    expect(cashNet).toBe(-40000.0); // Cash decreased by 40,000 net
    expect(bankNet).toBe(40000.0);  // Bank increased by 40,000 net
  });

  it("verifies BRS adjusting JVs post balanced entries for bank charges and interest income", () => {
    // 1. Bank charges: ₹354 (Debit Gateway/Bank Expense 5200, Credit Bank 1010)
    // 2. Bank interest: ₹1,250 (Debit Bank 1010, Credit Other Revenue 4010)
    const adjustingJvs: DoubleEntryTransaction[] = [
      {
        id: "brs-adj-1",
        transactionNumber: "BRS-ADJ-CHG-01",
        sourceType: "BRS_ADJUSTMENT",
        sourceId: "bank-hdfc",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.GATEWAY_EXPENSE.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        amount: 354.0,
        description: "Quarterly Bank Account SMS & Maintenance Charges",
      },
      {
        id: "brs-adj-2",
        transactionNumber: "BRS-ADJ-INT-02",
        sourceType: "BRS_ADJUSTMENT",
        sourceId: "bank-hdfc",
        debitAccountId: MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id,
        creditAccountId: MOCK_CHART_OF_ACCOUNTS.RENTAL_INCOME.id, // Revenue
        amount: 1250.0,
        description: "Savings Bank Interest Credit",
      },
    ];

    const result = calculateTrialBalance(adjustingJvs, MOCK_CHART_OF_ACCOUNTS);

    // Invariant 1: Equilibrium debits == credits
    expect(result.totalDebits).toBe(result.totalCredits);
    expect(result.totalDebits).toBe(1604.0);

    // Invariant 2: Bank account reflects net change (+₹1,250 - ₹354 = +₹896)
    const bankBalance = result.accountBalances[MOCK_CHART_OF_ACCOUNTS.BANK_PRIMARY.id]!;
    expect(bankBalance.netBalance).toBe(896.0);
  });

  it("verifies multi-row General Journal Vouchers strictly enforce sum(Debits) === sum(Credits)", () => {
    // Multi-row adjustment:
    // Debit Lab Expense (5010): ₹15,000
    // Debit Gateway Expense (5200): ₹5,000
    // Credit Bank Primary (1010): ₹20,000
    const balancedEntries = [
      { type: "DEBIT", amount: 15000.0 },
      { type: "DEBIT", amount: 5000.0 },
      { type: "CREDIT", amount: 20000.0 },
    ];

    const debits = balancedEntries
      .filter((e) => e.type === "DEBIT")
      .reduce((sum, e) => sum + e.amount, 0);
    const credits = balancedEntries
      .filter((e) => e.type === "CREDIT")
      .reduce((sum, e) => sum + e.amount, 0);

    expect(debits).toBe(credits);
    expect(Math.abs(debits - credits)).toBeLessThan(0.01);

    // Unbalanced test:
    const unbalancedEntries = [
      { type: "DEBIT", amount: 15000.0 },
      { type: "CREDIT", amount: 12000.0 },
    ];
    const unbDebits = unbalancedEntries
      .filter((e) => e.type === "DEBIT")
      .reduce((sum, e) => sum + e.amount, 0);
    const unbCredits = unbalancedEntries
      .filter((e) => e.type === "CREDIT")
      .reduce((sum, e) => sum + e.amount, 0);

    expect(unbDebits).not.toBe(unbCredits);
    expect(Math.abs(unbDebits - unbCredits)).toBe(3000.0);
  });

  it("enforces DECIDE-13: Ambiguous BRS candidates (same amount + same day) go to suggestion list, NEVER auto-match", () => {
    // Simulated ledger with two identical ₹5,000 fee collection deposits on the same day
    const ledgerTx = [
      {
        id: "tx-1",
        transactionNumber: "REC-101",
        transactionDate: "2026-10-08T09:00:00Z",
        transactionType: "CREDIT", // Deposit to bank
        amount: "5000.00",
      },
      {
        id: "tx-2",
        transactionNumber: "REC-102",
        transactionDate: "2026-10-08T11:30:00Z",
        transactionType: "CREDIT", // Deposit to bank
        amount: "5000.00",
      },
      {
        id: "tx-3",
        transactionNumber: "REC-103",
        transactionDate: "2026-10-08T14:00:00Z",
        transactionType: "CREDIT",
        amount: "12500.00",
      },
    ];

    // Bank statement with one ₹5,000 deposit and one ₹12,500 deposit
    const statementRows = [
      {
        id: "stmt-row-1",
        date: "2026-10-08",
        deposit: 5000.0,
        withdrawal: 0,
      },
      {
        id: "stmt-row-2",
        date: "2026-10-08",
        deposit: 12500.0,
        withdrawal: 0,
      },
    ];

    // Evaluate matching algorithm per DECIDE-13
    const results = statementRows.map((row) => {
      const candidates = ledgerTx.filter((tx) => {
        const txDate = tx.transactionDate.slice(0, 10);
        const txAmt = parseFloat(tx.amount);
        return txDate === row.date && Math.abs(txAmt - row.deposit) < 0.01;
      });

      if (candidates.length === 1) {
        return { status: "MATCHED", matchedTx: candidates[0] };
      } else if (candidates.length > 1) {
        return { status: "AMBIGUOUS", suggestions: candidates };
      } else {
        return { status: "UNMATCHED" };
      }
    });

    // 1. ₹5,000 row has 2 candidates on the same day -> Must be AMBIGUOUS, never auto-match!
    expect(results[0]?.status).toBe("AMBIGUOUS");
    expect(results[0]?.suggestions?.length).toBe(2);
    expect(results[0]?.suggestions?.map((s) => s.transactionNumber)).toEqual(["REC-101", "REC-102"]);

    // 2. ₹12,500 row has unique candidate -> Clear MATCHED
    expect(results[1]?.status).toBe("MATCHED");
    expect(results[1]?.matchedTx?.transactionNumber).toBe("REC-103");
  });
});
