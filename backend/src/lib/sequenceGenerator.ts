import { db } from "@/db";
import { schoolCounters, students, admissionApplications } from "@/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { withTenant } from "./tenant";

export interface SequenceOptions {
  year?: number;
}

/**
 * Atomically increments and returns the next monotonic sequence value for a given school and counter key.
 * Enforces fail-closed RLS multi-tenant scoping.
 */
export async function getNextSequenceValue(
  schoolId: string,
  counterKey: string,
  tx?: any,
): Promise<number> {
  const executeFn = async (executor: any) => {
    // Ensure tenant RLS session context is set
    await executor.execute(sql`SELECT set_config('app.current_school_id', ${schoolId}, true)`);

    const result = await executor.execute(sql`
      INSERT INTO "school_counters" (
        "id",
        "school_id",
        "counter_key",
        "last_value",
        "created_at",
        "updated_at"
      )
      VALUES (
        gen_random_uuid(),
        ${schoolId},
        ${counterKey},
        1,
        now(),
        now()
      )
      ON CONFLICT ("school_id", "counter_key")
      DO UPDATE SET
        "last_value" = "school_counters"."last_value" + 1,
        "updated_at" = now()
      RETURNING "last_value";
    `);

    const row = (result.rows || result)[0];
    if (!row || row.last_value === undefined) {
      throw new Error(`Failed to generate sequence for school ${schoolId} and key ${counterKey}`);
    }

    return Number(row.last_value);
  };

  if (tx) {
    return await executeFn(tx);
  }
  return await withTenant(schoolId, executeFn);
}

/**
 * Generates a collision-proof institutional admission number: ADM-YYYY-NNNN.
 * If concurrent execution triggers an index collision, retries up to maxRetries.
 */
export async function generateAdmissionNumber(
  schoolId: string,
  options: SequenceOptions = {},
  tx?: any,
  maxRetries = 5,
): Promise<string> {
  const executeFn = async (executor: any) => {
    await executor.execute(sql`SELECT set_config('app.current_school_id', ${schoolId}, true)`);
    const year = options.year || new Date().getFullYear();
    const counterKey = `admission_${year}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const seq = await getNextSequenceValue(schoolId, counterKey, executor);
      const candidate = `ADM-${year}-${String(seq).padStart(4, "0")}`;

      const existing = await executor.query.students.findFirst({
        where: and(
          eq(students.schoolId, schoolId),
          eq(students.admissionNumber, candidate),
        ),
        columns: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new Error(
      `Failed to generate unique admission number for school ${schoolId} after ${maxRetries} attempts`,
    );
  };

  if (tx) {
    return await executeFn(tx);
  }
  return await withTenant(schoolId, executeFn);
}

/**
 * Generates a collision-proof application number: APP/YYYY/NNNN.
 * If concurrent execution triggers an index collision, retries up to maxRetries.
 */
export async function generateApplicationNumber(
  schoolId: string,
  options: SequenceOptions = {},
  tx?: any,
  maxRetries = 5,
): Promise<string> {
  const executeFn = async (executor: any) => {
    await executor.execute(sql`SELECT set_config('app.current_school_id', ${schoolId}, true)`);
    const year = options.year || new Date().getFullYear();
    const counterKey = `application_${year}`;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const seq = await getNextSequenceValue(schoolId, counterKey, executor);
      const candidate = `APP/${year}/${String(seq).padStart(4, "0")}`;

      const existing = await executor.query.admissionApplications.findFirst({
        where: and(
          eq(admissionApplications.schoolId, schoolId),
          eq(admissionApplications.applicationNumber, candidate),
        ),
        columns: { id: true },
      });

      if (!existing) {
        return candidate;
      }
    }

    throw new Error(
      `Failed to generate unique application number for school ${schoolId} after ${maxRetries} attempts`,
    );
  };

  if (tx) {
    return await executeFn(tx);
  }
  return await withTenant(schoolId, executeFn);
}
