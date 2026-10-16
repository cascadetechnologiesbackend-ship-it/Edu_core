import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool } from "pg";
import {
  getNextSequenceValue,
  generateAdmissionNumber,
  generateApplicationNumber,
} from "../sequenceGenerator";
import { ISOLATION_IDS, seedIsolationSchools } from "../isolationFixtures";
import { db } from "@/db";
import { schoolCounters, students } from "@/db/schema";
import { eq, and } from "drizzle-orm";

const dbUrl =
  process.env.MIGRATION_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

describe("S13 Layer 1: Monotonic Number Sequence Generator & Uniqueness Drill", () => {
  let pool: Pool;
  const schoolA = ISOLATION_IDS.schoolA.id;
  const schoolB = ISOLATION_IDS.schoolB.id;
  const year = 2026;

  beforeAll(async () => {
    pool = new Pool({ connectionString: dbUrl });
    await seedIsolationSchools();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("1.1: getNextSequenceValue atomically increments sequentially starting from 1", async () => {
    const runKey = `test_counter_${Date.now()}`;
    const val1 = await getNextSequenceValue(schoolA, runKey);
    const val2 = await getNextSequenceValue(schoolA, runKey);
    const val3 = await getNextSequenceValue(schoolA, runKey);

    expect(val1).toBe(1);
    expect(val2).toBe(2);
    expect(val3).toBe(3);
  });

  it("1.2: Multi-tenant isolation: School A and School B counters are strictly isolated", async () => {
    const isolatedKey = `tenant_iso_${Date.now()}`;
    const a1 = await getNextSequenceValue(schoolA, isolatedKey);
    const a2 = await getNextSequenceValue(schoolA, isolatedKey);
    const b1 = await getNextSequenceValue(schoolB, isolatedKey);

    expect(a1).toBe(1);
    expect(a2).toBe(2);
    expect(b1).toBe(1); // School B starts at 1, unaffected by School A
  });

  it("1.3: generateAdmissionNumber produces zero-padded ADM-YYYY-NNNN format and is strictly monotonic", async () => {
    const adm1 = await generateAdmissionNumber(schoolA, { year });
    const adm2 = await generateAdmissionNumber(schoolA, { year });

    expect(adm1).toMatch(new RegExp(`^ADM-${year}-\\d{4,}$`));
    expect(adm2).toMatch(new RegExp(`^ADM-${year}-\\d{4,}$`));
    expect(adm1).not.toBe(adm2);

    const num1 = parseInt(adm1.split("-")[2]!, 10);
    const num2 = parseInt(adm2.split("-")[2]!, 10);
    expect(num2).toBe(num1 + 1);
  });

  it("1.4: generateApplicationNumber produces zero-padded APP/YYYY/NNNN format", async () => {
    const app1 = await generateApplicationNumber(schoolA, { year });
    const app2 = await generateApplicationNumber(schoolA, { year });

    expect(app1).toMatch(new RegExp(`^APP/${year}/\\d{4,}$`));
    expect(app2).toMatch(new RegExp(`^APP/${year}/\\d{4,}$`));
    expect(app1).not.toBe(app2);

    const num1 = parseInt(app1.split("/")[2]!, 10);
    const num2 = parseInt(app2.split("/")[2]!, 10);
    expect(num2).toBe(num1 + 1);
  });

  it("1.5: Inversion of F2: 200 sequential calls produce 200 unique numbers with zero collisions", async () => {
    const set = new Set<string>();
    const TOTAL = 200;

    for (let i = 0; i < TOTAL; i++) {
      const num = await generateAdmissionNumber(schoolA, { year });
      expect(set.has(num)).toBe(false);
      set.add(num);
    }

    expect(set.size).toBe(TOTAL);
  });
});
