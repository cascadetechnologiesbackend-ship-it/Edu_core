#!/usr/bin/env node
/**
 * S9 Board-Wise Examination Blueprint Backfill CLI
 * 
 * Usage:
 *   pnpm exec tsx scripts/backfill-exam-blueprints.mjs --dry-run
 *   pnpm exec tsx scripts/backfill-exam-blueprints.mjs --school-id <uuid>
 *   pnpm exec tsx scripts/backfill-exam-blueprints.mjs --all
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reqDb = createRequire(path.join(__dirname, "../database/package.json"));
const { Pool } = reqDb("pg");
const { drizzle } = reqDb("drizzle-orm/node-postgres");
const { eq, and, isNull } = reqDb("drizzle-orm");

const schema = await import("../database/src/schema/index.ts");
const { schools, classes, auditLogs } = schema;

const {
  deriveClassGroupsFromClasses,
  blueprintSummary,
} = await import("../backend/src/lib/examBoardBlueprints.ts");

const { seedExamBoardDefaults } = await import("../backend/src/lib/examSeeding.ts");

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://schoolmitra:schoolmitra_dev@127.0.0.1:5444/schoolmitra_erp",
});
const db = drizzle(pool, { schema });

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes("--dry-run");
  const isAll = args.includes("--all");
  const schoolIdIdx = args.indexOf("--school-id");
  const targetSchoolId = schoolIdIdx !== -1 ? args[schoolIdIdx + 1] : null;

  console.log("================================================================================");
  console.log("   S9 BOARD-WISE EXAMINATION BLUEPRINT BACKFILL ENGINE   ");
  console.log(`   Mode: ${isDryRun ? "DRY-RUN (Scan & Preview only)" : "LIVE EXECUTION"}`);
  console.log("================================================================================\n");

  if (!isDryRun && !isAll && !targetSchoolId) {
    console.error("❌ Error: Specify either --dry-run, --all, or --school-id <uuid>");
    await pool.end();
    process.exit(1);
  }

  try {
    // 1. Fetch matching schools
    const queryConditions = [eq(schools.isActive, true), isNull(schools.deletedAt)];
    if (targetSchoolId) {
      queryConditions.push(eq(schools.id, targetSchoolId));
    }

    const activeSchools = await db.query.schools.findMany({
      where: and(...queryConditions),
      orderBy: (t, { asc }) => [asc(t.name)],
    });

    if (activeSchools.length === 0) {
      console.log("⚠️ No active schools found matching criteria.");
      await pool.end();
      process.exit(0);
    }

    console.log(`Found ${activeSchools.length} target school(s) for examination blueprint evaluation.\n`);

    let totalSchoolsProcessed = 0;
    let totalExamTypesSeeded = 0;
    let totalGradeRulesSeeded = 0;
    let totalCocurricularSeeded = 0;

    for (const school of activeSchools) {
      console.log(`--------------------------------------------------------------------------------`);
      console.log(`🏫 School: ${school.name} (${school.id})`);
      console.log(`   Affiliation Board: ${school.board}`);

      // Fetch school classes
      const schoolClasses = await db.query.classes.findMany({
        where: and(eq(classes.schoolId, school.id), isNull(classes.deletedAt)),
        orderBy: (t, { asc }) => [asc(t.sortOrder)],
      });

      const activeGroups = deriveClassGroupsFromClasses(schoolClasses);
      console.log(`   Classes configured: ${schoolClasses.length} (Groups: ${activeGroups.join(", ")})`);

      const summary = blueprintSummary(school.board, undefined, activeGroups);

      if (isDryRun) {
        console.log(`   [DRY-RUN PREVIEW] Blueprint Footprint:`);
        console.log(`     - Exam Types: ${summary.examTypeCount} defined in blueprint`);
        console.log(`     - Cocurricular Areas: ${summary.cocurricularCount} defined in blueprint`);
        const totalRules = Object.values(summary.gradeRuleCountsByGroup).reduce((a, b) => a + b, 0);
        console.log(`     - Grade Rules: ${totalRules} across active class groups`);
        console.log(`     - Term Shells Prepared: ${summary.termPlanNames.join(", ")}`);
        totalSchoolsProcessed++;
        continue;
      }

      // Live backfill execution
      const seedResult = await seedExamBoardDefaults(
        school.id,
        school.board,
        undefined,
        db,
        { activeClassGroups: activeGroups },
      );

      // Record immutable audit log entry (Amendment 11)
      await db.insert(auditLogs).values({
        userId: "00000000-0000-0000-0000-000000000001", // Platform Migration System Actor
        userEmail: "system.migration@schoolmitra.internal",
        userRole: "SUPER_ADMIN",
        schoolId: school.id,
        action: "WRITE",
        tableName: "examinations",
        recordId: school.id,
        purposeId: "exam_setup",
        ipAddress: "127.0.0.1",
        userAgent: "CLI/backfill-exam-blueprints",
        metadata: {
          action: "CLI_BACKFILL",
          board: school.board,
          examTypesInserted: seedResult.insertedExamTypes,
          gradeRulesInserted: seedResult.insertedGradeRules,
          cocurricularInserted: seedResult.insertedCocurricular,
          skipped: seedResult.skipped,
        },
      });

      console.log(`   ✅ Seeded Successfully:`);
      console.log(`     - Exam Types: ${seedResult.insertedExamTypes} inserted`);
      console.log(`     - Grade Rules: ${seedResult.insertedGradeRules} inserted`);
      console.log(`     - Cocurricular Areas: ${seedResult.insertedCocurricular} inserted`);
      console.log(`     - Skipped (already existed): ${seedResult.skipped}`);

      totalSchoolsProcessed++;
      totalExamTypesSeeded += seedResult.insertedExamTypes;
      totalGradeRulesSeeded += seedResult.insertedGradeRules;
      totalCocurricularSeeded += seedResult.insertedCocurricular;
    }

    console.log("\n================================================================================");
    console.log(`✅ BACKFILL ${isDryRun ? "SCAN COMPLETE" : "EXECUTION SUCCESSFUL"}`);
    console.log(`   Schools evaluated: ${totalSchoolsProcessed}`);
    if (!isDryRun) {
      console.log(`   Total Exam Types Inserted: ${totalExamTypesSeeded}`);
      console.log(`   Total Grade Rules Inserted: ${totalGradeRulesSeeded}`);
      console.log(`   Total Cocurricular Areas Inserted: ${totalCocurricularSeeded}`);
    }
    console.log("================================================================================\n");
  } finally {
    await pool.end();
  }

  process.exit(0);
}

main().catch(async (err) => {
  console.error("❌ Fatal error during backfill:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
