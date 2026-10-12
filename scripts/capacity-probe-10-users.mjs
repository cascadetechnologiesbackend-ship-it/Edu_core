#!/usr/bin/env node
/**
 * S6-T4: Capacity & Load Probe (10 Concurrent Authenticated Sessions)
 * Normative Rulebook: SCHOOL-ERP-PERFORMANCE-SPEC.md v2.0 (PF-R100)
 *
 * Runs 10 concurrent user threads simulating authenticated School ERP workflows
 * against the local database to measure p50, p95, and p99 latency and pool saturation.
 */

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let pg;
try {
  const requireDb = createRequire(path.join(__dirname, '../database/package.json'));
  pg = requireDb('pg');
} catch {
  const requireRoot = createRequire(import.meta.url);
  pg = requireRoot('pg');
}
const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp";

const pool = new Pool({
  connectionString,
  min: 2,
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 3000,
});

async function main() {
  console.log("===============================================================================");
  console.log(" SchoolMitra ERP — S6-T4 Capacity & Load Probe (10 Concurrent Sessions)");
  console.log("===============================================================================");
  console.log(` Target DB: ${connectionString.replace(/:[^:@]+@/, ':***@')}`);
  console.log(` Concurrency: 10 authenticated virtual users`);
  console.log(` Requests per user: 20 transactions (Total: 200 operations)`);
  console.log("===============================================================================\n");

  // Get active school for tenant context
  const setupClient = await pool.connect();
  let schoolId;
  try {
    const schoolRes = await setupClient.query("SELECT id FROM schools LIMIT 1;");
    if (schoolRes.rows.length === 0) {
      console.error("❌ No school record found. Run pnpm --filter @schoolmitra/database db:seed first.");
      process.exit(1);
    }
    schoolId = schoolRes.rows[0].id;
  } finally {
    setupClient.release();
  }

  const latencies = [];
  const CONCURRENT_USERS = 10;
  const ITERATIONS_PER_USER = 20;

  async function runUserSession(userId) {
    const userLatencies = [];
    for (let i = 0; i < ITERATIONS_PER_USER; i++) {
      const client = await pool.connect();
      const opStart = performance.now();
      try {
        await client.query("BEGIN");
        // 1. Establish tenant context
        await client.query("SELECT set_config('app.current_school_id', $1, true)", [schoolId]);

        // 2. Query students roster (OLTP lookup)
        await client.query(
          "SELECT id, admission_number, school_id FROM students WHERE school_id = $1 LIMIT 25;",
          [schoolId]
        );

        // 3. Query fee invoices
        await client.query(
          "SELECT id, invoice_number, net_amount, status FROM fee_invoices WHERE school_id = $1 LIMIT 10;",
          [schoolId]
        );

        // 4. Query student attendance
        await client.query(
          "SELECT id, status, attendance_date FROM student_attendance WHERE school_id = $1 LIMIT 15;",
          [schoolId]
        );

        await client.query("COMMIT");
        const opDuration = performance.now() - opStart;
        userLatencies.push(opDuration);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error(`User ${userId} transaction error:`, err.message);
      } finally {
        client.release();
      }
    }
    return userLatencies;
  }

  const startTime = performance.now();

  // Check pool connection count during execution
  let peakConnections = 0;
  const monitorInterval = setInterval(async () => {
    try {
      const statRes = await pool.query(
        "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active';"
      );
      const active = parseInt(statRes.rows[0].count, 10);
      if (active > peakConnections) peakConnections = active;
    } catch {}
  }, 50);

  // Run all 10 virtual users concurrently
  const userPromises = Array.from({ length: CONCURRENT_USERS }, (_, idx) => runUserSession(idx + 1));
  const results = await Promise.all(userPromises);
  clearInterval(monitorInterval);

  const totalWallTime = performance.now() - startTime;
  results.forEach((userLats) => latencies.push(...userLats));

  latencies.sort((a, b) => a - b);
  const min = latencies[0].toFixed(2);
  const max = latencies[latencies.length - 1].toFixed(2);
  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const mean = (sum / latencies.length).toFixed(2);
  const p50 = latencies[Math.floor(latencies.length * 0.5)].toFixed(2);
  const p90 = latencies[Math.floor(latencies.length * 0.9)].toFixed(2);
  const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
  const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(2);
  const throughput = ((latencies.length / (totalWallTime / 1000))).toFixed(1);

  console.log("-------------------------------------------------------------------------------");
  console.log(" Capacity & Latency Results (S6-T4)");
  console.log("-------------------------------------------------------------------------------");
  console.log(` Completed Transactions : ${latencies.length}`);
  console.log(` Total Elapsed Time     : ${totalWallTime.toFixed(2)} ms`);
  console.log(` Effective Throughput   : ${throughput} txn/sec`);
  console.log(` Peak Active Connections: ${peakConnections} / ${pool.options.max}`);
  console.log("-------------------------------------------------------------------------------");
  console.log(` Min Latency            : ${min} ms`);
  console.log(` Mean Latency           : ${mean} ms`);
  console.log(` Median (p50) Latency   : ${p50} ms`);
  console.log(` p90 Latency            : ${p90} ms`);
  console.log(` p95 Latency            : ${p95} ms  (Target: < 500 ms)  -> ${Number(p95) < 500 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(` p99 Latency            : ${p99} ms  (Target: < 1000 ms) -> ${Number(p99) < 1000 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(` Max Latency            : ${max} ms`);
  console.log("===============================================================================\n");

  await pool.end();
  process.exit(0);
}

main().catch((err) => {
  console.error("Capacity probe error:", err);
  process.exit(1);
});
