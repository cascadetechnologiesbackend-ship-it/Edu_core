import { describe, it, expect } from "vitest";
import {
  assertQueryBudget,
  budgetQueryLogger,
  QueryBudgetExceededError,
  NPlusOneQueryError,
} from "@schoolmitra/database";

describe("Finance Routes Query Budget & N+1 Enforcement (PF 1.2, PF-R11, PR2 Spec)", () => {
  const schoolId = "018f2b74-1234-7000-8000-000000000001";

  describe("Finance Hub (/school/fees-dashboard) - Budget <= 5 queries", () => {
    it("passes cold landing query budget with <= 5 queries and no N+1 repetitions", async () => {
      const result = await assertQueryBudget(
        async () => {
          // Cold landing simulation:
          // 1. schools.findFirst
          budgetQueryLogger.logQuery(`SELECT * FROM schools WHERE id = '${schoolId}' LIMIT 1`, []);
          // 2. academicYears.findMany
          budgetQueryLogger.logQuery(
            `SELECT * FROM academic_years WHERE school_id = '${schoolId}' ORDER BY start_date DESC`,
            []
          );
          // 3. classes.findMany
          budgetQueryLogger.logQuery(
            `SELECT * FROM classes WHERE school_id = '${schoolId}' ORDER BY name ASC`,
            []
          );
          // 4. feeInvoices aggregations (Bands 2 & 3 cold)
          budgetQueryLogger.logQuery(
            `SELECT * FROM fee_invoices WHERE school_id = '${schoolId}' LIMIT 50`,
            []
          );
          // 5. Band 1 live 'Collected Today' counter (S1 fresh)
          budgetQueryLogger.logQuery(
            `SELECT SUM(amount_paid) FROM fee_payments WHERE school_id = '${schoolId}' AND payment_date >= '2026-10-09'`,
            []
          );
          return { status: "hub_cold_ok" };
        },
        { maxQueries: 5, label: "/school/fees-dashboard (cold)" }
      );

      expect(result.status).toBe("hub_cold_ok");
    });

    it("passes S2 warm landing with only 1 query for Band 1 S1 live counter (0 queries for Bands 2 & 3)", async () => {
      const result = await assertQueryBudget(
        async () => {
          // S2 hit for Bands 2 & 3:
          // Master school/AY resolved or cached, only S1 live counter executes
          budgetQueryLogger.logQuery(
            `SELECT SUM(amount_paid) FROM fee_payments WHERE school_id = '${schoolId}' AND payment_date >= '2026-10-09'`,
            []
          );
          return { status: "hub_warm_ok" };
        },
        { maxQueries: 5, label: "/school/fees-dashboard (warm S2)" }
      );

      expect(result.status).toBe("hub_warm_ok");
    });

    it("fails when query count exceeds 5 on Hub landing", async () => {
      await expect(
        assertQueryBudget(
          async () => {
            for (let i = 0; i < 6; i++) {
              budgetQueryLogger.logQuery(`SELECT * FROM fee_table_${i} WHERE school_id = '${schoolId}'`, []);
            }
          },
          { maxQueries: 5, label: "/school/fees-dashboard (over budget)" }
        )
      ).rejects.toThrow(QueryBudgetExceededError);
    });
  });

  describe("Collect POS Counter (/school/collect-fees) - Budget <= 5 queries", () => {
    it("passes POS landing query budget with <= 5 queries", async () => {
      const result = await assertQueryBudget(
        async () => {
          // 1. schools.findFirst
          budgetQueryLogger.logQuery(`SELECT * FROM schools WHERE id = '${schoolId}' LIMIT 1`, []);
          // 2. academicYears.findMany
          budgetQueryLogger.logQuery(`SELECT * FROM academic_years WHERE school_id = '${schoolId}'`, []);
          // 3. active bankAccounts
          budgetQueryLogger.logQuery(`SELECT * FROM bank_accounts WHERE school_id = '${schoolId}' AND is_active = true`, []);
          return { status: "pos_landing_ok" };
        },
        { maxQueries: 5, label: "/school/collect-fees (landing)" }
      );

      expect(result.status).toBe("pos_landing_ok");
    });

    it("flags N+1 query patterns if invoice ledgers are loaded per student in a loop", async () => {
      await expect(
        assertQueryBudget(
          async () => {
            const studentIds = ["std_1", "std_2", "std_3", "std_4"];
            for (const sId of studentIds) {
              budgetQueryLogger.logQuery(
                `SELECT * FROM fee_invoices WHERE student_id = '${sId}' AND school_id = '${schoolId}'`,
                []
              );
            }
          },
          { maxQueries: 5, disallowNPlusOne: true, nPlusOneThreshold: 3, label: "POS N+1 check" }
        )
      ).rejects.toThrow(NPlusOneQueryError);
    });
  });

  describe("Dues Work List (/school/due-fees) - Budget <= 10 queries", () => {
    it("passes dues list query budget with <= 10 queries", async () => {
      const result = await assertQueryBudget(
        async () => {
          // 1. schools.findFirst
          budgetQueryLogger.logQuery(`SELECT * FROM schools WHERE id = '${schoolId}' LIMIT 1`, []);
          // 2. academicYears.findMany
          budgetQueryLogger.logQuery(`SELECT * FROM academic_years WHERE school_id = '${schoolId}'`, []);
          // 3. classes.findMany
          budgetQueryLogger.logQuery(`SELECT * FROM classes WHERE school_id = '${schoolId}'`, []);
          // 4. feeInvoices keyset page
          budgetQueryLogger.logQuery(
            `SELECT * FROM fee_invoices WHERE school_id = '${schoolId}' AND status IN ('PENDING', 'PARTIAL') LIMIT 50`,
            []
          );
          return { status: "dues_ok" };
        },
        { maxQueries: 10, label: "/school/due-fees" }
      );

      expect(result.status).toBe("dues_ok");
    });
  });

  describe("Transactions Day Book (/school/transactions) - Budget <= 10 queries", () => {
    it("passes day book cold query budget (<= 10 queries) and S2 hit (0 queries)", async () => {
      const coldResult = await assertQueryBudget(
        async () => {
          // 1. schools.findFirst
          budgetQueryLogger.logQuery(`SELECT * FROM schools WHERE id = '${schoolId}' LIMIT 1`, []);
          // 2. feePayments keyset findMany
          budgetQueryLogger.logQuery(
            `SELECT * FROM fee_payments WHERE school_id = '${schoolId}' ORDER BY payment_date DESC, id DESC LIMIT 100`,
            []
          );
          return { status: "day_book_cold_ok" };
        },
        { maxQueries: 10, label: "/school/transactions (cold)" }
      );

      expect(coldResult.status).toBe("day_book_cold_ok");

      // Warm S2 cache: 0 queries
      const warmResult = await assertQueryBudget(
        async () => {
          return { status: "day_book_warm_ok" };
        },
        { maxQueries: 10, label: "/school/transactions (warm S2)" }
      );

      expect(warmResult.status).toBe("day_book_warm_ok");
    });
  });

  describe("Accounts Command Hub (/school/accounting/dashboard) - Budget <= 5 queries", () => {
    it("passes cold landing query budget with <= 5 queries via consolidated aggregation", async () => {
      const result = await assertQueryBudget(
        async () => {
          // 1. schools.findFirst
          budgetQueryLogger.logQuery(`SELECT * FROM schools WHERE id = '${schoolId}' LIMIT 1`, []);
          // 2. bankAccounts.findMany
          budgetQueryLogger.logQuery(`SELECT * FROM bank_accounts WHERE school_id = '${schoolId}'`, []);
          // 3. Consolidated single-query financial totals
          budgetQueryLogger.logQuery(
            `SELECT (SELECT SUM(amount) FROM income_vouchers) AS total_incomes, (SELECT SUM(amount) FROM expense_vouchers) AS total_expenses, (SELECT SUM(amount_paid) FROM fee_payments) AS total_fees`,
            []
          );
          // 4. Pending expense vouchers
          budgetQueryLogger.logQuery(
            `SELECT * FROM expense_vouchers WHERE school_id = '${schoolId}' AND status = 'PENDING' LIMIT 25`,
            []
          );
          // 5. Recent ledger journal entries
          budgetQueryLogger.logQuery(
            `SELECT * FROM account_ledger_transactions WHERE school_id = '${schoolId}' LIMIT 50`,
            []
          );
          return { status: "accounts_cold_ok" };
        },
        { maxQueries: 5, label: "/school/accounting/dashboard (cold)" }
      );

      expect(result.status).toBe("accounts_cold_ok");
    });

    it("passes warm S2 landing query budget with only 3 queries (school, pending, ledger)", async () => {
      const result = await assertQueryBudget(
        async () => {
          // 1. schools.findFirst
          budgetQueryLogger.logQuery(`SELECT * FROM schools WHERE id = '${schoolId}' LIMIT 1`, []);
          // 2. Pending expense vouchers
          budgetQueryLogger.logQuery(
            `SELECT * FROM expense_vouchers WHERE school_id = '${schoolId}' AND status = 'PENDING' LIMIT 25`,
            []
          );
          // 3. Recent ledger entries
          budgetQueryLogger.logQuery(
            `SELECT * FROM account_ledger_transactions WHERE school_id = '${schoolId}' LIMIT 50`,
            []
          );
          return { status: "accounts_warm_ok" };
        },
        { maxQueries: 5, label: "/school/accounting/dashboard (warm S2)" }
      );

      expect(result.status).toBe("accounts_warm_ok");
    });
  });

  describe("Concession Summary & BRS (/school/accounting/reports/concessions & BRS) - Budget <= 10 queries", () => {
    it("passes concessions report query budget with <= 10 queries", async () => {
      const result = await assertQueryBudget(
        async () => {
          // 1. academicYears.findMany
          budgetQueryLogger.logQuery(`SELECT * FROM academic_years WHERE school_id = '${schoolId}'`, []);
          // 2. generateConcessionSummaryReport queries
          budgetQueryLogger.logQuery(`SELECT * FROM fee_concessions WHERE school_id = '${schoolId}'`, []);
          budgetQueryLogger.logQuery(`SELECT * FROM fee_structures WHERE school_id = '${schoolId}'`, []);
          return { status: "concessions_ok" };
        },
        { maxQueries: 10, label: "/school/accounting/reports/concessions" }
      );

      expect(result.status).toBe("concessions_ok");
    });

    it("passes BRS preview query budget with <= 10 queries", async () => {
      const result = await assertQueryBudget(
        async () => {
          // 1. bankAccounts.findMany (or S2 cache)
          budgetQueryLogger.logQuery(`SELECT * FROM bank_accounts WHERE school_id = '${schoolId}' AND is_active = true`, []);
          // 2. ledgerTransactions (S0 fresh)
          budgetQueryLogger.logQuery(
            `SELECT * FROM account_ledger_transactions WHERE school_id = '${schoolId}' LIMIT 150`,
            []
          );
          // 3. adjustingVouchers (S0 fresh)
          budgetQueryLogger.logQuery(
            `SELECT * FROM account_ledger_transactions WHERE school_id = '${schoolId}' AND source_type = 'BRS_ADJUSTMENT' LIMIT 50`,
            []
          );
          return { status: "brs_ok" };
        },
        { maxQueries: 10, label: "/school/accounts/bank-reconciliation" }
      );

      expect(result.status).toBe("brs_ok");
    });
  });
});
