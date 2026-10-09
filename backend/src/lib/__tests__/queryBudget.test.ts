import { describe, it, expect } from "vitest";
import {
  normalizeSql,
  withQueryBudget,
  assertQueryBudget,
  budgetQueryLogger,
  QueryBudgetExceededError,
  NPlusOneQueryError,
} from "@schoolmitra/database";

describe("Database Query Budget & N+1 Enforcement (PF 1.2 & PF-R11)", () => {
  describe("SQL Normalization", () => {
    it("normalizes parameters, literals, and whitespace into structural query templates", () => {
      const rawSql = `
        SELECT * FROM students 
        WHERE school_id = '018f2b74-1234-7000-8000-000000000001' 
          AND class_id = 'cls-999' 
          AND roll_no = 42 
          AND is_active = $1;
      `;
      const normalized = normalizeSql(rawSql);
      expect(normalized).toBe(
        "select * from students where school_id = ? and class_id = ? and roll_no = ? and is_active = ?;"
      );
    });

    it("treats queries differing only by parameter values as the same structural query", () => {
      const q1 = "SELECT name FROM schools WHERE id = '018f2b74-1234-7000-8000-000000000001'";
      const q2 = "SELECT name FROM schools WHERE id = '018f2b74-5678-7000-8000-000000000002'";
      expect(normalizeSql(q1)).toBe(normalizeSql(q2));
    });
  });

  describe("Query Budget Scope Execution", () => {
    it("tracks query count and records executed queries accurately", async () => {
      const { result, queryCount, queries, violations } = await withQueryBudget(
        async () => {
          budgetQueryLogger.logQuery("SELECT 1", []);
          budgetQueryLogger.logQuery("SELECT * FROM schools WHERE id = $1", ["sch-1"]);
          return "ok";
        },
        { maxQueries: 10, label: "Test Track" }
      );

      expect(result).toBe("ok");
      expect(queryCount).toBe(2);
      expect(queries).toHaveLength(2);
      expect(violations).toHaveLength(0);
    });

    it("assertQueryBudget succeeds when queries are within budget limit (<= 10)", async () => {
      const res = await assertQueryBudget(
        async () => {
          for (let i = 0; i < 5; i++) {
            budgetQueryLogger.logQuery(`SELECT * FROM table_${i}`, []);
          }
          return 42;
        },
        { maxQueries: 10, label: "Valid Operation" }
      );

      expect(res).toBe(42);
    });

    it("assertQueryBudget throws QueryBudgetExceededError when queries exceed budget limit", async () => {
      await expect(
        assertQueryBudget(
          async () => {
            for (let i = 0; i < 12; i++) {
              budgetQueryLogger.logQuery(`SELECT * FROM items WHERE id = ${i}`, []);
            }
          },
          { maxQueries: 10, label: "Over-budget route" }
        )
      ).rejects.toThrow(QueryBudgetExceededError);
    });

    it("assertQueryBudget throws NPlusOneQueryError when identical query is executed >= 3 times", async () => {
      await expect(
        assertQueryBudget(
          async () => {
            // Simulated N+1 pattern: fetching student rows one-by-one in a loop
            const studentIds = ["s1", "s2", "s3", "s4"];
            for (const id of studentIds) {
              budgetQueryLogger.logQuery(
                `SELECT * FROM students WHERE id = '${id}' AND school_id = 'sch_01'`,
                []
              );
            }
          },
          { maxQueries: 10, disallowNPlusOne: true, nPlusOneThreshold: 3, label: "Student Loop" }
        )
      ).rejects.toThrow(NPlusOneQueryError);
    });

    it("allows queries when disallowNPlusOne is false", async () => {
      const res = await assertQueryBudget(
        async () => {
          for (let i = 0; i < 4; i++) {
            budgetQueryLogger.logQuery(`SELECT * FROM users WHERE id = '${i}'`, []);
          }
          return "allowed";
        },
        { maxQueries: 10, disallowNPlusOne: false }
      );

      expect(res).toBe("allowed");
    });
  });
});
